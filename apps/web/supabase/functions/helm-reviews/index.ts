import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-reviews — App Store yorum RSS'inden (auth'suz, public) son yorumları
// çeker, reviews tablosuna idempotent upsert eder. App Store ID tanımlı
// projeler taranır.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: projects, error } = await hub
    .from("projects")
    .select("id, app_store_id, app_store_country")
    .not("app_store_id", "is", null);
  if (error) return json({ error: error.message }, 500);

  let total = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const p of projects ?? []) {
    const country = (p.app_store_country as string) || "us";
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${p.app_store_id}/sortby=mostrecent/json`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`RSS ${res.status}`);
      const feed = await res.json();
      const entries: Array<Record<string, any>> = feed.feed?.entry ?? [];

      const rows = entries
        .filter((e) => e["im:rating"]) // ilk girdi app bilgisi — atla
        .map((e) => ({
          project_id: p.id,
          source: "appstore",
          external_id: e.id?.label ?? null,
          author: e.author?.name?.label ?? null,
          rating: Number(e["im:rating"]?.label ?? 0),
          title: e.title?.label ?? null,
          body: e.content?.label ?? null,
          review_date: e.updated?.label ?? null,
        }));

      if (rows.length > 0) {
        const { error: upErr } = await hub
          .from("reviews")
          .upsert(rows, { onConflict: "project_id,source,external_id" });
        if (upErr) throw new Error(upErr.message);
        total += rows.length;
      }
      results.push({ project_id: p.id, reviews: rows.length });
    } catch (e) {
      results.push({
        project_id: p.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({ projects: projects?.length ?? 0, reviews: total, results });
});
