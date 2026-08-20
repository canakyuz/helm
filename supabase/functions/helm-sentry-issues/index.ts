import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-sentry-issues - bağlı Sentry projelerinden top issue listesini çeker.
// On-demand: System sayfası açıldığında çağrılır.
//
// Body: { project_id?: string }  → verilmezse tüm aktif Sentry entegrasyonları.

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

interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit?: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  status: string;
  metadata?: { type?: string; value?: string; filename?: string };
}

interface ProjectIssues {
  project_id: string;
  ok: boolean;
  issues?: Array<{
    id: string;
    short_id: string;
    title: string;
    culprit: string | null;
    level: string;
    count: number;
    user_count: number;
    first_seen: string;
    last_seen: string;
    permalink: string;
    status: string;
    type: string | null;
    value: string | null;
  }>;
  error?: string;
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

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let q = hub
    .from("project_integrations")
    .select("project_id, config")
    .eq("provider", "sentry")
    .eq("enabled", true);
  if (projectId) q = q.eq("project_id", projectId);
  const { data: integs, error } = await q;
  if (error) return json({ error: error.message }, 500);
  if (!integs || integs.length === 0) {
    return json({ projects: [] });
  }

  const projects: ProjectIssues[] = [];
  for (const it of integs) {
    const cfg = it.config as {
      org_slug?: string;
      project_slug?: string;
      auth_token?: string;
      host?: string;
    };
    if (!cfg.org_slug || !cfg.project_slug || !cfg.auth_token) {
      projects.push({
        project_id: it.project_id as string,
        ok: false,
        error: "Sentry config eksik (org_slug/project_slug/auth_token)",
      });
      continue;
    }
    const host = (cfg.host || "https://sentry.io").replace(/\/+$/, "");
    // sort=freq → en sık görülen önce; limit=20 yeterli (top 10 ana hedef)
    const url = `${host}/api/0/projects/${cfg.org_slug}/${cfg.project_slug}/issues/?statsPeriod=14d&sort=freq&limit=20&query=is:unresolved`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.auth_token}` },
      });
      if (!res.ok) {
        projects.push({
          project_id: it.project_id as string,
          ok: false,
          error: `Sentry ${res.status}: ${await res.text()}`,
        });
        continue;
      }
      const issues = (await res.json()) as SentryIssue[];
      projects.push({
        project_id: it.project_id as string,
        ok: true,
        issues: issues.map((i) => ({
          id: i.id,
          short_id: i.shortId,
          title: i.title,
          culprit: i.culprit ?? null,
          level: i.level,
          count: Number(i.count ?? 0),
          user_count: Number(i.userCount ?? 0),
          first_seen: i.firstSeen,
          last_seen: i.lastSeen,
          permalink: i.permalink,
          status: i.status,
          type: i.metadata?.type ?? null,
          value: i.metadata?.value ?? null,
        })),
      });
    } catch (e) {
      projects.push({
        project_id: it.project_id as string,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({ projects });
});
