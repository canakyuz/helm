import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-acquisition - PostHog $initial_referrer + UTM breakdown.
// Kullanıcı edinme kaynakları: direct / google / facebook / referral,
// ayrıca ücretli kampanya atıfı ($initial_utm_*).
//
// Body: { project_id, days?: number }
// Yanıt: {
//   rows: [{ source, type, users }], total, days,
//   utm: {
//     sources:   [{ source, users }],
//     campaigns: [{ campaign, source, medium, users }],
//     total
//   }
// }
// utm alanı EK bir alandır; rows/total şekli değişmedi (UI ona bağlı).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// Raw referrer → temiz kategori
const categorize = (raw: string): { source: string; type: string } => {
  if (!raw || raw === "$direct" || raw === "(direct)") {
    return { source: "Direct", type: "direct" };
  }
  const r = raw.toLowerCase();
  if (r.includes("google")) return { source: "Google", type: "search" };
  if (r.includes("bing")) return { source: "Bing", type: "search" };
  if (r.includes("duckduckgo")) return { source: "DuckDuckGo", type: "search" };
  if (r.includes("facebook") || r.includes("fb.com"))
    return { source: "Facebook", type: "social" };
  if (r.includes("instagram")) return { source: "Instagram", type: "social" };
  if (r.includes("twitter") || r.includes("t.co") || r.includes("x.com"))
    return { source: "Twitter/X", type: "social" };
  if (r.includes("tiktok")) return { source: "TikTok", type: "social" };
  if (r.includes("linkedin")) return { source: "LinkedIn", type: "social" };
  if (r.includes("reddit")) return { source: "Reddit", type: "social" };
  if (r.includes("youtube")) return { source: "YouTube", type: "social" };
  if (r.includes("apple") || r.includes("app-store"))
    return { source: "App Store", type: "store" };
  if (r.includes("play.google"))
    return { source: "Play Store", type: "store" };
  // Domain çıkar
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return { source: url.hostname.replace(/^www\./, ""), type: "referral" };
  } catch {
    return { source: raw.slice(0, 30), type: "referral" };
  }
};

/* ───────────────────────────── UTM atıfı ───────────────────────────── */

interface UtmSourceRow {
  source: string;
  users: number;
}
interface UtmCampaignRow {
  campaign: string;
  // Kampanyaya en çok kullanıcı getiren source/medium - etiket amaçlı.
  source: string | null;
  medium: string | null;
  users: number;
}
interface UtmBreakdown {
  sources: UtmSourceRow[];
  campaigns: UtmCampaignRow[];
  total: number;
}

// UTM property'si olmayan (organik) uygulamalarda boş dönmek zorundayız:
// UI bunu "UTM etiketli trafik bulunamadı" boş durumuna çevirir.
const EMPTY_UTM: UtmBreakdown = { sources: [], campaigns: [], total: 0 };

// Payload'ı ve tablo satırlarını sınırlı tutmak için üst sınır.
const UTM_MAX_ROWS = 50;

// PostHog string property'leri "", "null", "undefined" gibi çöp değerlerle
// gelebiliyor; bunları yok saymazsak boş bir kampanya satırı gibi görünürler.
const cleanProp = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed.slice(0, 60);
};

// (source, medium, campaign, users) satırlarını iki boyuta katlar.
// $initial_* person-level ilk-dokunuş property'si olduğu için bir kullanıcı
// tek bir üçlüye düşer; dolayısıyla dilim toplamları çift saymaz.
// Zaman: O(n), Yer: O(farklı source + farklı campaign).
const foldUtm = (results: unknown[][]): UtmBreakdown => {
  const sources = new Map<string, number>();
  const campaigns = new Map<string, UtmCampaignRow>();
  let total = 0;

  for (const row of results) {
    const source = cleanProp(row[0]);
    const medium = cleanProp(row[1]);
    const campaign = cleanProp(row[2]);
    const users = Number(row[3] ?? 0);
    if (!Number.isFinite(users) || users <= 0) continue;
    // Hem source hem campaign boşsa satır UTM taşımıyor demektir.
    if (!source && !campaign) continue;

    total += users;
    if (source) sources.set(source, (sources.get(source) ?? 0) + users);
    if (campaign) {
      const existing = campaigns.get(campaign);
      if (existing) {
        existing.users += users;
      } else {
        // Sorgu users DESC sıralı geldiği için kampanyanın ILK görülen dilimi
        // en büyük dilimidir - source/medium etiketini ondan alıyoruz.
        campaigns.set(campaign, { campaign, source, medium, users });
      }
    }
  }

  const byUsersDesc = <T extends { users: number }>(a: T, b: T) =>
    b.users - a.users;

  return {
    sources: [...sources.entries()]
      .map(([source, users]) => ({ source, users }))
      .sort(byUsersDesc)
      .slice(0, UTM_MAX_ROWS),
    campaigns: [...campaigns.values()]
      .sort(byUsersDesc)
      .slice(0, UTM_MAX_ROWS),
    total,
  };
};

/* ─────────────────────────── PostHog sorgusu ─────────────────────────── */

type QueryResult =
  | { ok: true; results: unknown[][] }
  | { ok: false; error: string };

const runHogQL = async (
  host: string,
  projectId: string | number,
  apiKey: string,
  query: string,
): Promise<QueryResult> => {
  const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    return {
      ok: false,
      error: `PostHog ${res.status}: ${(await res.text()).slice(0, 500)}`,
    };
  }
  const data = await res.json();
  return { ok: true, results: (data?.results as unknown[][]) ?? [] };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let projectId: string | undefined;
  let days = 30;
  try {
    const body = await req.json();
    if (typeof body?.project_id === "string") projectId = body.project_id;
    // Gün sayısı hem SQL'e gömülüyor hem tarama maliyetini belirliyor:
    // tam sayıya indirip 365'te tavanlıyoruz.
    if (typeof body?.days === "number" && body.days > 0) {
      days = Math.min(Math.floor(body.days), 365);
    }
  } catch {
    // gövde yok
  }
  if (!projectId) return json({ error: "project_id gerekli" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: integ } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", projectId)
    .eq("provider", "posthog")
    .eq("enabled", true)
    .maybeSingle();
  const cfg = integ?.config as
    | { project_id?: string | number; api_key?: string; host?: string }
    | undefined;
  if (!cfg?.project_id || !cfg?.api_key) {
    return json({ error: "PostHog entegrasyonu yok" }, 400);
  }
  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");

  const referrerHogQL = `
    SELECT
      properties.$initial_referrer AS referrer,
      count(DISTINCT person_id) AS users
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
      AND properties.$initial_referrer IS NOT NULL
    GROUP BY referrer
    ORDER BY users DESC
    LIMIT 100
  `;

  // Referrer sorgusuyla AYNI temel (events + count(DISTINCT person_id) + aynı
  // tarih penceresi) - aksi halde iki kart birbirini tutmayan rakam gösterir.
  // Üçlüyü tek sorguda çekip TS tarafında katlıyoruz: ikinci bir HTTP turu
  // yerine tek tur, ve source/medium/campaign ilişkisi korunuyor.
  const utmHogQL = `
    SELECT
      properties.$initial_utm_source AS utm_source,
      properties.$initial_utm_medium AS utm_medium,
      properties.$initial_utm_campaign AS utm_campaign,
      count(DISTINCT person_id) AS users
    FROM events
    WHERE timestamp > now() - INTERVAL ${days} DAY
      AND (properties.$initial_utm_source IS NOT NULL
        OR properties.$initial_utm_campaign IS NOT NULL)
    GROUP BY utm_source, utm_medium, utm_campaign
    ORDER BY users DESC
    LIMIT 200
  `;

  // Paralel: UTM sorgusu toplam gecikmeyi artırmasın.
  const [referrerRes, utmRes] = await Promise.all([
    runHogQL(host, cfg.project_id, cfg.api_key, referrerHogQL),
    runHogQL(host, cfg.project_id, cfg.api_key, utmHogQL),
  ]);

  if (!referrerRes.ok) return json({ error: referrerRes.error }, 500);
  const results = referrerRes.results;

  // UTM sorgusu patlarsa (ör. property hiç yoksa şema hatası) tüm yanıtı
  // düşürmüyoruz: referrer kartı çalışmaya devam etsin, UTM boş görünsün.
  const utm = utmRes.ok ? foldUtm(utmRes.results) : EMPTY_UTM;

  // Kategori bazlı topla
  const byCategory = new Map<string, { source: string; type: string; users: number }>();
  for (const r of results) {
    const raw = (r[0] as string) ?? "";
    const users = Number(r[1] ?? 0);
    if (users === 0) continue;
    const cat = categorize(raw);
    const key = cat.source;
    const existing = byCategory.get(key);
    if (existing) existing.users += users;
    else byCategory.set(key, { ...cat, users });
  }

  const rows = Array.from(byCategory.values()).sort((a, b) => b.users - a.users);
  const total = rows.reduce((s, r) => s + r.users, 0);

  return json({ rows, total, days, utm });
});
