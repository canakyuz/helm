import type { Currency } from "@helm/types";

// Hub'daki tüm metric değerleri TRY baz. FX = TRY → diğer currency oranları.
export type FxRates = Record<Currency, number>;

// Fallback (online'a ulaşılamazsa — 2026 makul yaklaşık).
export const FX_FALLBACK: FxRates = { TRY: 1, USD: 0.029, EUR: 0.027, GBP: 0.023 };

export async function fetchFxRates(): Promise<FxRates> {
  // Frankfurter.app — ECB verisi, ücretsiz, anahtarsız. TRY base.
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP",
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`fx http ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rates = json.rates ?? {};
    return {
      TRY: 1,
      USD: rates.USD ?? FX_FALLBACK.USD,
      EUR: rates.EUR ?? FX_FALLBACK.EUR,
      GBP: rates.GBP ?? FX_FALLBACK.GBP,
    };
  } catch (err) {
    console.warn("[fx] fetch failed, using fallback", err);
    return FX_FALLBACK;
  }
}
