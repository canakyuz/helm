import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

// Severity şemada YOK — condition + metric kombinasyonundan türetiyoruz.
// "drop_pct" + revenue metric = critical; metric mrr/ad_revenue = warn; aksi info.
export type AlertSeverity = "info" | "warn" | "critical";

export type Alert = {
  id: number;
  ruleId: string | null;
  ruleName: string;
  metric: string;
  condition: string;
  severity: AlertSeverity;
  currentValue: number | null;
  referenceValue: number | null;
  message: string;
  triggeredAt: string;
  delivered: boolean;
};

const REVENUE_METRICS = new Set(["mrr", "ad_revenue", "active_subs"]);

function deriveSeverity(metric: string, condition: string): AlertSeverity {
  if (condition === "drop_pct" && REVENUE_METRICS.has(metric)) return "critical";
  if (REVENUE_METRICS.has(metric)) return "warn";
  if (condition === "drop_pct") return "warn";
  return "info";
}

type AlertEventRow = {
  id: number;
  rule_id: string | null;
  triggered_at: string;
  metric: string;
  current_value: number | null;
  reference_value: number | null;
  message: string;
  delivered: boolean;
  alert_rules: { name: string; condition: string } | null;
};

async function fetchAlerts(propertyId: SelectedPropertyId): Promise<Alert[]> {
  let q = supabase
    .from("alert_events")
    .select(
      "id, rule_id, triggered_at, metric, current_value, reference_value, message, delivered, alert_rules!inner ( name, condition, project_id )",
    )
    .order("triggered_at", { ascending: false })
    .limit(100);

  if (propertyId !== "all") {
    q = q.eq("alert_rules.project_id", propertyId);
  }

  const { data, error } = await q;
  if (error) throw error;

  return ((data as unknown as AlertEventRow[] | null) ?? []).map((row) => {
    const condition = row.alert_rules?.condition ?? "";
    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.alert_rules?.name ?? row.metric,
      metric: row.metric,
      condition,
      severity: deriveSeverity(row.metric, condition),
      currentValue: row.current_value,
      referenceValue: row.reference_value,
      message: row.message,
      triggeredAt: row.triggered_at,
      delivered: row.delivered,
    };
  });
}

export function useAlerts() {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["alerts", "recent", selectedPropertyId],
    queryFn: () => fetchAlerts(selectedPropertyId),
    staleTime: 30_000,
  });
}

// Ack — şemada `acknowledged_at` yok, `delivered=true` ile işaretle (mevcut convention).
export function useAckAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("alert_events")
        .update({ delivered: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["cockpit-kpis"] });
    },
  });
}
