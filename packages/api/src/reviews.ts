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

/** Tek bir kapsamin (tumu / iOS / Android) puan ozeti. */
export interface ReviewRatingStats {
  /** Puansiz yorumlar dahil toplam. */
  total: number;
  /** Yalnizca puani olanlar - ortalama bunun uzerinden hesaplanir. */
  rated: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewStats {
  all: ReviewRatingStats;
  appstore: ReviewRatingStats;
  playstore: ReviewRatingStats;
}

export type ReviewsBundle = {
  reviews: Review[];
  total: number;
  average: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  appstoreCount: number;
  playstoreCount: number;
};

const REVIEW_COLUMNS =
  "id, project_id, source, source_method, external_id, author, rating, title, body, territory, app_version, developer_response, responded_at, review_date";

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

/** helm_review_stats RPC'sinin satir sekli: source x rating sayimlari. */
export type ReviewStatsRow = { source: string; rating: number | null; cnt: number };

const emptyStats = (): ReviewRatingStats => ({
  total: 0,
  rated: 0,
  average: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
});

const toReview = (row: Row): Review => ({
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
});

/**
 * RPC satirlarini kapsam ozetlerine cevirir. Saf fonksiyon - testi burada.
 *
 * Ortalama, satir basina puan*adet toplamindan hesaplanir; puansiz yorumlar
 * `total`'a girer ama ortalamayi ve dagilimi bozmaz.
 * Time: O(satir) <= 12, Space: O(1).
 */
export function aggregateReviewStats(rows: ReviewStatsRow[]): ReviewStats {
  const stats: ReviewStats = {
    all: emptyStats(),
    appstore: emptyStats(),
    playstore: emptyStats(),
  };

  for (const row of rows) {
    const cnt = Number(row.cnt) || 0;
    const bucket = row.source === "playstore" ? stats.playstore : stats.appstore;
    for (const target of [bucket, stats.all]) {
      target.total += cnt;
      if (row.rating == null) continue;
      const star = Math.max(1, Math.min(5, Math.round(row.rating))) as 1 | 2 | 3 | 4 | 5;
      target.distribution[star] += cnt;
      target.rated += cnt;
    }
  }

  for (const target of [stats.all, stats.appstore, stats.playstore]) {
    let sum = 0;
    for (const star of [1, 2, 3, 4, 5] as const) sum += star * target.distribution[star];
    target.average = target.rated === 0 ? 0 : sum / target.rated;
  }

  return stats;
}

/**
 * Puan ozetini DB'de toplar (helm_review_stats RPC, migration 0047).
 *
 * NEDEN liste uzerinden hesaplamiyoruz: PostgREST max_rows = 1000. Listeden
 * hesaplanan ortalama/dagilim, veri tavani asinca sessizce YANLIS olur -
 * eksik gostermez, yanlis gosterir. RPC en fazla 12 satir dondurur
 * (2 kaynak x [1..5 + puansiz]), yani transfer O(1), dogruluk hacimden bagimsiz.
 */
export async function fetchReviewStats(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
): Promise<ReviewStats> {
  const { data, error } = await client.rpc("helm_review_stats", {
    p_project_id: propertyId === "all" ? null : propertyId,
  });
  if (error) throw error;
  return aggregateReviewStats((data ?? []) as ReviewStatsRow[]);
}

/**
 * Son 200 yorum + tam veriden hesaplanmis ozet.
 *
 * Liste bilerek pencereli (mobil yalnizca son kayitlari gosterir); ozet ise
 * fetchReviewStats'tan gelir, yani pencereden etkilenmez.
 */
export async function fetchReviews(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  platform: PlatformFilter,
  rating: RatingFilter,
): Promise<ReviewsBundle> {
  let q = client
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .order("review_date", { ascending: false })
    .limit(200);

  if (propertyId !== "all") q = q.eq("project_id", propertyId);
  if (platform !== "all") q = q.eq("source", platform);
  if (rating !== "all") q = q.eq("rating", rating);

  const [listResult, stats] = await Promise.all([q, fetchReviewStats(client, propertyId)]);
  if (listResult.error) throw listResult.error;

  const reviews = ((listResult.data ?? []) as Row[]).map(toReview);
  const scoped = platform === "all" ? stats.all : stats[platform];

  return {
    reviews,
    total: scoped.total,
    average: scoped.average,
    distribution: scoped.distribution,
    appstoreCount: stats.appstore.total,
    playstoreCount: stats.playstore.total,
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
