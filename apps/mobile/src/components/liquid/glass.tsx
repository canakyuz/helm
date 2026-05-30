import { type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { colors, glass } from "~/theme/tokens";

export type GlassTone =
  | "default"
  | "lime"
  | "danger"
  | "warn"
  | "info"
  | "violet";

type Props = {
  children: ReactNode;
  tone?: GlassTone;
  radius?: number;
  padding?: number;
  glow?: string; // accent color for the inner glow spot
  deco?: ReactNode; // e.g. <CornerTicks/> — sits above frost, below content
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const toneBorder: Record<GlassTone, string> = {
  default: glass.border,
  lime: `${colors.accent}40`,
  danger: `${colors.accentDanger}45`,
  warn: `${colors.accentWarn}40`,
  info: `${colors.accentInfo}40`,
  violet: `${colors.accentViolet}42`,
};

const liquidAvailable = isLiquidGlassAvailable();

export function LiquidGlass({
  children,
  tone = "default",
  radius = glass.radius,
  padding = 16,
  glow,
  deco,
  onPress,
  style,
}: Props) {
  const shell: StyleProp<ViewStyle> = [
    {
      borderRadius: radius,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: toneBorder[tone],
      alignSelf: "stretch",
    },
    style,
  ];

  // top specular sheen (prototype .glass::before, 176deg white→transparent)
  const sheen = (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "22%",
        backgroundColor: glass.sheen,
        opacity: 0.4,
      }}
    />
  );

  const glowSpot = glow ? (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: "-15%",
        right: "-10%",
        width: "70%",
        height: "60%",
        backgroundColor: `${glow}30`,
        borderRadius: 999,
      }}
    />
  ) : null;

  const innerBody = (
    <>
      {glowSpot}
      {sheen}
      {deco}
      <View style={{ padding, position: "relative" }}>{children}</View>
    </>
  );

  const base =
    Platform.OS === "ios" && liquidAvailable ? (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        style={StyleSheet.absoluteFill}
      />
    ) : Platform.OS === "ios" ? (
      <BlurView
        intensity={glass.blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
    ) : (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]}
      />
    );

  // Always lay a semi-opaque elevated surface so cards read as distinct
  // panels on the near-black background — GlassView's material alone is too
  // dark/transparent here and the cards vanish. Faithful to the prototype,
  // whose .glass always carries a tint fill on top of the blur.
  const fill = (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.07)" }]}
    />
  );

  const content = (
    <>
      {base}
      {fill}
      {innerBody}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [shell, pressed && { opacity: 0.92 }]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={shell}>{content}</View>;
}
