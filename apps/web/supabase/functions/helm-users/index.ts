import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-users — bir projenin Supabase kullanıcılarını + profiles join'i listeler.
// auth.users (admin API) + public.profiles (username, country, city, location)
// service_role key sunucuda kalır; panel sadece sonucu alır.

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

type ProfileRow = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  country?: string | null;
  country_code?: string | null;
  city?: string | null;
  location?: string | null;
  avatar_url?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let projectId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.project_id === "string") projectId = body.project_id;
  } catch {
    // gövde yok
  }
  if (!projectId) return json({ error: "project_id gerekli" }, 400);

  // Hub'dan projenin Supabase entegrasyon config'ini al.
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

  // 1. Auth kullanıcılarını çek (ilk 200).
  const { data: authData, error: usersError } = await admin.auth.admin.listUsers(
    { page: 1, perPage: 200 },
  );
  if (usersError) return json({ error: usersError.message }, 500);

  const userIds = authData.users.map((u) => u.id);

  // 2. profiles tablosundan username + lokasyon (tolerant — tablo yoksa boş bırak).
  const profileMap = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    try {
      const { data: profiles } = await admin
        .from("profiles")
        .select(
          "id, username, display_name, country, country_code, city, location, avatar_url",
        )
        .in("id", userIds);
      for (const p of (profiles ?? []) as ProfileRow[]) {
        profileMap.set(p.id, p);
      }
    } catch {
      // profiles tablosu yoksa veya kolon eksikse — username/location null kalır.
    }
  }

  const users = authData.users.map((u) => {
    const meta = (u as { banned_until?: string }).banned_until ?? null;
    const isBanned = meta !== null && new Date(meta).getTime() > Date.now();
    const premium = Boolean(
      (u.app_metadata as { premium?: unknown })?.premium,
    );
    const profile = profileMap.get(u.id);

    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      banned: isBanned,
      premium,
      providers: (u.identities ?? []).map((i) => i.provider).filter(Boolean),
      // profiles join
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      country: profile?.country ?? null,
      country_code: profile?.country_code ?? null,
      city: profile?.city ?? null,
      location: profile?.location ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });

  return json({ users, total: users.length });
});
