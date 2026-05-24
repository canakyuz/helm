import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-reviews — App Store public RSS'inden son yorumları çeker, reviews
// tablosuna idempotent upsert eder. Konfig kaynağı:
//   1) project_integrations.config (provider='app_store_connect') — birincil
//   2) projects.app_store_id / app_store_country — geriye uyum
// app_store_country comma-separated olabilir ("tr,us,gb"), her ülke için
// ayrı RSS çağrısı yapılır.

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

interface ProjectRow {
  id: string;
  app_store_id: string | null;
  app_store_country: string | null;
}

interface IntegrationRow {
  project_id: string;
  config: Record<string, unknown> | null;
}

const parseCountries = (raw: string | null | undefined): string[] => {
  if (!raw) return ["us"];
  const list = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : ["us"];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [{ data: projects, error: pErr }, { data: integrations, error: iErr }] =
    await Promise.all([
      hub
        .from("projects")
        .select("id, app_store_id, app_store_country"),
      hub
        .from("project_integrations")
        .select("project_id, config")
        .eq("provider", "app_store_connect")
        .eq("enabled", true),
    ]);
  if (pErr) return json({ error: pErr.message }, 500);
  if (iErr) return json({ error: iErr.message }, 500);

  const integrationByProject = new Map<string, IntegrationRow>();
  for (const it of (integrations ?? []) as IntegrationRow[]) {
    integrationByProject.set(it.project_id, it);
  }

  // Konfig birleştir: integration > projects fallback.
  const targets: Array<{ projectId: string; appId: string; countries: string[] }> = [];
  for (const p of (projects ?? []) as ProjectRow[]) {
    const it = integrationByProject.get(p.id);
    const cfg = (it?.config ?? {}) as Record<string, string | undefined>;
    const appId = (cfg.app_store_id || p.app_store_id || "").trim();
    if (!appId) continue;
    const countries = parseCountries(cfg.app_store_country ?? p.app_store_country);
    targets.push({ projectId: p.id, appId, countries });
  }

  let total = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const t of targets) {
    const perCountry: Array<Record<string, unknown>> = [];
    for (const country of t.countries) {
      const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=${t.appId}/sortby=mostrecent/json`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`RSS ${res.status}`);
        const feed = await res.json();
        const entries: Array<Record<string, any>> = feed.feed?.entry ?? [];

        const rows = entries
          .filter((e) => e["im:rating"]) // ilk girdi app meta — atla
          .map((e) => ({
            project_id: t.projectId,
            source: "appstore",
            external_id: `${country}:${e.id?.label ?? ""}`,
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
        perCountry.push({ country, reviews: rows.length });
      } catch (e) {
        perCountry.push({
          country,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    results.push({ project_id: t.projectId, app_store_id: t.appId, countries: perCountry });
  }

  return json({
    projects: targets.length,
    reviews: total,
    results,
  });
});
