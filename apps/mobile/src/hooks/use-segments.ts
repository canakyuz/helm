import { useQuery } from "@tanstack/react-query";
import { segmentsQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { Segment, SegmentRuleType } from "@helm/api";

export function useSegments() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(segmentsQueryOptions(supabase, selectedPropertyId));
}
