import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPropertyList } from "@helm/api";

export const propertyListKeys = { all: ["property-list"] as const };

export function propertyListQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: propertyListKeys.all,
    queryFn: () => fetchPropertyList(client),
    staleTime: 5 * 60_000,
  });
}
