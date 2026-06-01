import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchProjectsBreakdown } from "@helm/api";

export const projectsBreakdownKeys = { all: ["projects-breakdown"] as const };

export function projectsBreakdownQueryOptions(client: SupabaseClient) {
  return queryOptions({
    queryKey: projectsBreakdownKeys.all,
    queryFn: () => fetchProjectsBreakdown(client),
    staleTime: 60_000,
  });
}
