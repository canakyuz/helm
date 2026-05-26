import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

export type VersionPlatform = "ios" | "android";
export type PlatformFilter = "all" | VersionPlatform;

export type AppVersionStatus =
  | "live"
  | "in_review"
  | "ready"
  | "testflight"
  | "rejected"
  | "expired"
  | "removed"
  | "unknown";

export type AppVersion = {
  id: number;
  propertyId: string;
  propertyName: string | null;
  version: string;
  buildNumber: string | null;
  status: AppVersionStatus | null;
  source: VersionPlatform;
  releaseDate: string | null;
  releaseNotes: string | null;
  expiresAt: string | null;
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
  build_number: string | null;
  status: string | null;
  source: string;
  release_date: string | null;
  release_notes: string | null;
  expires_at: string | null;
  properties: { name: string } | null;
};

const KNOWN_STATUS: ReadonlySet<AppVersionStatus> = new Set([
  "live",
  "in_review",
  "ready",
  "testflight",
  "rejected",
  "expired",
  "removed",
  "unknown",
]);

async function fetchVersions(
  propertyId: SelectedPropertyId,
  platform: PlatformFilter,
): Promise<VersionsBundle> {
  let q = supabase
    .from("app_versions")
    .select(
      "id, project_id, version, build_number, status, source, release_date, release_notes, expires_at, properties ( name )",
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(200);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  if (platform !== "all") q = q.eq("source", platform);

  const { data, error } = await q;
  if (error) throw error;

  const all = ((data as unknown as Row[] | null) ?? []).map<AppVersion>((row) => {
    const rawStatus = (row.status ?? null) as AppVersionStatus | null;
    return {
      id: row.id,
      propertyId: row.project_id,
      propertyName: row.properties?.name ?? null,
      version: row.version,
      buildNumber: row.build_number,
      status: rawStatus && KNOWN_STATUS.has(rawStatus) ? rawStatus : null,
      source: (row.source === "android" ? "android" : "ios") as VersionPlatform,
      releaseDate: row.release_date,
      releaseNotes: row.release_notes,
      expiresAt: row.expires_at,
    };
  });

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
