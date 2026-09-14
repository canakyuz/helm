// Zernio webhook alicisi. Deploy: --no-verify-jwt (Zernio Supabase JWT'si
// gondermez; guvenlik HMAC imzasindan gelir).
//
// Bu alt projede islenen olaylar:
//   webhook.test          -> 200
//   account.connected     -> zernio ingest'i tetikle (hesap listesi yenilensin)
//   account.disconnected  -> social_accounts.needs_reconnection + cockpit push
//   analytics.synced      -> zernio ingest'i tetikle
// post.* (alt proje 2) ve message/comment.received (alt proje 3) burada
// 200 ile YUTULUR ki Zernio tekrar denemesin; islenmeleri sonraki alt projede.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyZernioSignature } from "../_shared/zernio-signature.ts";
import { sendCockpitPush } from "../_shared/expo-push.ts";
import { isRecentSync } from "../_shared/sync-debounce.ts";

const SYNC_DEBOUNCE_MS = 30 * 60 * 1000; // 30 dk (bkz. I2)

interface ZernioEvent {
  id?: string;
  event?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/** data.accountId | data.account._id | data.account.id - hangisi geldiyse. */
function accountIdOf(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.accountId === "string") return data.accountId;
  const acc = data.account as Record<string, unknown> | undefined;
  if (acc && typeof acc._id === "string") return acc._id;
  if (acc && typeof acc.id === "string") return acc.id;
  return null;
}

/**
 * En son "senkron oldu" damgası 30 dk'dan tazeyse true döner (bkz. I2).
 * Sadece analytics.synced için kullanılır - account.connected yeni bağlanan
 * hesabın hızlı görünmesi için hep tetiklemeye devam eder.
 * DB okuması hata verirse fail-open: false dönüp tetiklemeye izin ver -
 * ingest zaten idempotent, kaçırmak debounce'tan daha kötü.
 */
async function zernioRecentlySynced(
  hub: ReturnType<typeof createClient>,
): Promise<boolean> {
  const { data, error } = await hub
    .from("project_integrations")
    .select("last_synced_at")
    .eq("provider", "zernio")
    .eq("enabled", true)
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) {
    console.error("[helm-zernio-webhook] last_synced_at read failed", error.message);
    return false;
  }
  const lastSyncedAt = (data?.[0] as { last_synced_at?: string | null } | undefined)?.last_synced_at;
  return isRecentSync(lastSyncedAt, new Date(), SYNC_DEBOUNCE_MS);
}

async function triggerZernioIngest(): Promise<void> {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/helm-ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "manual", provider: "zernio" }),
    });
  } catch (e) {
    console.error("[helm-zernio-webhook] helm-ingest trigger failed", e instanceof Error ? e.message : String(e));
    // ingest tetiklenemezse gece cron'u toplar
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST bekleniyor" }, 405);

  const secret = Deno.env.get("ZERNIO_WEBHOOK_SECRET");
  if (!secret) {
    console.error("ZERNIO_WEBHOOK_SECRET tanimsiz");
    return json({ error: "webhook secret yapilandirilmamis" }, 500);
  }

  const rawBody = await req.text();
  const ok = await verifyZernioSignature(secret, rawBody, req.headers.get("x-zernio-signature"));
  if (!ok) return json({ error: "Invalid signature" }, 401);

  let evt: ZernioEvent;
  try {
    evt = JSON.parse(rawBody) as ZernioEvent;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const name = evt.event ?? evt.type ?? "";
  const eventId = req.headers.get("x-zernio-event-id") ?? evt.id ?? null;

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  const background = (p: Promise<unknown>) => (runtime ? runtime.waitUntil(p) : p);

  switch (name) {
    case "webhook.test":
      return json({ ok: true, event: name, event_id: eventId });

    case "account.connected":
      await background(triggerZernioIngest());
      return json({ ok: true, event: name, event_id: eventId });

    case "analytics.synced": {
      if (await zernioRecentlySynced(hub)) {
        return json({ ok: true, event: name, skipped: "recent sync" });
      }
      await background(triggerZernioIngest());
      return json({ ok: true, event: name, event_id: eventId });
    }

    case "account.disconnected": {
      const accountId = accountIdOf(evt.data);
      if (!accountId) return json({ ok: true, event: name, skipped: "accountId yok" });
      const { data: acc, error: updErr } = await hub
        .from("social_accounts")
        .update({ needs_reconnection: true, is_active: false })
        .eq("id", accountId)
        .select("platform, username")
        .maybeSingle();
      if (updErr) {
        console.error("[helm-zernio-webhook] social_accounts update failed", { accountId, message: updErr.message });
        return json({ error: "social_accounts update failed" }, 500);
      }
      const label = acc ? `${acc.platform} · ${acc.username ?? accountId}` : accountId;
      await sendCockpitPush(
        hub,
        "Sosyal hesap bağlantısı koptu",
        `${label} - Zernio'da yeniden bağla`,
        { kind: "social", accountId },
      );
      return json({ ok: true, event: name, event_id: eventId });
    }

    default:
      // Bilinmeyen / henuz islenmeyen olay: 200 don, Zernio retry yapmasin.
      return json({ ok: true, event: name, ignored: true });
  }
});
