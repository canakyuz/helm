import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./_shared/cors.ts";
import { type Connector } from "./connectors/types.ts";
import { fetchRevenueCat } from "./connectors/revenuecat.ts";
import { fetchAdMob } from "./connectors/admob.ts";
import { fetchPostHog } from "./connectors/posthog.ts";
import { fetchSupabaseUsers } from "./connectors/supabase-users.ts";
import { fetchStripe } from "./connectors/stripe.ts";
import { fetchPlausible } from "./connectors/plausible.ts";
import { fetchRest } from "./connectors/rest.ts";
import { fetchSentry } from "./connectors/sentry.ts";
import { fetchAppStoreConnect } from "./connectors/app-store-connect.ts";

// helm-ingest — her enabled entegrasyonu gezer, sağlayıcı API'sini çağırır,
// metrics tablosuna idempotent upsert eder. Her çalışma sync_runs'a kaydedilir.

const CONNECTORS: Record<string, Connector> = {
  revenuecat: fetchRevenueCat,
  admob: fetchAdMob,
  posthog: fetchPostHog,
  supabase: fetchSupabaseUsers,
  stripe: fetchStripe,
  plausible: fetchPlausible,
  rest: fetchRest,
  sentry: fetchSentry,
  app_store_connect: fetchAppStoreConnect,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // İstek gövdesi: trigger (panel "manual", cron yok) + opsiyonel project_id.
  let trigger: "manual" | "cron" = "cron";
  let projectId: string | undefined;
  try {
    const body = await req.json();
    if (body?.trigger === "manual") trigger = "manual";
    if (typeof body?.project_id === "string") projectId = body.project_id;
  } catch {
    // gövde yok — cron
  }

  // Çalışmayı kaydet.
  const { data: run } = await hub
    .from("sync_runs")
    .insert({ trigger })
    .select("id")
    .single();
  const runId = run?.id as number | undefined;

  // project_id verilirse yalnızca o projeyi senkronla.
  let integrationsQuery = hub
    .from("project_integrations")
    .select("id, project_id, provider, config")
    .eq("enabled", true);
  if (projectId) {
    integrationsQuery = integrationsQuery.eq("project_id", projectId);
  }
  const { data: integrations, error } = await integrationsQuery;

  if (error) {
    if (runId) {
      await hub
        .from("sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          error_count: 1,
          details: { error: error.message },
        })
        .eq("id", runId);
    }
    return json({ error: error.message }, 500);
  }

  let ingested = 0;
  let okCount = 0;
  let errorCount = 0;
  const results: Array<Record<string, unknown>> = [];
  const syncedAt = new Date().toISOString();

  for (const it of integrations ?? []) {
    try {
      const connector = CONNECTORS[it.provider];
      if (!connector) throw new Error(`Bilinmeyen sağlayıcı: ${it.provider}`);

      const result = await connector(it.config ?? {});
      // Geriye uyumluluk: connector ya düz dizi ya da {points, byCountry} döner.
      const points = Array.isArray(result) ? result : result.points;
      const byCountry = Array.isArray(result) ? [] : (result.byCountry ?? []);

      // Kaynak para birimi — config'ten (AdMob TRY, App Store vendor ccy…),
      // yoksa USD (RevenueCat/Stripe USD raporlar). Değer HAM saklanır; gösterim
      // katmanı metrics.currency'den USD'ye normalize eder.
      const sourceCurrency =
        ((it.config as { currency?: string } | null)?.currency) || "USD";
      const rows = points.map((p) => ({
        project_id: it.project_id,
        date: p.date,
        source: it.provider,
        metric: p.metric,
        value: p.value,
        currency: sourceCurrency,
      }));

      if (rows.length > 0) {
        const { error: upErr } = await hub
          .from("metrics")
          .upsert(rows, { onConflict: "project_id,date,source,metric" });
        if (upErr) throw new Error(upErr.message);
      }

      // Ülke kırılımı — metrics_country tablosuna.
      if (byCountry.length > 0) {
        const countryRows = byCountry.map((p) => ({
          project_id: it.project_id,
          date: p.date,
          source: it.provider,
          metric: p.metric,
          country_code: p.country_code,
          value: p.value,
        }));
        const { error: ccErr } = await hub
          .from("metrics_country")
          .upsert(countryRows, {
            onConflict: "project_id,date,source,metric,country_code",
          });
        if (ccErr) throw new Error(ccErr.message);
      }

      ingested += rows.length + byCountry.length;
      okCount++;
      await hub
        .from("project_integrations")
        .update({
          last_synced_at: syncedAt,
          last_sync_status: "ok",
          last_sync_error: null,
        })
        .eq("id", it.id);

      results.push({
        provider: it.provider,
        project_id: it.project_id,
        points: rows.length,
        country_points: byCountry.length,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errorCount++;
      await hub
        .from("project_integrations")
        .update({
          last_synced_at: syncedAt,
          last_sync_status: "error",
          last_sync_error: message,
        })
        .eq("id", it.id);

      results.push({
        provider: it.provider,
        project_id: it.project_id,
        error: message,
      });
    }
  }

  // Çalışmayı kapat.
  if (runId) {
    await hub
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        ingested,
        ok_count: okCount,
        error_count: errorCount,
        details: results,
      })
      .eq("id", runId);
  }

  // Senkron sonrası uyarı kurallarını değerlendir (fire-and-forget).
  try {
    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/helm-alert`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
  } catch {
    // uyarı değerlendirmesi senkronu bloklamasın
  }

  return json({ ingested, ok: okCount, errors: errorCount, results });
});
