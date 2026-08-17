import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-send-mail — bir segmentin kullanıcılarına Resend ile mail gönderir.
// Body: { project_id, segment_id, subject, body_html, body_text?, dry_run? }
// Yanıt: { recipients, sent, failed, campaign_id, errors? }

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

interface AuthUser {
  id: string;
  email?: string | null;
  created_at: string;
  last_sign_in_at?: string | null;
}

const matches = (
  u: AuthUser,
  rule_type: "new" | "active" | "inactive",
  rule_days: number,
): boolean => {
  const cutoff = Date.now() - rule_days * 86_400_000;
  if (rule_type === "new") return new Date(u.created_at).getTime() >= cutoff;
  if (rule_type === "active") {
    return (
      !!u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= cutoff
    );
  }
  return (
    !u.last_sign_in_at || new Date(u.last_sign_in_at).getTime() < cutoff
  );
};

async function listAllUsers(
  url: string,
  key: string,
): Promise<AuthUser[]> {
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const out: AuthUser[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      out.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (users.length < 200) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: {
    project_id?: string;
    segment_id?: string;
    subject?: string;
    body_html?: string;
    body_text?: string;
    dry_run?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { project_id, segment_id, subject, body_html, body_text, dry_run } =
    body;
  if (!project_id || !segment_id || !subject || !body_html) {
    return json(
      { error: "project_id, segment_id, subject, body_html gerekli" },
      400,
    );
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Segment
  const { data: seg, error: segErr } = await hub
    .from("user_segments")
    .select("rule_type, rule_days, project_id")
    .eq("id", segment_id)
    .maybeSingle();
  if (segErr || !seg) {
    return json({ error: "Segment not found" }, 404);
  }

  // Resend entegrasyonu — proje üzerinde
  const { data: resendIntg } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", project_id)
    .eq("provider", "resend")
    .eq("enabled", true)
    .maybeSingle();
  const resendCfg = resendIntg?.config as
    | { api_key?: string; from_email?: string; from_name?: string }
    | undefined;
  if (!resendCfg?.api_key || !resendCfg?.from_email) {
    return json({ error: "Bu projede Resend entegrasyonu yok/eksik" }, 400);
  }

  // Supabase entegrasyonu (kullanıcı listesi için)
  const supaProjectId = seg.project_id ?? project_id;
  const { data: supaIntg } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", supaProjectId)
    .eq("provider", "supabase")
    .eq("enabled", true)
    .maybeSingle();
  const supaCfg = supaIntg?.config as
    | { project_url?: string; service_role_key?: string }
    | undefined;
  if (!supaCfg?.project_url || !supaCfg?.service_role_key) {
    return json(
      { error: "Segment projesinde Supabase entegrasyonu yok" },
      400,
    );
  }

  // Kullanıcıları çek + filtrele
  let users: AuthUser[];
  try {
    users = await listAllUsers(supaCfg.project_url, supaCfg.service_role_key);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
  const recipients = users
    .filter((u) => matches(u, seg.rule_type, seg.rule_days))
    .map((u) => u.email)
    .filter((e): e is string => !!e);

  if (dry_run) {
    return json({
      recipients: recipients.length,
      sent: 0,
      failed: 0,
      dry_run: true,
      sample: recipients.slice(0, 5),
    });
  }

  const from = resendCfg.from_name
    ? `${resendCfg.from_name} <${resendCfg.from_email}>`
    : resendCfg.from_email;

  // Campaign önce yarat — id'yi tag olarak gönderime ekle (webhook'tan dönecek)
  const { data: camp } = await hub
    .from("campaigns")
    .insert({
      project_id,
      segment_id,
      channel: "mail",
      subject,
      body: body_html.slice(0, 4000),
      recipients: recipients.length,
      sent: 0,
      failed: 0,
    })
    .select("id")
    .single();
  const campaignId = camp?.id as number | undefined;

  // Resend "batch" endpoint (100/req limit). Chunk'lara böl.
  const CHUNK = 100;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const sentEmailIds: string[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const payload = chunk.map((to) => ({
      from,
      to: [to],
      subject,
      html: body_html,
      ...(body_text ? { text: body_text } : {}),
      ...(campaignId
        ? {
            tags: [
              { name: "helm_campaign_id", value: String(campaignId) },
              { name: "helm_channel", value: "mail" },
            ],
          }
        : {}),
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendCfg.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        failed += chunk.length;
        errors.push(`chunk ${i}: ${res.status} ${errText.slice(0, 200)}`);
      } else {
        sent += chunk.length;
        const result = await res.json();
        const items: Array<{ id?: string }> = result?.data ?? [];
        for (const it of items) {
          if (it.id) sentEmailIds.push(it.id);
        }
      }
    } catch (e) {
      failed += chunk.length;
      errors.push(`chunk ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Campaign güncelle (sent/failed)
  if (campaignId) {
    await hub
      .from("campaigns")
      .update({
        sent,
        failed,
        error: errors.length > 0 ? errors.join("\n").slice(0, 2000) : null,
      })
      .eq("id", campaignId);

    // Initial "sent" event'leri yaz (delivered/opened/clicked sonra webhook)
    if (sentEmailIds.length > 0) {
      const sentRows = sentEmailIds.map((id, idx) => ({
        campaign_id: campaignId,
        email_id: id,
        event: "sent" as const,
        recipient: recipients[idx] ?? null,
      }));
      await hub.from("campaign_events").insert(sentRows);
    }
  }

  return json({
    recipients: recipients.length,
    sent,
    failed,
    campaign_id: campaignId ?? null,
    errors: errors.length > 0 ? errors : undefined,
  });
});
