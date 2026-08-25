import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { segmentsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { lensSegments, useDemoLens } from "~/lib/demo";
import type { Segment } from "@helm/api";
import { usePreferences } from "~/lib/preferences";

export type { Segment, SegmentRuleType } from "@helm/api";

export function useSegments() {
  const { selectedPropertyId } = usePreferences();
  const lens = useDemoLens();
  return useQuery({
    ...segmentsQueryOptions(supabase, selectedPropertyId),
    select: useCallback((rows: Segment[]) => lensSegments(rows, lens), [lens]),
  });
}
