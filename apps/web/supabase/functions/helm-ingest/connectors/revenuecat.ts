import { type Connector, type MetricPoint, today } from "./types.ts";

// RevenueCat v2 — Metrics Overview (anlık snapshot).
// config: { rc_project_id, api_key }  (api_key = v2 secret key)
export const fetchRevenueCat: Connector = async (config) => {
  const res = await fetch(
    `https://api.revenuecat.com/v2/projects/${config.rc_project_id}/metrics/overview`,
    { headers: { Authorization: `Bearer ${config.api_key}` } },
  );
  if (!res.ok) {
    throw new Error(`RevenueCat ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const metrics: Array<{ id: string; value: number }> = json.metrics ?? [];
  const get = (id: string) =>
    Number(metrics.find((m) => m.id === id)?.value ?? 0);

  const date = today();
  const points: MetricPoint[] = [
    { date, metric: "mrr", value: get("mrr") },
    { date, metric: "active_subs", value: get("active_subscriptions") },
    { date, metric: "revenue_28d", value: get("revenue") },
  ];
  return points;
};
