import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";

// helm-mrr-movement edge — RevenueCat Charts API. Segment adları RC'nin döndüğü
// şekle göre dinamik (New/Churned ya da daha fazlası); UI generic render eder.
export type MrrSegment = { label: string; value: number };
export type MrrMovement = { segments: MrrSegment[]; net: number };

export function useMrrMovement(projectId?: string) {
  return useQuery({
    queryKey: ["mrr-movement", projectId],
    enabled: projectId != null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MrrMovement> => {
      const { data, error } = await supabase.functions.invoke<MrrMovement>("helm-mrr-movement", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data ?? { segments: [], net: 0 };
    },
  });
}
