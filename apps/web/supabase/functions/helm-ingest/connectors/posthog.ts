import { type Connector, type MetricPoint, today } from "./types.ts";

// PostHog — HogQL query API. Günlük DAU serisi + anlık WAU.
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

  // Günlük DAU serisi (90 gün) — grafik için geçmiş veri.
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

  // Anlık WAU — son 7 günün tekil kullanıcısı.
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

  return points;
};
