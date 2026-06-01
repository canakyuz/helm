import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";

// helm-* analytics edge functions are PostHog-backed and scope to a SINGLE
// project_id (they don't aggregate "all"). Callers resolve the effective
// project id (selected property, or the first property when "all" is active)
// and pass it here; the query is disabled while it's undefined.

const STALE = 5 * 60_000;

// ── Acquisition (helm-acquisition) ──────────────────────────────
export type AcquisitionRow = { source: string; type: string; users: number };
export type AcquisitionData = { rows: AcquisitionRow[]; total: number; days: number };

export function useAcquisition(projectId?: string) {
  return useQuery({
    queryKey: ["acquisition", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: async (): Promise<AcquisitionData> => {
      const { data, error } = await supabase.functions.invoke<AcquisitionData>(
        "helm-acquisition",
        { body: { project_id: projectId } },
      );
      if (error) throw error;
      return data ?? { rows: [], total: 0, days: 30 };
    },
  });
}

// ── Funnel (helm-funnel) ────────────────────────────────────────
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

export function useFunnel(projectId?: string) {
  return useQuery({
    queryKey: ["funnel", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: async (): Promise<FunnelData> => {
      const { data, error } = await supabase.functions.invoke<FunnelData>("helm-funnel", {
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
    },
  });
}

// ── Retention (helm-retention) ──────────────────────────────────
export type RetentionCohort = { day: string; pct: number };
export type RetentionData = { cohorts: RetentionCohort[]; days: number };

export function useRetention(projectId?: string) {
  return useQuery({
    queryKey: ["retention", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: async (): Promise<RetentionData> => {
      const { data, error } = await supabase.functions.invoke<RetentionData>("helm-retention", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data ?? { cohorts: [], days: 30 };
    },
  });
}

// ── OS breakdown (helm-os-breakdown) ────────────────────────────
export type OsRow = { os: string; version: string; users: number; pct: number };
export type OsData = { rows: OsRow[]; total: number; days: number };

export function useOsBreakdown(projectId?: string) {
  return useQuery({
    queryKey: ["os-breakdown", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: async (): Promise<OsData> => {
      const { data, error } = await supabase.functions.invoke<OsData>("helm-os-breakdown", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data ?? { rows: [], total: 0, days: 30 };
    },
  });
}

// ── Geo breakdown (helm-geo-breakdown) ──────────────────────────
export type GeoRow = { country: string; country_name: string | null; users: number };
export type GeoData = { rows: GeoRow[]; total: number; days: number; country: string | null };

export function useGeoBreakdown(projectId?: string) {
  return useQuery({
    queryKey: ["geo-breakdown", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: async (): Promise<GeoData> => {
      const { data, error } = await supabase.functions.invoke<GeoData>("helm-geo-breakdown", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      return data ?? { rows: [], total: 0, days: 30, country: null };
    },
  });
}
