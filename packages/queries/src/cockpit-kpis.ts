import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchCockpitKpis,
  fetchMrrSpark,
  fetchTotalRevenueSpark,
} from "@helm/api";
import { STALE_TIME } from "@helm/config";

type QueryGate = { enabled?: boolean };

export const cockpitKpisKeys = {
  all: ["cockpit-kpis"] as const,
  byProperty: (id: SelectedPropertyId) => [...cockpitKpisKeys.all, id] as const,
};

export const cockpitSparkKeys = {
  mrr: (id: SelectedPropertyId) => ["cockpit-spark", "mrr", id] as const,
  totalRevenue: (id: SelectedPropertyId) =>
    ["cockpit-spark", "total-revenue", id] as const,
};

export function cockpitKpisQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: cockpitKpisKeys.byProperty(propertyId),
    enabled: options.enabled ?? true,
    queryFn: () => fetchCockpitKpis(client, propertyId),
    staleTime: STALE_TIME.kpis,
  });
}

export function mrrSparkQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: cockpitSparkKeys.mrr(propertyId),
    enabled: options.enabled ?? true,
    queryFn: () => fetchMrrSpark(client, propertyId),
    staleTime: STALE_TIME.spark,
  });
}

export function totalRevenueSparkQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: cockpitSparkKeys.totalRevenue(propertyId),
    enabled: options.enabled ?? true,
    queryFn: () => fetchTotalRevenueSpark(client, propertyId),
    staleTime: STALE_TIME.spark,
  });
}
