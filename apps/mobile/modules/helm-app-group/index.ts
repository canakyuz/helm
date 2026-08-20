import { requireOptionalNativeModule } from "expo-modules-core";

type WriteResult = {
  ok: boolean;
  hasContainer: boolean;
  hasDefaults: boolean;
  reason?: string;
  defaultsHasKey?: boolean;
};

type HelmAppGroupNative = {
  hasAppGroup: (group: string) => boolean;
  writeWidgetPayload: (json: string, group: string, widgetKind: string) => WriteResult;
};

const native = requireOptionalNativeModule<HelmAppGroupNative>("HelmAppGroup");

export function hasHelmAppGroup(group: string): boolean {
  return native?.hasAppGroup(group) ?? false;
}

export function writeHelmWidgetPayload(
  json: string,
  group: string,
  widgetKind: string,
): WriteResult {
  if (!native) {
    return {
      ok: false,
      hasContainer: false,
      hasDefaults: false,
      reason: "HelmAppGroup native module missing - run bun run ios after prebuild",
    };
  }
  return native.writeWidgetPayload(json, group, widgetKind);
}
