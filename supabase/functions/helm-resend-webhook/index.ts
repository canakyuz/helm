import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-resend-webhook — Resend webhook event'lerini kabul eder, campaign_events
// tablosuna yazar.
//
// Resend tarafında bu URL webhook olarak eklenmeli:
//   https://<HUB>.supabase.co/functions/v1/helm-resend-webhook
//
// Resend webhook body:
//   { type: "email.delivered" | "email.opened" | ..., created_at, data: {...} }
// data içinde: email_id, from, to, subject, tags?, click? (clicked event'inde)
//
// Tag tabanlı eşleme: helm-send-mail her gönderime "helm_campaign_id" tag'i
// ekliyor — webhook'ta o tag'den campaign_id parse ederiz.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

interface ResendPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    click?: { link?: string; ipAddress?: string; userAgent?: string };
    open?: { ipAddress?: string; userAgent?: string };
  };
}

// Svix HMAC SHA256 doğrulama — Resend webhook'larında imza svix headers ile gelir.
// İlgili docs: https://docs.svix.com/receiving/verifying-payloads/how-manual
// Secret format: "whsec_xxx" (base64 sonrası); raw secret base64 decode edilir.
async function verifySvixSignature(
  signingSecret: string,
  msgId: string,
  msgTimestamp: string,
  body: string,
  receivedSignatures: string,
): Promise<boolean> {
  // "whsec_" prefix'i kaldır
  const cleanSecret = signingSecret.replace(/^whsec_/, "");
  const keyBytes = Uint8Array.from(atob(cleanSecret), (c) => c.charCodeAt(0));
  const toSign = `${msgId}.${msgTimestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign)),
  );
  let sigB64 = "";
  for (const b of sig) sigB64 += String.fromCharCode(b);
  const expected = btoa(sigB64);
  // Header birden fazla imza içerebilir, space-separated: "v1,base64 v1,base64"
  const sigs = receivedSignatures
    .split(/\s+/)
    .map((s) => s.split(",")[1])
    .filter(Boolean);
  return sigs.some((s) => s === expected);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // Webhook signature doğrulama — RESEND_WEBHOOK_SECRET set'liyse zorunlu
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const rawBody = await req.text();

  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTs = req.headers.get("svix-timestamp");
    const svixSig = req.headers.get("svix-signature");
    if (!svixId || !svixTs || !svixSig) {
      return json({ error: "svix-* header eksik" }, 401);
    }
    // Replay koruması — 5 dk dışı reddet
    const tsMs = Number(svixTs) * 1000;
    if (Math.abs(Date.now() - tsMs) > 5 * 60_000) {
      return json({ error: "Timestamp eski/gelecekten" }, 401);
    }
    try {
      const ok = await verifySvixSignature(
        secret,
        svixId,
        svixTs,
        rawBody,
        svixSig,
      );
      if (!ok) return json({ error: "Invalid signature" }, 401);
    } catch (e) {
      return json(
        { error: `Could not verify the signature: ${e instanceof Error ? e.message : e}` },
        401,
      );
    }
  }
  // secret yoksa: warning logla ama yine de kabul et (dev mode için)
  // Production: RESEND_WEBHOOK_SECRET MUTLAKA set'lenmeli.

  let payload: ResendPayload = {};
  try {
    payload = JSON.parse(rawBody) as ResendPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const type = payload.type ?? "";
  const eventName = TYPE_MAP[type];
  if (!eventName) {
    return json({ ok: true, ignored: type }, 200);
  }

  const data = payload.data ?? {};
  const emailId = data.email_id;
  if (!emailId) return json({ error: "email_id yok" }, 400);

  // Tag'den campaign_id parse et
  let campaignId: number | null = null;
  if (Array.isArray(data.tags)) {
    const tag = data.tags.find((t) => t.name === "helm_campaign_id");
    if (tag?.value) {
      const n = Number(tag.value);
      if (Number.isFinite(n)) campaignId = n;
    }
  }

  const recipient = Array.isArray(data.to) ? data.to[0] : data.to ?? null;
  const url = data.click?.link ?? null;
  const userAgent =
    data.click?.userAgent ?? data.open?.userAgent ?? null;

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await hub.from("campaign_events").insert({
    campaign_id: campaignId,
    email_id: emailId,
    event: eventName,
    recipient,
    url,
    user_agent: userAgent,
    occurred_at: payload.created_at ?? new Date().toISOString(),
  });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, event: eventName, campaign_id: campaignId });
});
