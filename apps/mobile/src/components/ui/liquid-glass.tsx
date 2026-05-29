import { type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

import { colors } from "~/theme/tokens";

/**
 * Dark frosted-glass panel (Card Balance–style).
 * Uses native blur on iOS; solid frosted fallback elsewhere.
 */
type Tone = "default" | "lime" | "danger" | "warn" | "info" | "violet";

type Props = {
  children: ReactNode;
  tone?: Tone;
  radius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

const toneBorder: Record<Tone, string> = {
  default: "rgba(255,255,255,0.14)",
  lime: `${colors.accent}40`,
  danger: `${colors.accentDanger}45`,
  warn: `${colors.accentWarn}40`,
  info: `${colors.accentInfo}40`,
  violet: `${colors.accentViolet}42`,
};

const toneGlow: Record<Tone, string> = {
  default: "transparent",
  lime: `${colors.accent}18`,
  danger: `${colors.accentDanger}14`,
  warn: `${colors.accentWarn}12`,
  info: `${colors.accentInfo}14`,
  violet: `${colors.accentViolet}16`,
};

const glassFill = "rgba(28, 28, 34, 0.55)";

export function LiquidGlassPanel({
  children,
  tone = "default",
  radius = 20,
  padding = 14,
  style,
}: Props) {
  const flat = StyleSheet.flatten(style) ?? {};
  const shellStyle = [
    {
      borderRadius: radius,
      overflow: "hidden" as const,
      borderWidth: 1,
      borderColor: toneBorder[tone],
      alignSelf: "stretch" as const,
    },
    flat.width != null ? { width: flat.width as number } : null,
    flat.height != null ? { height: flat.height as number } : null,
    flat.minHeight != null ? { minHeight: flat.minHeight as number } : null,
    flat.flex != null ? { flex: flat.flex as number } : null,
  ];

  const specular = (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 12,
        right: 12,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.22)",
      }}
    />
  );

  const rim = (
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFill,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
      }}
    />
  );

  const glow =
    toneGlow[tone] !== "transparent" ? (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "68%",
          height: "46%",
          backgroundColor: toneGlow[tone],
          borderBottomLeftRadius: radius * 1.4,
        }}
      />
    ) : null;

  const frost = (
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFill,
        backgroundColor: glassFill,
      }}
    />
  );

  const gradientSheen = (
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFill,
        backgroundColor: "transparent",
        opacity: 0.9,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "55%",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      />
    </View>
  );

  const inner = (
    <>
      {glow}
      {gradientSheen}
      {frost}
      {specular}
      {rim}
      <View style={{ padding, flex: flat.height != null ? 1 : undefined }}>
        {children}
      </View>
    </>
  );

  if (Platform.OS === "ios") {
    return (
      <View style={shellStyle}>
        <BlurView
          intensity={48}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        {inner}
      </View>
    );
  }

  return (
    <View style={[shellStyle, { backgroundColor: colors.bgElevated }]}>
      {inner}
    </View>
  );
}
