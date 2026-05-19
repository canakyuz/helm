import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-versions — App Store lookup API'sinden (public) her projenin güncel
// uygulama sürümünü çeker, app_versions'a idempotent upsert eder.

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

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: projects, error } = await hub
    .from("projects")
    .select("id, app_store_id, app_store_country")
    .not("app_store_id", "is", null);
  if (error) return json({ error: error.message }, 500);

  let found = 0;

  for (const p of projects ?? []) {
    const country = (p.app_store_country as string) || "us";
    try {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${p.app_store_id}&country=${country}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const app = data.results?.[0];
      if (!app?.version) continue;

      await hub.from("app_versions").upsert(
        {
          project_id: p.id,
          version: app.version,
          release_date: app.currentVersionReleaseDate ?? null,
          release_notes: app.releaseNotes ?? null,
        },
        { onConflict: "project_id,version" },
      );
      found++;
    } catch {
      // bir proje patlasa diğerleri devam etsin
    }
  }

  return json({ projects: projects?.length ?? 0, versions: found });
});
