import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Blur,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
  vec,
} from "@shopify/react-native-skia";

import { useTheme } from "~/theme/use-theme";

/** "#0A0A0C" + 0.8 → "rgba(10,10,12,0.8)". Skia hex+alpha kabul etmiyor. */
function rgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Bento arka plani — kisik aurora.
 *
 * NEDEN HALA AURORA VAR: cam, arkasindaki seyi bulaniklastirarak var olur. Duz
 * zemin uzerinde GlassView'in kiracagi hicbir sey kalmaz, geriye yari saydam
 * gri bir dikdortgen kalir. Aurora camin "malzeme" gibi okunmasini saglayan sey.
 *
 * NEDEN KISIK: eski Liquid Glass 0.28–0.45 opaklik + blueprint grid kullaniyordu;
 * o yogunluk tek buyuk kart icin dogruydu. Bento'da ekranda 5–7 ayri tile var,
 * ayni aurora gorsel gurultuye donusur. Opaklik tema recetesinden gelir
 * (packages/design/src/glass.ts → auroraOpacity), grid tamamen kaldirildi.
 */
export function BentoBackground() {
  const { theme, glass } = useTheme();
  const { width, height } = useWindowDimensions();
  const [minGlow, maxGlow] = glass.auroraOpacity;

  const blobs = useMemo(
    () => [
      { cx: width * 0.1, cy: 0, r: 230, color: "#D4FF4D", glow: maxGlow },
      { cx: width * 0.95, cy: height * 0.3, r: 200, color: theme.violet, glow: minGlow },
      { cx: width * 0.0, cy: height * 0.9, r: 190, color: theme.blue, glow: minGlow },
      { cx: width, cy: height * 0.95, r: 150, color: theme.amber, glow: minGlow },
    ],
    [width, height, theme.violet, theme.blue, theme.amber, minGlow, maxGlow],
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group layer={<Paint><Blur blur={50} /></Paint>}>
          {blobs.map((b, i) => (
            <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} opacity={b.glow}>
              <RadialGradient
                c={vec(b.cx, b.cy)}
                r={b.r}
                colors={[`${b.color}66`, `${b.color}00`]}
              />
            </Circle>
          ))}
        </Group>
        {/* Asagi dogru zemine soldur — icerik yogunlastikca aurora cekilir. */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={[rgba(theme.bg, 0), rgba(theme.bg, 0.8), theme.bg]}
            positions={[0, 0.32, 0.7]}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
