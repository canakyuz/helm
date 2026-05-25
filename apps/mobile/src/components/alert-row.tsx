import { View, Text } from "react-native";

import type { Alert, AlertSeverity } from "~/hooks/use-alerts";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: colors.accentDanger,
  warn: colors.accentWarn,
  info: colors.accentInfo,
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "CRIT",
  warn: "WARN",
  info: "INFO",
};

const CONDITION_LABEL: Record<string, string> = {
  drop_pct: "düşüş",
  rise_pct: "artış",
  below: "altında",
  above: "üstünde",
};

export function AlertRow({ alert }: { alert: Alert }) {
  const sev = SEVERITY_COLOR[alert.severity];
  const conditionLabel = CONDITION_LABEL[alert.condition] ?? alert.condition;

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        flexDirection: "row",
      }}
    >
      {/* Sol kenar — severity color bar */}
      <View
        style={{
          width: 3,
          backgroundColor: sev,
        }}
      />

      <View style={{ flex: 1, padding: 14, gap: 6 }}>
        {/* Top — severity badge + time */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              backgroundColor: `${sev}15`,
              borderWidth: 1,
              borderColor: `${sev}40`,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 9,
                color: sev,
                letterSpacing: 1.5,
              }}
            >
              {SEVERITY_LABEL[alert.severity]}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              color: colors.fgSubtle,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
            numberOfLines={1}
          >
            {alert.metric}
          </Text>
          <View style={{ flex: 1 }} />
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 10,
              color: colors.fgSubtle,
            }}
          >
            {formatRelativeTime(alert.triggeredAt)}
          </Text>
        </View>

        {/* Rule name */}
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 14,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {alert.ruleName}
        </Text>

        {/* Message */}
        {alert.message ? (
          <Text
            style={{
              fontFamily: "Geist-400",
              fontSize: 12,
              color: colors.fgMuted,
              lineHeight: 17,
            }}
            numberOfLines={2}
          >
            {alert.message}
          </Text>
        ) : null}

        {/* Comparative values strip */}
        {alert.currentValue !== null && alert.referenceValue !== null ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 11,
                color: colors.fgSecondary,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatInteger(alert.currentValue)}
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-400",
                fontSize: 10,
                color: colors.fgSubtle,
              }}
            >
              ←
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-400",
                fontSize: 11,
                color: colors.fgSubtle,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatInteger(alert.referenceValue)}
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-400",
                fontSize: 9,
                color: colors.fgSubtle,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                marginLeft: 4,
              }}
            >
              {conditionLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
