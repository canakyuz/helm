import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { duration, EASE_OUT, press, radius as R, stagger } from "@helm/design";

const ease = Easing.bezier(...EASE_OUT);

/** Sifirdan buyumez - hicbir sey yoktan var olmaz. Cubuk taban cizgisinde baslar. */
const FROM = 0.04;
/** Dokunma hedefi cubuktan genis: 30px'lik cubuga isabet ettirmek zor. */
const HIT = { top: 12, bottom: 12, left: 2, right: 2 };

export type BarPoint = { date: string; value: number };

type Props = {
  /** Ham noktalar. Yukseklikler burada normalize edilir. */
  points: readonly BarPoint[];
  /** Vurgulanan cubuk rengi (secili gun veya son gun). */
  activeColor: string;
  /** Diger cubuklarin rengi. */
  dimColor: string;
  height: number;
  gap?: number;
  /** Secili gunun indeksi; null ise son cubuk vurgulanir. */
  selectedIndex?: number | null;
  /** Cubuga basildiginda. Verilmezse cubuklar dokunulamaz olur. */
  onSelect?: (index: number) => void;
  replayKey?: number;
};

/**
 * Bento bar grafigi - flex tabanli, Skia degil.
 *
 * NEDEN SKIA DEGIL: bu grafik sadece dikdortgen; Skia canvas'i acmanin kazandirdigi
 * hicbir sey yok. Skia egri/gradyan/ring gerektiren yerlerde kalir (charts.tsx).
 * scaleY donusumu GPU'da calisir, layout tetiklemez.
 */
export function BentoBars({
  points,
  activeColor,
  dimColor,
  height,
  gap = 4,
  selectedIndex = null,
  onSelect,
  replayKey = 0,
}: Props) {
  // Time: O(n), Space: O(n) - n sabit (10–15 cubuk).
  const max = Math.max(...points.map((p) => p.value), 0);
  const active = selectedIndex ?? points.length - 1;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap }}>
      {points.map((p, i) => (
        <Bar
          key={p.date}
          ratio={max > 0 ? Math.max(0.04, p.value / max) : 0.04}
          index={i}
          color={i === active ? activeColor : dimColor}
          height={height}
          replayKey={replayKey}
          {...(onSelect ? { onPress: () => onSelect(i) } : {})}
        />
      ))}
    </View>
  );
}

function Bar({
  ratio,
  index,
  color,
  height,
  replayKey,
  onPress,
}: {
  ratio: number;
  index: number;
  color: string;
  height: number;
  replayKey: number;
  onPress?: () => void;
}) {
  const grow = useSharedValue(FROM);
  const noMotion = useReducedMotion();

  useEffect(() => {
    grow.value = FROM;
    grow.value = withDelay(
      40 + index * stagger.bar,
      withTiming(1, { duration: noMotion ? 0 : duration.grow, easing: ease }),
    );
  }, [index, replayKey, noMotion, grow]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }] }));

  const bar = (
    <Animated.View
      style={[
        {
          height: Math.max(2, height * ratio),
          backgroundColor: color,
          borderRadius: R.bar,
          transformOrigin: "bottom",
        },
        animated,
      ]}
    />
  );

  if (!onPress) return <View style={{ flex: 1 }}>{bar}</View>;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT}
      // Statik style - Pressable'in style'i fonksiyon olursa flexDirection gibi
      // layout ozellikleri uygulanmiyor (bkz design.md §8 gotcha).
      style={{ flex: 1, justifyContent: "flex-end" }}
      accessibilityRole="button"
    >
      {({ pressed }) => (
        <View style={pressed ? { opacity: press.opacity } : undefined}>{bar}</View>
      )}
    </Pressable>
  );
}
