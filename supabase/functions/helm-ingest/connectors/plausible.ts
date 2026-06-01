import { type Connector, type MetricPoint } from "./types.ts";

// Plausible — son 90 günün günlük web ziyaretçisi (web projeleri için DAU).
// config: { site_id, api_key, host }

export const fetchPlausible: Connector = async (config) => {
  const host = (config.host || "https://plausible.io").replace(/\/+$/, "");
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 90 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const params = new URLSearchParams({
    site_id: config.site_id,
    period: "custom",
    date: `${start},${end}`,
    metrics: "visitors",
    interval: "date",
  });

  const res = await fetch(
    `${host}/api/v1/stats/timeseries?${params}`,
    { headers: { Authorization: `Bearer ${config.api_key}` } },
  );
  if (!res.ok) {
    throw new Error(`Plausible ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const rows: Array<{ date: string; visitors: number }> =
    json.results ?? [];

  return rows.map((r): MetricPoint => ({
    date: String(r.date).slice(0, 10),
    metric: "dau",
    value: Number(r.visitors ?? 0),
  }));
};
