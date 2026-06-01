import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-posthog-events — bağlı PostHog projesinin event tanımlarını çeker.
// Funnel adımlarını elle yazmamak için: "son görülenden" sıralı top N.
// Body: { project_id }
// Yanıt: { events: [{ name, last_seen_at, volume_30_day? }] }

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

interface PHEvent {
  name: string;
  last_seen_at?: string | null;
  volume_30_day?: number | null;
  query_usage_30_day?: number | null;
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
  const cfg = integ?.config as
    | { project_id?: string | number; api_key?: string; host?: string }
    | undefined;
  if (!cfg?.project_id || !cfg?.api_key) {
    return json({ error: "PostHog entegrasyonu yok" }, 400);
  }
  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");

  const url = `${host}/api/projects/${cfg.project_id}/event_definitions/?limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.api_key}` },
  });
  if (!res.ok) {
    return json(
      { error: `PostHog ${res.status}: ${(await res.text()).slice(0, 300)}` },
      500,
    );
  }
  const data = await res.json();
  const all: PHEvent[] = data?.results ?? [];

  // $autocapture / $pageview gibi sistem event'leri sona at
  const isSystem = (n: string) => n.startsWith("$");
  const events = all
    .map((e) => ({
      name: e.name,
      last_seen_at: e.last_seen_at ?? null,
      volume_30_day: e.volume_30_day ?? null,
      system: isSystem(e.name),
    }))
    .sort((a, b) => {
      // Önce custom event'ler, sonra system; her grupta last_seen desc
      if (a.system !== b.system) return a.system ? 1 : -1;
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return tb - ta;
    });

  return json({ events, total: events.length });
});
