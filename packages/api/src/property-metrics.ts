import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFxRates, metricValueUsd, toUsd } from "./fx-rates";

export type PropertyMetric = {
  adRevenue: number;
  /**
   * O GUNUN TOPLAM geliri (USD): reklam + magaza/webhook odemeleri.
   *
   * NEDEN AYRI BIR ALAN: kokpitteki proje satirlari `adRevenue` gosteriyordu,
   * yani YALNIZCA reklam. Ustteki hero ise reklam + odemeleri topluyor. Sonuc,
   * ayni ekranda birbirini tutmayan iki rakamdi (olculdu, 2026-08-20):
   *
   *   hero (bugun)            : 8.30 GBP
   *   proje satirlari toplami : 0.95 GBP   ← ayni gunun %89'u eksik
   *
   * Empire Inc o gun 9.99 USD abonelik kazanmisti; satir 0.94 GBP yaziyordu.
   * Ayni gunun geliri iki yerde iki turlu okunuyordu.
   */
  revenue: number;
  mrr: number;
  dau: number;
  /**
   * adRevenue'nun HANGI GUNE ait oldugu (YYYY-MM-DD), veri yoksa null.
   *
   * Neden tasiniyor: bu sorgunun tarih filtresi yok, "en son satir"i alir. Ingest
   * durursa o satir haftalar oncesine ait olabilir. Deger tek basina tasinirsa
   * arayuz onu "bugun" diye etiketler ve bayat rakam guncelmis gibi gorunur -
   * panelin onlemesi gereken sey tam olarak bu. Tarihi da tasiyip etiketi
   * gercege gore kurdurmak, degeri atmaktan daha dogru: dun senkron olmus bir
   * projeyi sifir gostermek de yanlis olurdu.
   */
  adRevenueDate: string | null;
};
export type PropertyMetricsMap = Record<string, PropertyMetric>;

type Row = {
  project_id: string;
  metric: string;
  date: string;
  value: number;
  currency: string | null;
};

type EventRow = {
  project_id: string;
  amount: string | number | null;
  currency: string | null;
  occurred_at: string;
};

/** Magaza raporu ile webhook'un ayni gun icin mutabakati.
 *
 *  Magaza (App Store Connect) T-1/T-2 gecikmeli ama komisyon ve iadeyi
 *  yansitir; webhook aninda gelir ama revize olabilir. Magaza konustuysa onu,
 *  konusmadiysa webhook'u kullaniriz - ikisini TOPLAMAK cift sayim olurdu.
 *  Ayni kural revenue-history.ts'te de gecerli; iki yer ayrisirsa ekranlar
 *  yine celisir. */
function reconcilePayments(confirmed: number, provisional: number): number {
  return confirmed > 0 ? confirmed : provisional;
}

// Her project için ad_revenue/mrr/dau + o günün ödemelerinin en güncel değeri (date DESC → ilk gördüğü = latest).
// Para metrikleri (ad_revenue TRY, mrr USD) USD'ye normalize edilir; dau sayıdır, ham.
export async function fetchPropertyMetrics(
  client: SupabaseClient,
): Promise<PropertyMetricsMap> {
  // 90 gunluk pencere: sorgu SADECE her projenin en guncel degerini kullaniyor
  // ama tarih filtresi olmadan tum gecmisi cekiyordu (bugun 381 satir, her gun
  // buyuyor). PostgREST 1.000'de sessizce keser; o gun geldiginde ekran hata
  // vermez, sadece eksik proje gosterir. Pencere gorunur davranisi degistirmez:
  // 90 gundur veri gondermeyen bir projenin "guncel" degeri zaten yoktur.
  const sinceIso = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

  const [{ data, error }, eventsRes, rates] = await Promise.all([
    client
      .from("metrics")
      .select("project_id, metric, date, value, currency")
      .in("metric", [
        "ad_revenue",
        "mrr",
        "dau",
        // Magaza raporundan gelen ODEME kalemleri. app_revenue BILEREK yok:
        // olculdu ki app_revenue tam olarak subscription_revenue + iap_revenue
        // (342 gunun hepsinde fark 0), yani eklemek cift sayim olurdu.
        "subscription_revenue",
        "iap_revenue",
      ])
      .gte("date", sinceIso)
      .order("date", { ascending: false }),
    client
      .from("revenue_events")
      .select("project_id, amount, currency, occurred_at")
      .gte("occurred_at", sinceIso),
    fetchFxRates(),
  ]);
  if (error) throw error;
  if (eventsRes.error) throw eventsRes.error;

  // (proje|gun) → magaza raporundaki odeme toplami (USD).
  const confirmedByDay = new Map<string, number>();
  // (proje|gun) → webhook odeme toplami (USD).
  const provisionalByDay = new Map<string, number>();

  for (const r of (data ?? []) as Row[]) {
    if (r.metric !== "subscription_revenue" && r.metric !== "iap_revenue") continue;
    const k = `${r.project_id}|${r.date}`;
    const v = metricValueUsd(r.metric, Number(r.value), r.currency, rates);
    confirmedByDay.set(k, (confirmedByDay.get(k) ?? 0) + v);
  }
  for (const e of (eventsRes.data ?? []) as EventRow[]) {
    const day = String(e.occurred_at).slice(0, 10);
    const k = `${e.project_id}|${day}`;
    const v = toUsd(Number(e.amount ?? 0), e.currency, rates);
    provisionalByDay.set(k, (provisionalByDay.get(k) ?? 0) + v);
  }

  const out: PropertyMetricsMap = {};
  const seen = new Set<string>();
  for (const r of (data ?? []) as Row[]) {
    const key = `${r.project_id}|${r.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = (out[r.project_id] ??= {
      adRevenue: 0,
      revenue: 0,
      mrr: 0,
      dau: 0,
      adRevenueDate: null,
    });
    const v = metricValueUsd(r.metric, Number(r.value), r.currency, rates);
    if (r.metric === "ad_revenue") {
      entry.adRevenue = v;
      // Satirlar date DESC geldigi ve her (proje, metrik) ilk gorulende
      // kilitlendigi icin bu, o projenin EN GUNCEL ad_revenue gunudur.
      entry.adRevenueDate = r.date;
    }
    else if (r.metric === "mrr") entry.mrr = v;
    else if (r.metric === "dau") entry.dau = v;
  }

  // Odemeler, reklamin ait oldugu GUN icin okunur. Kendi "en son" gunlerinden
  // okunsaydi magaza gecikmesi yuzunden 2 gun onceki tutar bugune yazilirdi.
  for (const [projectId, entry] of Object.entries(out)) {
    const day = entry.adRevenueDate;
    const k = day != null ? `${projectId}|${day}` : null;
    const payments =
      k != null
        ? reconcilePayments(confirmedByDay.get(k) ?? 0, provisionalByDay.get(k) ?? 0)
        : 0;
    entry.revenue = entry.adRevenue + payments;
  }

  return out;
}

export async function fetchAlertRulesCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("alert_rules")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
