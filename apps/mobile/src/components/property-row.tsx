import { tr } from "~/lib/i18n";
import { View, Text } from "react-native";

import type { Property, PropertyStatus, PropertyType } from "~/hooks/use-properties";
import { Icon, type IconName } from "~/components/ui/icon";
import { formatRelativeTime } from "~/lib/format";
import { colors } from "~/theme/tokens";

const STATUS_COLOR: Record<PropertyStatus, string> = {
  healthy: colors.accent,
  stale: colors.accentWarn,
  down: colors.accentDanger,
  unknown: colors.fgSubtle,
};

const STATUS_LABEL: Record<PropertyStatus, string> = {
  healthy: "UP",
  stale: "STALE",
  down: "DOWN",
  unknown: "-",
};

const TYPE_LABEL: Record<PropertyType, string> = {
  website: "SITE",
  web_app: "WEB",
  mobile_app: "iOS/AND",
  desktop_app: "DESKTOP",
  game: "GAME",
};

const TYPE_ICON: Record<PropertyType, IconName> = {
  website: "layers",
  web_app: "layers",
  mobile_app: "activity",
  desktop_app: "layers",
  game: "activity",
};

export function PropertyRow({ property }: { property: Property }) {
  const dot = STATUS_COLOR[property.status];
  const isHealthy = property.status === "healthy";

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: property.status === "down" ? `${dot}40` : colors.border,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Status dot with glow */}
      <View style={{ alignItems: "center", justifyContent: "center", width: 32 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: dot,
            shadowColor: dot,
            shadowOpacity: isHealthy ? 0.9 : 0.4,
            shadowRadius: isHealthy ? 8 : 4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        {/* Top - type chip + name */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              backgroundColor: colors.bgHigher,
              paddingHorizontal: 6,
              paddingVertical: 1.5,
              borderRadius: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icon name={TYPE_ICON[property.type]} size={10} color={colors.fgMuted} />
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 9,
                color: colors.fgMuted,
                letterSpacing: 1.2,
              }}
            >
              {TYPE_LABEL[property.type]}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Geist-600",
              fontSize: 14,
              color: colors.fgPrimary,
              flex: 1,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {property.name}
          </Text>
        </View>

        {/* Bottom - brand + modules + heartbeat */}
        <Text
          style={{
            fontFamily: "Geist-400",
            fontSize: 11,
            color: colors.fgMuted,
          }}
          numberOfLines={1}
        >
          {property.brandName ?? property.slug}
          {property.enabledModules.length > 0
            ? ` · ${property.enabledModules.length} modül`
            : ""}
        </Text>
      </View>

      {/* Right - status badge + relative time */}
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <View
          style={{
            backgroundColor: `${dot}15`,
            borderWidth: 1,
            borderColor: `${dot}40`,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 9,
              color: dot,
              letterSpacing: 1.4,
            }}
          >
            {STATUS_LABEL[property.status]}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgSubtle,
          }}
        >
          {property.lastPingAt ? formatRelativeTime(property.lastPingAt) : tr("ping yok")}
        </Text>
      </View>
    </View>
  );
}
