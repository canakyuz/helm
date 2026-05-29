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

/** Push KPIs to the home screen widget whenever cockpit data is available. */
export function useWidgetSync(data: CockpitKpis | undefined): void {
  const { currency } = usePreferences();
  const { data: rates } = useFxRates();
  const { data: sparkline } = useTotalRevenueSpark();
  const fxRate = rates?.[currency] ?? 1;

  const dataRef = useRef(data);
  const currencyRef = useRef(currency);
  const fxRef = useRef(fxRate);
  const sparkRef = useRef(sparkline);
  dataRef.current = data;
  currencyRef.current = currency;
  fxRef.current = fxRate;
  sparkRef.current = sparkline;

  const push = () => {
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
    push();
    if (!data) return undefined;
    const retry2s = setTimeout(push, 2000);
    const retry5s = setTimeout(push, 5000);
    return () => {
      clearTimeout(retry2s);
      clearTimeout(retry5s);
    };
  }, [data, currency, fxRate, sparkline]);

  useEffect(() => {
    return subscribeWidgetResync(push);
  }, []);
}
