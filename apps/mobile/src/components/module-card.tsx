import { type ReactNode, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  type LayoutChangeEvent,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Canvas,
  RoundedRect,
  LinearGradient,
  vec,
  Group,
} from "@shopify/react-native-skia";

import { Icon, type IconName } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";

type Props = {
  href: Href;
  icon: IconName;
  accent: string;
  label: string;
  sublabel: string;
  primaryValue: string;
  secondaryValue: string;
  primaryAccent?: string;
  secondaryAccent?: string;
  loading?: boolean;
};

const CARD_RADIUS = 18;
const CARD_HEIGHT = 124;

export function ModuleCard({
  href,
  icon,
  accent,
  label,
  sublabel,
  primaryValue,
  secondaryValue,
  primaryAccent,
  secondaryAccent,
  loading = false,
}: Props) {
  const router = useRouter();
  const [size, setSize] = useState({ width: 0, height: CARD_HEIGHT });

  function onLayout(e: LayoutChangeEvent) {
    setSize({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        router.push(href);
      }}
      onLayout={onLayout}
      style={({ pressed }) => ({
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
        opacity: pressed ? 0.92 : 1,
        minHeight: CARD_HEIGHT,
      })}
    >
      {/* Skia background - gradient + accent corner glow */}
      {size.width > 0 ? (
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
              r={CARD_RADIUS}
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
              r={CARD_RADIUS}
            >
              <LinearGradient
                start={vec(size.width, 0)}
                end={vec(size.width * 0.3, size.height * 0.8)}
                colors={[`${accent}24`, "transparent"]}
              />
            </RoundedRect>
          </Group>
        </Canvas>
      ) : null}

      {/* Border */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: CARD_RADIUS,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      {/* Content */}
      <View style={{ padding: 18, gap: 14, flex: 1 }}>
        {/* Top row - icon + label/sublabel + chevron */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              backgroundColor: `${accent}18`,
              borderWidth: 1,
              borderColor: `${accent}38`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={icon} size={18} color={accent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontFamily: "Geist-600",
                fontSize: 17,
                color: colors.fgPrimary,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 9,
                color: colors.fgMuted,
                letterSpacing: 1.5,
              }}
              numberOfLines={1}
            >
              {sublabel.toUpperCase()}
            </Text>
          </View>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: colors.bgHigher,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="chevronRight" size={12} color={colors.fgMuted} />
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border }} />

        {/* Bottom row - primary + secondary stats */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.fgSubtle} />
          ) : (
            <>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 8,
                    color: colors.fgSubtle,
                    letterSpacing: 1.4,
                  }}
                >
                  ANLIK
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 22,
                    color: primaryAccent ?? colors.fgPrimary,
                    letterSpacing: -0.5,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {primaryValue}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 8,
                    color: colors.fgSubtle,
                    letterSpacing: 1.4,
                  }}
                >
                  EK
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 13,
                    color: secondaryAccent ?? colors.fgSecondary,
                    letterSpacing: -0.2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {secondaryValue}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function ModuleCardSummary({ children }: { children: ReactNode }) {
  return <View style={{ gap: 12 }}>{children}</View>;
}
