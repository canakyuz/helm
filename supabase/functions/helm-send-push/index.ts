import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-send-push - proje kullanıcılarına Expo Push bildirimi gönderir.
// Body: { project_id, title, body, data?, dry_run?, ...hedef }
// Hedef, üç moddan TAM BİRİ:
//   segment_id: string   - segment kuralına uyanlar (new/active/inactive)
//   user_ids:   string[] - elle seçilmiş kullanıcılar (max 1000, uuid)
//   broadcast:  true     - token tablosundaki HERKES
// Push token'ları: project_integrations.supabase.config.push_token_{table,column,user_column}
//   defaults: profiles / expo_push_token / id

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
    user_ids?: string[];
    broadcast?: boolean;
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    dry_run?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const {
    project_id,
    segment_id,
    user_ids,
    broadcast,
    title,
    body: msgBody,
    data,
    dry_run,
  } = body;
  if (!project_id || !title || !msgBody) {
    return json({ error: "project_id, title, body gerekli" }, 400);
  }

  // Hedef modu tam bir tane olmalı — iki mod birden gelirse hangi kitleye
  // gideceği belirsizleşir, sessizce birini seçmek yanlış kitleye push demek.
  const modeCount =
    (segment_id ? 1 : 0) +
    (user_ids && user_ids.length > 0 ? 1 : 0) +
    (broadcast ? 1 : 0);
  if (modeCount !== 1) {
    return json(
      { error: "Hedef olarak segment_id, user_ids veya broadcast'ten tam biri verilmeli" },
      400,
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (user_ids && user_ids.length > 0) {
    if (user_ids.length > 1000) {
      return json({ error: "user_ids en fazla 1000 olabilir" }, 400);
    }
    if (user_ids.some((id) => typeof id !== "string" || !UUID_RE.test(id))) {
      return json({ error: "user_ids geçersiz uuid içeriyor" }, 400);
    }
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let seg:
    | { rule_type: "new" | "active" | "inactive"; rule_days: number; project_id: string | null }
    | null = null;
  if (segment_id) {
    const { data: segRow } = await hub
      .from("user_segments")
      .select("rule_type, rule_days, project_id")
      .eq("id", segment_id)
      .maybeSingle();
    if (!segRow) return json({ error: "Segment not found" }, 404);
    seg = segRow as typeof seg;
  }

  const targetProjectId = seg?.project_id ?? project_id;
  const { data: supaIntg } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", targetProjectId)
    .eq("provider", "supabase")
    .eq("enabled", true)
    .maybeSingle();
  const cfg = supaIntg?.config as
    | {
        project_url?: string;
        service_role_key?: string;
        push_token_table?: string;
        push_token_column?: string;
        push_user_column?: string;
      }
    | undefined;
  if (!cfg?.project_url || !cfg?.service_role_key) {
    return json({ error: "Hedef projede Supabase entegrasyonu yok" }, 400);
  }

  // Güvenlik: tablo/kolon adları yalnızca identifier karakterleri.
  // user-provided string olduğu için SQL injection guard zorunlu.
  const SAFE = /^[a-z_][a-z0-9_]{0,62}$/i;
  const rawTokenTable = cfg.push_token_table || "profiles";
  const rawTokenCol = cfg.push_token_column || "expo_push_token";
  const rawUserCol = cfg.push_user_column || "id";
  if (!SAFE.test(rawTokenTable) || rawTokenTable.includes(".")) {
    return json({ error: `push_token_table is unsafe: ${rawTokenTable}` }, 400);
  }
  if (!SAFE.test(rawTokenCol)) {
    return json({ error: `push_token_column is unsafe: ${rawTokenCol}` }, 400);
  }
  if (!SAFE.test(rawUserCol)) {
    return json({ error: `push_user_column is unsafe: ${rawUserCol}` }, 400);
  }
  // Sistem tabloları yasak
  if (
    rawTokenTable.toLowerCase().startsWith("pg_") ||
    rawTokenTable.toLowerCase().startsWith("auth_") ||
    rawTokenTable.toLowerCase().startsWith("vault_") ||
    rawTokenTable.toLowerCase().startsWith("storage_")
  ) {
    return json({ error: `System tables are not allowed: ${rawTokenTable}` }, 400);
  }
  const tokenTable = rawTokenTable;
  const tokenCol = rawTokenCol;
  const userCol = rawUserCol;

  const admin = createClient(cfg.project_url, cfg.service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tokens: string[] = [];
  const collect = (rows: Record<string, unknown>[] | null) => {
    for (const r of rows ?? []) {
      const t = r[tokenCol];
      if (typeof t === "string" && t.startsWith("ExponentPushToken[")) {
        tokens.push(t);
      }
    }
  };
  const tokenReadError = (msg: string) =>
    json(
      { error: `Could not read from the push token table (${tokenTable}.${tokenCol}): ${msg}` },
      500,
    );

  let eligibleCount = 0;
  if (broadcast) {
    // Broadcast: kullanıcı listesi gereksiz — token tablosundaki herkes hedef.
    // 1000'lik sayfalar; 20k satır tavanı runaway koruması (tek kişilik hub).
    const PAGE = 1000;
    for (let from = 0; from < 20_000; from += PAGE) {
      const { data: rows, error: tokErr } = await admin
        .from(tokenTable)
        .select(`${userCol}, ${tokenCol}`)
        .not(tokenCol, "is", null)
        .range(from, from + PAGE - 1);
      if (tokErr) return tokenReadError(tokErr.message);
      collect(rows as Record<string, unknown>[] | null);
      eligibleCount += rows?.length ?? 0;
      if ((rows?.length ?? 0) < PAGE) break;
    }
  } else {
    let userIds: string[];
    if (seg) {
      let users: AuthUser[];
      try {
        users = await listAllUsers(cfg.project_url, cfg.service_role_key);
      } catch (e) {
        return json(
          { error: e instanceof Error ? e.message : String(e) },
          500,
        );
      }
      const rule = seg;
      userIds = users
        .filter((u) => matches(u, rule.rule_type, rule.rule_days))
        .map((u) => u.id);
    } else {
      userIds = user_ids ?? [];
    }
    eligibleCount = userIds.length;

    if (userIds.length === 0) {
      return json({ recipients: 0, sent: 0, failed: 0, sample: [] });
    }

    // Büyük listede tek seferde `in` query patlayabilir → chunk'la
    const TOKEN_CHUNK = 200;
    for (let i = 0; i < userIds.length; i += TOKEN_CHUNK) {
      const slice = userIds.slice(i, i + TOKEN_CHUNK);
      const { data: rows, error: tokErr } = await admin
        .from(tokenTable)
        .select(`${userCol}, ${tokenCol}`)
        .in(userCol, slice);
      if (tokErr) return tokenReadError(tokErr.message);
      collect(rows as Record<string, unknown>[] | null);
    }
  }

  // Tekrar eden token'ları at
  const uniqueTokens = Array.from(new Set(tokens));

  if (dry_run) {
    return json({
      recipients: uniqueTokens.length,
      eligible_users: eligibleCount,
      sent: 0,
      failed: 0,
      dry_run: true,
      sample: uniqueTokens.slice(0, 5),
    });
  }

  // Expo Push API - chunk 100
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const PUSH_CHUNK = 100;

  for (let i = 0; i < uniqueTokens.length; i += PUSH_CHUNK) {
    const chunk = uniqueTokens.slice(i, i + PUSH_CHUNK);
    const messages = chunk.map((to) => ({
      to,
      title,
      body: msgBody,
      sound: "default",
      ...(data ? { data } : {}),
    }));
    try {
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
        failed += chunk.length;
        errors.push(`chunk ${i}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const result = await res.json();
      const tickets: Array<{ status?: string; message?: string }> =
        result?.data ?? [];
      for (const t of tickets) {
        if (t.status === "ok") sent++;
        else {
          failed++;
          if (t.message) errors.push(t.message);
        }
      }
    } catch (e) {
      failed += chunk.length;
      errors.push(
        `chunk ${i}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const { data: camp } = await hub
    .from("campaigns")
    .insert({
      project_id,
      segment_id: segment_id ?? null,
      channel: "push",
      subject: title,
      body: msgBody.slice(0, 4000),
      recipients: uniqueTokens.length,
      sent,
      failed,
      error: errors.length > 0 ? errors.join("\n").slice(0, 2000) : null,
    })
    .select("id")
    .single();

  return json({
    recipients: uniqueTokens.length,
    eligible_users: eligibleCount,
    sent,
    failed,
    campaign_id: camp?.id ?? null,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  });
});
