import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchDataCoverage } from "@helm/api";

type QueryGate = { enabled?: boolean };

export const dataCoverageKeys = {
  all: ["data-coverage"] as const,
  byProperty: (id: SelectedPropertyId) => ["data-coverage", id] as const,
};

export function dataCoverageQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: dataCoverageKeys.byProperty(propertyId),
    enabled: options.enabled ?? true,
    // Tazelik gun bazinda degisir; dakikalik yeniden sorgu bos istek uretir.
    staleTime: 5 * 60_000,
    queryFn: () => fetchDataCoverage(client, propertyId),
  });
}
