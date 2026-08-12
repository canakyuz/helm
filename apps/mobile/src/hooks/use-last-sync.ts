import { useQuery } from "@tanstack/react-query";
import { lastSyncQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { LastSync } from "@helm/api";

/** Hub'in son ingest calismasi — baslik seridindeki "SON hh:mm" damgasi. */
export function useLastSync() {
  return useQuery(lastSyncQueryOptions(supabase));
}
