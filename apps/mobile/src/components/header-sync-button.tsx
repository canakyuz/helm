import { useEffect, useMemo } from "react";
import { Pressable, Animated, Easing } from "react-native";

import { Icon } from "~/components/ui/icon";
import { useLastSync } from "~/hooks/use-last-sync";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { colors } from "~/theme/tokens";

/**
 * Baslik seridindeki yenile dugmesi.
 *
 * NEDEN KENDI MANTIGI YOK: bu dugmenin eskiden ayri bir kopyasi vardi —
 * `invoke`'u timeout'suz await ediyor, hatayi `.catch(() => {})` ile yutuyor,
 * sonra KOSULSUZ "Senkronize edildi" gosteriyordu. Ingest 500 donse bile yesil
 * toast cikiyordu. Iki ayri yenileme yolu olmasi ayrica cooldown'un yalnizca
 * birinde islemesi demekti. Artik ikisi de `useScreenRefresh` uzerinden gider.
 *
 * NEDEN SPINNER YEREL STATE DEGIL: donme, sunucunun gercek durumuna bagli
 * (`lastSync.running`). Yerel bir bayrak, calisma arka planda surerken duruyor
 * ve "bitti" izlenimi veriyordu.
 */
export function HeaderSyncButton() {
  const { onRefresh } = useScreenRefresh();
  const { data: lastSync } = useLastSync();
  const running = lastSync?.running ?? false;
  // useRef DEGIL useMemo: `Animated.Value` bir ref degil, sabit bir nesne.
  // Ref olarak tutulunca `spin.interpolate(...)` render sirasinda ref okumus
  // oluyor ve react-hooks/refs hakli olarak hata veriyordu.
  const spin = useMemo(() => new Animated.Value(0), []);

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

  return (
    <Pressable
      hitSlop={10}
      disabled={running}
      onPress={() => {
        void onRefresh();
      }}
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
