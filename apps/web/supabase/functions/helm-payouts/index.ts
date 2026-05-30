import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeAscJwt } from "../_shared/asc-jwt.ts";

// helm-payouts — banka ödemeleri, çok kaynaklı:
//   • Stripe  /v1/payouts (canlı, gerçek payout objesi)
//   • App Store Connect /v1/financeReports (aylık proceeds → payout-benzeri)
// Her kaynak bağımsız try/catch — biri patlarsa diğeri akar. payouts tablosuna
// idempotent upsert + birleşik { pending, recent } döner.
// Body: { project_id }
//
// NOT (ASC): financeReports reportDate Apple FISCAL takvimi; arrival_date alanı
// raporda yok → ay sonu yaklaşık alınır. Bu modelleme canlı veriyle doğrulanmalı.

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

type PayoutRow = {
  id: string;
  project_id: string;
  source: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string | null;
};
type Pending = { source: string; amount: number; currency: string };
type Recent = {
  source: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: string | null;
  net: number;
};

const ymd = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);
const lastDayOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// ── Stripe ──────────────────────────────────────────────────────
interface StripePayout {
  id: string;
  amount: number; // minor units
  currency: string;
  arrival_date: number;
  status: string;
}

async function fetchStripe(projectId: string, secretKey: string) {
  const res = await fetch("https://api.stripe.com/v1/payouts?limit=25", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const payouts = ((await res.json()).data ?? []) as StripePayout[];

  const rows: PayoutRow[] = payouts.map((p) => ({
    id: p.id,
    project_id: projectId,
    source: "stripe",
    amount: p.amount / 100,
    currency: p.currency.toUpperCase(),
    status: p.status,
    arrival_date: ymd(p.arrival_date),
  }));
  const isPending = (s: string) => s === "pending" || s === "in_transit";
  const pending: Pending[] = payouts
    .filter((p) => isPending(p.status))
    .map((p) => ({ source: "Stripe", amount: p.amount / 100, currency: p.currency.toUpperCase() }));
  const recent: Recent[] = payouts
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
  return { rows, pending, recent };
}

// ── App Store Connect — financeReports ──────────────────────────
async function fetchAscFinance(
  projectId: string,
  cfg: Record<string, string>,
) {
  const jwt = await makeAscJwt(cfg as unknown as { key_id: string; issuer_id?: string; private_key: string });
  const vendor = String(cfg.vendor_number);

  // Son birkaç ay kodunu dene (yaklaşık fiscal); ilk veri döneni al.
  const now = new Date();
  const candidates: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    candidates.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const rows: PayoutRow[] = [];
  const recent: Recent[] = [];
  for (const month of candidates) {
    const params = new URLSearchParams({
      "filter[regionCode]": "ZZ", // tüm bölgeler konsolide
      "filter[reportDate]": month,
      "filter[reportType]": "FINANCIAL",
      "filter[vendorNumber]": vendor,
    });
    const res = await fetch(
      `https://api.appstoreconnect.apple.com/v1/financeReports?${params}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    if (res.status === 404) continue; // o fiscal ay henüz yok
    if (!res.ok) throw new Error(`ASC finance ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const ds = new DecompressionStream("gzip");
    const tsv = await new Response(res.body!.pipeThrough(ds)).text();
    const lines = tsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) continue;
    const headers = lines[0].split("\t");
    const iShare = headers.indexOf("Extended Partner Share");
    const iCur = headers.indexOf("Partner Share Currency");
    const iSor = headers.indexOf("Sale or Return");
    if (iShare < 0 || iCur < 0) continue;

    // Para birimine göre net proceeds topla (Return = çıkar).
    const byCur = new Map<string, number>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      const cur = (cols[iCur] ?? "").trim().toUpperCase();
      if (!cur) continue;
      const sign = iSor >= 0 && (cols[iSor] ?? "").trim().toUpperCase() === "R" ? -1 : 1;
      const share = Number(cols[iShare] ?? 0) * sign;
      byCur.set(cur, (byCur.get(cur) ?? 0) + share);
    }
    const arrival = lastDayOfMonth(month);
    for (const [cur, amount] of byCur) {
      if (amount === 0) continue;
      rows.push({
        id: `asc-${vendor}-${month}-${cur}`,
        project_id: projectId,
        source: "app_store_connect",
        amount: Number(amount.toFixed(2)),
        currency: cur,
        status: "paid",
        arrival_date: arrival,
      });
      recent.push({
        source: "App Store",
        amount: Number(amount.toFixed(2)),
        currency: cur,
        status: "paid",
        arrival_date: arrival,
        net: Number(amount.toFixed(2)),
      });
    }
    break; // en yeni veri döneni aldık, yeter
  }
  return { rows, pending: [] as Pending[], recent };
}

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

  const { data: integs } = await hub
    .from("project_integrations")
    .select("provider, config")
    .eq("project_id", projectId)
    .eq("enabled", true)
    .in("provider", ["stripe", "app_store_connect"]);

  const stripeCfg = integs?.find((i) => i.provider === "stripe")?.config as
    | { secret_key?: string }
    | undefined;
  const ascCfg = integs?.find((i) => i.provider === "app_store_connect")?.config as
    | Record<string, string>
    | undefined;

  if (!stripeCfg?.secret_key && !ascCfg?.vendor_number) {
    return json({ error: "Bu projede Stripe veya App Store Connect entegrasyonu yok" }, 400);
  }

  const allRows: PayoutRow[] = [];
  const pending: Pending[] = [];
  const recent: Recent[] = [];
  const errors: string[] = [];

  if (stripeCfg?.secret_key) {
    try {
      const r = await fetchStripe(projectId, stripeCfg.secret_key);
      allRows.push(...r.rows);
      pending.push(...r.pending);
      recent.push(...r.recent);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (ascCfg?.vendor_number) {
    try {
      const r = await fetchAscFinance(projectId, ascCfg);
      allRows.push(...r.rows);
      recent.push(...r.recent);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (allRows.length > 0) {
    await hub.from("payouts").upsert(allRows, { onConflict: "id" });
  }

  // recent'i tarihe göre (yeni → eski) sırala.
  recent.sort((a, b) => (a.arrival_date ?? "") < (b.arrival_date ?? "") ? 1 : -1);

  return json({ pending, recent: recent.slice(0, 12), ...(errors.length ? { errors } : {}) });
});
