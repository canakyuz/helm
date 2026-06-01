import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchReviews,
  type PlatformFilter,
  type RatingFilter,
} from "@helm/api";

export const reviewsKeys = {
  all: ["reviews"] as const,
  list: (id: SelectedPropertyId, platform: PlatformFilter, rating: RatingFilter) =>
    ["reviews", id, platform, rating] as const,
};

export function reviewsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  platform: PlatformFilter,
  rating: RatingFilter,
) {
  return queryOptions({
    queryKey: reviewsKeys.list(propertyId, platform, rating),
    queryFn: () => fetchReviews(client, propertyId, platform, rating),
    staleTime: 5 * 60_000,
  });
}
