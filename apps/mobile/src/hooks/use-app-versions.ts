import { useQuery } from "@tanstack/react-query";
import { appVersionsQueryOptions } from "@helm/queries";
import type { VersionPlatformFilter } from "@helm/api";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type {
  AppVersion,
  AppVersionStatus,
  VersionsBundle,
  VersionPlatform,
  VersionPlatformFilter,
} from "@helm/api";

export function useAppVersions(platform: VersionPlatformFilter = "all") {
  const { selectedPropertyId } = usePreferences();
  return useQuery(appVersionsQueryOptions(supabase, selectedPropertyId, platform));
}
