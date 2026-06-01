import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSystemHealth } from "@helm/api";
import { STALE_TIME } from "@helm/config";

export const systemHealthKeys = { all: ["system-health"] as const };

export function systemHealthQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: systemHealthKeys.all,
    queryFn: () => fetchSystemHealth(client),
    staleTime: STALE_TIME.systemHealth,
  });
}
