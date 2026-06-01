import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-retention — PostHog (HogQL) cohort retention eğrisi.
// Body: { project_id }
// Her offset (D1/D3/D7/D14/D30) için YANSIZ hesap: numerator ve denominator
// aynı "uygun cohort" kümesi üzerinden alınır — yani o offset'e ulaşacak kadar
// eski (>= offset gün önce ilk görülen) ve son 30 cohort günü içindeki kullanıcılar.
// Bu, genç cohort'ların uzun offset'leri aşağı çekmesini (recency bias) önler.

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

const OFFSETS = [1, 3, 7, 14, 30] as const;

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
  const phId = cfg.project_id;
  const apiKey = cfg.api_key;

  const hogql = async (query: string): Promise<unknown[][]> => {
    const r = await fetch(`${host}/api/projects/${phId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });
    if (!r.ok) {
      throw new Error(`PostHog ${r.status}: ${(await r.text()).slice(0, 300)}`);
    }
    return ((await r.json()).results ?? []) as unknown[][];
  };

  // Tek offset için [cohort_size, retained].
  const retentionFor = async (k: number): Promise<{ day: string; pct: number }> => {
    const win = k + 31; // ilk-görülme + aktiflik penceresi
    const rows = await hogql(
      `SELECT
         count(DISTINCT fs.person_id) AS cohort_size,
         count(DISTINCT if(act.d = fs.cohort + INTERVAL ${k} DAY, fs.person_id, NULL)) AS retained
       FROM (
         SELECT person_id, min(toDate(timestamp)) AS cohort
         FROM events
         WHERE timestamp >= now() - INTERVAL ${win} DAY
         GROUP BY person_id
       ) fs
       LEFT JOIN (
         SELECT DISTINCT person_id, toDate(timestamp) AS d
         FROM events
         WHERE timestamp >= now() - INTERVAL ${win} DAY
       ) act ON act.person_id = fs.person_id
       WHERE fs.cohort <= today() - ${k}
         AND fs.cohort >= today() - ${k} - 30`,
    );
    const cohort = Number(rows[0]?.[0] ?? 0);
    const retained = Number(rows[0]?.[1] ?? 0);
    const pct = cohort > 0 ? Number(((retained / cohort) * 100).toFixed(1)) : 0;
    return { day: `D${k}`, pct };
  };

  try {
    const cohorts = await Promise.all(OFFSETS.map((k) => retentionFor(k)));
    return json({ cohorts, days: 30 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
