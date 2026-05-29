import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "~/theme/tokens";

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
        : "rgba(255,255,255,0.06)";
  const bd =
    tone === "accent"
      ? "transparent"
      : tone === "danger"
        ? `${colors.accentDanger}59`
        : "rgba(255,255,255,0.1)";
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
