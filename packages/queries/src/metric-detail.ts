import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchMetricDetail } from "@helm/api";
import { STALE_TIME } from "@helm/config";

type QueryGate = { enabled?: boolean };

export const metricDetailKeys = {
  all: ["metric-detail"] as const,
  byMetric: (metric: string, id: SelectedPropertyId) =>
    ["metric-detail", metric, id] as const,
};

export function metricDetailQueryOptions(
  client: SupabaseClient,
  metric: string,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: metricDetailKeys.byMetric(metric, propertyId),
    enabled: options.enabled ?? true,
    queryFn: () => fetchMetricDetail(client, metric, propertyId),
    staleTime: STALE_TIME.systemHealth,
  });
}
