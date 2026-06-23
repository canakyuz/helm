import { useQuery } from "@tanstack/react-query";
import { mrrMovementQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { MrrSegment, MrrMovement } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useMrrMovement(projectId?: string, options: QueryGate = {}) {
  return useQuery(mrrMovementQueryOptions(supabase, projectId, options));
}
