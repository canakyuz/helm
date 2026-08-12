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
  /** Dolum orani, 0–1. 1'i asmasi VERI HATASIDIR; asagida ozel isleniyor. */
  ratio: number;
  color: string;
};

/**
 * Oran 1'i asarsa bu bir olcum hatasi (orn. "63 bitis / 60 baslangic").
 * Onceki hal `Math.min(1, ratio)` ile sessizce kirpiyordu; sonuc gercek bir
 * 5/5 ile ayni dolu cubuk oluyordu — yani hata BASARI gibi goruunuyordu.
 * Ustelik Saglik ekraninin ust karti ayni veriyi "olcum supheli" diye
 * raporluyor: tek ekranda iki celisen ifade.
 */
const OVERFLOW_MARK = " ⚠";

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
  const { theme, glass } = useTheme();
  const fill = useSharedValue(0);
  const noMotion = useReducedMotion();
  const overflow = row.ratio > 1;
  // Tasma durumunda cubuk hala tam dolu cizilir (baska bir sey cizilemez),
  // ama rengi warn'a doner ve degerin yaninda isaret cikar. Boylece "tamam"
  // ile "olculemedi" ayni goruunmez.
  const railColor = overflow ? theme.warn : row.color;

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
        <Text className="font-mono-semibold text-body" style={{ color: railColor }}>
          {row.value}
          {overflow ? OVERFLOW_MARK : ""}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: R.pill,
          backgroundColor: glass.chartDim,
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
              backgroundColor: railColor,
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
