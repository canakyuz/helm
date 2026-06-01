import { useQuery } from "@tanstack/react-query";
import { mrrMovementQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { MrrSegment, MrrMovement } from "@helm/api";

export function useMrrMovement(projectId?: string) {
  return useQuery(mrrMovementQueryOptions(supabase, projectId));
}
