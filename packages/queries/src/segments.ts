import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchSegments, fetchSegmentMetrics } from "@helm/api";

export const segmentsKeys = {
  all: ["segments"] as const,
  byProperty: (id: SelectedPropertyId) => ["segments", id] as const,
};

export function segmentsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: segmentsKeys.byProperty(propertyId),
    queryFn: () => fetchSegments(client, propertyId),
    staleTime: 5 * 60_000,
  });
}

export const segmentMetricsKeys = {
  all: ["segment-metrics"] as const,
  byProperty: (id: SelectedPropertyId, periodDays: number) =>
    ["segment-metrics", id, periodDays] as const,
};

export function segmentMetricsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  periodDays: number,
) {
  return queryOptions({
    queryKey: segmentMetricsKeys.byProperty(propertyId, periodDays),
    queryFn: () => fetchSegmentMetrics(client, propertyId, periodDays),
    staleTime: 5 * 60_000,
  });
}
