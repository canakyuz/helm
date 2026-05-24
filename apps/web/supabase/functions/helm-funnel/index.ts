import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-funnel — PostHog'tan sıralı funnel hesaplaması.
// Body: { project_id, days?: number }
//   days default 30
// PostHog Funnels API ile sıralı adım conversion'u — gerçek "kullanıcı 1→2→3"
// sıralı funnel. Her adımın unique_users count'unu ve önceki adıma göre
// conversion oranını döner.

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
  funnel_steps?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
  const cfg = integ?.config as PostHogConfig | undefined;
  if (!cfg?.project_id || !cfg?.api_key) {
    return json({ error: "Bu projede PostHog entegrasyonu yok" }, 400);
  }
  const stepsRaw = (cfg.funnel_steps ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stepsRaw.length < 2) {
    return json(
      {
        error:
          "PostHog config'inde en az 2 funnel_steps tanımlı olmalı (virgülle ayır)",
      },
      400,
    );
  }

  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");
  const phProjectId = cfg.project_id;

  // PostHog Funnel API
  // POST /api/projects/:id/query/ — HogQL/InsightVizNode kabul eder.
  // Funnel için "FunnelsQuery" kind kullan.
  const body = {
    query: {
      kind: "FunnelsQuery",
      dateRange: { date_from: `-${days}d` },
      series: stepsRaw.map((event) => ({
        kind: "EventsNode",
        event,
        math: "dau", // unique users
      })),
      funnelsFilter: {
        funnelOrderType: "ordered",
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${host}/api/projects/${phProjectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }

  if (!res.ok) {
    return json(
      {
        error: `PostHog ${res.status}: ${(await res.text()).slice(0, 500)}`,
      },
      500,
    );
  }

  const data = await res.json();
  // FunnelsQuery yanıtı:
  // { results: [{ name, count, order, ... }, ...] }
  // Bazı sürümlerde results doğrudan dizi; bazılarında { results: { results: [...] } }.
  const results: Array<{ name?: string; count?: number; order?: number }> =
    data?.results?.results ?? data?.results ?? [];

  const steps = stepsRaw.map((event, i) => {
    const match = results.find(
      (r) => r.order === i || r.name === event,
    );
    return {
      event,
      order: i,
      count: Number(match?.count ?? 0),
    };
  });

  const first = steps[0]?.count ?? 0;
  const enriched = steps.map((s, i) => {
    const overall = first > 0 ? (s.count / first) * 100 : 0;
    const prev = i > 0 ? steps[i - 1].count : s.count;
    const step = prev > 0 ? (s.count / prev) * 100 : 0;
    const drop = i > 0 ? prev - s.count : 0;
    return {
      ...s,
      overall_pct: Number(overall.toFixed(2)),
      step_pct: Number(step.toFixed(2)),
      drop,
    };
  });

  return json({
    days,
    steps: enriched,
    total_entered: first,
    total_converted: enriched[enriched.length - 1]?.count ?? 0,
    overall_conversion:
      first > 0
        ? Number(
            ((enriched[enriched.length - 1]?.count ?? 0) / first * 100).toFixed(
              2,
            ),
          )
        : 0,
  });
});
