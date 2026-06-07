import type { Currency } from "@helm/types";

// Hub'daki tüm revenue/metric değerleri USD baz (RevenueCat MRR, AdMob earnings,
// App Store proceeds — connector'lar ham USD yazar, ingest dönüştürmez). FX =
// USD → diğer currency oranları. display = usdValue * rate[displayCurrency].
export type FxRates = Record<Currency, number>;

// Fallback (online'a ulaşılamazsa — 2026 yaklaşık, canlı API üzerine yazar).
export const FX_FALLBACK: FxRates = { USD: 1, TRY: 40, EUR: 0.92, GBP: 0.79 };

export async function fetchFxRates(): Promise<FxRates> {
  // Frankfurter.app — ECB verisi, ücretsiz, anahtarsız. USD base.
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP",
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`fx http ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rates = json.rates ?? {};
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
