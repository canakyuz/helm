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
import { press, radius as R, space } from "@helm/design";

import { useTheme } from "~/theme/use-theme";

const liquidAvailable = isLiquidGlassAvailable();

type TileProps = {
  children: ReactNode;
  /** Ic padding. Varsayilan: standart tile (18). */
  padding?: number;
  /** Kose yaricapi. Varsayilan: ana tile (22). */
  cornerRadius?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Bento'nun ana yuzeyi — cam.
 *
 * YUZEY KURALI (packages/design/src/glass.ts): cam SADECE burada. Accent dolgu
 * ve tile-ici kutular SolidTile kullanir. Cam icinde cam hem gorsel camur
 * yaratir hem blur katmanini ikiye katlar.
 *
 * Her katman KENDI borderRadius'unu tasir: iOS'ta native blur view'lar ebeveynin
 * overflow:hidden'ina guvenilir sekilde kirpilmiyor, yuvarlak kenarin altindan
 * kare kose sizardi.
 */
export function BentoTile({
  children,
  padding = space.tilePad,
  cornerRadius = R.tile,
  onPress,
  style,
}: TileProps) {
  const { glass } = useTheme();

  const shell: StyleProp<ViewStyle> = [
    {
      borderRadius: cornerRadius,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: glass.border,
      alignSelf: "stretch",
    },
    glass.shadow && {
      shadowColor: glass.shadow.color,
      shadowOffset: { width: 0, height: glass.shadow.offsetY },
      shadowOpacity: glass.shadow.opacity,
      shadowRadius: glass.shadow.radius,
      elevation: glass.shadow.elevation,
    },
    style,
  ];

  const base =
    Platform.OS === "ios" && liquidAvailable ? (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={glass.colorScheme}
        style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius }]}
      />
    ) : Platform.OS === "ios" ? (
      <BlurView
        intensity={glass.blurIntensity}
        tint={glass.colorScheme}
        style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius }]}
      />
    ) : null;

  // Cam TEK BASINA gorunmez — uzerine her zaman tint fill konur, yoksa kart
  // kaybolur (design.md §4). Light temada ayni sorunun aynasi: fill daha parlak,
  // kenar koyu. Android'de blur yok, fill tek basina yuzeyi tasir.
  const fill = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: glass.fill, borderRadius: cornerRadius },
      ]}
    />
  );

  const content = (
    <>
      {base}
      {fill}
      <View style={{ padding }}>{children}</View>
    </>
  );

  if (!onPress) return <View style={shell}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [shell, pressed && { opacity: press.opacity }]}
    >
      {content}
    </Pressable>
  );
}

type SolidProps = TileProps & {
  /** Dolgu rengi. Accent hero icin theme-disi accent, ic kutular icin tile2. */
  color: string;
};

/**
 * Opak yuzey — accent hero ve tile-ici kutular.
 * Cam degil: accent dolgunun altinda bulaniklastiracak bir sey yok, tile2 ise
 * zaten bir camin icinde oturuyor.
 */
export function SolidTile({
  children,
  color,
  padding = space.tilePad,
  cornerRadius = R.tile,
  onPress,
  style,
}: SolidProps) {
  const shell: StyleProp<ViewStyle> = [
    { borderRadius: cornerRadius, backgroundColor: color, alignSelf: "stretch" },
    style,
  ];
  const body = <View style={{ padding }}>{children}</View>;

  if (!onPress) return <View style={shell}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [shell, pressed && { opacity: press.opacity }]}
    >
      {body}
    </Pressable>
  );
}
