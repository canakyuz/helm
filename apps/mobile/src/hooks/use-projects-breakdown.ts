import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsBreakdownQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensProjectsBreakdown, useDemoLens } from "~/lib/demo";
import type { ProjectBreakdown } from "@helm/api";

export type { ProjectBreakdown } from "@helm/api";

export function useProjectsBreakdown() {
  const lens = useDemoLens();
  return useQuery({
    ...projectsBreakdownQueryOptions(supabase),
    select: useCallback(
      (rows: ProjectBreakdown[]) => lensProjectsBreakdown(rows, lens),
      [lens],
    ),
  });
}
