import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { duration, press } from "@helm/design";

import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";

type Props = {
  /** Ust satir — BUYUK HARF, mono, genis tracking. */
  eyebrow: string;
  title: string;
  onSync: () => void;
  syncing: boolean;
  /** Acik uyari sayisi. 0 ise rozet gizlenir. */
  alertCount?: number;
};

/** Bes cockpit ekraninin ortak baslik seridi. */
export function BentoHeader({ eyebrow, title, onSync, syncing, alertCount = 0 }: Props) {
  const { theme } = useTheme();

  return (
    <View className="flex-row items-center justify-between px-tilePadLg pt-headerY pb-tilePadSm">
      <View>
        <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
          {eyebrow}
        </Text>
        <Text className="mt-[3px] font-semibold text-title tracking-tighter text-fg">
          {title}
        </Text>
      </View>

      <View className="flex-row gap-sm">
        <Pressable
          onPress={() => {
            haptic.tap();
            onSync();
          }}
          style={({ pressed }) => pressed && { opacity: press.opacity }}
          className="h-[34px] w-[34px] items-center justify-center rounded-btn bg-chrome"
          accessibilityRole="button"
          accessibilityLabel="Yenile"
        >
          <SyncGlyph spinning={syncing} color={theme.fg2} />
        </Pressable>

        {alertCount > 0 ? (
          <View className="h-[34px] w-[34px] items-center justify-center rounded-btn bg-chrome">
            <Text className="font-mono-semibold text-meta text-neg">{alertCount}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SyncGlyph({ spinning, color }: { spinning: boolean; color: string }) {
  const turn = useSharedValue(0);

  // Shared value render sirasinda yazilmaz. Donme bitince acida birakmak yerine
  // sifira cekiyoruz — yarim kalmis bir ok "hala calisiyor" gibi okunur.
  useEffect(() => {
    if (spinning) {
      turn.value = 0;
      turn.value = withRepeat(
        withTiming(1, { duration: duration.spin, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(turn);
      turn.value = withTiming(0, { duration: 160 });
    }
  }, [spinning, turn]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));

  return (
    <Animated.View style={animated}>
      <Text style={{ fontSize: 14, color }}>↻</Text>
    </Animated.View>
  );
}
