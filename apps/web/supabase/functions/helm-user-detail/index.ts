import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-user-detail — tek bir Auth kullanıcısının tam detayını döner.
// service_role key sunucuda kalır.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let projectId: string | undefined;
  let userId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.project_id === "string") projectId = body.project_id;
    if (typeof body?.user_id === "string") userId = body.user_id;
  } catch {
    // gövde yok
  }
  if (!projectId || !userId) {
    return json({ error: "project_id ve user_id gerekli" }, 400);
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: integ, error } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", projectId)
    .eq("provider", "supabase")
    .eq("enabled", true)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!integ) {
    return json({ error: "Bu projede aktif Supabase entegrasyonu yok" }, 404);
  }

  const cfg = integ.config as {
    project_url?: string;
    service_role_key?: string;
    crm_tables?: string;
  };
  if (!cfg.project_url || !cfg.service_role_key) {
    return json({ error: "Supabase entegrasyon config'i eksik" }, 400);
  }

  const admin = createClient(cfg.project_url, cfg.service_role_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr) return json({ error: getErr.message }, 500);
  if (!data?.user) return json({ error: "Kullanıcı bulunamadı" }, 404);

  const u = data.user;

  // CRM tabloları — `profiles:id, gems, subscriptions` → her biri için
  // user UUID ile eşleşen satırları çek.
  //
  // GÜVENLİK:
  //   - Tablo adı yalnızca [a-z0-9_] içerebilir (SQL injection guard)
  //   - Kolon adı yalnızca [a-z0-9_] (SQL injection guard)
  //   - Sistem tabloları yasak: auth.*, storage.*, vault.*, pg_*, information_schema.*
  //   - Sadece public schema (kullanıcı schema-prefix yazmamalı; yazarsa reddet)
  const SAFE_NAME = /^[a-z_][a-z0-9_]{0,62}$/i;
  const BLOCKED_TABLE_PREFIXES = ["pg_", "auth_", "storage_", "vault_"];
  const BLOCKED_EXACT = new Set([
    "users",        // auth.users değil ama public.users de kullanıcının olabilir;
                    // helm güvenliği için bunu engellemiyoruz, dev kararı
  ]);

  const isSafeName = (s: string) => SAFE_NAME.test(s);
  const isBlockedTable = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes(".")) return true; // schema prefix yasak
    if (BLOCKED_TABLE_PREFIXES.some((p) => lower.startsWith(p))) return true;
    // BLOCKED_EXACT şu an boş; reserved tutuyoruz
    if (BLOCKED_EXACT.has(lower)) return true;
    return false;
  };

  const tableSpecs = (cfg.crm_tables ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, col] = s.split(":");
      return { name: name.trim(), user_col: (col?.trim() || "user_id") };
    })
    .filter((spec) => {
      // Güvenli olmayan adları sessizce at — config tek dosya, kullanıcı
      // hatayı integration formundan görür.
      return (
        isSafeName(spec.name) &&
        isSafeName(spec.user_col) &&
        !isBlockedTable(spec.name)
      );
    });

  const tables: Array<{
    name: string;
    user_col: string;
    rows: Record<string, unknown>[] | null;
    error?: string;
  }> = [];
  for (const spec of tableSpecs) {
    try {
      const { data: rows, error: tblErr } = await admin
        .from(spec.name)
        .select("*")
        .eq(spec.user_col, userId)
        .limit(50);
      if (tblErr) {
        tables.push({ ...spec, rows: null, error: tblErr.message });
      } else {
        tables.push({ ...spec, rows: rows ?? [] });
      }
    } catch (e) {
      tables.push({
        ...spec,
        rows: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({
    user: {
      id: u.id,
      email: u.email ?? null,
      phone: u.phone ?? null,
      role: u.role ?? null,
      created_at: u.created_at,
      updated_at: u.updated_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      phone_confirmed_at: u.phone_confirmed_at ?? null,
      banned_until: (u as { banned_until?: string }).banned_until ?? null,
      app_metadata: u.app_metadata ?? {},
      user_metadata: u.user_metadata ?? {},
      identities: u.identities ?? [],
    },
    tables,
  });
});
