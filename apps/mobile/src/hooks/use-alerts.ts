import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertsQueryOptions, alertsKeys, cockpitKpisKeys } from "@helm/queries";
import { ackAlert } from "@helm/api";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { Alert, AlertSeverity } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useAlerts(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(alertsQueryOptions(supabase, selectedPropertyId, options));
}

export function useAckAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ackAlert(supabase, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertsKeys.all });
      qc.invalidateQueries({ queryKey: cockpitKpisKeys.all });
    },
  });
}
