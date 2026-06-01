import { useQuery } from "@tanstack/react-query";
import { segmentMetricsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { SegmentMetrics } from "@helm/api";

export function useSegmentMetrics(periodDays: number) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(segmentMetricsQueryOptions(supabase, selectedPropertyId, periodDays));
}
