import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { metricDetailQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensMetricDetail, useDemoLens } from "~/lib/demo";
import type { MetricDetail } from "@helm/api";
import { usePreferences } from "~/lib/preferences";

export type { MetricDetail } from "@helm/api";

type QueryGate = { enabled?: boolean };

export function useMetricDetail(metric: string, options: QueryGate = {}) {
  const { selectedPropertyId } = usePreferences();
  const lens = useDemoLens();
  return useQuery({
    ...metricDetailQueryOptions(supabase, metric, selectedPropertyId, options),
    // metric select'e GIRIYOR: ayni hook `dau` ile de `crash_free_sessions`
    // ile de cagriliyor, kapiyi lensMetricDetail iceride aciyor.
    select: useCallback(
      (d: MetricDetail) => lensMetricDetail(d, lens, metric),
      [lens, metric],
    ),
  });
}
