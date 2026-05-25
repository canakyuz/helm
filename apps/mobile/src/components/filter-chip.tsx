import { Pressable, Text, View } from "react-native";

import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";

type Props = {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
};

export function FilterChip({ label, count, active, onPress }: Props) {
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={{
        backgroundColor: active ? colors.fgPrimary : colors.bgElevated,
        borderWidth: 1,
        borderColor: active ? colors.fgPrimary : colors.border,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 10,
          letterSpacing: 1.5,
          color: active ? colors.bgBase : colors.fgMuted,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {count !== undefined ? (
        <View
          style={{
            backgroundColor: active ? `${colors.bgBase}30` : colors.bgHigher,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 6,
            minWidth: 16,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 9,
              color: active ? colors.bgBase : colors.fgSecondary,
              letterSpacing: 0.5,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
