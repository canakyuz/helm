import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { colors } from "~/theme/tokens";
import { Icon } from "~/components/ui/icon";
import { PropertyPicker } from "~/components/property-picker";
import { HeaderAlertsButton } from "~/components/header-alerts-button";
import { haptic } from "~/lib/haptics";

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

  function sync() {
    if (syncing) return;
    haptic.tap();
    setSyncing(true);
    qc.invalidateQueries();
    setTimeout(() => setSyncing(false), 1100);
  }

  return (
    <Pressable
      onPress={sync}
      hitSlop={8}
      style={{
        padding: 8,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <Animated.View style={style}>
        <Icon name="refresh" size={16} color={syncing ? colors.accent : colors.fgMuted} />
      </Animated.View>
    </Pressable>
  );
}

export function LiquidHeader({ showPicker = true }: { showPicker?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 13 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <SyncButton />

        {showPicker ? (
          <View style={{ flexShrink: 1 }}>
            <PropertyPicker />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <HeaderAlertsButton />
      </View>
      <View style={{ height: 1, marginTop: 13, backgroundColor: "rgba(255,255,255,0.10)" }} />
    </View>
  );
}
