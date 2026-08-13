import { useCallback } from "react";

import { usePreferences } from "~/lib/preferences";
import { formatCurrency, formatCurrencyCompact } from "~/lib/format";
import { useFxRates } from "~/hooks/use-fx-rates";

// Hub'daki değer USD baz. Seçili currency için anlık FX rate ile dönüştür.
// rate = USD → currency; kuruş/cent formatCurrency'de korunur (.toFixed(2)).
export function useFormatCurrency() {
  const { currency, revenueMultiplier } = usePreferences();
  const { data: rates } = useFxRates();

  return useCallback(
    (valueUsd: number) => {
      const rate = rates?.[currency] ?? 1;
      return formatCurrency(valueUsd * rate * revenueMultiplier, currency);
    },
    [currency, rates, revenueMultiplier],
  );
}

/**
 * Stat kutusu icin kurussuz para. Ayni cevrim, farkli gosterim — tam tutarin
 * gerektigi yerlerde useFormatCurrency kullanilmaya devam eder.
 */
export function useFormatCurrencyCompact() {
  const { currency, revenueMultiplier } = usePreferences();
  const { data: rates } = useFxRates();

  return useCallback(
    (valueUsd: number) => {
      const rate = rates?.[currency] ?? 1;
      return formatCurrencyCompact(valueUsd * rate * revenueMultiplier, currency);
    },
    [currency, rates, revenueMultiplier],
  );
}
