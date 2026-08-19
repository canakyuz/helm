import { AppState, Platform, type AppStateStatus } from "react-native";

import {
  getWidgetBridgeDiagnostics,
  hasWidgetNativeBridge,
  writeWidgetPayloadNative,
  type WidgetBridgeDiagnostics,
  type WidgetWriteResult,
} from "~/lib/widget-native-bridge";
import type { HelmWidgetPayload } from "~/lib/widget-payload";

// Saf hesap `widget-payload.ts`'te; burasi yalnizca native koprusu ve AppState.
export {
  buildWidgetPayload,
  monthFromBucket,
  normalizeBars,
  type HelmWidgetPayload,
  type WidgetMonthInput,
} from "~/lib/widget-payload";

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
