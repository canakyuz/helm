import type { SupabaseClient } from "@supabase/supabase-js";

export type PropertyMetric = { adRevenue: number; mrr: number; dau: number };
export type PropertyMetricsMap = Record<string, PropertyMetric>;

type Row = { project_id: string; metric: string; date: string; value: number };

// Her project için ad_revenue/mrr/dau'nun en güncel değeri (date DESC → ilk gördüğü = latest).
export async function fetchPropertyMetrics(
  client: SupabaseClient,
): Promise<PropertyMetricsMap> {
  const { data, error } = await client
    .from("metrics")
    .select("project_id, metric, date, value")
    .in("metric", ["ad_revenue", "mrr", "dau"])
    .order("date", { ascending: false });
  if (error) throw error;

  const out: PropertyMetricsMap = {};
  const seen = new Set<string>();
  for (const r of (data ?? []) as Row[]) {
    const key = `${r.project_id}|${r.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = (out[r.project_id] ??= { adRevenue: 0, mrr: 0, dau: 0 });
    const v = Number(r.value);
    if (r.metric === "ad_revenue") entry.adRevenue = v;
    else if (r.metric === "mrr") entry.mrr = v;
    else if (r.metric === "dau") entry.dau = v;
  }
  return out;
}

export async function fetchAlertRulesCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("alert_rules")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
