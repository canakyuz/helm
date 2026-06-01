import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProperties } from "@helm/api";
import { STALE_TIME } from "@helm/config";

export const propertiesKeys = { all: ["properties"] as const };

export function propertiesQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: propertiesKeys.all,
    queryFn: () => fetchProperties(client),
    staleTime: STALE_TIME.systemHealth,
  });
}
