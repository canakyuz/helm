import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Canvas,
  Circle,
  RadialGradient,
  Blur,
  Group,
  Paint,
  Path,
  Skia,
  Rect,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";

import { colors } from "~/theme/tokens";

type Blob = { cx: number; cy: number; r: number; color: string };

export function LiquidBackground({ glow = 0.45 }: { glow?: number }) {
  const { width, height } = useWindowDimensions();

  const blobs = useMemo<Blob[]>(
    () => [
      { cx: width * 0.1, cy: 0, r: 230, color: colors.accent },
      { cx: width * 0.95, cy: height * 0.3, r: 200, color: colors.accentViolet },
      { cx: width * 0.0, cy: height * 0.9, r: 190, color: colors.blue },
      { cx: width * 1.0, cy: height * 0.95, r: 150, color: colors.accentWarn },
    ],
    [width, height],
  );

  const grid = useMemo(() => {
    const p = Skia.Path.Make();
    const step = 32;
    for (let x = 0; x <= width; x += step) {
      p.moveTo(x, 0);
      p.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += step) {
      p.moveTo(0, y);
      p.lineTo(width, y);
    }
    return p;
  }, [width, height]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgBase }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* aurora blobs — blurred as a single layer */}
        <Group layer={<Paint><Blur blur={50} /></Paint>}>
          {blobs.map((b, i) => (
            <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} opacity={glow}>
              <RadialGradient
                c={vec(b.cx, b.cy)}
                r={b.r}
                colors={[`${b.color}66`, `${b.color}00`]}
              />
            </Circle>
          ))}
        </Group>
        {/* blueprint grid */}
        <Path
          path={grid}
          style="stroke"
          strokeWidth={1}
          color="rgba(255,255,255,0.028)"
        />
        {/* fade the grid + blobs downward into the base */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={["rgba(7,7,10,0)", "rgba(7,7,10,0.65)", colors.bgBase]}
            positions={[0, 0.4, 0.85]}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
