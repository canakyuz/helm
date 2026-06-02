import { useEffect, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, glass, space, type } from "~/theme/tokens";

const FONT_600 = "Geist-600";
const MONO_500 = "GeistMono-500";
const MONO_600 = "GeistMono-600";

export function FullDivider() {
  return <View style={{ height: 1, backgroundColor: glass.hairline }} />;
}

export function CardSection({
  index,
  title,
  count,
  action,
  onAction,
  pt = 16,
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
          gap: 8,
          paddingTop: pt,
          paddingBottom: 8,
          paddingHorizontal: 16,
        }}
      >
        {index ? (
          <Text style={{ fontFamily: MONO_500, fontSize: 10, color: colors.fgSubtle, letterSpacing: 0.5 }}>
            {index}
          </Text>
        ) : null}
        <Text style={{ fontFamily: FONT_600, fontSize: type.emph, color: colors.fgPrimary, letterSpacing: -0.2 }}>
          {title}
        </Text>
        {count != null ? (
          <View
            style={{
              paddingHorizontal: space.xs,
              paddingVertical: 1,
              borderRadius: 6,
              backgroundColor: glass.tint,
              borderWidth: 1,
              borderColor: glass.hairline,
            }}
          >
            <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgMuted }}>{count}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, height: 1, backgroundColor: glass.sheen }} />
        {action ? (
          <Pressable
            onPress={onAction}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.accent, letterSpacing: 0.4 }}>
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
  const r = useSharedValue(open ? 90 : 0);
  useEffect(() => {
    r.value = withTiming(open ? 90 : 0, { duration: 220 });
  }, [open, r]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Text style={{ color: colors.fgMuted, fontSize: type.bodySm }}>›</Text>
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
        borderBottomColor: glass.hairline,
        opacity: dimmed ? 0.5 : 1,
        flexDirection: "column",
        gap: space.md,
        paddingHorizontal: space.md,
        justifyContent: "center",
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          opacity: pressed ? 0.85 : 1,
          backgroundColor: pressed ? glass.tint : "transparent",
        })}
      >
        <View style={{ flex: 1, minWidth: 0 }}>{header}</View>
        <Chevron open={open} />
      </Pressable>
      {open && detail ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>{detail}</View>
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
        borderRadius: glass.radiusSm,
        backgroundColor: glass.tint,
        borderWidth: 1,
        borderColor: glass.hairline,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        marginHorizontal: 0,
        marginVertical: 0,
      }}
    >
      {items.map((it, i) => (
        <View key={i} style={{ width: it.full ? "100%" : "50%", paddingVertical: space.sm }}>
          <Text
            style={{
              fontFamily: MONO_500,
              fontSize: type.label,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: colors.fgMuted,
            }}
          >
            {it.label}
          </Text>
          <Text style={{ fontFamily: MONO_600, fontSize: type.body, color: it.color ?? colors.fgPrimary, marginTop: space.xs2 }}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
