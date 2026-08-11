import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchGameFunnels } from "@helm/api";

type QueryGate = { enabled?: boolean };

export const gameFunnelKeys = {
  all: ["game-funnels"] as const,
  byProperty: (id: SelectedPropertyId, days: number) =>
    ["game-funnels", id, days] as const,
};

export function gameFunnelsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  days = 30,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: gameFunnelKeys.byProperty(propertyId, days),
    enabled: options.enabled ?? true,
    // Telemetri saatlik ingest ile buyur; dakikada bir yenilemenin anlami yok.
    staleTime: 5 * 60_000,
    queryFn: () => fetchGameFunnels(client, propertyId, days),
  });
}
