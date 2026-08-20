import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon, type IconName } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";
import type { PropertyType } from "~/hooks/use-properties";

const TYPE_ICON: Record<PropertyType, IconName> = {
  website: "layers",
  web_app: "layers",
  mobile_app: "activity",
  desktop_app: "layers",
  game: "activity",
};

type Props = {
  rank: number;
  isLast: boolean;
  name: string;
  brandName: string | null;
  type: PropertyType;
  accent: string;
  primary: string;
  secondaryLabel: string;
  secondary: string;
  onPress: () => void;
  rightSlot?: ReactNode;
};

export function RankedPropertyRow({
  rank,
  isLast,
  name,
  brandName,
  type,
  accent,
  primary,
  secondaryLabel,
  secondary,
  onPress,
  rightSlot,
}: Props) {
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 14,
        backgroundColor: pressed ? colors.bgHigher : "transparent",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      })}
    >
      {/* Rank - accent number, fixed width */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          backgroundColor: rank === 1 ? `${accent}18` : colors.bgHigher,
          borderWidth: 1,
          borderColor: rank === 1 ? `${accent}40` : colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "GeistMono-600",
            fontSize: 10,
            color: rank === 1 ? accent : colors.fgMuted,
            letterSpacing: 0.3,
            fontVariant: ["tabular-nums"],
          }}
        >
          {String(rank).padStart(2, "0")}
        </Text>
      </View>

      {/* Type icon tile */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.bgHigher,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={TYPE_ICON[type]} size={13} color={colors.fgMuted} />
      </View>

      {/* Name + brand stacked */}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 14,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgMuted,
            letterSpacing: 1,
          }}
          numberOfLines={1}
        >
          {(brandName ?? "-").toUpperCase()}
        </Text>
      </View>

      {/* Stats - primary big + secondary small */}
      <View
        style={{
          alignItems: "flex-end",
          gap: 3,
          minWidth: 92,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: "GeistMono-600",
            fontSize: 14,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
            fontVariant: ["tabular-nums"],
          }}
        >
          {primary}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 8,
              color: colors.fgSubtle,
              letterSpacing: 1.2,
            }}
          >
            {secondaryLabel.toUpperCase()}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 10,
              color: colors.fgSecondary,
              fontVariant: ["tabular-nums"],
            }}
          >
            {secondary}
          </Text>
        </View>
      </View>

      {rightSlot}
    </Pressable>
  );
}
