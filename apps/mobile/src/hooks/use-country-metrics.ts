import { useQuery } from "@tanstack/react-query";
import { countryMetricsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

/** Ulke kirilimi. Varsayilan app_downloads - dolu olan metrik bu. */
export function useCountryMetrics(metric = "app_downloads", days = 30) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(countryMetricsQueryOptions(supabase, selectedPropertyId, metric, days));
}
