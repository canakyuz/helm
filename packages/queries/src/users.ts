import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchAllUsers, fetchPropertyDau } from "@helm/api";

export const usersKeys = {
  all: ["users"] as const,
  byProperty: (id: SelectedPropertyId) => ["users", id] as const,
};

export function usersQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: usersKeys.byProperty(propertyId),
    queryFn: () => fetchAllUsers(client, propertyId),
    staleTime: 2 * 60_000,
  });
}

export const propertyDauKeys = { all: ["property-dau"] as const };

export function propertyDauQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: propertyDauKeys.all,
    queryFn: () => fetchPropertyDau(client),
    staleTime: 2 * 60_000,
  });
}
