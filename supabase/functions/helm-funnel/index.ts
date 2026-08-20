import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-funnel - PostHog'tan sıralı funnel hesaplaması.
// Body: { project_id, days?: number }
//   days default 30
// PostHog Funnels API ile sıralı adım conversion'u - gerçek "kullanıcı 1→2→3"
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
          "The PostHog config needs at least 2 funnel_steps (comma-separated)",
      },
      400,
    );
  }

  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");
  const phProjectId = cfg.project_id;

  // PostHog Funnel API
  // POST /api/projects/:id/query/ - HogQL/InsightVizNode kabul eder.
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

  // Helper: bir tarih aralığı için funnel hesabı
  const fetchFunnel = async (dateFrom: string, dateTo?: string) => {
    const series = stepsRaw.map((event) => ({
      kind: "EventsNode",
      event,
      math: "dau",
    }));
    const dateRange: { date_from: string; date_to?: string } = {
      date_from: dateFrom,
    };
    if (dateTo) dateRange.date_to = dateTo;
    const reqBody = {
      query: {
        kind: "FunnelsQuery",
        dateRange,
        series,
        funnelsFilter: { funnelOrderType: "ordered" },
      },
    };
    const r = await fetch(`${host}/api/projects/${phProjectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });
    if (!r.ok) {
      throw new Error(
        `PostHog ${r.status}: ${(await r.text()).slice(0, 300)}`,
      );
    }
    const d = await r.json();
    const results: Array<{ name?: string; count?: number; order?: number }> =
      d?.results?.results ?? d?.results ?? [];
    return stepsRaw.map((event, i) => {
      const match = results.find(
        (rr) => rr.order === i || rr.name === event,
      );
      return { event, order: i, count: Number(match?.count ?? 0) };
    });
  };

  // Mevcut periyot
  let steps: Array<{ event: string; order: number; count: number }>;
  // Önceki periyot (karşılaştırma)
  let prevSteps: Array<{ event: string; order: number; count: number }> | null =
    null;
  try {
    steps = await fetchFunnel(`-${days}d`);
    // Önceki periyot - N gün öncesi, N gün uzunluğunda
    prevSteps = await fetchFunnel(`-${days * 2}d`, `-${days}d`);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }

  const first = steps[0]?.count ?? 0;
  const prevFirst = prevSteps?.[0]?.count ?? 0;
  const enriched = steps.map((s, i) => {
    const overall = first > 0 ? (s.count / first) * 100 : 0;
    const prev = i > 0 ? steps[i - 1].count : s.count;
    const step = prev > 0 ? (s.count / prev) * 100 : 0;
    const drop = i > 0 ? prev - s.count : 0;
    const prevCount = prevSteps?.[i]?.count ?? 0;
    const deltaPct =
      prevCount > 0 ? ((s.count - prevCount) / prevCount) * 100 : null;
    return {
      ...s,
      overall_pct: Number(overall.toFixed(2)),
      step_pct: Number(step.toFixed(2)),
      drop,
      prev_count: prevCount,
      delta_pct: deltaPct === null ? null : Number(deltaPct.toFixed(1)),
    };
  });

  const lastCount = enriched[enriched.length - 1]?.count ?? 0;
  const prevLastCount = prevSteps?.[prevSteps.length - 1]?.count ?? 0;
  const overallConversion =
    first > 0 ? Number(((lastCount / first) * 100).toFixed(2)) : 0;
  const prevOverallConversion =
    prevFirst > 0
      ? Number(((prevLastCount / prevFirst) * 100).toFixed(2))
      : 0;

  return json({
    days,
    steps: enriched,
    total_entered: first,
    total_converted: lastCount,
    overall_conversion: overallConversion,
    prev_total_entered: prevFirst,
    prev_total_converted: prevLastCount,
    prev_overall_conversion: prevOverallConversion,
  });
});
