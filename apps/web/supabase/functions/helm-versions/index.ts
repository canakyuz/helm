import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchAscVersions, type AscVersionRow } from "./asc.ts";
import { fetchPlayVersions, type PlayVersionRow } from "./play.ts";

// helm-versions — App Store + Play Store sürümlerini çeker.
// Apple sırası:
//   1) app_store_connect integration enabled + key varsa  → ASC API (canlı + TestFlight)
//   2) yoksa → iTunes lookup fallback (sadece canlı)
// Google Play sırası:
//   1) google_play_developer integration + service_account varsa → tracks API (production + internal/alpha/beta)
//   2) yoksa → Play Store HTML scrape (sadece canlı)
// app_versions tablosuna idempotent upsert (PK: project_id, source, version, build_number).

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

interface PropertyRow {
  id: string;
  app_store_id: string | null;
  app_store_country: string | null;
  google_play_id: string | null;
  google_play_country: string | null;
}

interface VersionInsert {
  project_id: string;
  source: "ios" | "android";
  version: string;
  build_number: string | null;
  status: string;
  release_date: string | null;
  release_notes: string | null;
  expires_at: string | null;
  state_changed_at: string | null;
}

async function fetchApple(p: PropertyRow): Promise<VersionInsert | null> {
  if (!p.app_store_id) return null;
  const country = p.app_store_country || "us";
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${p.app_store_id}&country=${country}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const app = data.results?.[0];
  if (!app?.version) return null;
  return {
    project_id: p.id,
    source: "ios",
    version: String(app.version),
    build_number: null,
    status: "live",
    release_date: app.currentVersionReleaseDate ?? null,
    release_notes: app.releaseNotes ?? null,
    expires_at: null,
    state_changed_at: app.currentVersionReleaseDate ?? null,
  };
}

async function fetchPlay(p: PropertyRow): Promise<VersionInsert | null> {
  if (!p.google_play_id) return null;
  const hl = p.google_play_country || "us";
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(
    p.google_play_id,
  )}&hl=${hl}`;
  const res = await fetch(url, {
    // User-Agent eksik olduğunda Google bazen 403 dönüyor
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": `${hl},en;q=0.9`,
    },
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Play Store HTML'inde "softwareVersion" / current version birkaç şekilde geçer.
  // Pattern 1: structured data — "softwareVersion": "1.2.3"
  // Pattern 2: meta — "Current Version" + value
  // Pattern 3: HTML attribute — version etiketi
  let version: string | null = null;
  const m1 = html.match(/"softwareVersion"\s*:\s*"([^"]+)"/);
  if (m1) version = m1[1];
  if (!version) {
    const m2 = html.match(/\[\[\["([0-9]+\.[0-9]+(?:\.[0-9]+)*)/);
    if (m2) version = m2[1];
  }
  if (!version) return null;

  // Release notes — "Yenilikler" / "What's new" — opsiyonel
  let releaseNotes: string | null = null;
  const rn = html.match(/<div[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/div>/);
  if (rn) {
    releaseNotes = rn[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (releaseNotes.length > 500) releaseNotes = releaseNotes.slice(0, 500);
  }

  // Release date — Play HTML'inde "lastUpdated" veya "datePublished" geçer
  let releaseDate: string | null = null;
  const dm = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  if (dm) releaseDate = dm[1];

  return {
    project_id: p.id,
    source: "android",
    version,
    build_number: null,
    status: "live",
    release_date: releaseDate,
    release_notes: releaseNotes,
    expires_at: null,
    state_changed_at: releaseDate,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // properties + integration config fallback. ASC config app_store_id veriyorsa
  // properties.app_store_id null olsa bile geçerli (helm-reviews ile aynı pattern).
  const [{ data: properties, error: pErr }, { data: integrations, error: iErr }] =
    await Promise.all([
      hub
        .from("properties")
        .select(
          "id, app_store_id, app_store_country, google_play_id, google_play_country",
        ),
      hub
        .from("project_integrations")
        .select("project_id, provider, config")
        .in("provider", ["app_store_connect", "google_play_developer"])
        .eq("enabled", true),
    ]);
  if (pErr) return json({ error: pErr.message }, 500);
  if (iErr) return json({ error: iErr.message }, 500);

  const ascByProj = new Map<string, Record<string, string | undefined>>();
  const playByProj = new Map<string, Record<string, string | undefined>>();
  for (const it of (integrations ?? []) as Array<{
    project_id: string;
    provider: string;
    config: Record<string, string | undefined> | null;
  }>) {
    const cfg = (it.config ?? {}) as Record<string, string | undefined>;
    if (it.provider === "app_store_connect") ascByProj.set(it.project_id, cfg);
    else if (it.provider === "google_play_developer") playByProj.set(it.project_id, cfg);
  }

  let iosCount = 0;
  let androidCount = 0;
  const errors: string[] = [];
  const results: Array<Record<string, unknown>> = [];

  for (const raw of properties ?? []) {
    const baseProp = raw as PropertyRow;
    const ascCfg = ascByProj.get(baseProp.id) ?? {};
    const playCfg = playByProj.get(baseProp.id) ?? {};
    const p: PropertyRow = {
      id: baseProp.id,
      app_store_id: ascCfg.app_store_id || baseProp.app_store_id,
      app_store_country: ascCfg.app_store_country || baseProp.app_store_country,
      google_play_id: playCfg.package_name || baseProp.google_play_id,
      google_play_country: baseProp.google_play_country,
    };
    if (!p.app_store_id && !p.google_play_id) {
      results.push({ projectId: p.id, ios: "skip-no-id", android: "skip-no-id" });
      continue;
    }

    const propResult: Record<string, unknown> = { projectId: p.id };

    try {
      const hasAscKey = !!(ascCfg.key_id && ascCfg.private_key && p.app_store_id);
      if (hasAscKey) {
        const ascRes = await fetchAscVersions({
          projectId: p.id,
          appId: p.app_store_id!,
          ascKey: {
            key_id: ascCfg.key_id!,
            issuer_id: ascCfg.issuer_id,
            private_key: ascCfg.private_key!,
          },
        });
        if (ascRes.ok) {
          let upserted = 0;
          for (const row of ascRes.rows) {
            const insert: VersionInsert = {
              ...(row as AscVersionRow),
              release_notes: null,
            };
            const { error: e } = await hub
              .from("app_versions")
              .upsert(insert, {
                onConflict: "project_id,source,version,build_number",
              });
            if (!e) {
              iosCount++;
              upserted++;
            } else {
              errors.push(`ios ${p.id} ${row.version}/${row.build_number}: ${e.message}`);
            }
          }
          propResult.ios = {
            method: "asc",
            rows: ascRes.rows.length,
            upserted,
            diag: ascRes.diag,
          };
        } else {
          errors.push(`ios ${p.id} ASC: ${ascRes.message}`);
          propResult.ios = {
            method: "asc",
            error: ascRes.message,
            status: ascRes.status,
          };
        }
      } else if (p.app_store_id) {
        const apple = await fetchApple(p);
        if (apple) {
          const { error: e } = await hub
            .from("app_versions")
            .upsert(apple, {
              onConflict: "project_id,source,version,build_number",
            });
          if (!e) iosCount++;
          else errors.push(`ios ${p.id}: ${e.message}`);
          propResult.ios = { method: "itunes", upserted: e ? 0 : 1 };
        } else {
          propResult.ios = { method: "itunes", error: "iTunes lookup boş" };
        }
      } else {
        propResult.ios = "skip-no-app-id";
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`ios ${p.id}: ${msg}`);
      propResult.ios = { error: msg };
    }

    try {
      const hasPlayKey = !!(playCfg.service_account_json && p.google_play_id);
      if (hasPlayKey) {
        const playRes = await fetchPlayVersions({
          projectId: p.id,
          packageName: p.google_play_id!,
          serviceAccountJson: playCfg.service_account_json!,
        });
        if (playRes.ok) {
          let upserted = 0;
          for (const row of playRes.rows) {
            const insert: VersionInsert = row as PlayVersionRow;
            const { error: e } = await hub
              .from("app_versions")
              .upsert(insert, {
                onConflict: "project_id,source,version,build_number",
              });
            if (!e) {
              androidCount++;
              upserted++;
            } else {
              errors.push(`android ${p.id} ${row.version}/${row.build_number}: ${e.message}`);
            }
          }
          propResult.android = {
            method: "play-api",
            rows: playRes.rows.length,
            upserted,
            diag: playRes.diag,
          };
        } else {
          errors.push(`android ${p.id} Play API: ${playRes.message}`);
          propResult.android = {
            method: "play-api",
            error: playRes.message,
            status: playRes.status,
          };
        }
      } else if (p.google_play_id) {
        const play = await fetchPlay(p);
        if (play) {
          const { error: e } = await hub
            .from("app_versions")
            .upsert(play, {
              onConflict: "project_id,source,version,build_number",
            });
          if (!e) androidCount++;
          else errors.push(`android ${p.id}: ${e.message}`);
          propResult.android = { method: "scrape", upserted: e ? 0 : 1 };
        } else {
          propResult.android = { method: "scrape", error: "Play scrape boş" };
        }
      } else {
        propResult.android = "skip-no-package-id";
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`android ${p.id}: ${msg}`);
      propResult.android = { error: msg };
    }

    results.push(propResult);
  }

  return json({
    properties: properties?.length ?? 0,
    ios: iosCount,
    android: androidCount,
    versions: iosCount + androidCount,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    results,
  });
});
