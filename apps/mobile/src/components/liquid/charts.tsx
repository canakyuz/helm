import { useEffect, useMemo } from "react";
import { View } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
  Circle,
  RoundedRect,
} from "@shopify/react-native-skia";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { colors } from "~/theme/tokens";

function smoothPath(values: number[], w: number, h: number, pad: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const n = values.length;
  const x = (i: number) => pad + (i / (n - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
  const line = Skia.Path.Make();
  line.moveTo(x(0), y(values[0]!));
  for (let i = 1; i < n; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    line.cubicTo(cx, y(values[i - 1]!), cx, y(values[i]!), x(i), y(values[i]!));
  }
  return { line, x, y };
}

export function AreaChart({
  data,
  width,
  height,
  color = colors.accent,
  strokeW = 2.5,
  pad = 6,
}: {
  data: number[];
  width: number;
  height: number;
  color?: string;
  strokeW?: number;
  pad?: number;
}) {
  const built = useMemo(() => {
    if (data.length < 2) return null;
    const { line, x, y } = smoothPath(data, width, height, pad);
    const area = line.copy();
    area.lineTo(x(data.length - 1), height - pad);
    area.lineTo(x(0), height - pad);
    area.close();
    const last = data.length - 1;
    return { line, area, cx: x(last), cy: y(data[last]!) };
  }, [data, width, height, pad]);

  if (!built) return <View style={{ width, height }} />;
  return (
    <Canvas style={{ width, height }}>
      <Path path={built.area} style="fill">
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[`${color}52`, `${color}00`]}
        />
      </Path>
      <Path
        path={built.line}
        style="stroke"
        strokeWidth={strokeW}
        strokeCap="round"
        strokeJoin="round"
        color={color}
      />
      <Circle cx={built.cx} cy={built.cy} r={3.5} color={color} />
    </Canvas>
  );
}

export function Bars({
  data,
  width,
  height,
  color = colors.blue,
  gap = 3,
}: {
  data: number[];
  width: number;
  height: number;
  color?: string;
  gap?: number;
}) {
  const max = Math.max(...data) || 1;
  const n = data.length;
  const bw = (width - gap * (n - 1)) / n;
  return (
    <Canvas style={{ width, height }}>
      {data.map((v, i) => {
        const bh = Math.max(2, (v / max) * height);
        const isLast = i === n - 1;
        return (
          <RoundedRect
            key={i}
            x={i * (bw + gap)}
            y={height - bh}
            width={bw}
            height={bh}
            r={Math.min(3, bw / 2)}
            color={color}
            opacity={isLast ? 1 : 0.32}
          />
        );
      })}
    </Canvas>
  );
}

export function Ring({
  value,
  size = 82,
  stroke = 8,
  color = colors.green,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const track = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(cx, cx, r);
    return p;
  }, [cx, r]);
  const end = Math.max(0, Math.min(1, value / 100));
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={track}
          style="stroke"
          strokeWidth={stroke}
          color="rgba(255,255,255,0.08)"
        />
        <Path
          path={track}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={color}
          start={0}
          end={end}
        />
      </Canvas>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

// Multi-segment donut (share breakdown). Same start/end arc trick as Ring,
// stacked per segment. O(segments) paths.
export function Donut({
  segments,
  size = 96,
  stroke = 16,
  gap = 0.014,
  children,
}: {
  segments: { pct: number; color: string }[];
  size?: number;
  stroke?: number;
  gap?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const track = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(cx, cx, r);
    return p;
  }, [cx, r]);
  const arcs = useMemo(() => {
    const total = segments.reduce((s, x) => s + x.pct, 0) || 1;
    let acc = 0;
    return segments.map((s) => {
      const start = acc / total;
      acc += s.pct;
      const end = acc / total;
      const hg = segments.length > 1 ? gap / 2 : 0;
      return { start: start + hg, end: Math.max(start + hg, end - hg), color: s.color };
    });
  }, [segments, gap]);
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Path path={track} style="stroke" strokeWidth={stroke} color="rgba(255,255,255,0.06)" />
        {arcs.map((a, i) => (
          <Path
            key={i}
            path={track}
            style="stroke"
            strokeWidth={stroke}
            strokeCap="butt"
            color={a.color}
            start={a.start}
            end={a.end}
          />
        ))}
      </Canvas>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

// animated horizontal proportion fill
export function HBar({
  pct,
  color = colors.accent,
  height = 8,
  track = "rgba(255,255,255,0.07)",
}: {
  pct: number;
  color?: string;
  height?: number;
  track?: string;
}) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, pct)), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View
      style={{ height, borderRadius: 999, backgroundColor: track, overflow: "hidden" }}
    >
      <Animated.View
        style={[{ height: "100%", borderRadius: 999, backgroundColor: color }, style]}
      />
    </View>
  );
}

export function StackBar({
  segments,
  height = 13,
}: {
  segments: { pct: number; color: string }[];
  height?: number;
}) {
  return (
    <View style={{ height, flexDirection: "row", gap: 2 }}>
      {segments.map((s, i) => (
        <View
          key={i}
          style={{
            width: `${s.pct}%`,
            height: "100%",
            backgroundColor: s.color,
            borderRadius: 4,
          }}
        />
      ))}
    </View>
  );
}

export function Spark({
  data,
  width,
  height,
  color = colors.accent,
  strokeW = 1.8,
}: {
  data: number[];
  width: number;
  height: number;
  color?: string;
  strokeW?: number;
}) {
  const line = useMemo(() => {
    if (data.length < 2) return null;
    return smoothPath(data, width, height, 2).line;
  }, [data, width, height]);
  if (!line) return <View style={{ width, height }} />;
  return (
    <Canvas style={{ width, height }}>
      <Path
        path={line}
        style="stroke"
        strokeWidth={strokeW}
        strokeCap="round"
        color={color}
        opacity={0.9}
      />
    </Canvas>
  );
}
