import {
  type Connector,
  type CountryMetricPoint,
  type MetricPoint,
  today,
} from "./types.ts";

// PostHog - HogQL query API. Günlük DAU serisi + anlık WAU.
// config: { project_id, api_key, host }

async function hogql(
  host: string,
  projectId: string,
  apiKey: string,
  query: string,
): Promise<unknown[][]> {
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    throw new Error(`PostHog ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return (json.results ?? []) as unknown[][];
}

export const fetchPostHog: Connector = async (config) => {
  const host = (config.host || "https://eu.posthog.com").replace(/\/+$/, "");
  const pid = config.project_id;
  const key = config.api_key;

  // Günlük DAU serisi (90 gün) - grafik için geçmiş veri.
  const dauRows = await hogql(
    host,
    pid,
    key,
    `SELECT toDate(timestamp) AS day, uniq(person_id) AS dau
     FROM events
     WHERE timestamp >= now() - INTERVAL 90 DAY
     GROUP BY day
     ORDER BY day`,
  );

  const points: MetricPoint[] = dauRows.map((r) => ({
    date: String(r[0]).slice(0, 10),
    metric: "dau",
    value: Number(r[1] ?? 0),
  }));

  // Anlık WAU - son 7 günün tekil kullanıcısı.
  const wauRows = await hogql(
    host,
    pid,
    key,
    `SELECT uniq(person_id)
     FROM events
     WHERE timestamp >= now() - INTERVAL 7 DAY`,
  );
  points.push({
    date: today(),
    metric: "wau",
    value: Number(wauRows[0]?.[0] ?? 0),
  });

  // Anlık MAU - son 30 günün tekil kullanıcısı (stickiness = dau/mau türetilir).
  const mauRows = await hogql(
    host,
    pid,
    key,
    `SELECT uniq(person_id)
     FROM events
     WHERE timestamp >= now() - INTERVAL 30 DAY`,
  );
  points.push({
    date: today(),
    metric: "mau",
    value: Number(mauRows[0]?.[0] ?? 0),
  });

  // Ortalama oturum süresi (sn) - son 7 gün, $session_id bazında. Bazı
  // projelerde session property yok → graceful, dau/wau/mau'yu bloklamaz.
  try {
    const sessRows = await hogql(
      host,
      pid,
      key,
      `SELECT avg(dur) FROM (
         SELECT dateDiff('second', min(timestamp), max(timestamp)) AS dur
         FROM events
         WHERE timestamp >= now() - INTERVAL 7 DAY
           AND properties.$session_id IS NOT NULL
         GROUP BY properties.$session_id
         HAVING dur > 0
       )`,
    );
    const avgSec = Number(sessRows[0]?.[0] ?? 0);
    if (avgSec > 0) {
      points.push({ date: today(), metric: "avg_session_sec", value: Math.round(avgSec) });
    }
  } catch {
    // $session_id yoksa oturum süresi atlanır.
  }

  // Ülke kırılımı - son 30 gün DAU. PostHog otomatik geoip_country_code yakalar
  // (kişi properties veya event properties). Boş/null olanları atla.
  const byCountry: CountryMetricPoint[] = [];
  try {
    const countryRows = await hogql(
      host,
      pid,
      key,
      `SELECT
         toDate(timestamp) AS day,
         upper(coalesce(
           nullIf(properties.$geoip_country_code, ''),
           nullIf(person.properties.$geoip_country_code, '')
         )) AS cc,
         uniq(person_id) AS users
       FROM events
       WHERE timestamp >= now() - INTERVAL 30 DAY
         AND cc IS NOT NULL
         AND length(cc) = 2
       GROUP BY day, cc
       ORDER BY day`,
    );
    for (const r of countryRows) {
      const date = String(r[0]).slice(0, 10);
      const cc = String(r[1] ?? "").trim().toUpperCase();
      const value = Number(r[2] ?? 0);
      if (!cc || cc.length !== 2 || value === 0) continue;
      byCountry.push({ date, metric: "dau", country_code: cc, value });
    }
  } catch {
    // PostHog projesinde $geoip_country_code yoksa breakdown atlanır.
  }

  return { points, byCountry };
};
