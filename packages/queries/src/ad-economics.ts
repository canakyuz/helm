import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchAdEconomics } from "@helm/api";

type QueryGate = { enabled?: boolean };

export const adEconomicsKeys = {
  all: ["ad-economics"] as const,
  byRange: (id: SelectedPropertyId, from: string, to: string) =>
    ["ad-economics", id, from, to] as const,
};

export function adEconomicsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  from: string,
  to: string,
  options: QueryGate = {},
) {
  return queryOptions({
    // Aralik ANAHTARDA: donem seridinden baska bir ay secilince ayri bir
    // cache girdisi olur, geri donuldugunde aninda gelir.
    queryKey: adEconomicsKeys.byRange(propertyId, from, to),
    // Aralik bos gelirse (henuz kova secilmemis) istek atilmaz.
    enabled: (options.enabled ?? true) && from.length > 0 && to.length > 0,
    // AdMob gunluk ingest ile gelir; dakikalik tazeleme bos istek uretir.
    staleTime: 5 * 60_000,
    queryFn: () => fetchAdEconomics(client, propertyId, from, to),
  });
}
