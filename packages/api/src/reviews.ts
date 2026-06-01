import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

export type ReviewSource = "appstore" | "playstore";
export type RatingFilter = "all" | 1 | 2 | 3 | 4 | 5;
export type PlatformFilter = "all" | ReviewSource;

export interface Review {
  id: number;
  project_id: string;
  source: "appstore" | "playstore";
  source_method?: "asc" | "rss" | "play" | null;
  external_id?: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory?: string | null;
  app_version?: string | null;
  developer_response?: string | null;
  responded_at?: string | null;
  review_date: string | null;
}

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
  source_method: string | null;
  external_id: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory: string | null;
  app_version: string | null;
  developer_response: string | null;
  responded_at: string | null;
  review_date: string | null;
};

export async function fetchReviews(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  platform: PlatformFilter,
  rating: RatingFilter,
): Promise<ReviewsBundle> {
  let q = client
    .from("reviews")
    .select(
      "id, project_id, source, source_method, external_id, author, rating, title, body, territory, app_version, developer_response, responded_at, review_date",
    )
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
    project_id: row.project_id,
    source: (row.source === "playstore" ? "playstore" : "appstore") as ReviewSource,
    source_method: (row.source_method as Review["source_method"]) ?? null,
    external_id: row.external_id,
    author: row.author,
    rating: row.rating,
    title: row.title,
    body: row.body,
    territory: row.territory,
    app_version: row.app_version,
    developer_response: row.developer_response,
    responded_at: row.responded_at,
    review_date: row.review_date,
  }));

  const distribution: ReviewsBundle["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  let appstoreCount = 0;
  let playstoreCount = 0;

  for (const r of reviews) {
    const ratingVal = r.rating ?? 0;
    const star = Math.max(1, Math.min(5, Math.round(ratingVal))) as 1 | 2 | 3 | 4 | 5;
    distribution[star]++;
    total++;
    sum += ratingVal;
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

export type ReviewReplyInput = { review_id: number; body: string };

export async function submitReviewReply(
  client: SupabaseClient,
  input: ReviewReplyInput,
): Promise<{ ok: true; responded_at: string }> {
  const { data, error } = await client.functions.invoke("helm-review-reply", {
    body: { review_id: input.review_id, body: input.body },
  });
  if (error) throw error;
  if ((data as { ok?: boolean })?.ok !== true) {
    throw new Error((data as { error?: string })?.error ?? "Bilinmeyen hata");
  }
  return data as { ok: true; responded_at: string };
}
