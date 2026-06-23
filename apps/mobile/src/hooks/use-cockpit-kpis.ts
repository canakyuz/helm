import { useQuery } from "@tanstack/react-query";
import {
  cockpitKpisQueryOptions,
  mrrSparkQueryOptions,
  totalRevenueSparkQueryOptions,
} from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

// Fetch + queryOptions @helm/api / @helm/queries'e taşındı; bu hook'lar
// sadece client + selectedPropertyId enjekte eder (web ile tek kaynak).
export type { CockpitKpis, SparkPoint } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useCockpitKpis(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(cockpitKpisQueryOptions(supabase, selectedPropertyId, options));
}

export function useMrrSpark(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(mrrSparkQueryOptions(supabase, selectedPropertyId, options));
}

export function useTotalRevenueSpark(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(
    totalRevenueSparkQueryOptions(supabase, selectedPropertyId, options),
  );
}
