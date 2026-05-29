import { requireOptionalNativeModule } from "expo-modules-core";

export type WidgetWriteResult = {
  ok: boolean;
  channel: "HelmAppGroup" | "ExtensionStorage" | "none";
  hasContainer: boolean;
  hasDefaults: boolean;
  reason?: string;
};

export type WidgetBridgeDiagnostics = {
  appGroup: string;
  helmAppGroupModule: boolean;
  extensionStorageModule: boolean;
  appGroupContainerReachable: boolean;
};

type HelmAppGroupNative = {
  hasAppGroup: (group: string) => boolean;
  writeWidgetPayload: (
    json: string,
    group: string,
    widgetKind: string,
  ) => Omit<WidgetWriteResult, "channel"> & { ok: boolean };
};

type ExtensionStorageNative = {
  setString: (key: string, value: string, group: string | null) => boolean;
  remove: (key: string, group: string | null) => void;
  reloadWidget: (timeline: string | null) => void;
};

const helmAppGroup = requireOptionalNativeModule<HelmAppGroupNative>("HelmAppGroup");
const extensionStorage =
  requireOptionalNativeModule<ExtensionStorageNative>("ExtensionStorage");

const PAYLOAD_KEY = "helm_widget_payload";
const PROBE_KEY = "__helm_app_group_probe__";

/** Native check: can we open the shared App Group container (not just “module exists”)? */
function isAppGroupContainerReachable(group: string): boolean {
  if (helmAppGroup?.hasAppGroup(group)) return true;

  if (!extensionStorage) return false;

  const ok = extensionStorage.setString(PROBE_KEY, "1", group);
  if (ok) extensionStorage.remove(PROBE_KEY, group);
  return ok;
}

export function getWidgetBridgeDiagnostics(
  group: string,
): WidgetBridgeDiagnostics {
  return {
    appGroup: group,
    helmAppGroupModule: helmAppGroup != null,
    extensionStorageModule: extensionStorage != null,
    appGroupContainerReachable: isAppGroupContainerReachable(group),
  };
}

export function hasWidgetNativeBridge(group: string): boolean {
  return isAppGroupContainerReachable(group);
}

export function writeWidgetPayloadNative(
  json: string,
  group: string,
  widgetKind: string,
): WidgetWriteResult {
  if (helmAppGroup) {
    const result = helmAppGroup.writeWidgetPayload(json, group, widgetKind);
    if (result.ok) {
      return { ...result, channel: "HelmAppGroup" };
    }
  }

  if (extensionStorage) {
    const ok = extensionStorage.setString(PAYLOAD_KEY, json, group);
    if (ok) {
      extensionStorage.reloadWidget(widgetKind);
      return {
        ok: true,
        channel: "ExtensionStorage",
        hasContainer: true,
        hasDefaults: true,
      };
    }
    return {
      ok: false,
      channel: "ExtensionStorage",
      hasContainer: false,
      hasDefaults: false,
      reason:
        "ExtensionStorage yazamadı — provisioning’de App Groups ve REGISTER_APP_GROUPS gerekir",
    };
  }

  return {
    ok: false,
    channel: "none",
    hasContainer: false,
    hasDefaults: false,
    reason:
      "Native modül yok (HelmAppGroup / ExtensionStorage) — EAS’tan yeni iOS build gerekir",
  };
}
