import { useQuery } from "@tanstack/react-query";
import { payoutsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PendingPayout, RecentPayout, PayoutsData } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function usePayouts(projectId?: string, options: QueryGate = {}) {
  return useQuery(payoutsQueryOptions(supabase, projectId, options));
}
