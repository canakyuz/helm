import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./_shared/cors.ts";
import { type Connector } from "./connectors/types.ts";
import { fetchRevenueCat } from "./connectors/revenuecat.ts";
import { fetchAdMob } from "./connectors/admob.ts";
import { fetchPostHog } from "./connectors/posthog.ts";
import { fetchSupabaseUsers } from "./connectors/supabase-users.ts";

// helm-ingest — her enabled entegrasyonu gezer, sağlayıcı API'sini çağırır,
// metrics tablosuna idempotent upsert eder. Gece pg_cron tetikler;
// panelden "Şimdi senkronize et" ile manuel de çağrılır.

const CONNECTORS: Record<string, Connector> = {
  revenuecat: fetchRevenueCat,
  admob: fetchAdMob,
  posthog: fetchPostHog,
  supabase: fetchSupabaseUsers,
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

  const { data: integrations, error } = await hub
    .from("project_integrations")
    .select("id, project_id, provider, config")
    .eq("enabled", true);

  if (error) return json({ error: error.message }, 500);

  let ingested = 0;
  const results: Array<Record<string, unknown>> = [];
  const syncedAt = new Date().toISOString();

  for (const it of integrations ?? []) {
    try {
      const connector = CONNECTORS[it.provider];
      if (!connector) throw new Error(`Bilinmeyen sağlayıcı: ${it.provider}`);

      const points = await connector(it.config ?? {});
      const rows = points.map((p) => ({
        project_id: it.project_id,
        date: p.date,
        source: it.provider,
        metric: p.metric,
        value: p.value,
      }));

      if (rows.length > 0) {
        const { error: upErr } = await hub
          .from("metrics")
          .upsert(rows, { onConflict: "project_id,date,source,metric" });
        if (upErr) throw new Error(upErr.message);
      }

      ingested += rows.length;
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
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
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

  return json({ ingested, results });
});
