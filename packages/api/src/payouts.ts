import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingPayout = { source: string; amount: number; currency: string };
export type RecentPayout = {
  source: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string;
  net: number;
};
export type PayoutsData = { pending: PendingPayout[]; recent: RecentPayout[] };

export async function fetchPayouts(
  client: SupabaseClient,
  projectId: string,
): Promise<PayoutsData> {
  const { data, error } = await client.functions.invoke<PayoutsData>("helm-payouts", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return data ?? { pending: [], recent: [] };
}
