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

type Props = {
  /** Tamamlanma orani, 0–1. */
  ratio: number;
  /** Segment sayisi. Tasarim 10 kullaniyor. */
  segments?: number;
  filledColor: string;
  emptyColor: string;
  replayKey?: number;
};

/**
 * Segmentli ilerleme olcegi — surekli bir cubuk degil, 10 ayri dilim.
 *
 * NEDEN SEGMENT: surekli bar "yuzde kac" sorusunu yaklasik cevaplar; 10 dilim
 * sayilabilir, "6/10" diye okunur. Aylik hedef gibi sayilabilir bir sey icin
 * dogru gosterim bu.
 */
export function SegmentMeter({
  ratio,
  segments = 10,
  filledColor,
  emptyColor,
  replayKey = 0,
}: Props) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * segments);

  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: segments }, (_, i) => (
        <Segment
          key={i}
          index={i}
          active={i < filled}
          color={i < filled ? filledColor : emptyColor}
          replayKey={replayKey}
        />
      ))}
    </View>
  );
}

function Segment({
  index,
  active,
  color,
  replayKey,
}: {
  index: number;
  active: boolean;
  color: string;
  replayKey: number;
}) {
  const progress = useSharedValue(active ? 0 : 1);
  const noMotion = useReducedMotion();

  useEffect(() => {
    // Dolu olmayan segmentler animasyonsuz — onlar zemin, olay degil.
    if (!active) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      index * stagger.tile,
      withTiming(1, { duration: noMotion ? 0 : duration.rise, easing: ease }),
    );
  }, [index, active, replayKey, noMotion, progress]);

  const animated = useAnimatedStyle(() => ({ opacity: active ? progress.value : 1 }));

  return (
    <Animated.View
      style={[
        { flex: 1, height: 6, borderRadius: R.pill, backgroundColor: color },
        animated,
      ]}
    />
  );
}
