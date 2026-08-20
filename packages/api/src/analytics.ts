import type { SupabaseClient } from "@supabase/supabase-js";

// PostHog-backed edge'ler - tek project_id scope'lu (aggregate "all" yok).
// Çağıran efektif project id'yi (seçili ya da ilk property) geçer.

export type AcquisitionRow = { source: string; type: string; users: number };
export type AcquisitionData = { rows: AcquisitionRow[]; total: number; days: number };

export async function fetchAcquisition(
  client: SupabaseClient,
  projectId: string,
): Promise<AcquisitionData> {
  const { data, error } = await client.functions.invoke<AcquisitionData>("helm-acquisition", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return data ?? { rows: [], total: 0, days: 30 };
}

export type FunnelStep = {
  event: string;
  order: number;
  count: number;
  overall_pct: number;
  step_pct: number;
  drop: number;
  prev_count: number;
  delta_pct: number | null;
};
export type FunnelData = {
  days: number;
  steps: FunnelStep[];
  total_entered: number;
  total_converted: number;
  overall_conversion: number;
};

export async function fetchFunnel(
  client: SupabaseClient,
  projectId: string,
): Promise<FunnelData> {
  const { data, error } = await client.functions.invoke<FunnelData>("helm-funnel", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return (
    data ?? {
      days: 30,
      steps: [],
      total_entered: 0,
      total_converted: 0,
      overall_conversion: 0,
    }
  );
}

export type RetentionCohort = { day: string; pct: number };
export type RetentionData = { cohorts: RetentionCohort[]; days: number };

export async function fetchRetention(
  client: SupabaseClient,
  projectId: string,
): Promise<RetentionData> {
  const { data, error } = await client.functions.invoke<RetentionData>("helm-retention", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return data ?? { cohorts: [], days: 30 };
}

export type OsRow = { os: string; version: string; users: number; pct: number };
export type OsData = { rows: OsRow[]; total: number; days: number };

export async function fetchOsBreakdown(
  client: SupabaseClient,
  projectId: string,
): Promise<OsData> {
  const { data, error } = await client.functions.invoke<OsData>("helm-os-breakdown", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return data ?? { rows: [], total: 0, days: 30 };
}

export type GeoRow = { country: string; country_name: string | null; users: number };
export type GeoData = {
  rows: GeoRow[];
  total: number;
  days: number;
  country: string | null;
};

export async function fetchGeoBreakdown(
  client: SupabaseClient,
  projectId: string,
): Promise<GeoData> {
  const { data, error } = await client.functions.invoke<GeoData>("helm-geo-breakdown", {
    body: { project_id: projectId },
  });
  if (error) throw error;
  return data ?? { rows: [], total: 0, days: 30, country: null };
}
