import { useQuery } from "@tanstack/react-query";
import {
  propertyMetricsQueryOptions,
  alertRulesCountQueryOptions,
} from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PropertyMetric, PropertyMetricsMap } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function usePropertyMetrics(options: QueryGate = {}) {
  return useQuery(propertyMetricsQueryOptions(supabase, options));
}

export function useAlertRulesCount() {
  return useQuery(alertRulesCountQueryOptions(supabase));
}
