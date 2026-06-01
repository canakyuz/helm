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

export function useCockpitKpis() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(cockpitKpisQueryOptions(supabase, selectedPropertyId));
}

export function useMrrSpark() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(mrrSparkQueryOptions(supabase, selectedPropertyId));
}

export function useTotalRevenueSpark() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(totalRevenueSparkQueryOptions(supabase, selectedPropertyId));
}
