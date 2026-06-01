import { useQuery } from "@tanstack/react-query";
import {
  propertyMetricsQueryOptions,
  alertRulesCountQueryOptions,
} from "@helm/queries";

import { supabase } from "~/lib/supabase";

export type { PropertyMetric, PropertyMetricsMap } from "@helm/api";

export function usePropertyMetrics() {
  return useQuery(propertyMetricsQueryOptions(supabase));
}

export function useAlertRulesCount() {
  return useQuery(alertRulesCountQueryOptions(supabase));
}
