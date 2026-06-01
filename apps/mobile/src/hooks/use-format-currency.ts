import { useCallback } from "react";

import { usePreferences } from "~/lib/preferences";
import { formatCurrency } from "~/lib/format";
import { useFxRates } from "~/hooks/use-fx-rates";

// Hub'daki değer TRY baz. Seçili currency için anlık FX rate ile dönüştür.
export function useFormatCurrency() {
  const { currency } = usePreferences();
  const { data: rates } = useFxRates();

  return useCallback(
    (valueTry: number) => {
      const rate = rates?.[currency] ?? 1;
      return formatCurrency(valueTry * rate, currency);
    },
    [currency, rates],
  );
}
