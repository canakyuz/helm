import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchIntegrationConfig } from "@helm/api";
import { STALE_TIME } from "@helm/config";

export const integrationConfigKeys = {
  all: ["integration-config"] as const,
  byId: (id: string) => ["integration-config", id] as const,
};

export function integrationConfigQueryOptions(client: SupabaseClient, id: string) {
  return queryOptions({
    queryKey: integrationConfigKeys.byId(id),
    queryFn: () => fetchIntegrationConfig(client, id),
    staleTime: STALE_TIME.systemHealth,
  });
}
