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
  });
});
