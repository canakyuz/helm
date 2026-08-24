import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-action - proje Auth kullanıcısı üzerinde admin aksiyonu.
// Tüm aksiyonlar audit_log'a kaydedilir.
//
// Body: { project_id, user_id, action, params? }
// Desteklenen actions:
//   ban               { duration?: "8760h" }  (default 100 yıl)
//   unban
//   set_metadata      { scope: "app"|"user", patch: Record<string,unknown> }
//   send_password_reset
//   delete_user
//   send_push         { title, body, data? } - tek kullanıcıya Expo push
//                     (token tablosu project_integrations.supabase.config
//                      push_token_{table,column} + push_user_column'dan;
//                      defaults: profiles / expo_push_token / id)

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

type Action =
  | "ban"
  | "unban"
  | "set_metadata"
  | "send_password_reset"
  | "delete_user"
  | "send_push";

interface Body {
  project_id?: string;
  user_id?: string;
  action?: Action;
  params?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { project_id, user_id, action, params = {} } = body;
  if (!project_id || !user_id || !action) {
    return json({ error: "project_id, user_id ve action gerekli" }, 400);
  }

  // Hub: hedef proje Supabase entegrasyonunu bul.
  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Actor - JWT'den email çıkar (audit log için)
  let actorEmail: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    try {
      const { data } = await hub.auth.getUser(jwt);
      actorEmail = data?.user?.email ?? null;
    } catch {
      // anonim/anon-key - actor null kalır
    }
  }
  const { data: integ, error: integErr } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", project_id)
    .eq("provider", "supabase")
    .eq("enabled", true)
    .maybeSingle();
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integ) {
    return json({ error: "Bu projede aktif Supabase entegrasyonu yok" }, 404);
  }
  const cfg = integ.config as {
    project_url?: string;
    service_role_key?: string;
    push_token_table?: string;
    push_token_column?: string;
    push_user_column?: string;
  };
  if (!cfg.project_url || !cfg.service_role_key) {
    return json({ error: "Supabase entegrasyon config'i eksik" }, 400);
  }
  const admin = createClient(cfg.project_url, cfg.service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let detail = "";
  try {
    if (action === "ban") {
      const duration =
        (typeof params.duration === "string" && params.duration) || "876000h";
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: duration,
      } as unknown as Record<string, unknown>);
      if (error) throw error;
      detail = `ban_duration=${duration}`;
    } else if (action === "unban") {
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      } as unknown as Record<string, unknown>);
      if (error) throw error;
      detail = "unban";
    } else if (action === "set_metadata") {
      const scope = params.scope === "user" ? "user" : "app";
      const patch =
        (params.patch as Record<string, unknown> | undefined) ?? {};
      if (Object.keys(patch).length === 0) {
        return json({ error: "patch is empty" }, 400);
      }
      const update =
        scope === "app"
          ? { app_metadata: patch }
          : { user_metadata: patch };
      const { error } = await admin.auth.admin.updateUserById(user_id, update);
      if (error) throw error;
      detail = `${scope}_metadata: ${JSON.stringify(patch)}`;
    } else if (action === "send_password_reset") {
      // Kullanıcının emailini al → recovery linki üret.
      const { data: u } = await admin.auth.admin.getUserById(user_id);
      const email = u?.user?.email;
      if (!email) return json({ error: "This user has no email" }, 400);
      const { error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (error) throw error;
      detail = `password reset link sent → ${email}`;
    } else if (action === "delete_user") {
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      detail = "user deleted";
    } else if (action === "send_push") {
      const title = typeof params.title === "string" ? params.title.trim() : "";
      const msgBody = typeof params.body === "string" ? params.body.trim() : "";
      if (!title || !msgBody) return json({ error: "title ve body gerekli" }, 400);

      // Token tablo/kolon adları kullanıcı config'inden gelir → identifier guard
      // (helm-send-push ile aynı kurallar; SQL injection + sistem tablosu koruması).
      const SAFE = /^[a-z_][a-z0-9_]{0,62}$/i;
      const tokenTable = cfg.push_token_table || "profiles";
      const tokenCol = cfg.push_token_column || "expo_push_token";
      const userCol = cfg.push_user_column || "id";
      const BLOCKED = /^(pg_|auth_|vault_|storage_)/i;
      if (
        [tokenTable, tokenCol, userCol].some((s) => !SAFE.test(s)) ||
        tokenTable.includes(".") ||
        BLOCKED.test(tokenTable)
      ) {
        return json({ error: "push token config is unsafe" }, 400);
      }

      const { data: rows, error: tokErr } = await admin
        .from(tokenTable)
        .select(tokenCol)
        .eq(userCol, user_id);
      if (tokErr) {
        return json(
          { error: `Token tablosu okunamadı (${tokenTable}.${tokenCol}): ${tokErr.message}` },
          500,
        );
      }
      const tokens = Array.from(
        new Set(
          (rows ?? [])
            .map((r) => (r as Record<string, unknown>)[tokenCol])
            .filter(
              (t): t is string =>
                typeof t === "string" && t.startsWith("ExponentPushToken["),
            ),
        ),
      );
      if (tokens.length === 0) {
        return json({ error: "Kullanıcının push token'ı yok" }, 400);
      }

      const messages = tokens.map((to) => ({
        to,
        title,
        body: msgBody,
        sound: "default",
        ...(params.data && typeof params.data === "object"
          ? { data: params.data }
          : {}),
      }));
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        throw new Error(`Expo push ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const result = await res.json();
      const tickets: Array<{ status?: string; message?: string }> =
        result?.data ?? [];
      const sent = tickets.filter((t) => t.status === "ok").length;
      const failedMsg = tickets.find((t) => t.status !== "ok")?.message;
      if (sent === 0) {
        throw new Error(`Expo ticket'ları başarısız: ${failedMsg ?? "unknown"}`);
      }
      // Mesajın kendisi audit'e girer: destek yazışması kanıtı burada durur.
      detail = `push sent (${sent}/${tokens.length} token) "${title}" — ${msgBody}`.slice(0, 500);
    } else {
      return json({ error: `Bilinmeyen aksiyon: ${action}` }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }

  // Audit log'a yaz (best-effort).
  await hub.from("audit_log").insert({
    project_id,
    target_user: user_id,
    action,
    detail,
    actor_email: actorEmail,
  });

  return json({ ok: true, action, detail });
});
