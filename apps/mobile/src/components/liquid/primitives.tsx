import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, glass, space, type } from "~/theme/tokens";

const FONT = "Geist-400";
const FONT_600 = "Geist-600";
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
  const h = {
    position: "absolute" as const,
    height: w,
    width: len,
    backgroundColor: color,
  };
  const v = {
    position: "absolute" as const,
    width: w,
    height: len,
    backgroundColor: color,
  };
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: inset, left: inset, right: inset, bottom: inset }}
    >
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
  duration = 800,
  fitOneLine = false,
}: {
  value: number;
  format: (n: number) => string;
  style?: object;
  duration?: number;
  fitOneLine?: boolean;
}) {
  const [v, setV] = useState(0);
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
  return (
    <Text
      style={style}
      numberOfLines={fitOneLine ? 1 : undefined}
      adjustsFontSizeToFit={fitOneLine}
    >
      {format(v)}
    </Text>
  );
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
        padding: space.xs2,
        borderRadius: 999,
        backgroundColor: glass.tint,
        borderWidth: 1,
        borderColor: glass.sheen,
        alignSelf: full ? "stretch" : "flex-start",
      }}
    >
      {options.map((k) => {
        const on = value === k;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            style={({ pressed }) => ({
              flex: full ? 1 : undefined,
              paddingVertical: space.xs,
              paddingHorizontal: space.md,
              borderRadius: 999,
              alignItems: "center",
              opacity: pressed && !on ? 0.85 : 1,
              backgroundColor: on ? "rgba(255,255,255,0.12)" : "transparent",
            })}
          >
            <Text
              style={{
                fontFamily: MONO_500,
                fontSize: type.bodySm,
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
    tone === "accent"
      ? colors.accentInk
      : tone === "danger"
        ? colors.accentDanger
        : colors.fgSecondary;
  const bg =
    tone === "accent"
      ? colors.accent
      : tone === "danger"
        ? `${colors.accentDanger}1F`
        : glass.tint;
  const bd =
    tone === "accent"
      ? "transparent"
      : tone === "danger"
        ? `${colors.accentDanger}59`
        : glass.border;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: space.sm,
        borderRadius: glass.radiusSm,
        alignItems: "center",
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: bd,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontFamily: MONO_600, fontSize: type.label, letterSpacing: 0.6, color: fg }}>
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
        gap: space.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        marginHorizontal: space.md,
        marginBottom: space.sm,
        borderRadius: glass.radiusSm,
        backgroundColor: glass.tint,
        borderWidth: 1,
        borderColor: glass.border,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.fgSubtle}
        style={{ flex: 1, color: colors.fgPrimary, fontFamily: FONT, fontSize: type.body, padding: 0 }}
      />
    </View>
  );
}

export function EmptyHint({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: MONO_500,
        fontSize: type.label,
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

// condensed-list footer: keep lists glanceable (top-N), expand on demand.
export function ShowMore({
  hidden,
  expanded,
  onPress,
}: {
  hidden: number;
  expanded: boolean;
  onPress: () => void;
}) {
  if (hidden <= 0) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 11,
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Text style={{ fontFamily: MONO_500, fontSize: 11, color: colors.fgMuted, letterSpacing: 0.4 }}>
        {expanded ? "Show less" : `+ ${hidden} more`}
      </Text>
      <Text style={{ fontFamily: MONO_500, fontSize: 10, color: colors.fgSubtle }}>{expanded ? "↑" : "↓"}</Text>
    </Pressable>
  );
}

// star rating row (reviews)
export function Stars({ n, size = 11 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1.5 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={{ fontSize: size, color: i <= n ? colors.accentWarn : colors.fgSubtle, lineHeight: size + 2 }}
        >
          {i <= n ? "★" : "☆"}
        </Text>
      ))}
    </View>
  );
}

// settings toggle — thumb travels via transform (not a layout-prop flip)
const TOGGLE_TRAVEL = 18; // 44 width − 2×2 pad − 20 thumb
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(on ? TOGGLE_TRAVEL : 0);
  useEffect(() => {
    x.value = reduced ? (on ? TOGGLE_TRAVEL : 0) : withTiming(on ? TOGGLE_TRAVEL : 0, { duration: 200 });
  }, [on, reduced, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={({ pressed }) => ({
        width: 44,
        height: 26,
        borderRadius: 99,
        backgroundColor: on ? colors.accent : "rgba(255,255,255,0.13)",
        padding: space.xs2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Animated.View style={[{ width: 20, height: 20, borderRadius: 99, backgroundColor: "#fff" }, thumb]} />
    </Pressable>
  );
}

// small DEMO chip — required next to any demo-sourced value
export function DemoChip() {
  return (
    <View
      style={{
        paddingHorizontal: space.xs,
        paddingVertical: 1,
        borderRadius: 6,
        backgroundColor: `${colors.accentWarn}22`,
        borderWidth: 1,
        borderColor: `${colors.accentWarn}55`,
      }}
    >
      <Text style={{ fontFamily: MONO_600, fontSize: type.label, letterSpacing: 1, color: colors.accentWarn }}>
        DEMO
      </Text>
    </View>
  );
}
