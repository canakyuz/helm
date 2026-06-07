import type { Currency } from "@helm/types";

// Hub'daki tüm revenue/metric değerleri USD baz (RevenueCat MRR, AdMob earnings,
// App Store proceeds — connector'lar ham USD yazar, ingest dönüştürmez). FX =
// USD → diğer currency oranları. display = usdValue * rate[displayCurrency].
export type FxRates = Record<Currency, number>;

// Fallback (online'a ulaşılamazsa — 2026 yaklaşık, canlı API üzerine yazar).
export const FX_FALLBACK: FxRates = { USD: 1, TRY: 40, EUR: 0.92, GBP: 0.79 };

export async function fetchFxRates(): Promise<FxRates> {
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
    return {
      USD: 1,
      TRY: rates.TRY ?? FX_FALLBACK.TRY,
      EUR: rates.EUR ?? FX_FALLBACK.EUR,
      GBP: rates.GBP ?? FX_FALLBACK.GBP,
    };
  } catch (err) {
    console.warn("[fx] fetch failed, using fallback", err);
    return FX_FALLBACK;
  }
}
