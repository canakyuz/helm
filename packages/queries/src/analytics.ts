import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAcquisition,
  fetchFunnel,
  fetchRetention,
  fetchOsBreakdown,
  fetchGeoBreakdown,
} from "@helm/api";

const STALE = 5 * 60_000;

export function acquisitionQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["acquisition", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: () => fetchAcquisition(client, projectId!),
  });
}

export function funnelQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["funnel", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: () => fetchFunnel(client, projectId!),
  });
}

export function retentionQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["retention", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: () => fetchRetention(client, projectId!),
  });
}

export function osBreakdownQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["os-breakdown", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: () => fetchOsBreakdown(client, projectId!),
  });
}

export function geoBreakdownQueryOptions(client: SupabaseClient, projectId?: string) {
  return queryOptions({
    queryKey: ["geo-breakdown", projectId],
    enabled: projectId != null,
    staleTime: STALE,
    queryFn: () => fetchGeoBreakdown(client, projectId!),
  });
}
