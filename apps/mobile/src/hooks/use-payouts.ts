import { useQuery } from "@tanstack/react-query";
import { payoutsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PendingPayout, RecentPayout, PayoutsData } from "@helm/api";

export function usePayouts(projectId?: string) {
  return useQuery(payoutsQueryOptions(supabase, projectId));
}
