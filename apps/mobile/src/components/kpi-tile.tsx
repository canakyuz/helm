import { View, Text } from "react-native";

import { Icon, type IconName } from "~/components/ui/icon";
import { formatPercent } from "~/lib/format";
import { colors } from "~/theme/tokens";

type Tone = "default" | "danger" | "warn" | "info";

type Props = {
  icon: IconName;
  label: string;
  value: string;
  delta?: number | null;
  tone?: Tone;
};

const accentByTone: Record<Tone, string> = {
  default: colors.accent,
  danger: colors.accentDanger,
  warn: colors.accentWarn,
  info: colors.accentInfo,
};

const borderByTone: Record<Tone, string> = {
  default: colors.border,
  danger: `${colors.accentDanger}55`,
  warn: `${colors.accentWarn}55`,
  info: `${colors.accentInfo}55`,
};

export function KpiTile({ icon, label, value, delta, tone = "default" }: Props) {
  const accent = accentByTone[tone];
  const deltaPositive = (delta ?? 0) >= 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: borderByTone[tone],
        padding: 14,
        gap: 12,
        minHeight: 104,
      }}
    >
      {/* Header — icon + delta */}
      <View className="flex-row items-center justify-between">
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            backgroundColor: `${accent}15`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={13} color={accent} />
        </View>
        {delta !== undefined && delta !== null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              backgroundColor: deltaPositive
                ? `${colors.accent}15`
                : `${colors.accentDanger}15`,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Icon
              name={deltaPositive ? "trendUp" : "trendDown"}
              size={10}
              color={deltaPositive ? colors.accent : colors.accentDanger}
            />
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                color: deltaPositive ? colors.accent : colors.accentDanger,
              }}
            >
              {formatPercent(delta)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Label */}
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 9,
          letterSpacing: 1.5,
          color: colors.fgMuted,
        }}
      >
        {label.toUpperCase()}
      </Text>

      {/* Value — mono tabular */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          fontFamily: "GeistMono-600",
          fontSize: 22,
          color: colors.fgPrimary,
          letterSpacing: -0.5,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
