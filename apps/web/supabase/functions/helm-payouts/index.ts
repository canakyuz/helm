import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-payouts — Stripe banka ödemeleri (/v1/payouts). Canlı çeker, payouts
// tablosuna idempotent upsert eder (geçmiş + ileride ASC/Play için ortak tablo).
// Body: { project_id }
// Response: { pending: [{ source, amount, currency }],
//             recent:  [{ source, amount, currency, status, arrival_date, net }] }
//
// Not: Stripe payout.amount = net (bankaya geçen). Gross/fees ayrımı için
// balance_transactions gerekir — burada net döner, gross/fees null bırakılır.

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

interface StripePayout {
  id: string;
  amount: number; // minor units (cents)
  currency: string;
  arrival_date: number; // unix
  status: string; // paid | pending | in_transit | failed | canceled
}

const ymd = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

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

  const hub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: integ } = await hub
    .from("project_integrations")
    .select("config")
    .eq("project_id", projectId)
    .eq("provider", "stripe")
    .eq("enabled", true)
    .maybeSingle();
  const secretKey = (integ?.config as { secret_key?: string } | undefined)?.secret_key;
  if (!secretKey) {
    return json({ error: "Bu projede Stripe entegrasyonu yok" }, 400);
  }

  const res = await fetch("https://api.stripe.com/v1/payouts?limit=25", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) {
    return json({ error: `Stripe ${res.status}: ${(await res.text()).slice(0, 300)}` }, 500);
  }
  const payouts = ((await res.json()).data ?? []) as StripePayout[];

  // payouts tablosuna upsert (geçmiş + ortak kaynak).
  const rows = payouts.map((p) => ({
    id: p.id,
    project_id: projectId,
    source: "stripe",
    amount: p.amount / 100,
    currency: p.currency.toUpperCase(),
    status: p.status,
    arrival_date: ymd(p.arrival_date),
  }));
  if (rows.length > 0) {
    await hub.from("payouts").upsert(rows, { onConflict: "id" });
  }

  const isPending = (s: string) => s === "pending" || s === "in_transit";
  const pending = payouts
    .filter((p) => isPending(p.status))
    .map((p) => ({ source: "Stripe", amount: p.amount / 100, currency: p.currency.toUpperCase() }));
  const recent = payouts
    .filter((p) => !isPending(p.status))
    .slice(0, 8)
    .map((p) => ({
      source: "Stripe",
      amount: p.amount / 100,
      currency: p.currency.toUpperCase(),
      status: p.status,
      arrival_date: ymd(p.arrival_date),
      net: p.amount / 100,
    }));

  return json({ pending, recent });
});
