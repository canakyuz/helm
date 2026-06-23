import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProperties } from "@helm/api";
import { STALE_TIME } from "@helm/config";

type QueryGate = { enabled?: boolean };

export const propertiesKeys = { all: ["properties"] as const };

export function propertiesQueryOptions(
  client: SupabaseClient,
  options: QueryGate = {},
) {
  return queryOptions({
    queryKey: propertiesKeys.all,
    enabled: options.enabled ?? true,
    queryFn: () => fetchProperties(client),
    staleTime: STALE_TIME.systemHealth,
  });
}
