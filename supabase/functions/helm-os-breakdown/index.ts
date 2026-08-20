import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-os-breakdown - PostHog (HogQL) OS + sürüm kırılımı (son 30 gün, tekil kullanıcı).
// Body: { project_id }
// Response: { rows: [{ os, version, users, pct }], total, days }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface PostHogConfig {
  project_id?: string | number;
  api_key?: string;
  host?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let projectId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.project_id === "string") projectId = body.project_id;
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
  const cfg = integ?.config as PostHogConfig | undefined;
  if (!cfg?.project_id || !cfg?.api_key) {
    return json({ error: "Bu projede PostHog entegrasyonu yok" }, 400);
  }

  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");

  const r = await fetch(`${host}/api/projects/${cfg.project_id}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query: `SELECT
                  coalesce(nullIf(properties.$os, ''), 'Unknown') AS os,
                  coalesce(nullIf(properties.$os_version, ''), '') AS version,
                  uniq(person_id) AS users
                FROM events
                WHERE timestamp >= now() - INTERVAL 30 DAY
                GROUP BY os, version
                ORDER BY users DESC
                LIMIT 12`,
      },
    }),
  });
  if (!r.ok) {
    return json(
      { error: `PostHog ${r.status}: ${(await r.text()).slice(0, 300)}` },
      500,
    );
  }

  const results = ((await r.json()).results ?? []) as unknown[][];
  const raw = results.map((row) => ({
    os: String(row[0] ?? "Unknown"),
    version: String(row[1] ?? ""),
    users: Number(row[2] ?? 0),
  }));
  const total = raw.reduce((a, b) => a + b.users, 0);
  const rows = raw.map((row) => ({
    ...row,
    pct: total > 0 ? Number(((row.users / total) * 100).toFixed(1)) : 0,
  }));

  return json({ rows, total, days: 30 });
});
