import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";
import { toast } from "~/lib/toast";

export type RevenueGoal = {
  month: string;
  target_amount: number;
  currency: string;
  project_id: string | null;
};

// Bulunduğumuz ayın ilk günü (YYYY-MM-01) — hedefler ay bazlı saklanır.
function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function fetchGoal(
  propertyId: SelectedPropertyId,
): Promise<RevenueGoal | null> {
  let q = supabase
    .from("revenue_goals")
    .select("month, target_amount, currency, project_id")
    .eq("month", monthStart());

  // "all" → genel hedef (project_id null); aksi → proje bazlı.
  q = propertyId === "all" ? q.is("project_id", null) : q.eq("project_id", propertyId);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as RevenueGoal | null) ?? null;
}

export function useRevenueGoal() {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["revenue-goal", monthStart(), selectedPropertyId],
    queryFn: () => fetchGoal(selectedPropertyId),
    staleTime: 5 * 60_000,
  });
}

export function useSetRevenueGoal() {
  const qc = useQueryClient();
  const { selectedPropertyId } = usePreferences();
  return useMutation({
    mutationFn: async ({ target, currency }: { target: number; currency: string }) => {
      const { data, error } = await supabase.rpc("set_revenue_goal", {
        p_month: monthStart(),
        p_target: target,
        p_currency: currency,
        p_project_id: selectedPropertyId === "all" ? null : selectedPropertyId,
      });
      if (error) throw error;
      return data as RevenueGoal;
    },
    onSuccess: () => {
      toast.success("Hedef güncellendi");
      qc.invalidateQueries({ queryKey: ["revenue-goal"] });
    },
    onError: (e: Error) => toast.error("Hedef kaydedilemedi", e.message),
  });
}
