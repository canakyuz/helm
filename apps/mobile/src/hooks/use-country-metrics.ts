import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { countryMetricsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensCountryMetrics, useDemoLens } from "~/lib/demo";
import type { CountryMetrics } from "@helm/api";
import { usePreferences } from "~/lib/preferences";

/** Ulke kirilimi. Varsayilan app_downloads - dolu olan metrik bu. */
export function useCountryMetrics(metric = "app_downloads", days = 30) {
  const { selectedPropertyId } = usePreferences();
  const lens = useDemoLens();
  return useQuery({
    ...countryMetricsQueryOptions(supabase, selectedPropertyId, metric, days),
    select: useCallback((d: CountryMetrics) => lensCountryMetrics(d, lens), [lens]),
  });
}
