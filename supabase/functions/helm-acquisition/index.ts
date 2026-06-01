import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-acquisition — PostHog $initial_referrer breakdown.
// Kullanıcı edinme kaynakları: direct / google / facebook / referral.
//
// Body: { project_id, days?: number }
// Yanıt: { rows: [{ source, source_type, users }], total }

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

// Raw referrer → temiz kategori
const categorize = (raw: string): { source: string; type: string } => {
  if (!raw || raw === "$direct" || raw === "(direct)") {
    return { source: "Doğrudan", type: "direct" };
  }
  const r = raw.toLowerCase();
  if (r.includes("google")) return { source: "Google", type: "search" };
  if (r.includes("bing")) return { source: "Bing", type: "search" };
  if (r.includes("duckduckgo")) return { source: "DuckDuckGo", type: "search" };
  if (r.includes("facebook") || r.includes("fb.com"))
    return { source: "Facebook", type: "social" };
  if (r.includes("instagram")) return { source: "Instagram", type: "social" };
  if (r.includes("twitter") || r.includes("t.co") || r.includes("x.com"))
    return { source: "Twitter/X", type: "social" };
  if (r.includes("tiktok")) return { source: "TikTok", type: "social" };
  if (r.includes("linkedin")) return { source: "LinkedIn", type: "social" };
  if (r.includes("reddit")) return { source: "Reddit", type: "social" };
  if (r.includes("youtube")) return { source: "YouTube", type: "social" };
  if (r.includes("apple") || r.includes("app-store"))
    return { source: "App Store", type: "store" };
  if (r.includes("play.google"))
    return { source: "Play Store", type: "store" };
  // Domain çıkar
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return { source: url.hostname.replace(/^www\./, ""), type: "referral" };
  } catch {
    return { source: raw.slice(0, 30), type: "referral" };
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let projectId: string | undefined;
  let days = 30;
  try {
    const body = await req.json();
    if (typeof body?.project_id === "string") projectId = body.project_id;
    if (typeof body?.days === "number" && body.days > 0) days = body.days;
  } catch {
    // gövde yok
  }
  if (!projectId) return json({ error: "project_id gerekli" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: integ } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", projectId)
    .eq("provider", "posthog")
    .eq("enabled", true)
    .maybeSingle();
  const cfg = integ?.config as
    | { project_id?: string | number; api_key?: string; host?: string }
    | undefined;
  if (!cfg?.project_id || !cfg?.api_key) {
    return json({ error: "PostHog entegrasyonu yok" }, 400);
  }
  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");

  const hogql = `
    SELECT
      properties.$initial_referrer AS referrer,
      count(DISTINCT person_id) AS users
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
      AND properties.$initial_referrer IS NOT NULL
    GROUP BY referrer
    ORDER BY users DESC
    LIMIT 100
  `;

  const res = await fetch(`${host}/api/projects/${cfg.project_id}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
  });
  if (!res.ok) {
    return json(
      { error: `PostHog ${res.status}: ${(await res.text()).slice(0, 500)}` },
      500,
    );
  }
  const data = await res.json();
  const results: unknown[][] = data?.results ?? [];

  // Kategori bazlı topla
  const byCategory = new Map<string, { source: string; type: string; users: number }>();
  for (const r of results) {
    const raw = (r[0] as string) ?? "";
    const users = Number(r[1] ?? 0);
    if (users === 0) continue;
    const cat = categorize(raw);
    const key = cat.source;
    const existing = byCategory.get(key);
    if (existing) existing.users += users;
    else byCategory.set(key, { ...cat, users });
  }

  const rows = Array.from(byCategory.values()).sort((a, b) => b.users - a.users);
  const total = rows.reduce((s, r) => s + r.users, 0);

  return json({ rows, total, days });
});
