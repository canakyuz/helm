import { type Connector, type MetricPoint } from "./types.ts";

// Sentry - iki metrik:
//   1) "errors": son 90 gün günlük kabul edilmiş hata olayı sayısı
//      (org-level stats_v2, category=error & outcome=accepted).
//      NOT: legacy /projects/{org}/{proj}/stats/?stat=received kullanılmıyor -
//      200 dönüp 171 gün boyunca sabit 0 ürettiği ölçüldü.
//   2) "crash_free_sessions": son 90 gün günlük crash-free session oranı (0–100),
//      Sessions/Release-Health endpoint'inden. Indie founder için en kritik sağlık
//      sinyali. Projede release-health (session) verisi yoksa veya token scope yetmezse
//      sessizce atlanır - "errors" akışını bozmaz (graceful degradation).
// config: { org_slug, project_slug, auth_token, host? }

const SESSION_FIELD = "crash_free_rate(session)";

/**
 * Slug → numerik project id. Hem sessions hem stats_v2 uc noktasi slug kabul
 * etmiyor, ikisi de bu id'yi istiyor.
 */
async function resolveProjectId(
  host: string,
  config: Record<string, string>,
): Promise<string> {
  const res = await fetch(
    `${host}/api/0/projects/${config.org_slug}/${config.project_slug}/`,
    { headers: { Authorization: `Bearer ${config.auth_token}` } },
  );
  if (!res.ok) {
    throw new Error(`Sentry project ${res.status}: ${await res.text()}`);
  }
  const id = String((await res.json())?.id ?? "");
  if (!id) throw new Error("Could not resolve the Sentry project id");
  return id;
}

/**
 * Crash-free session oranını günlük seri olarak çeker.
 * Org-level sessions endpoint numerik project_id ister (slug kabul etmez), bu yüzden
 * önce slug → numerik id çözülür. Herhangi bir hata → boş dizi (errors korunur).
 *
 * Time: O(d) (d = gün sayısı ~90). Space: O(d). HTTP: 2 çağrı.
 */
async function fetchCrashFree(
  host: string,
  config: Record<string, string>,
): Promise<MetricPoint[]> {
  const auth = { Authorization: `Bearer ${config.auth_token}` };

  // 1) slug → numerik project id
  const projectId = await resolveProjectId(host, config);

  // 2) günlük crash-free session oranı
  const qs = new URLSearchParams({
    field: SESSION_FIELD,
    interval: "1d",
    statsPeriod: "90d",
    project: projectId,
  });
  const sessRes = await fetch(
    `${host}/api/0/organizations/${config.org_slug}/sessions/?${qs}`,
    { headers: auth },
  );
  if (!sessRes.ok) {
    throw new Error(`Sentry sessions ${sessRes.status}: ${await sessRes.text()}`);
  }

  const data = (await sessRes.json()) as {
    intervals?: string[];
    groups?: Array<{ series?: Record<string, Array<number | null>> }>;
  };
  const intervals = data.intervals ?? [];
  const series = data.groups?.[0]?.series?.[SESSION_FIELD] ?? [];

  const points: MetricPoint[] = [];
  for (let i = 0; i < intervals.length; i++) {
    const rate = series[i];
    // null = o gün session yok → "%0 crash-free" demek değil, yazma.
    if (rate == null) continue;
    points.push({
      date: intervals[i].slice(0, 10),
      metric: "crash_free_sessions",
      value: Math.round(rate * 10_000) / 100, // 0..1 → 0..100, 2 ondalık
    });
  }
  return points;
}

export const fetchSentry: Connector = async (config) => {
  const host = (config.host || "https://sentry.io").replace(/\/+$/, "");

  // errors - ana metrik (her zaman çekilir).
  //
  // ESKIDEN: /api/0/projects/{org}/{proj}/stats/?stat=received - Sentry'nin LEGACY
  // uc noktasi. 200 donuyordu ama degeri her gun 0'di: 171 gun boyunca tek bir
  // sifirdan farkli deger uretmedi. Ayni donemde crash_free_sessions %99.53
  // raporluyordu, yani proje canliydi ve veri akiyordu - sorun uygulamada degil,
  // sorulan uc noktadaydi. Sonuc: kullanici App Store'da bug bildirirken panel
  // "0 hata" gosteriyordu.
  //
  // SIMDI: org-level stats_v2. category=error + outcome=accepted, yani Sentry'nin
  // gercekten kabul ettigi hata olaylari. Slug kabul etmedigi icin numerik id sart.
  // outcome FILTRESI YOK, groupBy VAR: "kabul edilen hata sayisi" ile "SDK hic
  // konusuyor mu" ayri sorular. Yalnizca accepted sorulunca ikisi ayrilamiyor ve
  // susmus bir SDK her gun "0 hata" yazip SAGLIKLI okunuyor - Empire Inc'te tam
  // olarak bu oldu: 55 gun boyunca gunluk 0 yazildi, panel yesil gorundu, oysa
  // uygulama Sentry'ye hic ulasmiyordu (DSN baska bir organizasyonu gosteriyor).
  const projectId = await resolveProjectId(host, config);
  const qs = new URLSearchParams({
    field: "sum(quantity)",
    category: "error",
    groupBy: "outcome",
    interval: "1d",
    statsPeriod: "90d",
    project: projectId,
  });
  const res = await fetch(
    `${host}/api/0/organizations/${config.org_slug}/stats_v2/?${qs}`,
    { headers: { Authorization: `Bearer ${config.auth_token}` } },
  );
  if (!res.ok) {
    throw new Error(`Sentry stats_v2 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    intervals?: string[];
    groups?: Array<{
      by?: { outcome?: string };
      series?: Record<string, Array<number | null>>;
    }>;
  };
  const intervals = data.intervals ?? [];

  // Gun basina: kabul edilen hata sayisi, ve TUM outcome'larin toplami.
  // Toplam, "SDK o gun Sentry ile konustu mu" sorusunun cevabi - istemci
  // tarafinda elenen (client_discard) veya kotaya takilan olaylar da sayilir.
  const accepted = new Array<number>(intervals.length).fill(0);
  const anyVolume = new Array<number>(intervals.length).fill(0);
  for (const g of data.groups ?? []) {
    const s = g.series?.["sum(quantity)"] ?? [];
    for (let i = 0; i < intervals.length; i++) {
      const v = Number(s[i] ?? 0);
      anyVolume[i]! += v;
      if (g.by?.outcome === "accepted") accepted[i]! += v;
    }
  }

  const points: MetricPoint[] = [];
  for (let i = 0; i < intervals.length; i++) {
    // HIC olay yoksa YAZMA. Onceki hal 0 yaziyordu ve "olcum gelmiyor" ile
    // "hata yok" ayni goruntuyu uretiyordu. Sifir ancak SDK konustuysa
    // anlamlidir: o zaman gercekten hatasiz bir gun demektir.
    // Ayni kural crash_free_sessions'ta zaten uygulaniyordu (rate == null).
    if (anyVolume[i] === 0) continue;
    points.push({
      date: intervals[i].slice(0, 10),
      metric: "errors",
      value: accepted[i]!,
    });
  }

  // crash_free_sessions - opsiyonel, hata errors'i bloklamaz.
  try {
    points.push(...(await fetchCrashFree(host, config)));
  } catch (e) {
    // SESSIZ YUTMA YOK: bos `catch {}` yuzunden release-health arizasi hicbir
    // yerde gorunmuyordu. Hata hala errors akisini bloklamiyor ama artik
    // senkron loguna dusuyor.
    console.error("[sentry] crash_free_sessions alinamadi:", String(e));
  }

  return points;
};
