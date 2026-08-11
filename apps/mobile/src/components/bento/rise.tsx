import { type ReactNode, useEffect } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { duration, EASE_OUT, reduced, stagger } from "@helm/design";

const RISE_Y = 14;
const ease = Easing.bezier(...EASE_OUT);

type Props = {
  children: ReactNode;
  /** Kacinci tile — stagger gecikmesi bundan hesaplanir (index * 40ms). */
  index?: number;
  /**
   * Degistiginde animasyon bastan oynar. Overview bunu yenileme sayacina baglar.
   *
   * NEDEN PROP: mockup her sekme degisiminde tum girisi tekrar oynatiyordu.
   * 5 sekmeli bir cockpit'te sekme degisimi gunde onlarca kez olur; o siklikta
   * animasyon bilgi degil gecikme tasir. Yeniden oynatma yalnizca TAZE VERI
   * geldiginde anlamli (packages/design/src/motion.ts → replayOn).
   */
  replayKey?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Tile giris animasyonu — opaklik + asagidan yukari kayma, index'e gore staggerli.
 *
 * Azaltilmis harekette kayma kalkar, FADE KALIR. "Azaltilmis hareket" sifir
 * animasyon demek degil; kavramaya yardim eden opaklik gecisleri korunur.
 */
export function Rise({ children, index = 0, replayKey = 0, style }: Props) {
  const progress = useSharedValue(0);
  const noMotion = useReducedMotion();

  // Shared value RENDER SIRASINDA yazilmaz — Reanimated uyarisi/jitter olur.
  useEffect(() => {
    const delay = index * stagger.tile;
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: noMotion ? reduced.fade : duration.rise,
        easing: ease,
      }),
    );
  }, [index, replayKey, noMotion, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * (noMotion ? 0 : RISE_Y) }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
