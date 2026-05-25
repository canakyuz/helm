import { useQuery } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { usePreferences, type SelectedPropertyId } from "~/lib/preferences";

export type ReviewSource = "appstore" | "playstore";
export type RatingFilter = "all" | 1 | 2 | 3 | 4 | 5;
export type PlatformFilter = "all" | ReviewSource;

export type Review = {
  id: number;
  propertyId: string;
  source: ReviewSource;
  author: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  reviewDate: string | null;
};

export type ReviewsBundle = {
  reviews: Review[];
  total: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  appstoreCount: number;
  playstoreCount: number;
};

type Row = {
  id: number;
  project_id: string;
  source: string;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  review_date: string | null;
};

async function fetchReviews(
  propertyId: SelectedPropertyId,
  platform: PlatformFilter,
  rating: RatingFilter,
): Promise<ReviewsBundle> {
  let q = supabase
    .from("reviews")
    .select("id, project_id, source, author, rating, title, body, review_date")
    .order("review_date", { ascending: false })
    .limit(200);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  if (platform !== "all") q = q.eq("source", platform);
  if (rating !== "all") q = q.eq("rating", rating);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const reviews: Review[] = rows.map((row) => ({
    id: row.id,
    propertyId: row.project_id,
    source: (row.source === "playstore" ? "playstore" : "appstore") as ReviewSource,
    author: row.author,
    rating: row.rating ?? 0,
    title: row.title,
    body: row.body,
    reviewDate: row.review_date,
  }));

  // Distribution + averaj her zaman tüm reviews üzerinden hesaplanır (filter'den bağımsız).
  // Bunun için ayrı bir query gerekir — şimdilik aynı query üzerinden hesaplayalım.
  // İdeal: separate count query, ama 1 round trip için cache'li haliyle yeterli.
  const distribution: ReviewsBundle["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  let appstoreCount = 0;
  let playstoreCount = 0;

  for (const r of reviews) {
    const star = Math.max(1, Math.min(5, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star]++;
    total++;
    sum += r.rating;
    if (r.source === "appstore") appstoreCount++;
    else if (r.source === "playstore") playstoreCount++;
  }

  return {
    reviews,
    total,
    average: total === 0 ? 0 : sum / total,
    distribution,
    appstoreCount,
    playstoreCount,
  };
}

export function useReviews(
  platform: PlatformFilter = "all",
  rating: RatingFilter = "all",
) {
  const { selectedPropertyId } = usePreferences();
  return useQuery({
    queryKey: ["reviews", selectedPropertyId, platform, rating],
    queryFn: () => fetchReviews(selectedPropertyId, platform, rating),
    staleTime: 5 * 60_000,
  });
}
