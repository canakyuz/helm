import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import { fetchSentryIssues } from "@helm/api";

export const sentryIssuesKeys = {
  all: ["sentry-issues"] as const,
  byProperty: (id: SelectedPropertyId) => ["sentry-issues", id] as const,
};

export function sentryIssuesQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: sentryIssuesKeys.byProperty(propertyId),
    queryFn: () => fetchSentryIssues(client, propertyId),
    staleTime: 2 * 60_000,
  });
}
