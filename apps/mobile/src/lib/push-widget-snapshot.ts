import type { QueryClient } from "@tanstack/react-query";
import { revenueHistoryKeys } from "@helm/queries";
import type { RevenueHistory } from "@helm/api";

import type { CockpitKpis } from "~/hooks/use-cockpit-kpis";
import { preferences } from "~/lib/preferences";
import {
  buildWidgetPayload,
  monthFromBucket,
  syncHomeWidget,
} from "~/lib/widget-sync";

function cockpitKpisKey(propertyId: string) {
  return ["cockpit-kpis", propertyId] as const;
}

/** Push latest cached cockpit KPIs to home + lock screen widgets. */
export function pushWidgetSnapshot(queryClient: QueryClient): boolean {
  const { currency, selectedPropertyId } = preferences.get();
  const kpis = queryClient.getQueryData<CockpitKpis>(
    cockpitKpisKey(selectedPropertyId),
  );
  if (!kpis) return false;

  const rates = queryClient.getQueryData<Record<string, number>>([
    "fx-rates",
    "usd-base",
  ]);
  const fxRate = rates?.[currency] ?? 1;

  // Buyuk sayi = aybasindan bugune gelir; Gelir ekraniyla ayni kova.
  const history = queryClient.getQueryData<RevenueHistory>(
    revenueHistoryKeys.byProperty(selectedPropertyId),
  );
  const month = monthFromBucket(history?.months?.[0]);

  return syncHomeWidget(buildWidgetPayload(kpis, month, currency, fxRate));
}
