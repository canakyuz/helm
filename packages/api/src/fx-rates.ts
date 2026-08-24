// Revenue değerleri KAYNAK para biriminde saklanır (AdMob ad_revenue → TRY,
// RevenueCat mrr → USD, App Store proceeds → vendor ccy). Her metric satırı
// `metrics.currency` ile etiketlidir; veri katmanı USD'ye normalize eder
// (metricValueUsd), gösterim USD → seçili currency'ye çevirir.
//
// FxRates = USD base; rates[X] = 1 USD kaç X eder. KAPALI `Currency` tipine
// (sadece USD/TRY/EUR/GBP - gösterim seçici) BAĞLI DEĞİL: kaynak satın alma
// para birimi App Store'un işlem yaptığı HERHANGİ bir kod olabilir (SEK, NOK,
// JPY...). Eskiden bu tip Record<Currency, number> idi ve toUsd() whitelist
// dışı bir para birimini SESSİZCE 1:1 USD sayıyordu - 9 SEK'lik satın alma
// panelde $9 (≈£6.60) gösteriyordu, doğrusu ≈$0.86 (≈£0.68) iken. 2026-08-24
// canlı veride yakalandı (empire_gems_80, revenue_events id 45-46).
export type FxRates = Record<string, number>;

// Fallback (online'a ulaşılamazsa - 2026 yaklaşık, canlı API üzerine yazar).
// Yalnızca gösterim para birimlerini kapsar; kaynak para birimi bu dört
// koddan biri değilse ve API'ye ulaşılamıyorsa toUsd() yine de uyarıp ham
// değeri döner (bkz. asağı) - offline'da whitelist dışı kur zaten yoktu.
export const FX_FALLBACK: FxRates = { USD: 1, TRY: 40, EUR: 0.92, GBP: 0.79 };

// Kaynak para biriminde saklanan para metrikleri - USD'ye normalize edilir.
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
//
// rates[currency] BULUNAMAZSA (fetchFxRates offline'a düşmüş VE bu para birimi
// FX_FALLBACK'te de yoksa) ham değer USD gibi döner - SESSİZCE değil, uyarı
// loglanır. Eskiden burada uyarı yoktu; SEK gibi bir kur haftalarca gözden
// kaçabilirdi (bkz. yukarı dosya yorumu).
// Time: O(1), Space: O(1).
export function toUsd(
  value: number,
  currency: string | null | undefined,
  rates: FxRates,
): number {
  if (!currency || currency === "USD") return value;
  const rate = rates[currency];
  if (rate && rate > 0) return value / rate;
  console.warn(`[fx] bilinmeyen para birimi "${currency}", USD gibi ele alınıyor (değer: ${value})`);
  return value;
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
  // open.er-api.com (ExchangeRate-API açık uç) - ücretsiz, anahtarsız, CORS açık,
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
    // TUM kurlar tutulur, dört gösterim para birimiyle SINIRLANMAZ - kaynak
    // satın alma her ülkenin kendi para biriminde gelir (SEK, NOK, JPY...),
    // toUsd() bunların hepsini normalize edebilmeli. Eskiden yalnızca
    // TRY/EUR/GBP seçilip gerisi atılıyordu; whitelist dışı bir kur toUsd()
    // içinde sessizce 1:1 USD sayılıyordu (bkz. yukarı dosya yorumu).
    const out: FxRates = { ...json.rates, USD: 1 };
    fxMemo = { at: Date.now(), rates: out };
    return out;
  } catch (err) {
    console.warn("[fx] fetch failed, using fallback", err);
    return FX_FALLBACK;
  }
}
