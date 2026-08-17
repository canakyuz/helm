import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

// helm-game-ingest — istemci oyunlardan telemetri/hata push'u (Sentry'siz).
// JWT istemez (--no-verify-jwt ile deploy); auth = body.project_id + body.token
// (properties.ingest_token ile eşleşmeli, tahmin edilemez UUID).
//
// Body:
//   {
//     "project_id": "uuid",
//     "token": "uuid",
//     "app_version": "1.2.0",         // ops.
//     "platform": "iOS",              // ops.
//     "events": [
//       { "type": "error",   "key": "ad_load_fail", "details": {...}, "occurred_at": "..." },
//       { "type": "session", "value": 142 },                          // süre sn
//       { "type": "metric",  "key": "fps_p95", "value": 58 },
//       { "type": "ad",      "key": "banner" },
//       { "type": "purchase","key": "remove_ads", "value": 4.99 }
//     ]
//   }
// type ∈ error | crash | session | metric | ad | purchase
//
// Ham event'ler game_events'e yazılır; günlük SAYIMLAR metrics'e (source='game')
// idempotent upsert edilir (her seferinde o günün toplamı game_events'ten yeniden
// sayılır → tekrar gönderim çift saymaz).

const MAX_EVENTS = 200;
const VALID = new Set(["error", "crash", "session", "metric", "ad", "purchase"]);

// event_type -> günlük sayım metriği (metrics.metric). 'metric' tipi ham kalır.
const COUNT_METRIC: Record<string, string> = {
  error: "errors",
  crash: "crashes",
  session: "sessions",
  ad: "ad_impressions",
  purchase: "purchases",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST gerekli" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const projectId = body?.project_id;
  const token = body?.token;
  if (typeof projectId !== "string" || typeof token !== "string") {
    return json({ error: "project_id + token gerekli" }, 400);
  }
  const events = Array.isArray(body?.events) ? body.events : [];
  if (events.length === 0) return json({ error: "events is empty" }, 400);
  if (events.length > MAX_EVENTS) return json({ error: `en fazla ${MAX_EVENTS} event` }, 413);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: project_id + token eşleşmesi.
  const { data: prop, error: perr } = await hub
    .from("properties")
    .select("id")
    .eq("id", projectId)
    .eq("ingest_token", token)
    .maybeSingle();
  if (perr) return json({ error: perr.message }, 500);
  if (!prop) return json({ error: "yetkisiz" }, 401);

  const platform = typeof body.platform === "string" ? body.platform.slice(0, 32) : null;
  const appVersion = typeof body.app_version === "string" ? body.app_version.slice(0, 32) : null;
  const nowIso = new Date().toISOString();

  const rows: Record<string, unknown>[] = [];
  for (const e of events) {
    const type = String(e?.type ?? "");
    if (!VALID.has(type)) continue;
    const occurred = typeof e?.occurred_at === "string" ? e.occurred_at : nowIso;
    rows.push({
      project_id: projectId,
      event_type: type,
      event_key: typeof e?.key === "string" ? e.key.slice(0, 120) : null,
      value: typeof e?.value === "number" && isFinite(e.value) ? e.value : null,
      details: e?.details && typeof e.details === "object" ? e.details : null,
      app_version: appVersion,
      platform,
      occurred_at: occurred,
    });
  }
  if (rows.length === 0) return json({ error: "no valid events" }, 400);

  const { error: ierr } = await hub.from("game_events").insert(rows);
  if (ierr) return json({ error: ierr.message }, 500);

  // Etkilenen (gün, sayım-metriği) çiftlerini topla, her birini yeniden say + upsert.
  const pairs = new Set<string>(); // `${date}|${metric}`
  for (const r of rows) {
    const metric = COUNT_METRIC[r.event_type as string];
    if (!metric) continue;
    const date = (r.occurred_at as string).slice(0, 10);
    pairs.add(`${date}|${metric}`);
  }

  for (const pair of pairs) {
    const [date, metric] = pair.split("|");
    const eventType = Object.keys(COUNT_METRIC).find((k) => COUNT_METRIC[k] === metric)!;
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const { count, error: cerr } = await hub
      .from("game_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("event_type", eventType)
      .gte("occurred_at", `${date}T00:00:00Z`)
      .lt("occurred_at", next.toISOString());
    if (cerr) continue;
    await hub.from("metrics").upsert(
      {
        project_id: projectId,
        date,
        source: "game",
        metric,
        value: count ?? 0,
        ingested_at: nowIso,
      },
      { onConflict: "project_id,date,source,metric" },
    );
  }

  return json({ ok: true, accepted: rows.length });
});
