import { useState } from "react";
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  type LayoutChangeEvent,
} from "react-native";
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  vec,
  Group,
} from "@shopify/react-native-skia";

import { Icon, type IconName } from "~/components/ui/icon";
import { formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

type Props = {
  icon: IconName;
  accent: string;
  label: string;
  count: number | null;
  loading?: boolean;
  onPress?: () => void;
};

const RADIUS = 14;

export function SegmentTemplateCard({
  icon,
  accent,
  label,
  count,
  loading = false,
  onPress,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(e: LayoutChangeEvent) {
    setSize({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: RADIUS,
        overflow: "hidden",
        opacity: pressed ? 0.92 : 1,
        minHeight: 116,
      })}
    >
      {size.width > 0 && size.height > 0 ? (
        <Canvas
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
          }}
        >
          <Group>
            <RoundedRect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              r={RADIUS}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(size.width, size.height)}
                colors={[colors.bgElevated, colors.bgSurface]}
              />
            </RoundedRect>
            <RoundedRect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              r={RADIUS}
            >
              <LinearGradient
                start={vec(size.width, 0)}
                end={vec(size.width * 0.2, size.height)}
                colors={[`${accent}24`, "transparent"]}
              />
            </RoundedRect>
          </Group>
        </Canvas>
      ) : null}

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <View
        style={{
          flex: 1,
          padding: 12,
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: `${accent}18`,
            borderWidth: 1,
            borderColor: `${accent}40`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={14} color={accent} />
        </View>

        <View style={{ gap: 3 }}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.fgMuted} />
          ) : (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 22,
                color: accent,
                letterSpacing: -0.5,
                fontVariant: ["tabular-nums"],
              }}
            >
              {count === null ? "-" : formatInteger(count)}
            </Text>
          )}
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              letterSpacing: 1.3,
              color: colors.fgMuted,
            }}
            numberOfLines={1}
          >
            {label.toUpperCase()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
