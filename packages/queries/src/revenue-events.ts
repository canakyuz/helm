import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchRevenueEvents } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function revenueEventsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: ["revenue-events", propertyId],
    enabled: options.enabled ?? true,
    // Webhook aninda yazar; bu ekran "az once ne oldu" icin acilir.
    staleTime: 30_000,
    queryFn: () => fetchRevenueEvents(client, propertyId),
  });
}
