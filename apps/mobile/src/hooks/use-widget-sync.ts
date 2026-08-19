import { useEffect, useRef } from "react";

import { type CockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useRevenueHistory } from "~/hooks/use-revenue-history";
import { useFxRates } from "~/hooks/use-fx-rates";
import { usePreferences } from "~/lib/preferences";
import {
  buildWidgetPayload,
  monthFromBucket,
  subscribeWidgetResync,
  syncHomeWidget,
} from "~/lib/widget-sync";

type WidgetSyncOptions = { enabled?: boolean };

/**
 * Kokpit verisi geldikce ana ekran widget'ini besler.
 *
 * NEDEN GELIR GECMISI: widget eskiden `useCockpitKpis`'ten `adRevenue + mrr`
 * aliyordu — bir gunun reklami artI aylik oran. Artik Gelir ekraninin
 * kullandigi ayni kovadan (aybasindan bugune) besleniyor; iki ekran ayni
 * sayiyi soyluyor.
 */
export function useWidgetSync(
  data: CockpitKpis | undefined,
  options: WidgetSyncOptions = {},
): void {
  const enabled = options.enabled ?? true;
  const { currency, revenueMultiplier } = usePreferences();
  const { data: rates } = useFxRates({ enabled });
  const { data: history } = useRevenueHistory({ enabled });
  const displayRate = (rates?.[currency] ?? 1) * revenueMultiplier;
  // months[0] = guncel ay (fetchRevenueHistory anahtara gore azalan siralar).
  const month = monthFromBucket(history?.months?.[0]);

  const dataRef = useRef(data);
  const currencyRef = useRef(currency);
  const fxRef = useRef(displayRate);
  const monthRef = useRef(month);
  dataRef.current = data;
  currencyRef.current = currency;
  fxRef.current = displayRate;
  monthRef.current = month;

  const push = () => {
    if (!enabled) return;
    const current = dataRef.current;
    if (!current) return;
    syncHomeWidget(
      buildWidgetPayload(current, monthRef.current, currencyRef.current, fxRef.current),
    );
  };

  useEffect(() => {
    if (!enabled) return undefined;
    push();
    if (!data) return undefined;
    const retry2s = setTimeout(push, 2000);
    const retry5s = setTimeout(push, 5000);
    return () => {
      clearTimeout(retry2s);
      clearTimeout(retry5s);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currency, displayRate, enabled, month?.total]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeWidgetResync(push);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
