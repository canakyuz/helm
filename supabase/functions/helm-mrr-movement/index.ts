import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-mrr-movement - RevenueCat Charts API (2026-02-05'te REST'e açıldı).
// GET /v2/projects/{id}/charts/mrr_movement  (scope: charts_metrics:charts:read)
// Body: { project_id }
// Response: { segments: [{ label, value }], net, raw? }
//
// ÖNEMLİ: RC'nin MRR Movement modeli doküman olarak 2 bileşenli (New + Churned),
// 4'lü expansion/contraction TEYİTLİ DEĞİL. Bu yüzden segment adları HARDCODE
// EDİLMEZ - summary ne dönerse toleranslı parse edilir. Tanınmayan şekilde `raw`
// aynen döner ki canlı yanıt incelenip parser kesinleştirilebilsin.

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

interface RcConfig {
  rc_project_id?: string;
  api_key?: string;
}

type Segment = { label: string; value: number };

// summary'yi toleranslı normalize et: dizi-of-obj veya obj-of-number kabul et.
function normalizeSegments(summary: unknown): Segment[] | null {
  if (Array.isArray(summary)) {
    const segs = summary
      .map((it): Segment | null => {
        if (it && typeof it === "object") {
          const o = it as Record<string, unknown>;
          const label = String(o.name ?? o.segment ?? o.label ?? o.key ?? "");
          const value = Number(o.value ?? o.total ?? o.amount ?? o.sum ?? NaN);
          if (label && Number.isFinite(value)) return { label, value };
        }
        return null;
      })
      .filter((s): s is Segment => s !== null);
    return segs.length > 0 ? segs : null;
  }
  if (summary && typeof summary === "object") {
    const segs = Object.entries(summary as Record<string, unknown>)
      .map(([label, v]): Segment | null => {
        const value = Number(v);
        return Number.isFinite(value) ? { label, value } : null;
      })
      .filter((s): s is Segment => s !== null);
    return segs.length > 0 ? segs : null;
  }
  return null;
}

const monthStart = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

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
    .eq("provider", "revenuecat")
    .eq("enabled", true)
    .maybeSingle();
  const cfg = integ?.config as RcConfig | undefined;
  if (!cfg?.rc_project_id || !cfg?.api_key) {
    return json({ error: "Bu projede RevenueCat entegrasyonu yok" }, 400);
  }

  const params = new URLSearchParams({
    start_date: monthStart(),
    end_date: new Date().toISOString().slice(0, 10),
    resolution: "month",
    aggregate: "total", // values boş, sadece summary dolu
  });
  const url = `https://api.revenuecat.com/v2/projects/${cfg.rc_project_id}/charts/mrr_movement?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${cfg.api_key}` },
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // 403 = api_key'de charts_metrics:charts:read scope yok.
    return json({ error: `RevenueCat ${res.status}: ${detail}` }, res.status === 403 ? 403 : 500);
  }

  const data = await res.json();
  const segments = normalizeSegments(data?.summary ?? data);
  if (!segments) {
    // Tanınmadı - ham yanıtı döndür, parser canlı şekle göre kesinleştirilsin.
    return json({ segments: [], net: 0, raw: data });
  }
  const net = segments.reduce((a, b) => a + b.value, 0);
  return json({ segments, net });
});
