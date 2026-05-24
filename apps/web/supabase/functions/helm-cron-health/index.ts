import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-cron-health — pg_cron job durumu + son N run.
// helm_cron_status() RPC fonksiyonunu çağırır (SECURITY DEFINER ile cron.* okur).
//
// Body: { limit?: number }  (default 10 son run / job)

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

  let limit = 10;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number" && body.limit > 0) limit = body.limit;
  } catch {
    // gövde yok
  }

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await hub.rpc("helm_cron_status", {
    limit_runs: limit,
  });
  if (error) {
    return json(
      {
        error: error.message,
        hint:
          "Migration 0023 push edilmiş olmalı (helm_cron_status fonksiyonu).",
      },
      500,
    );
  }
  return json({ jobs: data ?? [] });
});
