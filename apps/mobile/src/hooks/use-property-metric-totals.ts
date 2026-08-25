import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertyMetricTotalsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensPropertyMetricTotals, useDemoLens } from "~/lib/demo";
import type { PropertyMetricTotal } from "@helm/api";

export type { PropertyMetricTotal } from "@helm/api";

export function usePropertyMetricTotals(metric: string) {
  const lens = useDemoLens();
  return useQuery({
    ...propertyMetricTotalsQueryOptions(supabase, metric),
    select: useCallback(
      (rows: PropertyMetricTotal[]) => lensPropertyMetricTotals(rows, lens, metric),
      [lens, metric],
    ),
  });
}
