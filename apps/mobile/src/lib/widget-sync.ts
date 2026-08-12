import { AppState, Platform, type AppStateStatus } from "react-native";

import {
  getWidgetBridgeDiagnostics,
  hasWidgetNativeBridge,
  writeWidgetPayloadNative,
  type WidgetBridgeDiagnostics,
  type WidgetWriteResult,
} from "~/lib/widget-native-bridge";
import {
  formatCurrency,
  formatInteger,
  formatDelta,
} from "~/lib/format";
import type { Currency } from "~/lib/preferences";

export type HelmWidgetPayload = {
  liveUsers: number;
  liveUsersText: string;
  adRevenueText: string;
  incomingPaymentsText: string;
  totalRevenueText: string;
  mrrDelta: number | null;
  mrrDeltaText: string | null;
  /** @deprecated Legacy ring; widget prefers mrrDelta when present. */
  conversionRate?: number | null;
  conversionRateText?: string | null;
  openAlerts: number;
  /** Normalized 0–1 heights for Mon–Sun bars (7 values). */
  sparkline?: number[];
  currency: Currency;
  updatedAtIso: string;
};

const APP_GROUP = "group.com.canakyuz.helmmobile.shared";
const WIDGET_KIND = "HelmSummaryWidget";

export function isWidgetStorageAvailable(): boolean {
  return Platform.OS === "ios" && hasWidgetNativeBridge(APP_GROUP);
}

export type { WidgetBridgeDiagnostics, WidgetWriteResult };

export function getWidgetStorageDiagnostics(): WidgetBridgeDiagnostics | null {
  if (Platform.OS !== "ios") return null;
  return getWidgetBridgeDiagnostics(APP_GROUP);
}

export function buildWidgetPayload(
  data: {
    dau: number;
    adRevenue: number;
    mrr: number;
    mrrDelta: number | null;
    openAlerts: number;
  },
  currency: Currency,
  fxRate: number,
  sparkline?: number[],
): HelmWidgetPayload {
  // KPI değerleri USD baz; fxRate = USD → seçili currency.
  const toDisplay = (usdValue: number) => usdValue * fxRate;

  return {
    liveUsers: data.dau,
    liveUsersText: formatInteger(data.dau),
    adRevenueText: formatCurrency(toDisplay(data.adRevenue), currency),
    incomingPaymentsText: formatCurrency(toDisplay(data.mrr), currency),
    totalRevenueText: formatCurrency(
      toDisplay(data.adRevenue + data.mrr),
      currency,
    ),
    mrrDelta: data.mrrDelta,
    mrrDeltaText:
      data.mrrDelta !== null ? formatDelta(data.mrrDelta) : null,
    openAlerts: data.openAlerts,
    ...(sparkline && sparkline.length >= 7
      ? { sparkline: sparkline.slice(0, 7) }
      : {}),
    currency,
    updatedAtIso: new Date().toISOString(),
  };
}

let lastWidgetWrite: WidgetWriteResult | null = null;

export function getLastWidgetWriteResult(): WidgetWriteResult | null {
  return lastWidgetWrite;
}

export function syncHomeWidget(payload: HelmWidgetPayload): boolean {
  if (Platform.OS !== "ios") return false;

  const json = JSON.stringify(payload);
  const result = writeWidgetPayloadNative(json, APP_GROUP, WIDGET_KIND);
  lastWidgetWrite = result;

  if (result.ok) {
    if (__DEV__) {
      console.log("[widget] synced via", result.channel, payload.totalRevenueText);
    }
  } else if (__DEV__) {
    console.warn("[widget] sync failed:", result.reason ?? "unknown", result);
  }

  return result.ok;
}

export function subscribeWidgetResync(resync: () => void): () => void {
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") resync();
  });
  return () => sub.remove();
}
