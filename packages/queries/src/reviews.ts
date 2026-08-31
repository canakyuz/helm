import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";
import {
  fetchReviewStats,
  fetchReviews,
  type PlatformFilter,
  type RatingFilter,
} from "@helm/api";

export const reviewsKeys = {
  all: ["reviews"] as const,
  list: (id: SelectedPropertyId, platform: PlatformFilter, rating: RatingFilter) =>
    ["reviews", id, platform, rating] as const,
  // Ozet listeden bagimsiz cekilir; platform/puan filtresi degisince yeniden
  // sorgulanmasi gerekmez - tum kirilimlar tek cevapta gelir.
  stats: (id: SelectedPropertyId) => ["reviews", "stats", id] as const,
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

export function reviewStatsQueryOptions(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
) {
  return queryOptions({
    queryKey: reviewsKeys.stats(propertyId),
    queryFn: () => fetchReviewStats(client, propertyId),
    staleTime: 5 * 60_000,
  });
}
