import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";

// Latest per-project values for the real `metrics` table keys.
// One query, O(n) over rows; "first seen per (project, metric)" = latest
// because we order date DESC.

export type PropertyMetric = { adRevenue: number; mrr: number; dau: number };
export type PropertyMetricsMap = Record<string, PropertyMetric>;

type Row = { project_id: string; metric: string; date: string; value: number };

export function usePropertyMetrics() {
  return useQuery({
    queryKey: ["property-metrics"],
    staleTime: 60_000,
    queryFn: async (): Promise<PropertyMetricsMap> => {
      const { data, error } = await supabase
        .from("metrics")
        .select("project_id, metric, date, value")
        .in("metric", ["ad_revenue", "mrr", "dau"])
        .order("date", { ascending: false });
      if (error) throw error;

      const out: PropertyMetricsMap = {};
      const seen = new Set<string>();
      for (const r of (data ?? []) as Row[]) {
        const key = `${r.project_id}|${r.metric}`;
        if (seen.has(key)) continue; // first row per (project,metric) is latest
        seen.add(key);
        const entry = (out[r.project_id] ??= { adRevenue: 0, mrr: 0, dau: 0 });
        const v = Number(r.value);
        if (r.metric === "ad_revenue") entry.adRevenue = v;
        else if (r.metric === "mrr") entry.mrr = v;
        else if (r.metric === "dau") entry.dau = v;
      }
      return out;
    },
  });
}

// Count of configured alert rules (real `alert_rules` table) for Settings.
export function useAlertRulesCount() {
  return useQuery({
    queryKey: ["alert-rules-count"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("alert_rules")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}
