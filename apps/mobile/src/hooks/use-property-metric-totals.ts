import { useQuery } from "@tanstack/react-query";
import { propertyMetricTotalsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PropertyMetricTotal } from "@helm/api";

export function usePropertyMetricTotals(metric: string) {
  return useQuery(propertyMetricTotalsQueryOptions(supabase, metric));
}
