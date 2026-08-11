import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { duration, EASE_OUT, radius as R, stagger } from "@helm/design";

const ease = Easing.bezier(...EASE_OUT);
/** Sifirdan buyumez — hicbir sey yoktan var olmaz. Cubuk taban cizgisinde baslar. */
const FROM = 0.04;

type Props = {
  /** Yukseklikler, 0–1 arasi oran. Son eleman "bugun/simdi" olarak vurgulanir. */
  values: readonly number[];
  /** Vurgulanan (son) cubuk rengi. */
  activeColor: string;
  /** Diger cubuklarin rengi. */
  dimColor: string;
  height: number;
  gap?: number;
  /** Degistiginde animasyon bastan oynar. */
  replayKey?: number;
};

/**
 * Bento bar grafigi — flex tabanli, Skia degil.
 *
 * NEDEN SKIA DEGIL: bu grafik sadece dikdortgen; Skia canvas'i acmanin maliyeti
 * kazandirdigi hicbir sey yok. Skia egri/gradyan/ring gerektiren yerlerde kalir
 * (charts.tsx). Burada scaleY donusumu GPU'da calisir, layout tetiklemez.
 */
export function BentoBars({
  values,
  activeColor,
  dimColor,
  height,
  gap = 4,
  replayKey = 0,
}: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap }}>
      {values.map((v, i) => (
        <Bar
          key={i}
          ratio={v}
          index={i}
          color={i === values.length - 1 ? activeColor : dimColor}
          height={height}
          replayKey={replayKey}
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
}: {
  ratio: number;
  index: number;
  color: string;
  height: number;
  replayKey: number;
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

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          height: Math.max(2, height * ratio),
          backgroundColor: color,
          borderRadius: R.bar,
          transformOrigin: "bottom",
        },
        animated,
      ]}
    />
  );
}
