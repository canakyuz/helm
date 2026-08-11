import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { press, space } from "@helm/design";

import { useProperties } from "~/hooks/use-properties";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useAlertRulesCount } from "~/hooks/use-property-metrics";
import { useRevenueGoal, useSetRevenueGoal } from "~/hooks/use-revenue-goal";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import {
  normalizeRevenueMultiplier,
  preferences,
  usePreferences,
  type Currency,
  type ThemeMode,
} from "~/lib/preferences";
import { supabase } from "~/lib/supabase";
import { useTheme } from "~/theme/use-theme";
import { Toggle } from "~/components/liquid";
import {
  BentoBackground,
  BentoHeader,
  BentoSegment,
  BentoTile,
  Rise,
  SolidTile,
} from "~/components/bento";

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP", "TRY"];

/** Ekranda gosterilen etiket → saklanan deger. Tercih Turkce degil, sabit. */
const THEME_LABELS = ["Sistem", "Koyu", "Açık"] as const;
type ThemeLabel = (typeof THEME_LABELS)[number];
const LABEL_TO_MODE: Record<ThemeLabel, ThemeMode> = {
  Sistem: "system",
  Koyu: "dark",
  Açık: "light",
};
const MODE_TO_LABEL: Record<ThemeMode, ThemeLabel> = {
  system: "Sistem",
  dark: "Koyu",
  light: "Açık",
};

export default function Settings() {
  const { theme } = useTheme();
  const { currency, revenueMultiplier, prioritizeRevenueRequests, themeMode } =
    usePreferences();
  const fmt = useFormatCurrency();
  const { refreshing, onRefresh } = useScreenRefresh();
  const [replayKey, setReplayKey] = useState(0);

  const propertiesQuery = useProperties();
  const healthQuery = useSystemHealth();
  const alertRules = useAlertRulesCount();
  const goal = useRevenueGoal();
  const setGoal = useSetRevenueGoal();

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  function promptGoal() {
    haptic.tap();
    Alert.prompt(
      "Aylık gelir hedefi",
      "Hedef tutarı gir. İlerleme ayın gerçek gelir toplamından hesaplanır.",
      (text) => {
        const n = Number((text ?? "").replace(/[^\d.]/g, ""));
        if (!Number.isFinite(n) || n < 0) return;
        setGoal.mutate({ target: n, currency });
      },
      "plain-text",
      goal.data?.target_amount != null ? String(goal.data.target_amount) : "",
      "numeric",
    );
  }

  function promptMultiplier() {
    haptic.tap();
    Alert.prompt(
      "Gelir çarpanı",
      "1 ile 100 arası bir değer. Yalnızca yerel gösterimi etkiler, veriyi değiştirmez.",
      (text) => {
        const n = Number((text ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
        if (!Number.isFinite(n)) return;
        preferences.setRevenueMultiplier(normalizeRevenueMultiplier(n));
      },
      "plain-text",
      String(revenueMultiplier),
      "decimal-pad",
    );
  }

  function confirmSignOut() {
    haptic.tap();
    Alert.alert("Çıkış yap", "Tekrar girmek için e-posta bağlantısı gerekecek.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış yap",
        style: "destructive",
        onPress: () => void supabase.auth.signOut(),
      },
    ]);
  }

  const projectCount = propertiesQuery.data?.length ?? 0;
  const lastSync = healthQuery.data?.lastSyncRun?.finishedAt ?? null;
  const sources = healthQuery.data?.totalIntegrations ?? 0;
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="SİSTEM"
          title="Ayarlar"
          onSync={handleRefresh}
          syncing={refreshing}
        />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screenX,
            paddingBottom: 120,
            gap: space.tileGap,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              tintColor={theme.fg}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {/* Calisma alani */}
          <Rise index={0} replayKey={replayKey}>
            <BentoTile>
              <View className="flex-row items-center gap-tilePadSm">
                <SolidTile
                  color="#D4FF4D"
                  cornerRadius={18}
                  padding={0}
                  style={{ width: 52, height: 52, alignSelf: "auto" }}
                >
                  <View className="h-full w-full items-center justify-center">
                    <Text className="font-semibold text-statSm text-accent-ink">h</Text>
                  </View>
                </SolidTile>
                <View className="flex-1">
                  <Text className="font-semibold text-title tracking-tighter text-fg">
                    Kişisel çalışma alanı
                  </Text>
                  <Text className="mt-xs font-mono-medium text-eyebrow tracking-wide text-fg3">
                    {projectCount} PROJE · {sources} KAYNAK
                  </Text>
                </View>
              </View>
            </BentoTile>
          </Rise>

          {/* Gorunum — ikisi de GERCEK, tercihe yaziyor */}
          <Rise index={1} replayKey={replayKey}>
            <BentoTile>
              <Row
                label="Tema"
                sub="sistem / koyu / açık"
                right={
                  <BentoSegment
                    options={THEME_LABELS}
                    value={MODE_TO_LABEL[themeMode]}
                    onChange={(l) => preferences.setThemeMode(LABEL_TO_MODE[l])}
                    mono={false}
                  />
                }
              />
              <Row
                label="Para birimi"
                divider
                right={
                  <BentoSegment
                    options={CURRENCIES}
                    value={currency}
                    onChange={(c) => preferences.setCurrency(c)}
                  />
                }
              />
            </BentoTile>
          </Rise>

          {/* Gelir */}
          <Rise index={2} replayKey={replayKey}>
            <BentoTile>
              <Row
                label="Aylık gelir hedefi"
                onPress={promptGoal}
                value={
                  goal.data?.target_amount != null
                    ? `${goal.data.target_amount} ${goal.data.currency}`
                    : "Belirle"
                }
              />
              <Row
                label="Gelir çarpanı"
                sub="yalnızca yerel gösterim"
                divider
                onPress={promptMultiplier}
                value={`×${revenueMultiplier}`}
              />
              <Row
                label="Gelir önceliği"
                sub="gelir sorgusu önce yüklensin"
                divider
                right={
                  <Toggle
                    on={prioritizeRevenueRequests}
                    offColor={theme.tile2}
                    onChange={(v) => {
                      haptic.tap();
                      preferences.setPrioritizeRevenueRequests(v);
                    }}
                  />
                }
              />
            </BentoTile>
          </Rise>

          {/* Sistem — salt okunur */}
          <Rise index={3} replayKey={replayKey}>
            <BentoTile>
              <Row label="Projeler" value={String(projectCount)} />
              <Row label="Uyarı kuralları" divider value={String(alertRules.data ?? 0)} />
              <Row
                label="Son senkron"
                divider
                value={lastSync != null ? formatRelativeTime(lastSync) : "—"}
              />
              <Row label="Sürüm" divider value={version} />
            </BentoTile>
          </Rise>

          <Rise index={4} replayKey={replayKey}>
            <Pressable onPress={confirmSignOut} accessibilityRole="button">
              {({ pressed }) => (
                <View style={pressed ? { opacity: press.opacity } : undefined}>
                  <BentoTile padding={space.tilePadSm}>
                    <Text
                      className="font-semibold text-emph"
                      style={{ color: theme.neg }}
                    >
                      Çıkış yap
                    </Text>
                  </BentoTile>
                </View>
              )}
            </Pressable>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Ayar satiri. onPress verilmezse basilamaz — dekoratif buton yok.
 *
 * Eski ekranda dokuz satir `onPress={() => haptic.tap()}` idi: basinca titriyor,
 * baska hicbir sey yapmiyordu. Redesign'da tasinmadilar; calismayan bir butonu
 * yeniden cizmek onu calisiyormus gibi gosterir.
 */
function Row({
  label,
  sub,
  value,
  right,
  divider,
  onPress,
}: {
  label: string;
  sub?: string;
  value?: string;
  right?: React.ReactNode;
  divider?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      className="flex-row items-center justify-between py-headerY"
      style={
        divider
          ? { borderTopWidth: 1, borderTopColor: "rgba(128,128,128,0.18)" }
          : undefined
      }
    >
      <View className="mr-rowY flex-1">
        <Text className="font-medium text-emph text-fg">{label}</Text>
        {sub != null ? (
          <Text className="mt-[1px] text-meta text-fg3">{sub}</Text>
        ) : null}
      </View>
      {right ?? (
        <Text className="font-mono-semibold text-body text-fg2">
          {value}
          {onPress != null ? " ›" : ""}
        </Text>
      )}
    </View>
  );

  if (onPress == null) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={pressed ? { opacity: press.opacity } : undefined}>{body}</View>
      )}
    </Pressable>
  );
}
