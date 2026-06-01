import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchAppVersions, type VersionPlatformFilter } from "@helm/api";

export const appVersionsKeys = {
  all: ["app-versions"] as const,
  list: (id: SelectedPropertyId, platform: VersionPlatformFilter) =>
    ["app-versions", id, platform] as const,
};

export function appVersionsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  platform: VersionPlatformFilter,
) {
  return queryOptions({
    queryKey: appVersionsKeys.list(propertyId, platform),
    queryFn: () => fetchAppVersions(client, propertyId, platform),
    staleTime: 5 * 60_000,
  });
}
