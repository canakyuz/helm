// supabase/functions/helm-social/index.ts
// Kullanici JWT'siyle calisan Zernio aksiyon yonlendiricisi.
// Body: { project_id, action, params? }
// Alt proje 1 aksiyonlari: accounts.sync, webhook.ensure
// (alt proje 2: posts.*, media.presign; alt proje 3: inbox.*)
//
// Kalip helm-review-reply ile ayni: service-role client, aktor caller
// JWT'den, 60 sn'de 10 yazma siniri, her aksiyon audit_log'a.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  ZernioApiError,
  listAccounts,
  resolveProfileId,
  zernioFetch,
} from "../_shared/zernio.ts";
import { toAccountRows } from "../helm-ingest/connectors/zernio-aggregate.ts";

type Action = "accounts.sync" | "webhook.ensure";
const ACTIONS: ReadonlySet<string> = new Set(["accounts.sync", "webhook.ensure"]);

interface Body {
  project_id?: string;
  action?: string;
  params?: Record<string, unknown>;
}

interface ZernioWebhook {
  _id: string;
  url: string;
  isActive?: boolean;
}

/** Zernio'da abone olunan olaylar - alt projeler ekledikce buraya eklenir. */
const WEBHOOK_EVENTS = [
  "webhook.test",
  "account.connected",
  "account.disconnected",
  "analytics.synced",
  "post.scheduled",
  "post.published",
  "post.failed",
  "post.partial",
  "post.cancelled",
  "post.platform.published",
  "post.platform.failed",
  "message.received",
  "comment.received",
];

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const projectId = body.project_id;
  const action = body.action;
  if (!projectId || typeof projectId !== "string") return json({ error: "project_id gerekli" }, 400);
  if (!action || !ACTIONS.has(action)) return json({ error: "gecersiz action" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Aktor: caller JWT'sinden. Anon istek 401.
  let actorEmail: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { data } = await hub.auth.getUser(authHeader.slice(7));
      actorEmail = data?.user?.email ?? null;
    } catch {
      // anon
    }
  }
  if (!actorEmail) return json({ error: "Authenticated request gerekli" }, 401);

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recent } = await hub
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_email", actorEmail)
    .like("action", "social.%")
    .gte("created_at", since);
  if ((recent ?? 0) >= RATE_MAX) return json({ error: "Too fast - wait a minute" }, 429);

  const { data: integ, error: integErr } = await hub
    .from("project_integrations")
    .select("id, config")
    .eq("project_id", projectId)
    .eq("provider", "zernio")
    .eq("enabled", true)
    .maybeSingle();
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integ) return json({ error: "Bu projede Zernio entegrasyonu yok" }, 404);
  const cfg = (integ.config ?? {}) as Record<string, string | undefined>;
  const apiKey = cfg.api_key;
  if (!apiKey) return json({ error: "Zernio api_key eksik" }, 422);

  const audit = (detail: string) =>
    hub.from("audit_log").insert({
      project_id: projectId,
      action: `social.${action}`,
      actor_email: actorEmail,
      detail,
    });

  try {
    if (action === "accounts.sync") {
      const profileId = await resolveProfileId(apiKey, cfg.profile_id);
      const accounts = await listAccounts(apiKey, profileId);
      const rows = toAccountRows(accounts, new Date().toISOString()).map((r) => ({
        project_id: projectId,
        ...r,
      }));
      if (rows.length > 0) {
        const { error } = await hub.from("social_accounts").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      await audit(`${rows.length} hesap`);
      return json({ ok: true, count: rows.length });
    }

    // webhook.ensure
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/helm-zernio-webhook`;
    const secret = Deno.env.get("ZERNIO_WEBHOOK_SECRET");
    if (!secret) return json({ error: "ZERNIO_WEBHOOK_SECRET tanimsiz" }, 500);

    const listed = await zernioFetch<{ webhooks?: ZernioWebhook[] } | ZernioWebhook[]>(
      apiKey,
      "/webhooks/settings",
    );
    const existing = (Array.isArray(listed) ? listed : (listed.webhooks ?? [])).find(
      (w) => w.url === url,
    );
    if (existing) {
      await audit(`mevcut ${existing._id}`);
      return json({ ok: true, webhook_id: existing._id, created: false });
    }

    const created = await zernioFetch<{ webhook: ZernioWebhook }>(apiKey, "/webhooks/settings", {
      method: "POST",
      body: JSON.stringify({ name: "Helm", url, secret, events: WEBHOOK_EVENTS, isActive: true }),
    });
    const webhookId = created.webhook._id;
    await hub
      .from("project_integrations")
      .update({ config: { ...cfg, webhook_id: webhookId } })
      .eq("id", integ.id);
    await audit(`olusturuldu ${webhookId}`);
    return json({ ok: true, webhook_id: webhookId, created: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await hub.from("audit_log").insert({
      project_id: projectId,
      action: `social.${action}.fail`,
      actor_email: actorEmail,
      detail: message.slice(0, 500),
    });
    if (e instanceof ZernioApiError) {
      return json({ error: message, code: e.code, retry_after: e.retryAfter }, e.status === 429 ? 429 : 502);
    }
    return json({ error: message }, 500);
  }
});
