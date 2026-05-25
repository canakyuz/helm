import { View, Text, ActivityIndicator } from "react-native";

import { colors } from "~/theme/tokens";

export type MiniKpi = {
  label: string;
  value: string;
  accent?: string;
};

type Props = {
  title?: string;
  suffix?: string;
  kpis: MiniKpi[];
  loading?: boolean;
};

export function DetailHeader({ title, suffix, kpis, loading }: Props) {
  return (
    <View style={{ gap: 12 }}>
      {/* Optional section header with glow dot */}
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
              shadowOpacity: 0.8,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 10,
              letterSpacing: 2,
              color: colors.fgMuted,
            }}
          >
            {title.toUpperCase()}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          {suffix ? (
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 9,
                letterSpacing: 1.2,
                color: colors.fgSubtle,
              }}
            >
              {suffix.toUpperCase()}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* KPI strip */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.bgElevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        {kpis.map((k, idx) => (
          <View
            key={k.label}
            style={{
              flex: 1,
              padding: 12,
              gap: 6,
              borderLeftWidth: idx === 0 ? 0 : 1,
              borderLeftColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 9,
                letterSpacing: 1.4,
                color: colors.fgSubtle,
              }}
              numberOfLines={1}
            >
              {k.label.toUpperCase()}
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.fgSubtle} />
            ) : (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 18,
                  color: k.accent ?? colors.fgPrimary,
                  letterSpacing: -0.4,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {k.value}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
