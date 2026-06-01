import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPropertyMetricTotals } from "@helm/api";

export const propertyMetricTotalsKeys = {
  all: ["property-metric-totals"] as const,
  byMetric: (metric: string) => ["property-metric-totals", metric] as const,
};

export function propertyMetricTotalsQueryOptions(
  client: SupabaseClient,
  metric: string,
) {
  return queryOptions({
    queryKey: propertyMetricTotalsKeys.byMetric(metric),
    queryFn: () => fetchPropertyMetricTotals(client, metric),
    staleTime: 60_000,
  });
}
