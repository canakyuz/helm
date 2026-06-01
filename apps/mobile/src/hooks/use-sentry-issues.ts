import { useQuery } from "@tanstack/react-query";
import { sentryIssuesQueryOptions } from "@helm/queries";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type { SentryIssue, SentryLevel, SentryStatus } from "@helm/api";

export function useSentryIssues() {
  const { selectedPropertyId } = usePreferences();
  return useQuery(sentryIssuesQueryOptions(supabase, selectedPropertyId));
}
