import { Text, View } from "react-native";

import { colors } from "~/theme/tokens";
import { PropertyPicker } from "~/components/property-picker";
import { HeaderAlertsButton } from "~/components/header-alerts-button";

export function LiquidHeader({ showPicker = true }: { showPicker?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 13 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "GeistMono-600", fontSize: 15, color: colors.accentInk }}>
              h
            </Text>
          </View>
          <Text style={{ fontFamily: "Geist-600", fontSize: 17, color: colors.fgPrimary, letterSpacing: -0.3 }}>
            helm
          </Text>
          <View
            style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.accent, marginLeft: 1 }}
          />
        </View>

        {showPicker ? (
          <View style={{ flexShrink: 1 }}>
            <PropertyPicker />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <HeaderAlertsButton />
      </View>
      <View style={{ height: 1, marginTop: 13, backgroundColor: "rgba(255,255,255,0.10)" }} />
    </View>
  );
}
