import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-revenuecat-webhook — RevenueCat olaylarini revenue_events tablosuna yazar.
//
// NEDEN VAR: subscription_revenue / iap_revenue metrikleri App Store Connect'ten
// geliyor ve Apple gunluk raporlari T-1 + isleme gecikmesi tasiyor; bir satin alma
// panelde 1-2 gun sonra goruluyor. RevenueCat olayi aninda biliyor.
//
// RevenueCat panelinde ayarlanacak (Project → Integrations → Webhooks):
//   URL     : https://<PROJE>.supabase.co/functions/v1/helm-revenuecat-webhook
//   Header  : Authorization: Bearer <RC_WEBHOOK_SECRET>
//
// RC_WEBHOOK_SECRET edge function secret'i olarak tanimlanmali:
//   supabase secrets set RC_WEBHOOK_SECRET=<rastgele-uzun-dize>
//
// Yetkilendirme neden gerekli: bu uc herkese aciktir. Secret olmadan biri sahte
// satin alma POST'layip gelir tablosunu kirletebilir.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Gelir ureten olaylar. Digerleri (transfer, billing issue…) kaydedilir ama
 *  tutari yoktur; ekran yalnizca gelir uretenleri toplar. */
const REVENUE_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

interface RcEvent {
  id?: string;
  type?: string;
  event_timestamp_ms?: number;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  country_code?: string;
  currency?: string;
  price?: number;
  price_in_purchased_currency?: number;
  // RC bazi surumlerde mikro-birim kullanir.
  purchased_at_ms?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST bekleniyor" }, 405);

  const secret = Deno.env.get("RC_WEBHOOK_SECRET");
  if (!secret) return json({ error: "RC_WEBHOOK_SECRET tanimli degil" }, 500);

  const auth = req.headers.get("authorization") ?? "";
  // Sabit zamanli karsilastirma gerekmiyor: secret uzun ve rastgele, ayrica
  // basarisiz denemede hicbir bilgi sizmiyor.
  if (auth !== `Bearer ${secret}`) return json({ error: "yetkisiz" }, 401);

  let body: { event?: RcEvent; api_version?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "gecersiz JSON" }, 400);
  }

  const ev = body.event;
  if (ev?.id == null || ev.type == null) {
    return json({ error: "event.id veya event.type yok" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Proje eslemesi: RC'nin app_user_id'si bizim project_id'miz DEGIL. Esleme
  // project_integrations.config.rc_project_id uzerinden yapilir; tek RC projesi
  // varsa dogrudan o projeye yazilir.
  const { data: integ } = await supabase
    .from("project_integrations")
    .select("project_id")
    .eq("provider", "revenuecat")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();

  const occurredMs = ev.purchased_at_ms ?? ev.event_timestamp_ms ?? Date.now();
  const amount = REVENUE_TYPES.has(ev.type)
    ? (ev.price_in_purchased_currency ?? ev.price ?? null)
    : null;

  // upsert + ignoreDuplicates: RC teslimati garanti etmek icin ayni olayi
  // tekrar gonderebilir. event_id unique; ikinci gonderim sessizce yutulur.
  const { error } = await supabase.from("revenue_events").upsert(
    {
      project_id: integ?.project_id ?? null,
      event_id: ev.id,
      event_type: ev.type,
      store: ev.store ?? null,
      product_id: ev.product_id ?? null,
      app_user_id: ev.app_user_id ?? ev.original_app_user_id ?? null,
      country_code: ev.country_code ?? null,
      amount,
      currency: ev.currency ?? null,
      occurred_at: new Date(occurredMs).toISOString(),
      raw: body,
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, event_id: ev.id, type: ev.type });
});
