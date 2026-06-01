import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import type { PropertyType } from "~/hooks/use-properties";

export type ProjectBreakdown = {
  id: string;
  name: string;
  brandName: string | null;
  type: PropertyType;
  mrr: number;
  dau: number;
  adRevenue: number;
  openAlerts: number;
};

type PropertyRow = {
  id: string;
  name: string;
  type: PropertyType;
  brands: { name: string } | null;
};

type MetricRow = {
  project_id: string;
  metric: string;
  value: number;
};

type AlertCountRow = {
  project_id: string | null;
};

async function fetchBreakdown(): Promise<ProjectBreakdown[]> {
  // Son 7 günün en güncel metric'ini her property için almak ideal,
  // ama tek query ile son 1 gün yeterli + non-zero filter.
  const todayIso = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [propsRes, metricsRes, alertsRes] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, type, brands ( name )")
      .order("name"),
    supabase
      .from("metrics")
      .select("project_id, metric, value, date")
      .in("metric", ["mrr", "dau", "ad_revenue"])
      .gte("date", sevenDaysAgo)
      .lte("date", todayIso)
      .order("date", { ascending: false }),
    supabase
      .from("alert_events")
      .select("rule_id, alert_rules!inner ( project_id )")
      .eq("delivered", false),
  ]);

  if (propsRes.error) throw propsRes.error;
  if (metricsRes.error) throw metricsRes.error;
  if (alertsRes.error) throw alertsRes.error;

  const properties = (propsRes.data as unknown as PropertyRow[] | null) ?? [];

  // Her property + metric için en güncel değer (date desc sorted, ilk gördüğü kaldır).
  const latestMetric = new Map<string, number>(); // key: `${projectId}:${metric}`
  for (const row of (metricsRes.data as unknown as Array<
    MetricRow & { date: string }
  > | null) ?? []) {
    const k = `${row.project_id}:${row.metric}`;
    if (!latestMetric.has(k)) latestMetric.set(k, Number(row.value));
  }

  // Alert sayımları project_id'ye göre.
  const alertCounts = new Map<string, number>();
  for (const row of (alertsRes.data as unknown as Array<{
    alert_rules: AlertCountRow | null;
  }> | null) ?? []) {
    const pid = row.alert_rules?.project_id;
    if (!pid) continue;
    alertCounts.set(pid, (alertCounts.get(pid) ?? 0) + 1);
  }

  return properties.map<ProjectBreakdown>((p) => ({
    id: p.id,
    name: p.name,
    brandName: p.brands?.name ?? null,
    type: p.type,
    mrr: latestMetric.get(`${p.id}:mrr`) ?? 0,
    dau: latestMetric.get(`${p.id}:dau`) ?? 0,
    adRevenue: latestMetric.get(`${p.id}:ad_revenue`) ?? 0,
    openAlerts: alertCounts.get(p.id) ?? 0,
  }));
}

export function useProjectsBreakdown() {
  return useQuery({
    queryKey: ["projects-breakdown"],
    queryFn: fetchBreakdown,
    staleTime: 60_000,
  });
}
