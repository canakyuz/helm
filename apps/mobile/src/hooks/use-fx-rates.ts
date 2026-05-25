import { useQuery } from "@tanstack/react-query";

import type { Currency } from "~/lib/preferences";

// Hub'daki tüm metric değerleri TRY (Türk Lirası) baz.
// FX dönüşümü: TRY bazında diğer currency'lere oranlar.
export type FxRates = Record<Currency, number>;

// Fallback oranlar (online'a ulaşamazsak — 2026 makul yaklaşık değerler).
const FALLBACK: FxRates = { TRY: 1, USD: 0.029, EUR: 0.027, GBP: 0.023 };

async function fetchRates(): Promise<FxRates> {
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
      USD: rates.USD ?? FALLBACK.USD,
      EUR: rates.EUR ?? FALLBACK.EUR,
      GBP: rates.GBP ?? FALLBACK.GBP,
    };
  } catch (err) {
    console.warn("[fx] fetch failed, using fallback", err);
    return FALLBACK;
  }
}

export function useFxRates() {
  return useQuery({
    queryKey: ["fx-rates", "try-base"],
    queryFn: fetchRates,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: FALLBACK,
  });
}
