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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let payload: ResendPayload = {};
  try {
    payload = (await req.json()) as ResendPayload;
  } catch {
    return json({ error: "Geçersiz JSON" }, 400);
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
