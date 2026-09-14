import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { press } from "@helm/design";

import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";
import { useSelectedProjectLabel } from "./property-picker";

/**
 * iOS 26 tab bar aksesuarı: seçili proje her sekmede, kaydırırken de görünür.
 *
 * NEDEN YEREL STATE YOK: expo-router bu bileşeni iki kez render ediyor (regular +
 * inline) ve state kopyalar arasında paylaşılmıyor. Seçim preferences'ta, liste
 * react-query'de, açılan liste de bir route; iki kopya hep aynı şeyi gösterir.
 */
export function ProjectAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const router = useRouter();
  const t = useT();
  const { theme } = useTheme();
  const label = useSelectedProjectLabel();
  // inline: bar küçülmüş, aksesuar sekme simgesiyle aynı satırda - etiket sığmaz.
  const inline = placement === "inline";

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push("/project-picker");
      }}
      accessibilityRole="button"
      accessibilityLabel={t("Proje seç")}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          className="flex-1 flex-row items-center justify-center gap-sm px-tilePad"
          style={pressed ? { opacity: press.opacity } : undefined}
        >
          {inline ? null : (
            <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
              {t("PROJE")}
            </Text>
          )}
          <Text
            className={inline ? "font-semibold text-meta text-fg" : "font-semibold text-body text-fg"}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {label}
          </Text>
          <Text style={{ fontSize: 10, color: theme.fg3 }}>▾</Text>
        </View>
      )}
    </Pressable>
  );
}
