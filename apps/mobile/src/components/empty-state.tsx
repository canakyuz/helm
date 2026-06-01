import { View, Text } from "react-native";

import { Icon, type IconName } from "~/components/ui/icon";
import { colors } from "~/theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
};

export function EmptyState({ title, subtitle, icon = "circleDashed" }: Props) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgBase,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: colors.bgElevated,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={18} color={colors.fgMuted} />
      </View>
      <Text
        style={{
          fontFamily: "Geist-600",
          fontSize: 16,
          color: colors.fgPrimary,
          letterSpacing: -0.2,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: "Geist-400",
            fontSize: 13,
            color: colors.fgMuted,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
