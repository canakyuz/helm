import type { QueryClient } from "@tanstack/react-query";

import type { CockpitKpis } from "~/hooks/use-cockpit-kpis";
import { preferences } from "~/lib/preferences";
import { buildWidgetPayload, syncHomeWidget } from "~/lib/widget-sync";

function cockpitKpisKey(propertyId: string) {
  return ["cockpit-kpis", propertyId] as const;
}

function totalRevenueSparkKey(propertyId: string) {
  return ["cockpit-spark", "total-revenue", propertyId] as const;
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
    "try-base",
  ]);
  const fxRate = rates?.[currency] ?? 1;
  const sparkline = queryClient.getQueryData<number[]>(
    totalRevenueSparkKey(selectedPropertyId),
  );

  return syncHomeWidget(
    buildWidgetPayload(kpis, currency, fxRate, sparkline),
  );
}
