import { useQuery } from "@tanstack/react-query";
import { projectsBreakdownQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { ProjectBreakdown } from "@helm/api";

export function useProjectsBreakdown() {
  return useQuery(projectsBreakdownQueryOptions(supabase));
}
