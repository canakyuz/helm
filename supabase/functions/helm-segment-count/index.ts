import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-segment-count - bir segmentin kaç kullanıcıyı eşlediğini hesaplar.
// Auth listUsers'i tüm sayfalarıyla çeker, kuralı uygular.
//
// Body: { segment_id: string }
// Yanıt: {
//   segment_id, name, rule_type, rule_days,
//   count: number,
//   sample: Array<{ id, email, last_sign_in_at, created_at }>  (ilk 10)
//   projects: number  (kaç farklı projeden geldi)
// }

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

interface SegmentRow {
  id: string;
  name: string;
  project_id: string | null;
  rule_type: "new" | "active" | "inactive";
  rule_days: number;
}

interface IntegRow {
  project_id: string;
  config: { project_url?: string; service_role_key?: string };
}

const MAX_PAGES = 20; // 20 × 200 = 4000 user/proje üst sınırı (perf koruması)

async function listAllUsers(
  projectUrl: string,
  serviceRoleKey: string,
): Promise<AuthUser[]> {
  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const out: AuthUser[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
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
    if (users.length < 200) break; // son sayfa
  }
  return out;
}

function matches(
  u: AuthUser,
  rule_type: SegmentRow["rule_type"],
  rule_days: number,
): boolean {
  const cutoff = Date.now() - rule_days * 86_400_000;
  if (rule_type === "new") {
    return new Date(u.created_at).getTime() >= cutoff;
  }
  if (rule_type === "active") {
    return (
      !!u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= cutoff
    );
  }
  // inactive: hiç giriş yok veya cutoff'tan önce
  return (
    !u.last_sign_in_at || new Date(u.last_sign_in_at).getTime() < cutoff
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let segmentId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.segment_id === "string") segmentId = body.segment_id;
  } catch {
    // gövde yok
  }
  if (!segmentId) return json({ error: "segment_id gerekli" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: seg, error: segErr } = await hub
    .from("user_segments")
    .select("id, name, project_id, rule_type, rule_days")
    .eq("id", segmentId)
    .maybeSingle();
  if (segErr) return json({ error: segErr.message }, 500);
  if (!seg) return json({ error: "Segment not found" }, 404);

  const segment = seg as SegmentRow;

  // Hedef projeler: belirli proje veya tüm aktif Supabase entegrasyonu.
  let integQ = hub
    .from("project_integrations")
    .select("project_id, config")
    .eq("provider", "supabase")
    .eq("enabled", true);
  if (segment.project_id) integQ = integQ.eq("project_id", segment.project_id);
  const { data: integs, error: integErr } = await integQ;
  if (integErr) return json({ error: integErr.message }, 500);
  if (!integs || integs.length === 0) {
    return json({
      segment_id: segment.id,
      name: segment.name,
      rule_type: segment.rule_type,
      rule_days: segment.rule_days,
      count: 0,
      sample: [],
      projects: 0,
      warning: "No active Supabase integration is linked to this segment",
    });
  }

  let count = 0;
  const sample: Array<{
    id: string;
    email: string | null;
    last_sign_in_at: string | null;
    created_at: string;
    project_id: string;
  }> = [];

  for (const it of integs as IntegRow[]) {
    if (!it.config?.project_url || !it.config?.service_role_key) continue;
    let users: AuthUser[] = [];
    try {
      users = await listAllUsers(
        it.config.project_url,
        it.config.service_role_key,
      );
    } catch (e) {
      // proje patlarsa diğerlerini engelleme
      console.error(`listUsers fail (${it.project_id}):`, e);
      continue;
    }
    for (const u of users) {
      if (!matches(u, segment.rule_type, segment.rule_days)) continue;
      count++;
      if (sample.length < 10) {
        sample.push({
          id: u.id,
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at,
          project_id: it.project_id,
        });
      }
    }
  }

  return json({
    segment_id: segment.id,
    name: segment.name,
    rule_type: segment.rule_type,
    rule_days: segment.rule_days,
    count,
    sample,
    projects: integs.length,
  });
});
