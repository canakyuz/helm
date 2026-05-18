import { type Connector, type MetricPoint } from "./types.ts";

// PostHog — HogQL query API ile son 90 günün GÜNLÜK aktif kullanıcısı.
// config: { project_id, api_key, host }
export const fetchPostHog: Connector = async (config) => {
  const host = (config.host || "https://eu.posthog.com").replace(/\/+$/, "");

  // Günlük DAU serisi — grafik için geçmiş veri.
  const query = `
    SELECT toDate(timestamp) AS day, uniq(person_id) AS dau
    FROM events
    WHERE timestamp >= now() - INTERVAL 90 DAY
    GROUP BY day
    ORDER BY day
  `;

  const res = await fetch(
    `${host}/api/projects/${config.project_id}/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    },
  );
  if (!res.ok) {
    throw new Error(`PostHog ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const rows: Array<[string, number]> = json.results ?? [];

  return rows.map(([day, dau]): MetricPoint => ({
    date: String(day).slice(0, 10),
    metric: "dau",
    value: Number(dau),
  }));
};
