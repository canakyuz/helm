import { type Connector, type MetricPoint } from "./types.ts";

// AdMob — networkReport ile tahmini reklam geliri (son 90 gün).
// AdMob API service account DESTEKLEMEZ → refresh_token ile OAuth2.
// config: { publisher_id, client_id, client_secret, refresh_token, app_id? }
// app_id (opsiyonel): tek bir oyunun gelirini ayirmak icin AdMob UYGULAMA
// KIMLIGI — format "ca-app-pub-XXXXXXXX~YYYYYYYY". iOS bundle id, Android
// package name veya App Store numeric id DEGIL — bunlar AdMob'un APP
// boyutuyla eslesmez. app_id bos birakilirsa yayinci hesabindaki TUM
// uygulamalarin geliri toplanip tek seri olarak yazilir.

const ymd = (d: Date) => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
  day: d.getUTCDate(),
});

async function getAccessToken(config: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`AdMob OAuth ${res.status}: ${await res.text()}`);
  }
  const { access_token } = await res.json();
  return access_token as string;
}

export const fetchAdMob: Connector = async (config) => {
  const accessToken = await getAccessToken(config);

  // Son 90 gün — grafik için geçmiş seri (idempotent upsert tekrarları düzeltir).
  const end = new Date();
  const start = new Date(Date.now() - 90 * 86_400_000);

  const body = {
    reportSpec: {
      dateRange: { startDate: ymd(start), endDate: ymd(end) },
      // APP boyutu olmadan yayinci hesabindaki TUM uygulamalar tek gunluk
      // rakamda toplanir ve hangi oyunun kazandirdigi gorunmez.
      dimensions: ["DATE", "APP"],
      metrics: ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSION_RPM"],
    },
  };

  const res = await fetch(
    `https://admob.googleapis.com/v1/accounts/${config.publisher_id}/networkReport:generate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`AdMob report ${res.status}: ${await res.text()}`);
  }

  // Yanıt bir dizi: { header } / { row } / { footer } elemanları.
  const items: Array<Record<string, unknown>> = await res.json();

  const appFilter = typeof config.app_id === "string" && config.app_id.length > 0
    ? config.app_id
    : null;

  // Gun bazinda toplama: APP boyutu ile ayni tarih icin birden fazla satir
  // doner. Tek tek push edilirse ingest'in upsert'i (project_id,date,source,
  // metric) son satiri yazar ve toplam tek uygulamaya duser — sessiz veri kaybi.
  const daily = new Map<string, { revenue: number; impressions: number }>();

  for (const item of items) {
    const row = item.row as
      | {
          dimensionValues?: Record<string, { value?: string }>;
          metricValues?: Record<
            string,
            { microsValue?: string; integerValue?: string }
          >;
        }
      | undefined;
    if (!row) continue;

    // app_id tanimliysa yalnizca o uygulamanin satirlari sayilir. Tanimli
    // degilse hepsi toplanir — mevcut entegrasyonlar icin davranis degismez.
    if (appFilter) {
      const appId = row.dimensionValues?.APP?.value;
      if (appId !== appFilter) continue;
    }

    const dateRaw = row.dimensionValues?.DATE?.value; // "YYYYMMDD"
    if (!dateRaw || dateRaw.length !== 8) continue;
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

    const mv = row.metricValues ?? {};
    // ESTIMATED_EARNINGS, IMPRESSION_RPM → micros; IMPRESSIONS → integer.
    const revenue = Number(mv.ESTIMATED_EARNINGS?.microsValue ?? 0) / 1_000_000;
    const impressions = Number(mv.IMPRESSIONS?.integerValue ?? 0);

    const acc = daily.get(date) ?? { revenue: 0, impressions: 0 };
    acc.revenue += revenue;
    acc.impressions += impressions;
    daily.set(date, acc);
  }

  // app_id filtresi tanimliysa ve hicbir satir eslesmediyse daily bos kalir;
  // bu durumda sessizce bos points donmek yerine hata firlatilir — aksi
  // halde index.ts rows.length === 0 icin upsert'i atlar ve "ok" durumunu
  // yazar, gelir sessizce donmeyi keser (yanlis bundle id gibi tipik hata).
  // Filtre tanimli degilse (yeni hesap, sifir gelirli pencere) mevcut
  // sessiz-bos davranis korunur.
  if (appFilter && daily.size === 0) {
    throw new Error(
      `AdMob app_id "${appFilter}" hicbir satirla eslesmedi — AdMob uygulama kimligi (ca-app-pub-XXXX~YYYY) bekleniyor, bundle id degil.`,
    );
  }

  const points: MetricPoint[] = [];
  for (const [date, acc] of daily) {
    // eCPM toplanamaz — oranlarin ortalamasi yanlis sonuc verir. Toplanmis
    // gelir ve gosterimden yeniden hesaplanir.
    const ecpm = acc.impressions > 0 ? (acc.revenue / acc.impressions) * 1000 : 0;
    points.push({ date, metric: "ad_revenue", value: acc.revenue });
    points.push({ date, metric: "ad_impressions", value: acc.impressions });
    points.push({ date, metric: "ad_ecpm", value: ecpm });
  }
  return points;
};
