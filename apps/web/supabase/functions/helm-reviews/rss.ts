// supabase/functions/helm-reviews/rss.ts
// iTunes RSS — public, auth gerektirmez. ASC fallback'i olarak kalır.

export interface RssReviewRow {
  project_id: string;
  source: "appstore";
  source_method: "rss";
  external_id: string;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  territory: string;
  app_version: string | null;
  developer_response: string | null;
  responded_at: string | null;
  review_date: string | null;
}

export interface RssFetchInput {
  projectId: string;
  appId: string;
  countries: string[];
}

export interface RssFetchResult {
  rows: RssReviewRow[];
  perCountry: Array<{ country: string; reviews: number; error?: string }>;
}

export async function fetchRssReviews(
  input: RssFetchInput,
): Promise<RssFetchResult> {
  const rows: RssReviewRow[] = [];
  const perCountry: RssFetchResult["perCountry"] = [];

  for (const country of input.countries) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${input.appId}/sortby=mostrecent/json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`RSS ${res.status}`);
      const feed = await res.json();
      const raw = feed.feed?.entry;
      const entries: Array<Record<string, any>> = Array.isArray(raw)
        ? raw
        : raw
        ? [raw]
        : [];

      const countryRows = entries
        .filter((e) => e["im:rating"])
        .map((e): RssReviewRow => ({
          project_id: input.projectId,
          source: "appstore",
          source_method: "rss",
          external_id: `rss:${country}:${e.id?.label ?? ""}`,
          author: e.author?.name?.label ?? null,
          rating: Number(e["im:rating"]?.label ?? 0) || null,
          title: e.title?.label ?? null,
          body: e.content?.label ?? null,
          territory: country,
          app_version: e["im:version"]?.label ?? null,
          developer_response: null,
          responded_at: null,
          review_date: e.updated?.label ?? null,
        }));

      rows.push(...countryRows);
      perCountry.push({ country, reviews: countryRows.length });
    } catch (e) {
      perCountry.push({
        country,
        reviews: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { rows, perCountry };
}
