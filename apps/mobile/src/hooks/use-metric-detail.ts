import { useQuery } from "@tanstack/react-query";
import { metricDetailQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { MetricDetail } from "@helm/api";

export function useMetricDetail(metric: string) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(metricDetailQueryOptions(supabase, metric, selectedPropertyId));
}
