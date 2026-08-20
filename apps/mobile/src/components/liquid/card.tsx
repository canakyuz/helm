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
  return <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />;
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
  const r = useSharedValue(open ? 90 : 0);
  useEffect(() => {
    r.value = withTiming(open ? 90 : 0, { duration: 220 });
  }, [open, r]);
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
        flexDirection: "column",
        gap: 12,
        paddingHorizontal: 12,
        justifyContent: "center",
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          paddingVertical: 11,
          paddingLeft: 16,
          paddingRight: 14,
          backgroundColor: pressed ? "rgba(255,255,255,0.03)" : "transparent",
        })}
      >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{header}</View>
        <Chevron open={open} />
      </View>
      </Pressable>
      {open && detail ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 12 }}>{detail}</View>
      ) : null}
    </View>
  );
}

// Detail readout: one full-width row per metric - label left, value right,
// hairline between. Single column scans cleanly; value (mono+tabular, colored)
// is the hero, label sits quietly beside it. (`full` kept for API compat, no-op.)
export function KV({
  items,
}: {
  items: { label: string; value: string; color?: string; full?: boolean }[];
}) {
  return (
    <View
      style={{
        borderRadius: glass.radiusSm,
        backgroundColor: glass.tint,
        borderWidth: 1,
        borderColor: glass.hairline,
        overflow: "hidden",
      }}
    >
      {items.map((it, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.md,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: glass.hairline,
          }}
        >
          <Text
            style={{
              fontFamily: MONO_500,
              fontSize: type.label,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: colors.fgSecondary,
            }}
            numberOfLines={1}
          >
            {it.label}
          </Text>
          <Text
            style={{
              flexShrink: 1,
              textAlign: "right",
              fontFamily: MONO_600,
              fontSize: type.body,
              letterSpacing: -0.2,
              color: it.color ?? colors.fgPrimary,
            }}
            numberOfLines={1}
          >
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
