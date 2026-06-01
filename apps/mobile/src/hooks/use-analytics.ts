import { useQuery } from "@tanstack/react-query";
import {
  acquisitionQueryOptions,
  funnelQueryOptions,
  retentionQueryOptions,
  osBreakdownQueryOptions,
  geoBreakdownQueryOptions,
} from "@helm/queries";

import { supabase } from "~/lib/supabase";

// PostHog-backed edge'ler tek project_id scope'lu — çağıran efektif id'yi geçer.
export type {
  AcquisitionRow,
  AcquisitionData,
  FunnelStep,
  FunnelData,
  RetentionCohort,
  RetentionData,
  OsRow,
  OsData,
  GeoRow,
  GeoData,
} from "@helm/api";

export function useAcquisition(projectId?: string) {
  return useQuery(acquisitionQueryOptions(supabase, projectId));
}

export function useFunnel(projectId?: string) {
  return useQuery(funnelQueryOptions(supabase, projectId));
}

export function useRetention(projectId?: string) {
  return useQuery(retentionQueryOptions(supabase, projectId));
}

export function useOsBreakdown(projectId?: string) {
  return useQuery(osBreakdownQueryOptions(supabase, projectId));
}

export function useGeoBreakdown(projectId?: string) {
  return useQuery(geoBreakdownQueryOptions(supabase, projectId));
}
