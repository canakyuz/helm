import type { SupabaseClient } from "@supabase/supabase-js";
import type { SelectedPropertyId } from "@helm/types";

import { fetchFxRates, toUsd, type FxRates } from "./fx-rates";

/**
 * Reklam ekonomisi - format basina gelir, eCPM ve doluluk.
 *
 * NEDEN VAR: gelirin buyuk kismi reklamdan geliyordu ama ekranda tek satir
 * ("Reklam ₺340.71") olarak duruyordu. Olculdu (6-13 Agustos): `rewarded`
 * gosterimlerin %15'ini alip gelirin %77'sini uretiyor, `banner` ise
 * gosterimlerin %77'sini alip gelirin %11'ini. Tek sayiyla bu gorunmuyor.
 *
 * Kaynak `metrics_format` (migration 0040) - AdMob networkReport'un FORMAT
 * boyutu. Tabloda YALNIZCA SAYIM var; oranlar burada turetiliyor.
 */

/** Formatlarin sabit sirasi - ekran her tazelemede ayni sirayi gormeli.
 *  Gelire gore siralamak, iki gun arasinda satirlarin yer degistirmesine yol
 *  acardi; goz once ogrendigi yere bakiyor. */
const FORMAT_ORDER = ["rewarded", "interstitial", "app_open", "banner"] as const;

export const AD_FORMAT_TR: Record<string, string> = {
  rewarded: "Ödüllü",
  interstitial: "Geçiş",
  app_open: "Açılış",
  banner: "Banner",
  native: "Native",
  rewarded_interstitial: "Ödüllü geçiş",
};

/** Doluluk bu esigin altindaysa "kayip var" sayilir. AdMob'un kendi
 *  yonlendirmesi %80 civari; 0.7'yi esik aldik ki gurultu yapmasin. */
const LOW_FILL = 0.7;

export type AdFormatRow = {
  format: string;
  label: string;
  /** USD'ye normalize edilmis. */
  revenue: number;
  impressions: number;
  requests: number;
  matched: number;
  clicks: number;
  /** Toplam reklam gelirindeki pay, 0–1. Toplam sifirsa null. */
  revenueShare: number | null;
  /** Bin gosterim basina gelir (USD). Gosterim sifirsa null. */
  ecpm: number | null;
  /** matched / requests, 0–1. Istek sifirsa null. */
  fillRate: number | null;
  /** impressions / matched, 0–1. Eslesen sifirsa null.
   *  Dolan ama GOSTERILMEYEN reklam: geçis/acilis formatlarinda dogal olarak
   *  dusuktur (onceden yuklenir, dogal molada gosterilir) - tek basina ariza
   *  degildir, o yuzden uyari uretmez. */
  showRate: number | null;
  /** Doluluk esigin altinda - masada para kalmis olabilir. */
  lowFill: boolean;
};

export type AdEconomics = {
  /** Sorgulanan aralik - ekranin secili donemi. */
  from: string;
  to: string;
  rows: AdFormatRow[];
  totalRevenue: number;
  totalImpressions: number;
  /** Tum formatlar birlikte. Satir eCPM'lerinin ORTALAMASI DEGIL - oranlarin
   *  ortalamasi oran degildir; toplanmis gelir ve gosterimden hesaplanir. */
  blendedEcpm: number | null;
  overallFillRate: number | null;
};

type Row = {
  metric: string;
  format: string;
  value: number | string;
  currency: string | null;
};

const METRICS = [
  "ad_revenue",
  "ad_impressions",
  "ad_requests",
  "ad_matched_requests",
  "ad_clicks",
] as const;

const ratio = (num: number, den: number): number | null =>
  den > 0 ? num / den : null;

/** Ham satirlari format bazinda toplar. Time: O(n), Space: O(f) - f = format
 *  sayisi (4-6), yani pratikte sabit. */
function aggregate(rows: readonly Row[], fx: FxRates) {
  const acc = new Map<
    string,
    { revenue: number; impressions: number; requests: number; matched: number; clicks: number }
  >();

  for (const r of rows) {
    let a = acc.get(r.format);
    if (a == null) {
      a = { revenue: 0, impressions: 0, requests: 0, matched: 0, clicks: 0 };
      acc.set(r.format, a);
    }
    const v = Number(r.value) || 0;
    switch (r.metric) {
      case "ad_revenue":
        // Yalnizca gelir cevrilir; digerleri sayim, para degil.
        a.revenue += toUsd(v, r.currency, fx);
        break;
      case "ad_impressions":
        a.impressions += v;
        break;
      case "ad_requests":
        a.requests += v;
        break;
      case "ad_matched_requests":
        a.matched += v;
        break;
      case "ad_clicks":
        a.clicks += v;
        break;
    }
  }
  return acc;
}

/**
 * ARALIK ALIR, gun sayisi DEGIL: ekrandaki donem seridi (Agustos / 10-16 Agu)
 * altindaki her seyi surmeli. "Son 7 gun" sabiti secili donemle uyusmaz ve
 * kullanici Temmuz'a bakarken Agustos reklamlarini gosterirdi.
 */
export async function fetchAdEconomics(
  client: SupabaseClient,
  propertyId: SelectedPropertyId,
  from: string,
  to: string,
): Promise<AdEconomics> {
  let q = client
    .from("metrics_format")
    .select("metric, format, value, currency")
    .in("metric", METRICS)
    .gte("date", from)
    .lte("date", to);
  if (propertyId !== "all") q = q.eq("project_id", propertyId);

  const [{ data, error }, rates] = await Promise.all([q, fetchFxRates()]);
  if (error) throw error;

  const acc = aggregate((data ?? []) as Row[], rates);

  let totalRevenue = 0;
  let totalImpressions = 0;
  let totalRequests = 0;
  let totalMatched = 0;
  for (const a of acc.values()) {
    totalRevenue += a.revenue;
    totalImpressions += a.impressions;
    totalRequests += a.requests;
    totalMatched += a.matched;
  }

  // Bilinen formatlar sabit sirada; AdMob yeni bir format eklerse (native,
  // rewarded_interstitial…) listeden DUSMEZ - sona, gelire gore eklenir.
  const known = new Set<string>(FORMAT_ORDER);
  const ordered = [
    ...FORMAT_ORDER.filter((f) => acc.has(f)),
    ...[...acc.keys()]
      .filter((f) => !known.has(f))
      .sort((a, b) => (acc.get(b)?.revenue ?? 0) - (acc.get(a)?.revenue ?? 0)),
  ];

  const rows: AdFormatRow[] = ordered.map((format) => {
    const a = acc.get(format)!;
    const fillRate = ratio(a.matched, a.requests);
    return {
      format,
      label: AD_FORMAT_TR[format] ?? format,
      revenue: a.revenue,
      impressions: a.impressions,
      requests: a.requests,
      matched: a.matched,
      clicks: a.clicks,
      revenueShare: ratio(a.revenue, totalRevenue),
      ecpm: a.impressions > 0 ? (a.revenue / a.impressions) * 1000 : null,
      fillRate,
      showRate: ratio(a.impressions, a.matched),
      lowFill: fillRate != null && fillRate < LOW_FILL,
    };
  });

  return {
    from,
    to,
    rows,
    totalRevenue,
    totalImpressions,
    blendedEcpm:
      totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : null,
    overallFillRate: ratio(totalMatched, totalRequests),
  };
}
