import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// helm-revenuecat-webhook - RevenueCat olaylarini revenue_events tablosuna yazar.
//
// NEDEN VAR: subscription_revenue / iap_revenue metrikleri App Store Connect'ten
// geliyor ve Apple gunluk raporlari T-1 + isleme gecikmesi tasiyor; bir satin alma
// panelde 1-2 gun sonra goruluyor. RevenueCat olayi aninda biliyor.
//
// Sir IKI YOLDAN da kabul edilir:
//   1) Authorization: Bearer <RC_WEBHOOK_SECRET>   - RC panelinden elle
//   2) ?k=<RC_WEBHOOK_SECRET>                      - URL'in kendisinde
//
// NEDEN IKISI: RevenueCat v2 API'si webhook kaydinda authorization BASLIGI
// ayarlamaya izin vermiyor (kayit yaniti boyle bir alan dondurmuyor) - baslik
// yalnizca panelden girilebiliyor. Sir URL'de tasinabilirse kayit tamamen
// API'den yapilabilir, panele hic girilmez.
//
// URL'deki sirrin bedeli: istek loglarinda gorunur. Tek kullanicili bir arac
// icin kabul edilebilir; loglar da zaten ayni kisinin.
//
// Yetkilendirme neden gerekli: bu uc herkese aciktir. Sir olmadan biri sahte
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
  transaction_id?: string;
  original_transaction_id?: string;
  environment?: string;
}

/** Odemenin dogal anahtari - REST geri doldurmasiyla ORTAK.
 *
 *  Neden RC olay kimligi degil: geri doldurma REST API'sinden okur, orada olay
 *  kimligi yoktur. Iki taraf ayni parayi ayni anahtarla bulamazsa webhook
 *  kesintisi sonrasi geri doldurma cift sayim uretir (bkz. migration 0038).
 *
 *  Yenilemede transaction_id degisir, original_transaction_id degismez; ayirici
 *  olan donem baslangicidir (purchased_at_ms). Bu yuzden original kullaniliyor.
 *
 *  Gelir uretmeyen olay parayla ayrisamaz - iptal, satin almanin kopyasi sanilip
 *  yutulmasin diye olay kimligiyle anahtarlanir. */
function txnKey(ev: RcEvent, occurredMs: number, isRevenue: boolean): string {
  if (!isRevenue) return `evt:${ev.id}`;
  const orig = ev.original_transaction_id ?? ev.transaction_id;
  // Magaza kimligi yoksa (promo, test, Amazon...) olay kimligine dus: tekillik
  // korunur, sadece REST tarafiyla eslesme kaybolur.
  if (!orig) return `evt:${ev.id}`;
  return `${ev.store ?? "unknown"}:${orig}:${occurredMs}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST bekleniyor" }, 405);

  const secret = Deno.env.get("RC_WEBHOOK_SECRET");
  if (!secret) return json({ error: "RC_WEBHOOK_SECRET tanimli degil" }, 500);

  // Sabit zamanli karsilastirma gerekmiyor: sir uzun ve rastgele, basarisiz
  // denemede hicbir bilgi sizmiyor.
  const header = req.headers.get("authorization") ?? "";
  const fromUrl = new URL(req.url).searchParams.get("k") ?? "";
  const ok = header === `Bearer ${secret}` || fromUrl === secret;
  if (!ok) return json({ error: "yetkisiz" }, 401);

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

  // Sandbox/test satin almalari gercek gelir DEGIL. 200 donuyoruz ki RevenueCat
  // teslimati basarili saysin ve tekrar tekrar denemesin.
  if ((ev.environment ?? "PRODUCTION").toUpperCase() !== "PRODUCTION") {
    return json({ ok: true, skipped: "sandbox", event_id: ev.id });
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
  const isRevenue = REVENUE_TYPES.has(ev.type);
  const amount = isRevenue
    ? (ev.price_in_purchased_currency ?? ev.price ?? null)
    : null;

  // upsert + ignoreDuplicates: RC teslimati garanti etmek icin ayni olayi
  // tekrar gonderebilir. Catisma hedefi txn_key - hem RC'nin tekrar gonderimini
  // hem de REST geri doldurmasinin ayni odemeyi yazmasini ayni anda yutar.
  const { error } = await supabase.from("revenue_events").upsert(
    {
      project_id: integ?.project_id ?? null,
      txn_key: txnKey(ev, occurredMs, isRevenue),
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
    { onConflict: "txn_key", ignoreDuplicates: true },
  );

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, event_id: ev.id, type: ev.type });
});
