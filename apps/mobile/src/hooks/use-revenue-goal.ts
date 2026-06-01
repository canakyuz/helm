import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { revenueGoalQueryOptions, revenueGoalKeys } from "@helm/queries";
import { setRevenueGoal } from "@helm/api";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";
import { toast } from "~/lib/toast";

export type { RevenueGoal } from "@helm/api";

export function useRevenueGoal() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(revenueGoalQueryOptions(supabase, selectedPropertyId));
}

export function useSetRevenueGoal() {
  const qc = useQueryClient();
  const { selectedPropertyId } = usePreferences();
  return useMutation({
    mutationFn: ({ target, currency }: { target: number; currency: string }) =>
      setRevenueGoal(supabase, { target, currency, propertyId: selectedPropertyId }),
    onSuccess: () => {
      toast.success("Hedef güncellendi");
      qc.invalidateQueries({ queryKey: revenueGoalKeys.all });
    },
    onError: (e: Error) => toast.error("Hedef kaydedilemedi", e.message),
  });
}
