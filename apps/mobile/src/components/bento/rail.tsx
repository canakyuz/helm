import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { duration, EASE_OUT, radius as R, stagger } from "@helm/design";

import { useTheme } from "~/theme/use-theme";

const ease = Easing.bezier(...EASE_OUT);

export type RailRow = {
  label: string;
  /** Sagda gosterilen deger — bicimlenmis metin. */
  value: string;
  /** Dolum orani, 0–1. */
  ratio: number;
  color: string;
};

/**
 * Etiketli oran rail'i — "Yeni +$1,840" gibi satirlar.
 *
 * Tasarim bunu CSS'te `width: 0 → %X` ile animasyonluyordu; burada scaleX
 * kullaniliyor. Gerekce: width animasyonu her karede layout hesabi tetikler,
 * scaleX GPU'da doner (bkz motion.ts).
 */
export function BentoRails({
  rows,
  replayKey = 0,
}: {
  rows: readonly RailRow[];
  replayKey?: number;
}) {
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r, i) => (
        <Rail key={r.label} row={r} index={i} replayKey={replayKey} />
      ))}
    </View>
  );
}

function Rail({
  row,
  index,
  replayKey,
}: {
  row: RailRow;
  index: number;
  replayKey: number;
}) {
  const { theme } = useTheme();
  const fill = useSharedValue(0);
  const noMotion = useReducedMotion();

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      60 + index * stagger.rail,
      withTiming(1, { duration: noMotion ? 0 : duration.rail, easing: ease }),
    );
  }, [index, replayKey, noMotion, fill]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text className="font-medium text-row text-fg">{row.label}</Text>
        <Text className="font-mono-semibold text-body" style={{ color: row.color }}>
          {row.value}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: R.pill,
          backgroundColor: theme.line,
          marginTop: 7,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[
            {
              width: `${Math.max(0, Math.min(1, row.ratio)) * 100}%`,
              height: "100%",
              borderRadius: R.pill,
              backgroundColor: row.color,
              transformOrigin: "left",
            },
            animated,
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Yigili oran cubugu — tek satirda parcalarin payi (gelir kirilimi).
 * Parcalar arasinda 3px bosluk var: bitisik renkler ayirt edilemiyordu.
 */
export function BentoStack({
  parts,
  height = 12,
}: {
  parts: readonly { ratio: number; color: string }[];
  height?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 3, height }}>
      {parts.map((p, i) => (
        <View
          key={i}
          style={{
            flex: Math.max(0.0001, p.ratio),
            backgroundColor: p.color,
            borderRadius: R.rail,
          }}
        />
      ))}
    </View>
  );
}
