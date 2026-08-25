import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { accentById, press, space } from "@helm/design";

import { useProperties } from "~/hooks/use-properties";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { usePreferences } from "~/lib/preferences";
import { supabase } from "~/lib/supabase";
import { useTheme } from "~/theme/use-theme";
import { ScreenGround, BentoHeader, BentoTile, Rise, SolidTile } from "~/components/bento";
import { MODE_LABEL_KEY, SettingsRow as Row } from "~/components/settings";

export default function SettingsHub() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
  const { currency, revenueMultiplier, themeMode, accent } = usePreferences();
  const { refreshing, onRefresh } = useScreenRefresh();

  const propertiesQuery = useProperties();
  const healthQuery = useSystemHealth();

  const projectCount = propertiesQuery.data?.length ?? 0;
  const sources = healthQuery.data?.totalIntegrations ?? 0;
  const okCount = healthQuery.data?.okCount ?? 0;
  const errorCount = healthQuery.data?.errorCount ?? 0;
  const version = Constants.expoConfig?.version ?? "-";

  function confirmSignOut() {
    haptic.tap();
    Alert.alert(t("Çıkış yap"), t("Tekrar girmek için e-posta bağlantısı gerekecek."), [
      { text: t("Vazgeç"), style: "cancel" },
      {
        text: t("Çıkış yap"),
        style: "destructive",
        onPress: () => void supabase.auth.signOut(),
      },
    ]);
  }

  // Ozet metinleri satirin SAGINDA duruyor: hub bir menu degil, durum ozeti.
  // Ic ekrani acmadan "tema neydi, hangi para birimi" sorusu cevaplanmali.
  const sourcesSummary =
    healthQuery.isLoading && healthQuery.data == null
      ? "-"
      : errorCount > 0
        ? t("{n} bağlı · {m} hata", { n: okCount, m: errorCount })
        : t("{n} bağlı", { n: okCount });

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow={t("SİSTEM")}
          title={t("Ayarlar")}
          onSync={onRefresh}
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
              onRefresh={onRefresh}
            />
          }
        >
          {/* Kimlik. Proje/kaynak sayilari YALNIZCA burada - eski ekranda hem
              burada hem alttaki sistem tile'inda tekrar ediyordu. */}
          <Rise index={0}>
            <BentoTile>
              <View className="flex-row items-center gap-tilePadSm">
                <SolidTile
                  color={theme.accent}
                  cornerRadius={18}
                  padding={0}
                  style={{ width: 52, height: 52, alignSelf: "auto" }}
                >
                  <View className="h-full w-full items-center justify-center">
                    <Text
                      className="font-semibold text-statSm"
                      style={{ color: theme.accentInk }}
                    >
                      h
                    </Text>
                  </View>
                </SolidTile>
                <View className="flex-1">
                  <Text className="font-semibold text-title tracking-tighter text-fg">
                    {t("Kişisel çalışma alanı")}
                  </Text>
                  <Text className="mt-xs font-mono-medium text-eyebrow tracking-wide text-fg3">
                    {t("{n} PROJE · {m} KAYNAK", { n: projectCount, m: sources })}
                  </Text>
                </View>
              </View>
            </BentoTile>
          </Rise>

          <Rise index={1}>
            <BentoTile>
              <Row
                label={t("Görünüm")}
                sub={t("tema ve vurgu rengi")}
                value={`${t(MODE_LABEL_KEY[themeMode])} · ${t(accentById(accent).label)}`}
                onPress={() => router.push("/settings/appearance")}
              />
              <Row
                label={t("Veri ve biçim")}
                sub={t("para birimi, hedef, çarpan")}
                divider
                // Para birimi eski ekranda "Gorunum" grubundaydi. Bicimlendirme
                // ayari gorunum degil: hangi kur ile okudugun veriyle ilgili.
                value={`${currency} · ×${revenueMultiplier}`}
                onPress={() => router.push("/settings/data")}
              />
              <Row
                label={t("Kaynaklar")}
                sub={t("bağlı entegrasyonlar")}
                divider
                value={sourcesSummary}
                onPress={() => router.push("/settings/sources")}
              />
              <Row
                label={t("Hakkında")}
                sub={t("sürüm ve senkron durumu")}
                divider
                value={version}
                onPress={() => router.push("/settings/about")}
              />
            </BentoTile>
          </Rise>

          <Rise index={2}>
            <Pressable onPress={confirmSignOut} accessibilityRole="button">
              {({ pressed }) => (
                <View style={pressed ? { opacity: press.opacity } : undefined}>
                  <BentoTile padding={space.tilePadSm}>
                    <Text className="font-semibold text-emph" style={{ color: theme.neg }}>
                      {t("Çıkış yap")}
                    </Text>
                  </BentoTile>
                </View>
              )}
            </Pressable>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </ScreenGround>
  );
}
