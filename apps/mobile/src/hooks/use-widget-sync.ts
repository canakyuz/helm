import { useEffect, useRef } from "react";

import {
  type CockpitKpis,
  useTotalRevenueSpark,
} from "~/hooks/use-cockpit-kpis";
import { useFxRates } from "~/hooks/use-fx-rates";
import { usePreferences } from "~/lib/preferences";
import {
  buildWidgetPayload,
  subscribeWidgetResync,
  syncHomeWidget,
} from "~/lib/widget-sync";

type WidgetSyncOptions = { enabled?: boolean };

/** Push KPIs to the home screen widget whenever cockpit data is available. */
export function useWidgetSync(
  data: CockpitKpis | undefined,
  options: WidgetSyncOptions = {},
): void {
  const enabled = options.enabled ?? true;
  const { currency, revenueMultiplier } = usePreferences();
  const { data: rates } = useFxRates({ enabled });
  const { data: sparkline } = useTotalRevenueSpark({ enabled });
  const displayRate = (rates?.[currency] ?? 1) * revenueMultiplier;

  const dataRef = useRef(data);
  const currencyRef = useRef(currency);
  const fxRef = useRef(displayRate);
  const sparkRef = useRef(sparkline);
  dataRef.current = data;
  currencyRef.current = currency;
  fxRef.current = displayRate;
  sparkRef.current = sparkline;

  const push = () => {
    if (!enabled) return;
    const current = dataRef.current;
    if (!current) return;
    syncHomeWidget(
      buildWidgetPayload(
        current,
        currencyRef.current,
        fxRef.current,
        sparkRef.current,
      ),
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
  }, [data, currency, displayRate, enabled, sparkline]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeWidgetResync(push);
  }, [enabled]);
}
