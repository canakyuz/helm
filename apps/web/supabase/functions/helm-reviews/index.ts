// supabase/functions/helm-reviews/index.ts
// Orchestrator: ASC + RSS fallback + Google Play. 30dk cron tarafından çağrılır.
//
// Konfig kaynakları:
//   project_integrations.provider='app_store_connect' enabled=true → ASC API (cfg.app_store_id + cfg.key_id + cfg.issuer_id + cfg.private_key)
//   projects.app_store_id (any value)                              → RSS fallback (cfg yoksa veya ASC fail)
//   project_integrations.provider='google_play_developer' enabled=true → Play API (cfg.service_account_json + cfg.package_name?)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { fetchAscReviews, type AscReviewRow } from "./asc.ts";
import { fetchRssReviews, type RssReviewRow } from "./rss.ts";
import { fetchPlayReviews, type PlayReviewRow } from "./play.ts";

interface ProjectRow {
  id: string;
  app_store_id: string | null;
  app_store_country: string | null;
  google_play_id: string | null;
}

interface IntegrationRow {
  project_id: string;
  provider: string;
  config: Record<string, unknown> | null;
}

type ReviewRow = AscReviewRow | RssReviewRow | PlayReviewRow;

const parseCountries = (raw: string | null | undefined): string[] => {
  if (!raw) return ["us"];
  const list = raw
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : ["us"];
};

async function upsertReviews(
  hub: ReturnType<typeof createClient>,
  rows: ReviewRow[],
): Promise<{ ok: number; errors: string[] }> {
  const errors: string[] = [];
  let ok = 0;
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await hub
      .from("reviews")
      .upsert(chunk, { onConflict: "project_id,source,external_id" });
    if (error) errors.push(error.message);
    else ok += chunk.length;
  }
  return { ok, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const [{ data: projects, error: pErr }, { data: integrations, error: iErr }] =
    await Promise.all([
      hub
        .from("projects")
        .select("id, app_store_id, app_store_country, google_play_id"),
      hub
        .from("project_integrations")
        .select("project_id, provider, config")
        .in("provider", ["app_store_connect", "google_play_developer"])
        .eq("enabled", true),
    ]);
  if (pErr) return json({ error: pErr.message }, 500);
  if (iErr) return json({ error: iErr.message }, 500);

  const ascByProject = new Map<string, IntegrationRow>();
  const playByProject = new Map<string, IntegrationRow>();
  for (const it of (integrations ?? []) as IntegrationRow[]) {
    if (it.provider === "app_store_connect") ascByProject.set(it.project_id, it);
    else if (it.provider === "google_play_developer") playByProject.set(it.project_id, it);
  }

  const projectIds = (projects ?? []).map((p) => (p as ProjectRow).id);
  const sinceMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: maxRows } = await hub
      .from("reviews")
      .select("project_id, review_date")
      .in("project_id", projectIds)
      .order("review_date", { ascending: false })
      .limit(1000);
    for (const r of (maxRows ?? []) as { project_id: string; review_date: string | null }[]) {
      if (!r.review_date) continue;
      const cur = sinceMap.get(r.project_id);
      if (!cur || r.review_date > cur) sinceMap.set(r.project_id, r.review_date);
    }
  }

  const results: Array<Record<string, unknown>> = [];
  const allRows: ReviewRow[] = [];

  const appPromises = (projects ?? []).map(async (p) => {
    const proj = p as ProjectRow;
    const integ = ascByProject.get(proj.id);
    const cfg = (integ?.config ?? {}) as Record<string, string | undefined>;
    const ascAppId = (cfg.app_store_id || proj.app_store_id || "").trim();
    if (!ascAppId) return { projectId: proj.id, app: "skip" };

    const hasAscKey = cfg.key_id && cfg.private_key;
    if (hasAscKey) {
      const r = await fetchAscReviews({
        projectId: proj.id,
        appId: ascAppId,
        ascKey: {
          key_id: cfg.key_id!,
          issuer_id: cfg.issuer_id,
          private_key: cfg.private_key!,
        },
        sinceDate: sinceMap.get(proj.id) ?? null,
      });
      if (r.ok) {
        allRows.push(...r.rows);
        return { projectId: proj.id, app: { method: "asc", count: r.rows.length, pages: r.pages } };
      }
      if (!r.shouldFallback) {
        return { projectId: proj.id, app: { method: "asc", error: r.message, status: r.status } };
      }
    }

    const countries = parseCountries(cfg.app_store_country ?? proj.app_store_country);
    const rss = await fetchRssReviews({ projectId: proj.id, appId: ascAppId, countries });
    allRows.push(...rss.rows);
    return {
      projectId: proj.id,
      app: { method: "rss", count: rss.rows.length, perCountry: rss.perCountry },
    };
  });

  const playPromises = (projects ?? []).map(async (p) => {
    const proj = p as ProjectRow;
    const integ = playByProject.get(proj.id);
    if (!integ) return { projectId: proj.id, play: "skip" };
    const cfg = (integ.config ?? {}) as Record<string, unknown>;
    const saJson = typeof cfg.service_account_json === "string" ? cfg.service_account_json : "";
    const pkgName =
      (typeof cfg.package_name === "string" && cfg.package_name) || proj.google_play_id || "";
    if (!saJson || !pkgName) return { projectId: proj.id, play: "skip" };
    const langs = Array.isArray(cfg.language_codes)
      ? (cfg.language_codes as string[])
      : ["en", "tr"];

    const r = await fetchPlayReviews({
      projectId: proj.id,
      packageName: pkgName,
      serviceAccountJson: saJson,
      languageCodes: langs,
    });
    if ("error" in r) {
      return { projectId: proj.id, play: { error: r.error } };
    }
    allRows.push(...r.rows);
    return { projectId: proj.id, play: { count: r.rows.length, pages: r.pages } };
  });

  const [appResults, playResults] = await Promise.all([
    Promise.allSettled(appPromises),
    Promise.allSettled(playPromises),
  ]);
  for (const r of appResults) {
    if (r.status === "fulfilled") results.push(r.value);
    else results.push({ app: { error: String(r.reason) } });
  }
  for (const r of playResults) {
    if (r.status === "fulfilled") results.push(r.value);
    else results.push({ play: { error: String(r.reason) } });
  }

  const upsertResult = await upsertReviews(hub, allRows);
  const elapsedMs = Date.now() - startedAt;

  await hub.from("audit_log").insert({
    project_id: null,
    target_user: null,
    action: "system.reviews_ingest",
    detail: JSON.stringify({
      total_rows: allRows.length,
      upserted: upsertResult.ok,
      upsert_errors: upsertResult.errors,
      elapsed_ms: elapsedMs,
      projects: (projects ?? []).length,
    }),
    actor_email: "system",
  });

  return json({
    ok: true,
    projects: (projects ?? []).length,
    reviews: upsertResult.ok,
    elapsed_ms: elapsedMs,
    errors: upsertResult.errors,
    results,
  });
});
