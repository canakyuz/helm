import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type Connector, type MetricPoint } from "../helm-ingest/connectors/types.ts";
import { fetchRevenueCat } from "../helm-ingest/connectors/revenuecat.ts";
import { fetchAdMob } from "../helm-ingest/connectors/admob.ts";
import { fetchPostHog } from "../helm-ingest/connectors/posthog.ts";
import { fetchSupabaseUsers } from "../helm-ingest/connectors/supabase-users.ts";
import { fetchStripe } from "../helm-ingest/connectors/stripe.ts";
import { fetchPlausible } from "../helm-ingest/connectors/plausible.ts";
import { fetchRest } from "../helm-ingest/connectors/rest.ts";
import { fetchSentry } from "../helm-ingest/connectors/sentry.ts";

// helm-verify — bir entegrasyonun connector'ını koşar + son N gün
// stored metric'leri okur + (date, metric) üzerinden DIFF tablosu döner.
// "upstream gerçekte ne döndü vs helm DB'ye ne yazdı" — yanyana.

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

const CONNECTORS: Record<string, Connector> = {
  revenuecat: fetchRevenueCat,
  admob: fetchAdMob,
  posthog: fetchPostHog,
  supabase: fetchSupabaseUsers,
  stripe: fetchStripe,
  plausible: fetchPlausible,
  rest: fetchRest,
  sentry: fetchSentry,
};

type DiffStatus = "match" | "mismatch" | "missing_stored" | "missing_upstream";

interface DiffRow {
  date: string;
  metric: string;
  upstream: number | null;
  stored: number | null;
  delta: number | null;
  delta_pct: number | null;
  status: DiffStatus;
}

const EPS = 1e-6;
const key = (p: { date: string; metric: string }) => `${p.date}|${p.metric}`;

/**
 * O(n + m). Set union + iki Map lookup ile her (date, metric) için 1 satır.
 */
function buildDiff(upstream: MetricPoint[], stored: MetricPoint[]): DiffRow[] {
  const upMap = new Map(upstream.map((p) => [key(p), p.value]));
  const stMap = new Map(stored.map((p) => [key(p), p.value]));
  const keys = new Set<string>([...upMap.keys(), ...stMap.keys()]);

  const rows: DiffRow[] = [];
  for (const k of keys) {
    const [date, metric] = k.split("|");
    const up = upMap.has(k) ? (upMap.get(k) as number) : null;
    const st = stMap.has(k) ? (stMap.get(k) as number) : null;

    let status: DiffStatus;
    let delta: number | null = null;
    let delta_pct: number | null = null;

    if (up === null) {
      status = "missing_upstream";
    } else if (st === null) {
      status = "missing_stored";
    } else {
      delta = up - st;
      delta_pct = Math.abs(st) > EPS ? (delta / st) * 100 : null;
      status = Math.abs(delta) < EPS ? "match" : "mismatch";
    }
    rows.push({ date, metric, upstream: up, stored: st, delta, delta_pct, status });
  }

  rows.sort(
    (a, b) => b.date.localeCompare(a.date) || a.metric.localeCompare(b.metric),
  );
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let body: { integration_id?: string; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    // gövde yok
  }

  const integrationId = body.integration_id;
  const days =
    typeof body.days === "number" && body.days > 0
      ? Math.min(Math.floor(body.days), 90)
      : 7;
  if (!integrationId) {
    return json({ error: "integration_id gerekli" }, 400);
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: integ, error: integErr } = await hub
    .from("project_integrations")
    .select("provider, config, project_id")
    .eq("id", integrationId)
    .maybeSingle();
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integ) return json({ error: "Integration not found" }, 404);

  const connector = CONNECTORS[integ.provider as string];
  if (!connector) {
    return json({ error: `Unknown provider: ${integ.provider}` }, 400);
  }

  const t0 = Date.now();
  let upstream: MetricPoint[];
  try {
    upstream = await connector(integ.config ?? {});
  } catch (e) {
    return json({
      ok: false,
      provider: integ.provider,
      duration_ms: Date.now() - t0,
      error: `Connector error: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  // Son N günlük pencere
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: storedRows, error: mErr } = await hub
    .from("metrics")
    .select("date, metric, value")
    .eq("project_id", integ.project_id)
    .eq("source", integ.provider)
    .gte("date", since)
    .order("date", { ascending: false });
  if (mErr) return json({ error: mErr.message }, 500);

  const upstreamWindow = upstream.filter((p) => p.date >= since);
  const stored: MetricPoint[] = (storedRows ?? []).map((r) => ({
    date: r.date as string,
    metric: r.metric as string,
    value: Number(r.value),
  }));

  const diffs = buildDiff(upstreamWindow, stored);

  const summary = {
    match: 0,
    mismatch: 0,
    missing_stored: 0,
    missing_upstream: 0,
  };
  for (const d of diffs) summary[d.status]++;

  // Sayfa boyutunu sınırla — UI rahat çizsin
  const MAX = 200;
  return json({
    ok: true,
    provider: integ.provider,
    project_id: integ.project_id,
    duration_ms: Date.now() - t0,
    days,
    counts: {
      upstream_total: upstream.length,
      upstream_in_window: upstreamWindow.length,
      stored_in_window: stored.length,
    },
    summary,
    diffs: diffs.slice(0, MAX),
    truncated: diffs.length > MAX,
  });
});
