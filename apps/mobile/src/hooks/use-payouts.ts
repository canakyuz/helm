import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";

// helm-payouts edge — Stripe banka ödemeleri (canlı). Tek proje scope'lu.
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

export function usePayouts(projectId?: string) {
  return useQuery({
    queryKey: ["payouts", projectId],
    enabled: projectId != null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PayoutsData> => {
      const { data, error } = await supabase.functions.invoke<PayoutsData>("helm-payouts", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data ?? { pending: [], recent: [] };
    },
  });
}
