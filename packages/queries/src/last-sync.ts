import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLastSync } from "@helm/api";
import { STALE_TIME } from "@helm/config";

export const lastSyncKeys = { all: ["last-sync"] as const };

export function lastSyncQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: lastSyncKeys.all,
    queryFn: () => fetchLastSync(client),
    staleTime: STALE_TIME.kpis,
  });
}
