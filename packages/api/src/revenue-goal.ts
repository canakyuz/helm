import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

export type RevenueGoal = {
  month: string;
  target_amount: number;
  currency: string;
  project_id: string | null;
};

// Bulunduğumuz ayın ilk günü (YYYY-MM-01) — hedefler ay bazlı.
export function revenueGoalMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function fetchRevenueGoal(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<RevenueGoal | null> {
  let q = client
    .from("revenue_goals")
    .select("month, target_amount, currency, project_id")
    .eq("month", revenueGoalMonth());

  q = propertyId === "all" ? q.is("project_id", null) : q.eq("project_id", propertyId);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as RevenueGoal | null) ?? null;
}

export async function setRevenueGoal(
  client: SupabaseClient,
  args: { target: number; currency: string; propertyId: SelectedPropertyId },
): Promise<RevenueGoal> {
  const { data, error } = await client.rpc("set_revenue_goal", {
    p_month: revenueGoalMonth(),
    p_target: args.target,
    p_currency: args.currency,
    p_project_id: args.propertyId === "all" ? null : args.propertyId,
  });
  if (error) throw error;
  return data as RevenueGoal;
}
