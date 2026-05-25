import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

export type VersionPlatform = "ios" | "android";
export type PlatformFilter = "all" | VersionPlatform;

export type AppVersion = {
  id: number;
  propertyId: string;
  propertyName: string | null;
  version: string;
  source: VersionPlatform;
  releaseDate: string | null;
  releaseNotes: string | null;
};

export type VersionsBundle = {
  versions: AppVersion[];
  iosCount: number;
  androidCount: number;
  latestIos: AppVersion | null;
  latestAndroid: AppVersion | null;
};

type Row = {
  id: number;
  project_id: string;
  version: string;
  source: string;
  release_date: string | null;
  release_notes: string | null;
  properties: { name: string } | null;
};

async function fetchVersions(
  propertyId: SelectedPropertyId,
  platform: PlatformFilter,
): Promise<VersionsBundle> {
  let q = supabase
    .from("app_versions")
    .select(
      "id, project_id, version, source, release_date, release_notes, properties ( name )",
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(200);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  if (platform !== "all") q = q.eq("source", platform);

  const { data, error } = await q;
  if (error) throw error;

  const all = ((data as unknown as Row[] | null) ?? []).map<AppVersion>((row) => ({
    id: row.id,
    propertyId: row.project_id,
    propertyName: row.properties?.name ?? null,
    version: row.version,
    source: (row.source === "android" ? "android" : "ios") as VersionPlatform,
    releaseDate: row.release_date,
    releaseNotes: row.release_notes,
  }));

  const iosVersions = all.filter((v) => v.source === "ios");
  const androidVersions = all.filter((v) => v.source === "android");

  return {
    versions: all,
    iosCount: iosVersions.length,
    androidCount: androidVersions.length,
    latestIos: iosVersions[0] ?? null,
    latestAndroid: androidVersions[0] ?? null,
  };
}

export function useAppVersions(platform: PlatformFilter = "all") {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["app-versions", selectedPropertyId, platform],
    queryFn: () => fetchVersions(selectedPropertyId, platform),
    staleTime: 5 * 60_000,
  });
}
