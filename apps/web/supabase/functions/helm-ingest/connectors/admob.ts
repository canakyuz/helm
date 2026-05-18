import { type Connector, type MetricPoint } from "./types.ts";

// AdMob — networkReport ile tahmini reklam geliri (son 3 gün).
// AdMob API service account DESTEKLEMEZ → refresh_token ile OAuth2.
// config: { publisher_id, client_id, client_secret, refresh_token }

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
      dimensions: ["DATE"],
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
  const points: MetricPoint[] = [];

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

    const dateRaw = row.dimensionValues?.DATE?.value; // "YYYYMMDD"
    if (!dateRaw || dateRaw.length !== 8) continue;
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

    const mv = row.metricValues ?? {};
    // ESTIMATED_EARNINGS, IMPRESSION_RPM → micros; IMPRESSIONS → integer.
    const revenue = Number(mv.ESTIMATED_EARNINGS?.microsValue ?? 0) / 1_000_000;
    const impressions = Number(mv.IMPRESSIONS?.integerValue ?? 0);
    const ecpm = Number(mv.IMPRESSION_RPM?.microsValue ?? 0) / 1_000_000;

    points.push({ date, metric: "ad_revenue", value: revenue });
    points.push({ date, metric: "ad_impressions", value: impressions });
    points.push({ date, metric: "ad_ecpm", value: ecpm });
  }
  return points;
};
