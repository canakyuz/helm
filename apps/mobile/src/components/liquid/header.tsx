import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { colors, glass, space, type } from "~/theme/tokens";
import { Icon } from "~/components/ui/icon";
import { PropertyPicker } from "~/components/property-picker";
import { HeaderAlertsButton } from "~/components/header-alerts-button";
import { haptic } from "~/lib/haptics";
import { supabase } from "~/lib/supabase";

// icon-only sync pill — rotates while syncing, refetches all queries on tap
function SyncButton() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const rot = useSharedValue(0);

  useEffect(() => {
    if (syncing) {
      rot.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rot);
      rot.value = withTiming(0, { duration: 200 });
    }
  }, [syncing, rot]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  async function sync() {
    if (syncing) return;
    haptic.tap();
    setSyncing(true);
    try {
      // 1) trigger the backend connectors to pull fresh data from external
      //    APIs into the hub (RevenueCat/Stripe/Sentry/PostHog → metrics tables).
      //    helm-ingest accepts { trigger: "manual" } and runs all integrations.
      await supabase.functions.invoke("helm-ingest", { body: { trigger: "manual" } });
    } catch {
      // ingest failure is non-fatal — still refetch whatever the hub already has
    }
    try {
      // 2) refetch ALL cached queries (active + inactive, not just the mounted
      //    screen) so every tab shows the freshly-ingested data.
      await qc.refetchQueries();
    } catch {
      // per-query error states surface individually
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Pressable
      onPress={sync}
      hitSlop={8}
      style={({ pressed }) => ({
        padding: space.sm,
        borderRadius: 999,
        backgroundColor: glass.tint,
        borderWidth: 1,
        borderColor: glass.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Animated.View style={style}>
        <Icon name="refresh" size={16} color={syncing ? colors.accent : colors.fgMuted} />
      </Animated.View>
    </Pressable>
  );
}

export function LiquidHeader({ showPicker = true }: { showPicker?: boolean }) {
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
        }}
      >
        <SyncButton />

        {showPicker ? (
          <View style={{ flexShrink: 1 }}>
            <PropertyPicker />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontFamily: "GeistMono-500", fontSize: type.label, letterSpacing: 2, color: colors.fgMuted }}>
              SETTINGS
            </Text>
          </View>
        )}

        <HeaderAlertsButton />
      </View>
      <View style={{ height: 1, marginTop: space.md, backgroundColor: glass.border }} />
    </View>
  );
}
