import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchAudit } from "@helm/api";

export const auditKeys = {
  all: ["audit"] as const,
  recent: (id: SelectedPropertyId) => ["audit", "recent", id] as const,
};

export function auditQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: auditKeys.recent(propertyId),
    queryFn: () => fetchAudit(client, propertyId),
    staleTime: 5 * 60_000,
  });
}
