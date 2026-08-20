import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

// Severity şemada YOK - condition + metric kombinasyonundan türetilir.
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

export function deriveSeverity(metric: string, condition: string): AlertSeverity {
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

export async function fetchAlerts(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<Alert[]> {
  let q = client
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

// Ack - şemada acknowledged_at yok, delivered=true ile işaretle (mevcut convention).
export async function ackAlert(client: SupabaseClient, id: number): Promise<void> {
  const { error } = await client
    .from("alert_events")
    .update({ delivered: true })
    .eq("id", id);
  if (error) throw error;
}
