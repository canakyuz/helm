import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-heartbeat — bir heartbeat ping'ini kaydeder.
// Kullanım (izlenen cron job sonuna eklenir):
//   curl "https://<hub>.supabase.co/functions/v1/helm-heartbeat?id=<heartbeat-id>"
// id (uuid) tahmin edilemez olduğu için endpoint JWT istemez (--no-verify-jwt).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  const url = new URL(req.url);
  let id = url.searchParams.get("id") ?? undefined;
  if (!id) {
    try {
      const body = await req.json();
      if (typeof body?.id === "string") id = body.id;
    } catch {
      // gövde yok
    }
  }
  if (!id) return json({ error: "heartbeat id gerekli" }, 400);

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await hub
    .from("heartbeats")
    .update({ last_ping_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
