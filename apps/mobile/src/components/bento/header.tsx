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

import { useLastSync } from "~/hooks/use-last-sync";
import { formatClock } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";
import { PropertyPicker } from "./property-picker";

/**
 * Bu suredan eski veri "bayat" sayilir ve damga uyari rengine doner.
 *
 * NEDEN 90 DAKIKA: cron saat basi calisiyor (0013_cron_hourly.sql). Bir saatlik
 * gecikme NORMAL — onu kirmiziya boyamak alarmi anlamsizlastirirdi. 90 dakika
 * "bir tur kacti" demektir; bakilmasi gereken tek durum bu.
 */
const STALE_AFTER_MS = 90 * 60_000;

type Props = {
  /** Ust satir — BUYUK HARF, mono, genis tracking. */
  eyebrow: string;
  title: string;
  /**
   * Yenile butonu. VERILMEZSE BUTON CIZILMEZ — Ayarlar alt ekranlarinda
   * (gorunum, veri, hakkinda) yenilenecek uzak veri yok; calismayan bir buton
   * koymak `rows.tsx`'te bilerek temizlenen "dekoratif buton" hatasinin aynisi.
   */
  onSync?: () => void;
  syncing?: boolean;
  /** Acik uyari sayisi. 0 ise rozet gizlenir. */
  alertCount?: number;
  /**
   * Baslik yerine proje secici goster. Portfoy kapsamli ekranlarda (Ozet, Gelir,
   * Kullanici, Saglik) acik olmali — secili proje ekranin ne gosterdigini
   * belirliyor ve degistirmenin baska yolu yok. Ayarlar'da anlamsiz.
   */
  picker?: boolean;
  /** Verilirse solda geri okunu cizer. Ayarlar alt ekranlari icin. */
  onBack?: () => void;
};

/** Cockpit ekranlarinin ve Ayarlar alt ekranlarinin ortak baslik seridi. */
export function BentoHeader({
  eyebrow,
  title,
  onSync,
  syncing = false,
  alertCount = 0,
  picker = false,
  onBack,
}: Props) {
  const { theme } = useTheme();

  return (
    <View className="flex-row items-center justify-between px-tilePadLg pt-headerY pb-tilePadSm">
      <View className="flex-1 flex-row items-center gap-sm">
        {onBack != null ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              onBack();
            }}
            style={({ pressed }) => pressed && { opacity: press.opacity }}
            className="h-[34px] w-[34px] items-center justify-center rounded-btn bg-chrome"
            accessibilityRole="button"
            accessibilityLabel="Geri"
          >
            <Text style={{ fontSize: 16, color: theme.fg2 }}>‹</Text>
          </Pressable>
        ) : null}

        <View className="flex-1">
          <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
            {eyebrow}
          </Text>
          {picker ? (
            <View className="mt-[3px]">
              <PropertyPicker />
            </View>
          ) : (
            <Text
              className="mt-[3px] font-semibold text-title tracking-tighter text-fg"
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row items-center gap-sm">
        {/* Damga yenile butonuna BAGLI: var olma sebebi "ne zaman basmaliyim"
            sorusunu cevaplamak (bkz. SyncStamp yorumu). Buton yoksa damga
            cevapsiz bir bilgi olarak orada kalirdi. */}
        {onSync != null ? <SyncStamp /> : null}

        {onSync != null ? (
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
        ) : null}

        {alertCount > 0 ? (
          <View className="h-[34px] w-[34px] items-center justify-center rounded-btn bg-chrome">
            <Text className="font-mono-semibold text-meta text-neg">{alertCount}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * "SON 10:12" — verinin hub'a en son ne zaman indigi.
 *
 * NEDEN BUTONUN YANINDA: yenile butonu tek basina ne zaman basilmasi gerektigini
 * soylemiyordu. Rakam degismeyince "uygulama mi bozuk, veri mi ayni" ayrimi
 * yapilamiyordu — damga bu belirsizligi kaldiriyor. Kaynak sync_runs, yani
 * HUB'in son calismasi; telefonun son istek attigi an degil (bkz. fetchLastSync).
 */
function SyncStamp() {
  const { theme } = useTheme();
  const { data } = useLastSync();
  if (!data) return null;

  const stale = Date.now() - new Date(data.at).getTime() > STALE_AFTER_MS;
  const clock = formatClock(data.at);

  // Suren calismada bitis saati HENUZ yok; started_at'i "bitti" gibi sunmamak
  // icin ayri bir metin.
  const label = data.running ? "SÜRÜYOR" : `SON ${clock}`;
  // Renk kosullu oldugu icin token yerine tema degeri — bento'daki diger
  // kosullu renkler de boyle (StatTile delta rengi).
  const color = data.failed ? theme.neg : stale && !data.running ? theme.warn : theme.fg3;

  return (
    <Text
      className="font-mono-medium text-eyebrow tracking-wide"
      style={{ color }}
      accessibilityLabel={
        data.running ? "Senkronizasyon sürüyor" : `Son güncelleme saat ${clock}`
      }
    >
      {label}
    </Text>
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
