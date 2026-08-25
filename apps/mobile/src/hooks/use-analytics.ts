import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  acquisitionQueryOptions,
  funnelQueryOptions,
  retentionQueryOptions,
  osBreakdownQueryOptions,
  geoBreakdownQueryOptions,
} from "@helm/queries";

import { supabase } from "~/lib/supabase";
import {
  lensAcquisition,
  lensFunnel,
  lensGeoBreakdown,
  lensOsBreakdown,
  useDemoLens,
} from "~/lib/demo";
import type { AcquisitionData, FunnelData, GeoData, OsData } from "@helm/api";

// PostHog-backed edge'ler tek project_id scope'lu - çağıran efektif id'yi geçer.
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
  const lens = useDemoLens();
  return useQuery({
    ...acquisitionQueryOptions(supabase, projectId),
    select: useCallback((d: AcquisitionData) => lensAcquisition(d, lens), [lens]),
  });
}

export function useFunnel(projectId?: string) {
  const lens = useDemoLens();
  return useQuery({
    ...funnelQueryOptions(supabase, projectId),
    select: useCallback((d: FunnelData) => lensFunnel(d, lens), [lens]),
  });
}

export function useRetention(projectId?: string) {
  return useQuery(retentionQueryOptions(supabase, projectId));
}

export function useOsBreakdown(projectId?: string) {
  const lens = useDemoLens();
  return useQuery({
    ...osBreakdownQueryOptions(supabase, projectId),
    select: useCallback((d: OsData) => lensOsBreakdown(d, lens), [lens]),
  });
}

export function useGeoBreakdown(projectId?: string) {
  const lens = useDemoLens();
  return useQuery({
    ...geoBreakdownQueryOptions(supabase, projectId),
    select: useCallback((d: GeoData) => lensGeoBreakdown(d, lens), [lens]),
  });
}
