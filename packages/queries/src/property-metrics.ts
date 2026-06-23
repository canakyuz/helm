import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPropertyMetrics, fetchAlertRulesCount } from "@helm/api";

type QueryGate = { enabled?: boolean };

export const propertyMetricsKeys = { all: ["property-metrics"] as const };

export function propertyMetricsQueryOptions(
  client: SupabaseClient,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: propertyMetricsKeys.all,
    enabled: options.enabled ?? true,
    queryFn: () => fetchPropertyMetrics(client),
    staleTime: 60_000,
  });
}

export const alertRulesCountKeys = { all: ["alert-rules-count"] as const };

export function alertRulesCountQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: alertRulesCountKeys.all,
    queryFn: () => fetchAlertRulesCount(client),
    staleTime: 5 * 60_000,
  });
}
