import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

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
  // Premium — projeye özgü (Empire-Inc: profiles.premium_tier + premium_expires_at).
  premium_tier?: number | null;
  premium_expires_at?: string | null;
};

const PROFILE_BASE_COLS =
  "id, username, display_name, country, country_code, city, location, avatar_url";
const PROFILE_PREMIUM_COLS = "premium_tier, premium_expires_at";

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

  // 1. Auth kullanıcılarını sayfalı çek — eski 200 limiti UUID/e-posta aramasını
  //    ilk 200 kayıtla sınırlıyordu (201+ bulunamıyordu). Artık hepsini yüklüyoruz.
  //    Güvenlik freni: en fazla MAX_PAGES * PER_PAGE kayıt (runaway koruması).
  const PER_PAGE = 1000;
  const MAX_PAGES = 50;
  const authUsers: User[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data: pageData, error: usersError } =
      await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (usersError) return json({ error: usersError.message }, 500);
    authUsers.push(...pageData.users);
    if (pageData.users.length < PER_PAGE) break;
  }

  const userIds = authUsers.map((u) => u.id);

  // 2. profiles tablosundan username + lokasyon + premium (tolerant).
  //    Premium kolonları (premium_tier/premium_expires_at) projeye özgü → önce
  //    onlarla dene; kolon yoksa premium'suz tekrar dene ki username/lokasyon kaybolmasın.
  const profileMap = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const tryFetch = async (cols: string) =>
      (await admin.from("profiles").select(cols).in("id", userIds)) as {
        data: ProfileRow[] | null;
        error: unknown;
      };
    let res = await tryFetch(`${PROFILE_BASE_COLS}, ${PROFILE_PREMIUM_COLS}`);
    if (res.error) res = await tryFetch(PROFILE_BASE_COLS); // premium kolonu yok → düş
    for (const p of res.data ?? []) profileMap.set(p.id, p);
  }

  const nowMs = Date.now();
  const users = authUsers.map((u) => {
    const meta = (u as { banned_until?: string }).banned_until ?? null;
    const isBanned = meta !== null && new Date(meta).getTime() > nowMs;
    const profile = profileMap.get(u.id);

    // Premium: profiles.premium_tier > 0 ve süresi geçmemiş (Empire-Inc modeli);
    // yoksa eski app_metadata.premium fallback.
    const tier = profile?.premium_tier ?? 0;
    const expMs = profile?.premium_expires_at
      ? new Date(profile.premium_expires_at).getTime()
      : null;
    const premiumActive = tier > 0 && (expMs === null || expMs > nowMs);
    const premium =
      premiumActive ||
      Boolean((u.app_metadata as { premium?: unknown })?.premium);

    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      banned: isBanned,
      premium,
      premium_tier: tier || null,
      premium_expires_at: profile?.premium_expires_at ?? null,
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
