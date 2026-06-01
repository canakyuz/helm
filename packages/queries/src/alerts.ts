import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchAlerts } from "@helm/api";
import { STALE_TIME } from "@helm/config";

export const alertsKeys = {
  all: ["alerts"] as const,
  recent: (id: SelectedPropertyId) => ["alerts", "recent", id] as const,
};

export function alertsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: alertsKeys.recent(propertyId),
    queryFn: () => fetchAlerts(client, propertyId),
    staleTime: STALE_TIME.alerts,
  });
}
