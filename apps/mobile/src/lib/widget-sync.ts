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
    // null = olcum yok. Metin alanlari "—" gosterir; SAYISAL alan (liveUsers)
    // widget'in duzeni icin 0'a duser — orada gosterilecek bir metin yok.
    dau: number | null;
    adRevenue: number | null;
    mrr: number | null;
    mrrDelta: number | null;
    openAlerts: number;
  },
  currency: Currency,
  fxRate: number,
  sparkline?: number[],
): HelmWidgetPayload {
  // KPI değerleri USD baz; fxRate = USD → seçili currency.
  const toDisplay = (usdValue: number) => usdValue * fxRate;
  /** Olcum yoksa "—". Widget'ta sifir yazmak "kazanc yok" diye okunur. */
  const money = (v: number | null) =>
    v != null ? formatCurrency(toDisplay(v), currency) : "—";
  // Toplam ancak IKI bacak da olculduyse anlamli; biri eksikken toplamak
  // eksigi sifir saymak demektir.
  const total =
    data.adRevenue != null && data.mrr != null ? data.adRevenue + data.mrr : null;

  return {
    liveUsers: data.dau ?? 0,
    liveUsersText: data.dau != null ? formatInteger(data.dau) : "—",
    adRevenueText: money(data.adRevenue),
    incomingPaymentsText: money(data.mrr),
    totalRevenueText: money(total),
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
