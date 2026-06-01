import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-geo-breakdown — PostHog $geoip_* property'lerinden ülke/eyalet/şehir
// kırılımı (izinsiz, IP tabanlı GeoIP — kullanıcıya konum sorulmaz).
//
// Body: { project_id, days?, country? }
//   country verilirse: o ülkenin eyalet+şehir kırılımı
//   verilmezse: tüm ülkelerin top-level dağılımı
// Yanıt: { rows: [{ country, region?, city?, users }], total }

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let projectId: string | undefined;
  let days = 30;
  let country: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.project_id === "string") projectId = body.project_id;
    if (typeof body?.days === "number" && body.days > 0) days = body.days;
    if (typeof body?.country === "string" && body.country.length === 2) {
      country = body.country.toUpperCase();
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
    return json({ error: "Bu projede PostHog entegrasyonu yok" }, 400);
  }
  const host = (cfg.host || "https://eu.posthog.com").replace(/\/+$/, "");

  // HogQL — country verilirse o ülkeyi drill-down (region+city), yoksa ülke özeti
  const dateFilter = `timestamp > now() - INTERVAL ${days} DAY`;
  const hogql = country
    ? `
        SELECT
          properties.$geoip_subdivision_1_name AS region,
          properties.$geoip_city_name AS city,
          count(DISTINCT person_id) AS users
        FROM events
        WHERE ${dateFilter}
          AND properties.$geoip_country_code = '${country}'
        GROUP BY region, city
        ORDER BY users DESC
        LIMIT 500
      `
    : `
        SELECT
          properties.$geoip_country_code AS country,
          properties.$geoip_country_name AS country_name,
          count(DISTINCT person_id) AS users
        FROM events
        WHERE ${dateFilter}
          AND properties.$geoip_country_code IS NOT NULL
        GROUP BY country, country_name
        ORDER BY users DESC
        LIMIT 100
      `;

  const res = await fetch(`${host}/api/projects/${cfg.project_id}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: hogql },
    }),
  });
  if (!res.ok) {
    return json(
      { error: `PostHog ${res.status}: ${(await res.text()).slice(0, 500)}` },
      500,
    );
  }
  const data = await res.json();
  // HogQL yanıtı: { results: [[col1, col2, ...], ...], columns: [...] }
  const results: unknown[][] = data?.results ?? [];

  let rows: Array<Record<string, unknown>>;
  if (country) {
    rows = results
      .map((r) => ({
        region: (r[0] as string) ?? "—",
        city: (r[1] as string) ?? "—",
        users: Number(r[2] ?? 0),
      }))
      .filter((r) => r.users > 0);
  } else {
    rows = results
      .map((r) => ({
        country: (r[0] as string) ?? "??",
        country_name: (r[1] as string) ?? null,
        users: Number(r[2] ?? 0),
      }))
      .filter((r) => r.country !== "??" && r.users > 0);
  }

  const total = rows.reduce((s, r) => s + (r.users as number), 0);
  return json({ rows, total, days, country });
});
