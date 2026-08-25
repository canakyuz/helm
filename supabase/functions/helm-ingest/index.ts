import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./_shared/cors.ts";
// SAAT DILIMI NOTU: baglayicilar rapor penceresini UTC'ye gore kurar ama
// saglayicilar HESABIN saat diliminde raporlar (AdMob'da Europe/Istanbul, UTC+3).
// Pencere UTC bugune sabitlenirse, yerel gun donumu ile UTC gun donumu arasindaki
// ~3 saatte saglayicinin GUNCEL gunu hic istenmez - panel "bugun" diye dunun
// rakamini gosterir. admob.ts bitisi UTC yarina uzatir; yeni baglayici yazarken
// ayni tuzaga dikkat.

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
import { fetchGooglePlay } from "./connectors/google-play.ts";

// helm-ingest - her enabled entegrasyonu gezer, sağlayıcı API'sini çağırır,
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
  google_play_developer: fetchGooglePlay,
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
    // gövde yok - cron
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

  const syncedAt = new Date().toISOString();
  type Integration = NonNullable<typeof integrations>[number];

  /**
   * Tek bir entegrasyonu senkronlar ve SONUCU DÖNER.
   *
   * NEDEN SAYAÇ MUTASYONU YOK: eskiden gövde `ingested++` / `okCount++` diye
   * dışarıdaki değişkenleri güncelliyordu. Eş zamanlı koşarken bu yarış demek.
   * Sonuçlar dönülüp sonunda toplanıyor - saf fonksiyon, güvenli paralellik.
   */
  async function syncIntegration(it: Integration): Promise<Record<string, unknown>> {
    try {
      const connector = CONNECTORS[it.provider];
      if (!connector) throw new Error(`Unknown provider: ${it.provider}`);

      const result = await connector(it.config ?? {});
      // Geriye uyumluluk: connector ya düz dizi ya da {points, byCountry,
      // byFormat} döner.
      const points = Array.isArray(result) ? result : result.points;
      const byCountry = Array.isArray(result) ? [] : (result.byCountry ?? []);
      const byFormat = Array.isArray(result) ? [] : (result.byFormat ?? []);

      // Kaynak para birimi - config'ten (AdMob TRY, App Store vendor ccy…),
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

      // Ülke kırılımı - metrics_country tablosuna.
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

      // Reklam formatı kırılımı - metrics_format tablosuna. currency ANA
      // tabloyla aynı kaynaktan: ad_revenue burada da para taşıyor, birimsiz
      // yazılırsa iki tablonun toplamı karşılaştırılamaz.
      if (byFormat.length > 0) {
        const formatRows = byFormat.map((p) => ({
          project_id: it.project_id,
          date: p.date,
          source: it.provider,
          metric: p.metric,
          format: p.format,
          value: p.value,
          currency: sourceCurrency,
        }));
        const { error: fmtErr } = await hub
          .from("metrics_format")
          .upsert(formatRows, {
            onConflict: "project_id,date,source,metric,format",
          });
        if (fmtErr) throw new Error(fmtErr.message);
      }

      await hub
        .from("project_integrations")
        .update({
          last_synced_at: syncedAt,
          last_sync_status: "ok",
          last_sync_error: null,
        })
        .eq("id", it.id);

      return {
        ok: true,
        provider: it.provider,
        project_id: it.project_id,
        points: rows.length,
        country_points: byCountry.length,
        ingested: rows.length + byCountry.length + byFormat.length,
      };
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

      return {
        ok: false,
        provider: it.provider,
        project_id: it.project_id,
        error: message,
      };
    }
  }

  // Sağlayıcı bazında grupla: FARKLI sağlayıcılar eş zamanlı, AYNI sağlayıcının
  // entegrasyonları sırayla.
  //
  // NEDEN BÖYLE: önceki hali tek bir `for` döngüsüydü - AdMob bitmeden
  // RevenueCat başlamıyordu ve tek bir çalışma 90 saniyeyi aşıyordu (ölçüldü:
  // damga 13:19'da "SÜRÜYOR", 13:20'de bitti). Hepsini birden paralele almak ise
  // aynı sağlayıcıya eş zamanlı vurmak demek; AdMob'un raporlama kotası bunu
  // sevmez. Bu düzende duvar saati en yavaş TEK sağlayıcıya düşer ve hiçbir dış
  // API aynı anda birden fazla istek almaz - kota riski yok.
  //
  // Time:  O(en yavaş sağlayıcı) - önce O(tüm sağlayıcıların toplamı)
  // Space: O(n) entegrasyon sayısı kadar sonuç
  const byProvider = new Map<string, Integration[]>();
  for (const it of integrations ?? []) {
    const group = byProvider.get(it.provider);
    if (group) group.push(it);
    else byProvider.set(it.provider, [it]);
  }

  const grouped = await Promise.all(
    Array.from(byProvider.values(), async (group) => {
      const out: Array<Record<string, unknown>> = [];
      for (const it of group) out.push(await syncIntegration(it));
      return out;
    }),
  );

  const results = grouped.flat();
  const okCount = results.filter((r) => r.ok === true).length;
  const errorCount = results.length - okCount;
  const ingested = results.reduce(
    (sum, r) => sum + (typeof r.ingested === "number" ? r.ingested : 0),
    0,
  );

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

  // Senkron sonrası uyarı kurallarını değerlendir.
  //
  // Yorum "fire-and-forget" diyordu ama çağrı `await` ediliyordu - yani yanıtı
  // bekletiyordu. Gerçekten arka plana almak için EdgeRuntime.waitUntil gerekir:
  // await'i düpedüz kaldırmak isteği runtime yanıtı dönünce öldürür ve uyarı
  // değerlendirmesi sessizce kaybolurdu.
  const evaluateAlerts = (async () => {
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/helm-alert`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    } catch {
      // uyarı değerlendirmesi senkronu bloklamasın
    }
  })();

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } })
    .EdgeRuntime;
  if (runtime) runtime.waitUntil(evaluateAlerts);
  else await evaluateAlerts;

  return json({ ingested, ok: okCount, errors: errorCount, results });
});
