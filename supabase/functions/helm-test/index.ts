import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type Connector } from "../helm-ingest/connectors/types.ts";
import { fetchRevenueCat } from "../helm-ingest/connectors/revenuecat.ts";
import { fetchAdMob } from "../helm-ingest/connectors/admob.ts";
import { fetchPostHog } from "../helm-ingest/connectors/posthog.ts";
import { fetchSupabaseUsers } from "../helm-ingest/connectors/supabase-users.ts";
import { fetchStripe } from "../helm-ingest/connectors/stripe.ts";
import { fetchPlausible } from "../helm-ingest/connectors/plausible.ts";
import { fetchRest } from "../helm-ingest/connectors/rest.ts";
import { fetchSentry } from "../helm-ingest/connectors/sentry.ts";
import { getPlayAccessToken } from "../_shared/play-oauth.ts";

// helm-test - tek bir entegrasyonu çalıştırır, sonucu DB'ye YAZMADAN döner.
// Panel "Test" butonu için: gelen veriyi gözle inceleyebilmek.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let integrationId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.integration_id === "string") {
      integrationId = body.integration_id;
    }
  } catch {
    // gövde yok
  }
  if (!integrationId) {
    return json({ error: "integration_id gerekli" }, 400);
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: integ, error } = await hub
    .from("project_integrations")
    .select("provider, config")
    .eq("id", integrationId)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!integ) return json({ error: "Integration not found" }, 404);

  const t0 = Date.now();

  // Non-metric provider'lar için özel "ping" testleri - connector mantığı yok,
  // sadece auth/erişim doğrulanır.
  if (integ.provider === "google_play_developer") {
    const cfg = (integ.config ?? {}) as Record<string, string | undefined>;
    if (!cfg.service_account_json) {
      return json({
        ok: false,
        provider: integ.provider,
        duration_ms: Date.now() - t0,
        error: "service_account_json eksik",
      });
    }
    try {
      await getPlayAccessToken(cfg.service_account_json);
      return json({
        ok: true,
        provider: integ.provider,
        duration_ms: Date.now() - t0,
        count: 0,
        points: [],
        message:
          "OAuth token succeeded. Reviews are handled by helm-reviews and versions by helm-versions.",
      });
    } catch (e) {
      return json({
        ok: false,
        provider: integ.provider,
        duration_ms: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const connector = CONNECTORS[integ.provider as string];
  if (!connector) {
    return json({ error: `Unknown provider: ${integ.provider}` }, 400);
  }

  try {
    const points = await connector(integ.config ?? {});
    const ms = Date.now() - t0;
    return json({
      ok: true,
      provider: integ.provider,
      duration_ms: ms,
      count: points.length,
      points: points.slice(0, 100), // ilk 100 - UI'da göstermek için
    });
  } catch (e) {
    return json({
      ok: false,
      provider: integ.provider,
      duration_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
