import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchCountryMetrics } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function countryMetricsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  metric = "app_downloads",
  days = 30,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: ["country-metrics", propertyId, metric, days],
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
    queryFn: () => fetchCountryMetrics(client, propertyId, metric, days),
  });
}
