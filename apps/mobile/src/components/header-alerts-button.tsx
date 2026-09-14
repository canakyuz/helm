import { View, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { useAlerts } from "~/hooks/use-alerts";
import { Icon } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";

export function HeaderAlertsButton() {
  const router = useRouter();
  const { data } = useAlerts();
  const open = (data ?? []).filter((a) => !a.delivered);
  const count = open.length;
  const critical = open.filter((a) => a.severity === "critical").length;

  const tone =
    critical > 0
      ? colors.accentDanger
      : count > 0
      ? colors.accentWarn
      : colors.fgMuted;

  return (
    <Pressable
      hitSlop={10}
      onPress={() => {
        haptic.tap();
        router.push("/(cockpit)/health");
      }}
      style={({ pressed }) => ({
        paddingRight: 16,
        paddingLeft: 8,
        paddingVertical: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ position: "relative" }}>
        <Icon name="bell" size={20} color={tone} />
        {count > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: tone,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 4,
              borderWidth: 1.5,
              borderColor: colors.bgBase,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 9,
                color: colors.bgBase,
                lineHeight: 11,
                letterSpacing: -0.3,
              }}
            >
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
