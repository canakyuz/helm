import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LiquidBackground, LiquidHeader } from "~/components/liquid";
import { colors } from "~/theme/tokens";

export default function Revenue() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "GeistMono-500", fontSize: 12, letterSpacing: 2, color: colors.fgMuted }}>
            REVENUE · COMING NEXT
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
