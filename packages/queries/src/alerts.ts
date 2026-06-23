import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchAlerts } from "@helm/api";
import { STALE_TIME } from "@helm/config";

type QueryGate = { enabled?: boolean };

export const alertsKeys = {
  all: ["alerts"] as const,
  recent: (id: SelectedPropertyId) => ["alerts", "recent", id] as const,
};

export function alertsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: alertsKeys.recent(propertyId),
    enabled: options.enabled ?? true,
    queryFn: () => fetchAlerts(client, propertyId),
    staleTime: STALE_TIME.alerts,
  });
}
