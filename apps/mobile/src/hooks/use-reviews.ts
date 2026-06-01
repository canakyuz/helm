import { useQuery } from "@tanstack/react-query";
import { reviewsQueryOptions } from "@helm/queries";
import type { PlatformFilter, RatingFilter } from "@helm/api";

import { supabase } from "~/lib/supabase";
import { usePreferences } from "~/lib/preferences";

export type {
  Review,
  ReviewsBundle,
  ReviewSource,
  RatingFilter,
  PlatformFilter,
} from "@helm/api";

export function useReviews(
  platform: PlatformFilter = "all",
  rating: RatingFilter = "all",
) {
  const { selectedPropertyId } = usePreferences();
  return useQuery(reviewsQueryOptions(supabase, selectedPropertyId, platform, rating));
}
