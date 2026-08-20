import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFxRates, metricValueUsd } from "./fx-rates";

export type PropertyMetric = {
  adRevenue: number;
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

// Her project için ad_revenue/mrr/dau'nun en güncel değeri (date DESC → ilk gördüğü = latest).
// Para metrikleri (ad_revenue TRY, mrr USD) USD'ye normalize edilir; dau sayıdır, ham.
export async function fetchPropertyMetrics(
  client: SupabaseClient,
): Promise<PropertyMetricsMap> {
  const [{ data, error }, rates] = await Promise.all([
    client
      .from("metrics")
      .select("project_id, metric, date, value, currency")
      .in("metric", ["ad_revenue", "mrr", "dau"])
      .order("date", { ascending: false }),
    fetchFxRates(),
  ]);
  if (error) throw error;

  const out: PropertyMetricsMap = {};
  const seen = new Set<string>();
  for (const r of (data ?? []) as Row[]) {
    const key = `${r.project_id}|${r.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = (out[r.project_id] ??= {
      adRevenue: 0,
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
  return out;
}

export async function fetchAlertRulesCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("alert_rules")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
