import type { Currency } from "@helm/types";

// Revenue değerleri KAYNAK para biriminde saklanır (AdMob ad_revenue → TRY,
// RevenueCat mrr → USD, App Store proceeds → vendor ccy). Her metric satırı
// `metrics.currency` ile etiketlidir; veri katmanı USD'ye normalize eder
// (metricValueUsd), gösterim USD → seçili currency'ye çevirir.
// FxRates = USD base; rates[X] = 1 USD kaç X eder.
export type FxRates = Record<Currency, number>;

// Fallback (online'a ulaşılamazsa — 2026 yaklaşık, canlı API üzerine yazar).
export const FX_FALLBACK: FxRates = { USD: 1, TRY: 40, EUR: 0.92, GBP: 0.79 };

// Kaynak para biriminde saklanan para metrikleri — USD'ye normalize edilir.
// Diğerleri (dau, active_subs, downloads…) sayıdır, dokunulmaz.
export const MONEY_METRICS: ReadonlySet<string> = new Set([
  "mrr",
  "ad_revenue",
  "app_revenue",
  "iap_revenue",
  "subscription_revenue",
  "revenue_28d",
]);

// X cinsinden değeri USD'ye çevir. rates USD base (rates[X] = 1 USD → X) →
// X → USD = value / rates[X]. Bilinmeyen/boş currency = USD kabul (no-op).
// Time: O(1), Space: O(1).
export function toUsd(
  value: number,
  currency: string | null | undefined,
  rates: FxRates,
): number {
  if (!currency || currency === "USD") return value;
  const rate = rates[currency as Currency];
  return rate && rate > 0 ? value / rate : value;
}

// Bir metric satırını money ise USD'ye çevir; değilse ham bırak.
export function metricValueUsd(
  metric: string,
  value: number,
  currency: string | null | undefined,
  rates: FxRates,
): number {
  return MONEY_METRICS.has(metric) ? toUsd(value, currency, rates) : value;
}

// Fetcher'lar (cockpit-kpis, revenue-mix…) normalize için fetchFxRates'i çağırır.
// react-query cache'i bypass ettikleri için modül seviyesi TTL memo ile tek
// network çağrısını paylaşırlar (TTL içinde).
const FX_TTL_MS = 60 * 60 * 1000; // 1 saat
let fxMemo: { at: number; rates: FxRates } | null = null;

export async function fetchFxRates(): Promise<FxRates> {
  if (fxMemo && Date.now() - fxMemo.at < FX_TTL_MS) return fxMemo.rates;
  // open.er-api.com (ExchangeRate-API açık uç) — ücretsiz, anahtarsız, CORS açık,
  // HER GÜN güncel (TRY hızlı oynadığı için ECB'nin hafta sonu boşluğu yok).
  // Tek çağrı, USD base; rates[X] = 1 USD → X.
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`fx http ${res.status}`);
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== "success" || !json.rates) {
      throw new Error("fx unexpected payload");
    }
    const rates = json.rates;
    const out: FxRates = {
      USD: 1,
      TRY: rates.TRY ?? FX_FALLBACK.TRY,
      EUR: rates.EUR ?? FX_FALLBACK.EUR,
      GBP: rates.GBP ?? FX_FALLBACK.GBP,
    };
    fxMemo = { at: Date.now(), rates: out };
    return out;
  } catch (err) {
    console.warn("[fx] fetch failed, using fallback", err);
    return FX_FALLBACK;
  }
}
