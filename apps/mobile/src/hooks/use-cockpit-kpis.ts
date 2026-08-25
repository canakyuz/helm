import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  cockpitKpisQueryOptions,
  mrrSparkQueryOptions,
  totalRevenueSparkQueryOptions,
} from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";
import { lensCockpitKpis, useDemoLens } from "~/lib/demo";
import type { CockpitKpis as CockpitKpisShape } from "@helm/api";

// Fetch + queryOptions @helm/api / @helm/queries'e taşındı; bu hook'lar
// sadece client + selectedPropertyId enjekte eder (web ile tek kaynak).
export type { CockpitKpis, SparkPoint } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useCockpitKpis(options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  const lens = useDemoLens();
  return useQuery({
    ...cockpitKpisQueryOptions(supabase, selectedPropertyId, options),
    select: useCallback((d: CockpitKpisShape) => lensCockpitKpis(d, lens), [lens]),
  });
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
