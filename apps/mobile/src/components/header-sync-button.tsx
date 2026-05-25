import { useEffect, useRef, useState } from "react";
import { Pressable, Animated, Easing } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "~/lib/supabase";
import { Icon } from "~/components/ui/icon";
import { haptic } from "~/lib/haptics";
import { toast } from "~/lib/toast";
import { colors } from "~/theme/tokens";

export function HeaderSyncButton() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!running) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [running, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  async function onPress() {
    if (running) return;
    haptic.tap();
    setRunning(true);

    try {
      // 1. Hub-side ingest tetikle (background).
      await supabase.functions
        .invoke("helm-ingest", { body: { trigger: "manual" } })
        .catch(() => {
          // ingest fail olursa devam et — yine de client-side invalidate yap.
        });

      // 2. Mobile cache invalidate — tüm görünür data yenilenir.
      await queryClient.invalidateQueries();

      toast.success("Senkronize edildi");
    } catch (err) {
      console.warn("[sync] error", err);
      toast.error("Senkron başarısız");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Pressable
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingLeft: 16,
        paddingRight: 8,
        paddingVertical: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon
          name="refresh"
          size={20}
          color={running ? colors.accent : colors.fgMuted}
        />
      </Animated.View>
    </Pressable>
  );
}
