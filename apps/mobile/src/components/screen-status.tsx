import { View, Text, ActivityIndicator } from "react-native";

import { colors } from "~/theme/tokens";

type Props = {
  label: string;
  tone?: "default" | "danger";
};

export function ScreenStatus({ label, tone = "default" }: Props) {
  const labelColor = tone === "danger" ? colors.accentDanger : colors.fgMuted;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgBase,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
      }}
    >
      {tone === "default" ? (
        <ActivityIndicator color={colors.fgMuted} />
      ) : (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.accentDanger,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 14,
              color: colors.accentDanger,
            }}
          >
            !
          </Text>
        </View>
      )}
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 10,
          letterSpacing: 2,
          color: labelColor,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
