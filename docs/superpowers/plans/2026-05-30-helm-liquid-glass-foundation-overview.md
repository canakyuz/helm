# helm liquid glass — Foundation + Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the `helm liquid glass.html` prototype's visual + interaction language in the real Expo/React Native app — a shared liquid-glass design system plus a fully-wired Overview screen — keeping the native tab bar and folding the old 4-tab IA into a new 5-tab IA.

**Architecture:** A new presentational design-system layer under `src/components/liquid/` (pure components, props-in/JSX-out, no data fetching) built on `expo-glass-effect` (GlassView, iOS-26 Liquid Glass) with a `expo-blur` BlurView fallback, `@shopify/react-native-skia` for charts/background, and `react-native-reanimated` for fills. Screens compose existing Supabase hooks + these primitives. Mock-only prototype concepts live in a single `demoData` object, every demo value visibly tagged.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript strict, NativeWind v4, TanStack Query v5, expo-glass-effect, expo-blur, react-native-skia, react-native-reanimated, expo-router NativeTabs.

> **Testing note (project rule override):** The user's CLAUDE.md forbids test-first / unit-test obsession. Presentational RN components are not unit-tested here. Every task's gate is: `bun run typecheck` (== `tsc --noEmit`) clean + a stated manual/visual check + a single-line conventional commit (`type(scope): WES-000 …`, no Co-Authored-By, no `--no-verify`).

---

## File Structure

```
src/theme/tokens.ts                 MODIFY  — add glass recipe + extended fg/green tokens
src/lib/demo-data.ts                CREATE  — tagged demo values for mock-only concepts
src/components/liquid/glass.tsx     CREATE  — <LiquidGlass> (GlassView | BlurView)
src/components/liquid/charts.tsx    CREATE  — AreaChart, Bars, Ring, HBar, StackBar, Spark
src/components/liquid/background.tsx CREATE — <LiquidBackground> (Skia blobs + grid)
src/components/liquid/primitives.tsx CREATE — Delta, Eyebrow, Glyph, StatusDot, CornerTicks, CountUp, Seg, ActionBtn, SearchInput, EmptyHint
src/components/liquid/hero.tsx      CREATE  — OpenHero, MiniStat, Sep
src/components/liquid/card.tsx      CREATE  — CardSection, FullDivider, Row, KV, Chevron
src/components/liquid/header.tsx    CREATE  — LiquidHeader
src/components/liquid/index.ts      CREATE  — barrel exports
src/components/ui/liquid-glass.tsx  MODIFY  — re-export from liquid/glass (compat shim)
app/(cockpit)/_layout.tsx           MODIFY  — NativeTabs → 5 tabs
app/(cockpit)/overview.tsx          CREATE  — Overview screen (real build)
app/(cockpit)/revenue.tsx           CREATE  — placeholder
app/(cockpit)/analytics.tsx         CREATE  — placeholder
app/(cockpit)/health.tsx            CREATE  — placeholder
app/(cockpit)/settings.tsx          CREATE  — placeholder
app/(cockpit)/(home)/ (growth)/ (reviews)/ more/   DELETE (Task 12)
```

---

### Task 1: Extend theme tokens

**Files:**
- Modify: `src/theme/tokens.ts`

- [ ] **Step 1: Add extended palette + glass recipe**

Replace the `colors` object and append `glass` to `src/theme/tokens.ts` (keep `fonts` as-is):

```typescript
// Tailwind config ile birebir senkron — runtime/inline kullanım için aynı palet.

export const colors = {
  bgBase: "#07070A",
  bgDeep: "#050507",
  bgSurface: "#0E0E12",
  bgElevated: "#15151B",
  bgHigher: "#1C1C24",
  fgPrimary: "#F6F6F1",
  fgSecondary: "#C9C9BE",
  fgMuted: "#8C8C94",
  fgSubtle: "#585860",
  border: "#1C1C24",
  borderStrong: "#2A2A33",
  borderGlow: "#3A3A46",
  accent: "#D4FF4D",
  accentInk: "#11130A",
  accentSoft: "#A8CC3D",
  accentDanger: "#FF5C7A",
  accentWarn: "#FFB100",
  accentInfo: "#7AA8FF",
  accentViolet: "#B89CFF",
  green: "#57E08B",
  blue: "#7AA8FF",
} as const;

export const fonts = {
  sans: "Geist-400",
  medium: "Geist-500",
  semibold: "Geist-600",
  bold: "Geist-700",
  mono: "GeistMono-400",
  monoMedium: "GeistMono-500",
  monoSemibold: "GeistMono-600",
} as const;

// Liquid-glass design recipe (prototype: liquid.css :root)
export const glass = {
  tint: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.10)",
  sheen: "rgba(255,255,255,0.12)",
  hairline: "rgba(255,255,255,0.06)",
  blurIntensity: 60,
  radius: 28,
  radiusSm: 18,
  gap: 13,
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS (no references broke — `fgPrimary/Secondary/Muted/Subtle` names unchanged; only hex values + additive keys).

- [ ] **Step 3: Commit**

```bash
git add src/theme/tokens.ts
git commit -m "feat(mobile): WES-000 extend theme tokens with liquid glass recipe"
```

---

### Task 2: Demo data module

**Files:**
- Create: `src/lib/demo-data.ts`

- [ ] **Step 1: Create the tagged demo data**

```typescript
// Mock-only prototype concepts NOT present in the real Supabase layer.
// Every value here is DEMO — consumers MUST render a `DEMO` chip next to it.
// See docs/superpowers/specs/2026-05-30-helm-liquid-glass-foundation-overview-design.md

export const DEMO_TAG = "DEMO" as const;

export const demoData = {
  // Overview monthly revenue goal strip
  goal: { target: 150_000, current: 118_200, label: "May target" },
  // crash-free %, only used when useSystemHealth does not expose it
  crashFree: 99.2,
  crashFreeDelta: -1.8,
  // per-project KV detail values shown when expanding an Overview project row
  // keyed by intent, not by project — purely illustrative
  projectDetail: {
    revToday: 1680,
    mrr: 14_100,
    crashFree: 99.5,
  },
} as const;

export type DemoData = typeof demoData;
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/demo-data.ts
git commit -m "feat(mobile): WES-000 add tagged demo-data for mock-only concepts"
```

---

### Task 3: LiquidGlass primitive

**Files:**
- Create: `src/components/liquid/glass.tsx`
- Modify: `src/components/ui/liquid-glass.tsx`

- [ ] **Step 1: Create `glass.tsx`**

```typescript
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

import { colors, glass } from "~/theme/tokens";

export type GlassTone =
  | "default"
  | "lime"
  | "danger"
  | "warn"
  | "info"
  | "violet";

type Props = {
  children: ReactNode;
  tone?: GlassTone;
  radius?: number;
  padding?: number;
  glow?: string; // accent color for the inner glow spot
  deco?: ReactNode; // e.g. <CornerTicks/> — sits above frost, below content
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const toneBorder: Record<GlassTone, string> = {
  default: glass.border,
  lime: `${colors.accent}40`,
  danger: `${colors.accentDanger}45`,
  warn: `${colors.accentWarn}40`,
  info: `${colors.accentInfo}40`,
  violet: `${colors.accentViolet}42`,
};

const liquidAvailable = isLiquidGlassAvailable();

export function LiquidGlass({
  children,
  tone = "default",
  radius = glass.radius,
  padding = 16,
  glow,
  deco,
  onPress,
  style,
}: Props) {
  const shell: StyleProp<ViewStyle> = [
    {
      borderRadius: radius,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: toneBorder[tone],
      alignSelf: "stretch",
    },
    style,
  ];

  // top specular sheen (prototype .glass::before, 176deg white→transparent)
  const sheen = (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "30%",
        backgroundColor: glass.sheen,
        opacity: 0.5,
      }}
    />
  );

  const glowSpot = glow ? (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: "-15%",
        right: "-10%",
        width: "70%",
        height: "60%",
        backgroundColor: `${glow}30`,
        borderRadius: 999,
      }}
    />
  ) : null;

  const innerBody = (
    <>
      {glowSpot}
      {sheen}
      {deco}
      <View style={{ padding, position: "relative" }}>{children}</View>
    </>
  );

  const base =
    Platform.OS === "ios" && liquidAvailable ? (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        style={StyleSheet.absoluteFill}
      />
    ) : Platform.OS === "ios" ? (
      <BlurView
        intensity={glass.blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
    ) : (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated }]}
      />
    );

  const fill =
    liquidAvailable && Platform.OS === "ios" ? null : (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]}
      />
    );

  const content = (
    <>
      {base}
      {fill}
      {innerBody}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [shell, pressed && { opacity: 0.92 }]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={shell}>{content}</View>;
}
```

- [ ] **Step 2: Make the old path a compat shim**

Replace the entire contents of `src/components/ui/liquid-glass.tsx` with:

```typescript
// Compatibility shim — the panel now lives in the liquid design-system layer.
import { LiquidGlass, type GlassTone } from "~/components/liquid/glass";

export type { GlassTone };

type Props = {
  children: React.ReactNode;
  tone?: GlassTone;
  radius?: number;
  padding?: number;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
};

export function LiquidGlassPanel(props: Props) {
  return <LiquidGlass {...props} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS (existing `LiquidGlassPanel` imports across the app still resolve via the shim).

- [ ] **Step 4: Commit**

```bash
git add src/components/liquid/glass.tsx src/components/ui/liquid-glass.tsx
git commit -m "feat(mobile): WES-000 add LiquidGlass primitive (GlassView + BlurView fallback)"
```

---

### Task 4: Skia chart primitives

**Files:**
- Create: `src/components/liquid/charts.tsx`

- [ ] **Step 1: Create `charts.tsx`** (mirrors existing `spark-line.tsx` Skia usage + prototype `charts.jsx`)

```typescript
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
  Circle,
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
      <Path path={built.line} style="stroke" strokeWidth={strokeW} color={color} />
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
  const path = useMemo(() => {
    const max = Math.max(...data) || 1;
    const n = data.length;
    const bw = (width - gap * (n - 1)) / n;
    const p = Skia.Path.Make();
    data.forEach((v, i) => {
      const bh = Math.max(2, (v / max) * height);
      const r = Math.min(3, bw / 2);
      p.addRRect(
        Skia.RRectXY(Skia.XYWHRect(i * (bw + gap), height - bh, bw, bh), r, r),
      );
    });
    return p;
  }, [data, width, height, gap]);
  return (
    <Canvas style={{ width, height }}>
      <Path path={path} style="fill" color={color} opacity={0.55} />
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
          color={color}
          strokeCap="round"
          start={0}
          end={Math.max(0, Math.min(1, value / 100))}
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
      <Path path={line} style="stroke" strokeWidth={strokeW} color={color} opacity={0.9} />
    </Canvas>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS. If `Skia.RRectXY`/`XYWHRect` type names mismatch the installed Skia version, switch `Bars` to draw plain rects in a loop (`<RoundedRect>` per bar) — keep behavior identical.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/charts.tsx
git commit -m "feat(mobile): WES-000 add Skia liquid chart primitives"
```

---

### Task 5: Liquid background

**Files:**
- Create: `src/components/liquid/background.tsx`

- [ ] **Step 1: Create `background.tsx`** (static aurora blobs + faded blueprint grid; drift is an optional later polish)

```typescript
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  Canvas,
  Circle,
  RadialGradient,
  Blur,
  Group,
  Path,
  Skia,
  Rect,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";

import { colors } from "~/theme/tokens";

type Blob = { cx: number; cy: number; r: number; color: string };

export function LiquidBackground({ glow = 0.9 }: { glow?: number }) {
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
        {/* aurora blobs */}
        <Group>
          <Blur blur={60} />
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
        {/* fade the grid downward into the base */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={["rgba(7,7,10,0)", "rgba(7,7,10,0)", colors.bgBase]}
            positions={[0, 0.45, 1]}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS. If `<Blur>` as a child filter mismatches the installed Skia API, wrap blobs in `<Group layer={<Paint><Blur blur={60}/></Paint>}>` per the installed version's docs — keep the visual identical.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/background.tsx
git commit -m "feat(mobile): WES-000 add liquid aurora background"
```

---

### Task 6: Atomic primitives

**Files:**
- Create: `src/components/liquid/primitives.tsx`

- [ ] **Step 1: Create `primitives.tsx`**

```typescript
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "~/theme/tokens";

const FONT = "Geist-400";
const FONT_600 = "Geist-600";
const MONO = "GeistMono-400";
const MONO_500 = "GeistMono-500";
const MONO_600 = "GeistMono-600";

export function Eyebrow({
  children,
  color = colors.fgMuted,
  size = 10,
}: {
  children: string;
  color?: string;
  size?: number;
}) {
  return (
    <Text
      style={{
        fontFamily: MONO_500,
        fontSize: size,
        letterSpacing: size * 0.18,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </Text>
  );
}

export function Delta({
  value,
  suffix = "%",
  size = 12,
  invert = false,
}: {
  value: number;
  suffix?: string;
  size?: number;
  invert?: boolean;
}) {
  const pos = value >= 0;
  const good = invert ? !pos : pos;
  const color = good ? colors.green : colors.accentDanger;
  return (
    <Text style={{ fontFamily: MONO_600, fontSize: size, color }}>
      {pos ? "▲" : "▼"} {Math.abs(value).toFixed(1)}
      {suffix}
    </Text>
  );
}

export function Glyph({
  glyph,
  tint,
  size = 30,
}: {
  glyph: string;
  tint: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${tint}28`,
        borderWidth: 1,
        borderColor: `${tint}5C`,
      }}
    >
      <Text style={{ color: tint, fontSize: size * 0.44, fontFamily: FONT_600 }}>
        {glyph}
      </Text>
    </View>
  );
}

export function StatusDot({
  color,
  label,
}: {
  color: string;
  label?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color }}
      />
      {label ? (
        <Text
          style={{ fontFamily: MONO_500, fontSize: 10, letterSpacing: 0.6, color }}
        >
          {label.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

export function CornerTicks({
  inset = 13,
  len = 9,
  color = "rgba(255,255,255,0.22)",
  w = 1.2,
}: {
  inset?: number;
  len?: number;
  color?: string;
  w?: number;
}) {
  const h = { position: "absolute" as const, height: w, width: len, backgroundColor: color };
  const v = { position: "absolute" as const, width: w, height: len, backgroundColor: color };
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: inset, left: inset, right: inset, bottom: inset }}>
      <View style={[h, { top: 0, left: 0 }]} />
      <View style={[v, { top: 0, left: 0 }]} />
      <View style={[h, { top: 0, right: 0 }]} />
      <View style={[v, { top: 0, right: 0 }]} />
      <View style={[h, { bottom: 0, left: 0 }]} />
      <View style={[v, { bottom: 0, left: 0 }]} />
      <View style={[h, { bottom: 0, right: 0 }]} />
      <View style={[v, { bottom: 0, right: 0 }]} />
    </View>
  );
}

// rAF count-up with timer fallback (mirrors prototype CountUp)
export function CountUp({
  value,
  format,
  style,
  duration = 900,
}: {
  value: number;
  format: (n: number) => string;
  style?: object;
  duration?: number;
}) {
  const [v, setV] = useState(value);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    let start: number | null = null;
    let done = false;
    setV(0);
    const finish = () => {
      if (!done) {
        done = true;
        setV(value);
      }
    };
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else finish();
    };
    raf.current = requestAnimationFrame(step);
    const fb = setTimeout(finish, duration + 250);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      clearTimeout(fb);
    };
  }, [value, duration]);
  return <Text style={style}>{format(v)}</Text>;
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  full = false,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  full?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        alignSelf: full ? "stretch" : "flex-start",
      }}
    >
      {options.map((k) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={{
              flex: full ? 1 : undefined,
              paddingVertical: 5,
              paddingHorizontal: 12,
              borderRadius: 999,
              alignItems: "center",
              backgroundColor: on ? "rgba(255,255,255,0.12)" : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: MONO_500,
                fontSize: 11,
                color: on ? colors.fgPrimary : colors.fgMuted,
              }}
            >
              {k}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActionBtn({
  label,
  tone = "default",
  onPress,
}: {
  label: string;
  tone?: "default" | "accent" | "danger";
  onPress?: () => void;
}) {
  const fg =
    tone === "accent" ? colors.accentInk : tone === "danger" ? colors.accentDanger : colors.fgSecondary;
  const bg =
    tone === "accent" ? colors.accent : tone === "danger" ? `${colors.accentDanger}1F` : "rgba(255,255,255,0.06)";
  const bd =
    tone === "accent" ? "transparent" : tone === "danger" ? `${colors.accentDanger}59` : "rgba(255,255,255,0.1)";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 9,
        borderRadius: 10,
        alignItems: "center",
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: bd,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontFamily: MONO_600, fontSize: 10.5, letterSpacing: 0.6, color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingVertical: 9,
        paddingHorizontal: 12,
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.fgSubtle}
        style={{ flex: 1, color: colors.fgPrimary, fontFamily: FONT, fontSize: 13, padding: 0 }}
      />
    </View>
  );
}

export function EmptyHint({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: MONO_500,
        fontSize: 10.5,
        letterSpacing: 0.6,
        color: colors.fgSubtle,
        textAlign: "center",
        paddingVertical: 20,
      }}
    >
      {children}
    </Text>
  );
}

// small DEMO chip — required next to any demo-sourced value
export function DemoChip() {
  return (
    <View
      style={{
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: `${colors.accentWarn}22`,
        borderWidth: 1,
        borderColor: `${colors.accentWarn}55`,
      }}
    >
      <Text style={{ fontFamily: MONO_600, fontSize: 7.5, letterSpacing: 1, color: colors.accentWarn }}>
        DEMO
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/primitives.tsx
git commit -m "feat(mobile): WES-000 add liquid atomic primitives"
```

---

### Task 7: OpenHero

**Files:**
- Create: `src/components/liquid/hero.tsx`

- [ ] **Step 1: Create `hero.tsx`**

```typescript
import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { colors } from "~/theme/tokens";
import { AreaChart, Ring } from "~/components/liquid/charts";
import { CountUp, Delta, Eyebrow } from "~/components/liquid/primitives";

const MONO_600 = "GeistMono-600";

export type HeroStat = {
  label: string;
  value: string;
  delta?: number;
  invert?: boolean;
};

export function Sep() {
  return (
    <View
      style={{ width: 1, alignSelf: "stretch", marginHorizontal: 2, backgroundColor: "rgba(255,255,255,0.08)" }}
    />
  );
}

export function MiniStat({ label, value, delta, invert }: HeroStat) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Eyebrow size={9}>{label}</Eyebrow>
      <Text style={{ fontFamily: MONO_600, fontSize: 16, color: colors.fgPrimary, letterSpacing: -0.3 }}>
        {value}
      </Text>
      {delta != null ? <Delta value={delta} size={10} invert={invert} /> : null}
    </View>
  );
}

export function OpenHero({
  eyebrow,
  live = false,
  right,
  value,
  format,
  delta,
  deltaInvert,
  caption,
  chartWidth,
  chartData,
  chartEl,
  color = colors.accent,
  chartH = 96,
  stats,
  ring,
}: {
  eyebrow: string;
  live?: boolean;
  right?: ReactNode;
  value: number;
  format: (n: number) => string;
  delta?: number;
  deltaInvert?: boolean;
  caption?: string;
  chartWidth: number;
  chartData?: number[];
  chartEl?: ReactNode;
  color?: string;
  chartH?: number;
  stats?: HeroStat[];
  ring?: { value: number; color: string };
}) {
  return (
    <View style={{ paddingHorizontal: 6, paddingTop: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {live ? (
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.accent }} />
          ) : null}
          <Eyebrow color={live ? colors.accent : colors.fgMuted}>{eyebrow}</Eyebrow>
        </View>
        {right}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            <CountUp
              value={value}
              format={format}
              style={{
                fontFamily: MONO_600,
                fontSize: ring ? 46 : 56,
                lineHeight: ring ? 50 : 60,
                letterSpacing: -2,
                color: colors.fgPrimary,
              }}
            />
            {delta != null ? (
              <View style={{ marginBottom: ring ? 6 : 9 }}>
                <Delta value={delta} size={13} invert={deltaInvert} />
              </View>
            ) : null}
          </View>
          {caption ? (
            <View style={{ marginTop: 9 }}>
              <Eyebrow color={colors.fgMuted}>{caption}</Eyebrow>
            </View>
          ) : null}
        </View>
        {ring ? (
          <Ring value={ring.value} size={82} stroke={8} color={ring.color}>
            <Text style={{ fontFamily: MONO_600, fontSize: 16, color: colors.fgPrimary }}>
              {ring.value}%
            </Text>
          </Ring>
        ) : null}
      </View>

      {chartEl ? (
        <View style={{ marginTop: 16 }}>{chartEl}</View>
      ) : chartData ? (
        <View style={{ marginTop: 16 }}>
          <AreaChart data={chartData} width={chartWidth} height={chartH} color={color} />
        </View>
      ) : null}

      {stats ? (
        <View
          style={{
            flexDirection: "row",
            marginTop: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.08)",
          }}
        >
          {stats.map((s, i) => (
            <View key={s.label} style={{ flex: 1, flexDirection: "row" }}>
              {i > 0 ? <Sep /> : null}
              <MiniStat {...s} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/hero.tsx
git commit -m "feat(mobile): WES-000 add OpenHero + mini-stats"
```

---

### Task 8: CardSection + expandable Row

**Files:**
- Create: `src/components/liquid/card.tsx`

- [ ] **Step 1: Create `card.tsx`**

```typescript
import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors } from "~/theme/tokens";

const FONT_600 = "Geist-600";
const MONO_500 = "GeistMono-500";

export function FullDivider() {
  return <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />;
}

export function CardSection({
  index,
  title,
  count,
  action,
  onAction,
  pt = 15,
  children,
}: {
  index?: string;
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
  pt?: number;
  children: ReactNode;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          paddingTop: pt,
          paddingBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        {index ? (
          <Text style={{ fontFamily: MONO_500, fontSize: 10, color: colors.fgSubtle, letterSpacing: 0.5 }}>
            {index}
          </Text>
        ) : null}
        <Text style={{ fontFamily: FONT_600, fontSize: 12.5, color: colors.fgPrimary, letterSpacing: -0.2 }}>
          {title}
        </Text>
        {count != null ? (
          <View
            style={{
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 5,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ fontFamily: MONO_500, fontSize: 9.5, color: colors.fgMuted }}>{count}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
        {action ? (
          <Pressable onPress={onAction} hitSlop={6}>
            <Text style={{ fontFamily: MONO_500, fontSize: 10, color: colors.accent, letterSpacing: 0.4 }}>
              {action} →
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(0);
  r.value = withTiming(open ? 90 : 0, { duration: 220 });
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Text style={{ color: colors.fgSubtle, fontSize: 12 }}>›</Text>
    </Animated.View>
  );
}

export function Row({
  open,
  onToggle,
  header,
  detail,
  isLast = false,
  dimmed = false,
}: {
  open: boolean;
  onToggle: () => void;
  header: ReactNode;
  detail?: ReactNode;
  isLast?: boolean;
  dimmed?: boolean;
}) {
  return (
    <View
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.055)",
        opacity: dimmed ? 0.5 : 1,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 11,
          paddingLeft: 16,
          paddingRight: 14,
          backgroundColor: pressed ? "rgba(255,255,255,0.03)" : "transparent",
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>{header}</View>
        <Chevron open={open} />
      </Pressable>
      {open && detail ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 12 }}>{detail}</View>
      ) : null}
    </View>
  );
}

export function KV({
  items,
}: {
  items: { label: string; value: string; color?: string; full?: boolean }[];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.035)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 14,
        paddingVertical: 4,
      }}
    >
      {items.map((it, i) => (
        <View key={i} style={{ width: it.full ? "100%" : "50%", paddingVertical: 8 }}>
          <Text style={{ fontFamily: MONO_500, fontSize: 8.5, letterSpacing: 1.4, textTransform: "uppercase", color: colors.fgMuted }}>
            {it.label}
          </Text>
          <Text style={{ fontFamily: "GeistMono-600", fontSize: 13, color: it.color ?? colors.fgPrimary, marginTop: 3 }}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/liquid/card.tsx
git commit -m "feat(mobile): WES-000 add CardSection + expandable Row + KV"
```

---

### Task 9: LiquidHeader + barrel

**Files:**
- Create: `src/components/liquid/header.tsx`
- Create: `src/components/liquid/index.ts`

- [ ] **Step 1: Create `header.tsx`** (reuses the existing property picker + alerts button)

```typescript
import { Text, View } from "react-native";

import { colors } from "~/theme/tokens";
import { PropertyPicker } from "~/components/property-picker";
import { HeaderAlertsButton } from "~/components/header-alerts-button";

export function LiquidHeader({ showPicker = true }: { showPicker?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 13 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "GeistMono-600", fontSize: 15, color: colors.accentInk }}>h</Text>
          </View>
          <Text style={{ fontFamily: "Geist-600", fontSize: 17, color: colors.fgPrimary, letterSpacing: -0.3 }}>
            helm
          </Text>
          <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.accent, marginLeft: 1 }} />
        </View>

        {showPicker ? <PropertyPicker /> : <View style={{ flex: 1 }} />}

        <HeaderAlertsButton />
      </View>
      <View
        style={{
          height: 1,
          marginTop: 13,
          backgroundColor: "rgba(255,255,255,0.10)",
        }}
      />
    </View>
  );
}
```

> NOTE: If `PropertyPicker` / `HeaderAlertsButton` require props, open each file and pass what they need. If the existing `PropertyPicker` doesn't lay out well inline, wrap it in `<View style={{ flexShrink: 1 }}>`. Do not rebuild them — reuse.

- [ ] **Step 2: Create the barrel `index.ts`**

```typescript
export { LiquidGlass } from "./glass";
export type { GlassTone } from "./glass";
export { LiquidBackground } from "./background";
export { AreaChart, Bars, Ring, HBar, StackBar, Spark } from "./charts";
export {
  Eyebrow,
  Delta,
  Glyph,
  StatusDot,
  CornerTicks,
  CountUp,
  Seg,
  ActionBtn,
  SearchInput,
  EmptyHint,
  DemoChip,
} from "./primitives";
export { OpenHero, MiniStat, Sep } from "./hero";
export type { HeroStat } from "./hero";
export { CardSection, FullDivider, Row, KV } from "./card";
export { LiquidHeader } from "./header";
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/liquid/header.tsx src/components/liquid/index.ts
git commit -m "feat(mobile): WES-000 add LiquidHeader + liquid barrel exports"
```

---

### Task 10: Overview screen

**Files:**
- Create: `app/(cockpit)/overview.tsx`

> Maps the prototype's Overview to real hooks (`useCockpitKpis`, `useMetricDetail`, `useAlerts`, `useAckAlert`, `useProperties`) + `demoData`. Project-row metric details are demo-tagged (no per-row hooks — avoids N+1 / rules-of-hooks). Kind filter maps `Property.type`: Games=`game`, Apps=`*_app`, Web=`website`.

- [ ] **Step 1: Create `overview.tsx`**

```typescript
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useAlerts, useAckAlert, type Alert } from "~/hooks/use-alerts";
import { useProperties, type Property } from "~/hooks/use-properties";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { usePreferences } from "~/lib/preferences";
import { demoData } from "~/lib/demo-data";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";
import { ScreenStatus } from "~/components/screen-status";
import {
  LiquidBackground,
  LiquidHeader,
  LiquidGlass,
  OpenHero,
  CardSection,
  FullDivider,
  Row,
  KV,
  HBar,
  Spark,
  Seg,
  ActionBtn,
  StatusDot,
  Glyph,
  Eyebrow,
  EmptyHint,
  DemoChip,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

const PROJECT_TINTS = [colors.accent, colors.accentViolet, colors.blue, colors.green, colors.accentWarn];
const PROJECT_GLYPHS = ["◆", "✦", "❖", "◇", "●"];

type Kind = "All" | "Games" | "Apps" | "Web";

function statusColor(s: Property["status"]): string {
  return s === "healthy" ? colors.green : s === "down" ? colors.accentDanger : colors.accentWarn;
}
function statusLabel(s: Property["status"]): string {
  return s === "healthy" ? "Healthy" : s === "down" ? "Down" : "Watch";
}
function matchesKind(p: Property, k: Kind): boolean {
  if (k === "All") return true;
  if (k === "Games") return p.type === "game";
  if (k === "Web") return p.type === "website" || p.type === "web_app";
  return p.type === "mobile_app" || p.type === "desktop_app";
}

function ProjectRows({ fmt }: { fmt: (n: number) => string }) {
  const properties = useProperties();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Kind>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [muted, setMuted] = useState<Record<string, boolean>>({});

  const list = useMemo(
    () => (properties.data ?? []).filter((p) => matchesKind(p, filter)),
    [properties.data, filter],
  );

  return (
    <View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <Seg<Kind>
          value={filter}
          options={["All", "Games", "Apps", "Web"]}
          onChange={(v) => {
            setFilter(v);
            setOpenId(null);
          }}
          full
        />
      </View>
      {list.length === 0 ? (
        <EmptyHint>NO PROJECTS IN THIS GROUP</EmptyHint>
      ) : (
        list.map((p, i) => {
          const open = openId === p.id;
          const tint = PROJECT_TINTS[i % PROJECT_TINTS.length]!;
          const glyph = PROJECT_GLYPHS[i % PROJECT_GLYPHS.length]!;
          return (
            <Row
              key={p.id}
              open={open}
              onToggle={() => setOpenId(open ? null : p.id)}
              isLast={i === list.length - 1}
              header={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Glyph glyph={glyph} tint={tint} size={30} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Text style={{ fontFamily: "Geist-600", fontSize: 14, color: colors.fgPrimary, letterSpacing: -0.2 }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <StatusDot color={statusColor(p.status)} />
                    </View>
                    <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.4 }} numberOfLines={1}>
                      {(p.brandName ?? p.type).toUpperCase()}
                    </Text>
                  </View>
                  <StatusDot color={statusColor(p.status)} label={statusLabel(p.status)} />
                </View>
              }
              detail={
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Eyebrow size={8}>METRICS</Eyebrow>
                    <DemoChip />
                  </View>
                  <KV
                    items={[
                      { label: "Revenue today", value: fmt(demoData.projectDetail.revToday), color: colors.accent },
                      { label: "MRR", value: fmt(demoData.projectDetail.mrr), color: colors.accentViolet },
                      { label: "Status", value: statusLabel(p.status), color: statusColor(p.status) },
                      { label: "Crash-free", value: demoData.projectDetail.crashFree + "%", color: colors.green },
                    ]}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <ActionBtn label="OPEN DETAIL" tone="accent" onPress={() => haptic.tap()} />
                    <ActionBtn
                      label={muted[p.id] ? "ALERTS MUTED" : "MUTE ALERTS"}
                      onPress={() => setMuted((m) => ({ ...m, [p.id]: !m[p.id] }))}
                    />
                  </View>
                </>
              }
            />
          );
        })
      )}
    </View>
  );
}

function AlertRows() {
  const alerts = useAlerts();
  const ack = useAckAlert();
  const [openId, setOpenId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});

  const list = (alerts.data ?? []).filter((a) => !dismissed[a.id]);
  if (list.length === 0) return <EmptyHint>ALL CLEAR · NO OPEN ALERTS</EmptyHint>;

  return (
    <View>
      {list.map((a: Alert, i) => {
        const open = openId === a.id;
        const sev = a.severity === "critical" ? colors.accentDanger : a.severity === "warn" ? colors.accentWarn : colors.accentInfo;
        return (
          <View key={a.id} style={{ flexDirection: "row", borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.055)" }}>
            <View style={{ width: 3, backgroundColor: sev, opacity: a.severity === "critical" ? 1 : 0.7 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Row
                open={open}
                onToggle={() => setOpenId(open ? null : a.id)}
                isLast
                header={
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ flex: 1, fontFamily: "Geist-600", fontSize: 12.5, color: colors.fgPrimary, letterSpacing: -0.2 }} numberOfLines={1}>
                        {a.ruleName}
                      </Text>
                      <Text style={{ fontFamily: "GeistMono-500", fontSize: 10, color: colors.fgSubtle }}>
                        {formatRelativeTime(a.triggeredAt)}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.4 }} numberOfLines={1}>
                      {a.metric.toUpperCase()} · {a.condition.toUpperCase()}
                    </Text>
                  </View>
                }
                detail={
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <ActionBtn
                      label="RESOLVE"
                      tone="accent"
                      onPress={() => {
                        haptic.tap();
                        ack.mutate(a.id);
                        setDismissed((d) => ({ ...d, [a.id]: true }));
                      }}
                    />
                    <ActionBtn label="MUTE" onPress={() => setDismissed((d) => ({ ...d, [a.id]: true }))} />
                  </View>
                }
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function Overview() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;
  const fmt = useFormatCurrency();
  const kpis = useCockpitKpis();
  const alerts = useAlerts();
  const revenue = useMetricDetail("ad_revenue");

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data) return <ScreenStatus label="Cockpit yüklenemedi" tone="danger" />;

  const data = kpis.data;
  const series = (revenue.data?.series ?? []).map((p) => p.value);
  const today = revenue.data?.today ?? data.adRevenue;
  const yest = revenue.data?.yesterday ?? 0;
  const revDelta = yest > 0 ? ((today - yest) / yest) * 100 : 0;
  const goalPct = Math.round((demoData.goal.current / demoData.goal.target) * 100);

  const stats: HeroStat[] = [
    { label: "DAU", value: formatInteger(data.dau), delta: data.dauDelta ?? undefined },
    { label: "Crash-free", value: demoData.crashFree + "%", delta: demoData.crashFreeDelta, invert: true },
    { label: "MRR", value: fmt(data.mrr), delta: data.mrrDelta ?? undefined },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 18 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              tintColor={colors.fgPrimary}
              refreshing={kpis.isRefetching}
              onRefresh={() => {
                haptic.tap();
                kpis.refetch();
                alerts.refetch();
                revenue.refetch();
              }}
            />
          }
        >
          <OpenHero
            eyebrow="Today"
            live
            value={today}
            format={(v) => fmt(v)}
            delta={Number(revDelta.toFixed(1))}
            caption="Revenue · all projects"
            chartWidth={chartW}
            chartData={series.length >= 2 ? series : [today, today]}
            color={colors.accent}
            chartH={92}
            stats={stats}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.accent }} />
                <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgSecondary, letterSpacing: 0.4 }}>
                  {formatInteger(data.dau)} ACTIVE
                </Text>
              </View>
            }
          />

          {/* monthly goal — DEMO */}
          <LiquidGlass padding={14}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Eyebrow>{demoData.goal.label}</Eyebrow>
                <DemoChip />
              </View>
              <Text style={{ fontFamily: "GeistMono-500", fontSize: 11.5, color: colors.fgSecondary }}>
                <Text style={{ color: colors.fgPrimary, fontFamily: "GeistMono-600" }}>{fmt(demoData.goal.current)}</Text> / {fmt(demoData.goal.target)}
              </Text>
            </View>
            <HBar pct={goalPct} color={colors.accent} height={8} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.accent, letterSpacing: 0.4 }}>{goalPct}% REACHED</Text>
            </View>
          </LiquidGlass>

          {/* projects + needs attention */}
          <LiquidGlass padding={0}>
            <CardSection index="01" title="Projects" count={(useProperties as never) ? undefined : undefined} pt={14}>
              <ProjectRows fmt={fmt} />
            </CardSection>
            <FullDivider />
            <CardSection index="02" title="Needs attention" count={(alerts.data ?? []).length}>
              <AlertRows />
              <View style={{ height: 4 }} />
            </CardSection>
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
```

> CLEANUP IN STEP: delete the bogus `count={(useProperties as never)...}` expression on the `Projects` `CardSection` — it was a placeholder for a count. Replace that whole `count=` prop with nothing (omit it), OR lift `const properties = useProperties()` into the `Overview` component and pass `count={(properties.data ?? []).length}`. Do the latter: add `const properties = useProperties();` near the other hooks in `Overview`, pass `count={(properties.data ?? []).length}`, and pass `properties` down to `<ProjectRows properties={properties} fmt={fmt} />` so the list isn't fetched twice. Update `ProjectRows` signature to `({ properties, fmt }: { properties: ReturnType<typeof useProperties>; fmt: (n: number) => string })` and remove its internal `useProperties()` call.

- [ ] **Step 2: Apply the cleanup described above**

Final `Overview` hook block:
```typescript
  const kpis = useCockpitKpis();
  const alerts = useAlerts();
  const properties = useProperties();
  const revenue = useMetricDetail("ad_revenue");
```
Final Projects section:
```tsx
<CardSection index="01" title="Projects" count={(properties.data ?? []).length} pt={14}>
  <ProjectRows properties={properties} fmt={fmt} />
</CardSection>
```
And `ProjectRows` takes `properties` as a prop (no internal fetch).

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS. Resolve any hook field-name mismatches against the actual hook source (e.g. confirm `useMetricDetail` returns `{ today, yesterday, series }`, `Alert` has `ruleName/metric/condition/triggeredAt/severity`, `Property` has `name/type/status/brandName`). Fix names to match real sources; do not invent fields.

- [ ] **Step 4: Visual check**

Run the app on an iOS 26 device/simulator (`bun run ios`), land on Overview. Confirm: glass header + aurora background render; hero number counts up to today's revenue; DAU/MRR mini-stats show real values; Crash-free + goal show a `DEMO` chip; project rows expand with KV + actions; type filter narrows the list; alert rows expand and `RESOLVE` removes the row.

- [ ] **Step 5: Commit**

```bash
git add app/(cockpit)/overview.tsx
git commit -m "feat(mobile-cockpit): WES-000 add liquid glass Overview screen"
```

---

### Task 11: Switch tab bar to 5 tabs + placeholders

**Files:**
- Modify: `app/(cockpit)/_layout.tsx`
- Create: `app/(cockpit)/revenue.tsx`, `analytics.tsx`, `health.tsx`, `settings.tsx`

- [ ] **Step 1: Create the placeholder screen (one file, reused shape)**

Create `app/(cockpit)/revenue.tsx`:
```typescript
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LiquidBackground, LiquidHeader } from "~/components/liquid";
import { colors } from "~/theme/tokens";

export default function Revenue() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "GeistMono-500", fontSize: 12, letterSpacing: 2, color: colors.fgMuted }}>
            REVENUE · COMING NEXT
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
```

Create `analytics.tsx`, `health.tsx`, `settings.tsx` identically, changing only the component name and the label string (`ANALYTICS · COMING NEXT`, `HEALTH · COMING NEXT`, `SETTINGS · COMING NEXT`). For `settings.tsx` pass `<LiquidHeader showPicker={false} />`.

- [ ] **Step 2: Rewrite `_layout.tsx`**

```typescript
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAlerts } from "~/hooks/use-alerts";
import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useWidgetSync } from "~/hooks/use-widget-sync";
import { colors } from "~/theme/tokens";

export default function CockpitLayout() {
  const kpis = useCockpitKpis();
  useWidgetSync(kpis.data);
  const alerts = useAlerts();
  const openCount = (alerts.data ?? []).filter((a) => !a.delivered).length;

  return (
    <NativeTabs
      labelStyle={{ fontFamily: "GeistMono-500", fontSize: 10 }}
      tintColor={colors.accent}
      blurEffect="systemChromeMaterialDark"
    >
      <NativeTabs.Trigger name="overview">
        <NativeTabs.Trigger.Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} />
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="revenue">
        <NativeTabs.Trigger.Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} />
        <NativeTabs.Trigger.Label>Revenue</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <NativeTabs.Trigger.Label>Analytics</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="health">
        <NativeTabs.Trigger.Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <NativeTabs.Trigger.Label>Health</NativeTabs.Trigger.Label>
        {openCount > 0 ? <NativeTabs.Trigger.Badge>{String(openCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 3: Update the auth-gate redirect target**

The app redirects to `/(cockpit)/(home)` in two places. Update both to `/(cockpit)/overview`:
- `src/lib/auth-gate.tsx` — find the post-login redirect and change `(home)` → `overview`.
- `app/index.tsx` — find the authed redirect and change `(home)` → `overview`.

Search command to locate them:
```bash
grep -rn "(cockpit)/(home)" app src
```
Change each match's target to `"/(cockpit)/overview"`.

- [ ] **Step 4: Typecheck + boot**

Run: `bun run typecheck` → PASS.
Run: `bun run ios` → app boots to Overview; all 5 tabs switch; Revenue/Analytics/Health/Settings show their "COMING NEXT" placeholder; Health tab shows the alert badge.

- [ ] **Step 5: Commit**

```bash
git add app/(cockpit)/_layout.tsx app/(cockpit)/revenue.tsx app/(cockpit)/analytics.tsx app/(cockpit)/health.tsx app/(cockpit)/settings.tsx src/lib/auth-gate.tsx app/index.tsx
git commit -m "feat(mobile): WES-000 switch to 5-tab liquid IA with placeholders"
```

---

### Task 12: Remove old route trees

**Files:**
- Delete: `app/(cockpit)/(home)/`, `app/(cockpit)/(growth)/`, `app/(cockpit)/(reviews)/`, `app/(cockpit)/more/`

- [ ] **Step 1: Confirm nothing else imports the old screens**

Run:
```bash
grep -rn "(cockpit)/(home)\|(cockpit)/(growth)\|(cockpit)/(reviews)\|(cockpit)/more" app src
```
Expected: no remaining references (Task 11 already fixed redirects). If any router `push`/`href` still targets `more/alerts`, `more/errors`, etc., those are deep links into screens that no longer exist — for this slice, repoint them to the relevant new tab (`/(cockpit)/health` or `/(cockpit)/overview`) or remove the navigation. List each and fix.

- [ ] **Step 2: Delete the old route directories**

```bash
git rm -r "app/(cockpit)/(home)" "app/(cockpit)/(growth)" "app/(cockpit)/(reviews)" "app/(cockpit)/more"
```

- [ ] **Step 3: Typecheck + boot**

Run: `bun run typecheck` → PASS.
Run: `bun run ios` → app still boots to Overview, all tabs work, no dead-link crashes.

> Components that were ONLY used by the deleted screens (e.g. `kpi-tile`, `rich-metric-tile`, `module-card`, `projects-breakdown`, `rating-histogram`, etc.) may now be unreferenced. Do NOT delete them in this slice — Revenue/Analytics/Health builds may reuse them. Leaving them is harmless; `tsc` does not fail on unused files. (A dead-code sweep is a later slice.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(mobile): WES-000 remove legacy 4-tab route trees"
```

---

## Self-Review (completed during authoring)

**Spec coverage:**
- Tokens/glass recipe → Task 1 ✓
- Hybrid demo data, tagged → Task 2 + DemoChip (Task 6) + used in Task 10 ✓
- LiquidGlass GlassView+BlurView fallback → Task 3 ✓
- Charts (Area/Bars/Ring/HBar/StackBar/Spark) → Task 4 ✓
- LiquidBackground (blobs+grid) → Task 5 ✓ (drift noted optional, per spec "transform-only" safety)
- Primitives + layout (OpenHero/CardSection/Row/KV/Seg/etc.) → Tasks 6–8 ✓
- LiquidHeader reusing existing picker/alerts button → Task 9 ✓
- Overview data mapping table → Task 10 ✓ (hero=ad_revenue, DAU/MRR real, crash-free+goal+project-detail DEMO, alerts real w/ ack)
- Native tab bar kept, 5 tabs, SF icons → Task 11 ✓
- Replace + remove old IA → Tasks 11–12 ✓

**Placeholder scan:** Task 10 intentionally contains a wrong-on-purpose `count=` expression that Step 1's inline NOTE + Step 2 explicitly fix — this is a guided refactor, not a silent placeholder. No other TBD/TODO.

**Type consistency:** `GlassTone` defined in Task 3, re-exported Task 9, consumed Task 10. `HeroStat` defined Task 7, consumed Tasks 7+10. `Kind` local to Overview. Chart prop names consistent between Task 4 defs and Task 7/10 uses. Hook field names are flagged in Task 10 Step 3 to be verified against real sources (the plan must not invent fields).

**Known verification points handed to the implementer (not guesses):**
- Skia `Bars`/`Blur` API shape (Task 4/5 fallbacks given).
- `useMetricDetail`/`Alert`/`Property` exact field names (Task 10 Step 3).
- `PropertyPicker`/`HeaderAlertsButton` prop requirements (Task 9 NOTE).
