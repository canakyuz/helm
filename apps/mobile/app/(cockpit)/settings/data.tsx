import { Alert, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { space } from "@helm/design";

import { useRevenueGoal, useSetRevenueGoal } from "~/hooks/use-revenue-goal";
import { formatCurrency } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import {
  normalizeRevenueMultiplier,
  preferences,
  usePreferences,
  type Currency,
} from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";
import { Toggle } from "~/components/liquid";
import { BentoBackground, BentoHeader, BentoSegment, BentoTile, Rise } from "~/components/bento";
import { SettingsRow as Row } from "~/components/settings";

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP", "TRY"];

export default function DataSettings() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
  const { currency, revenueMultiplier, prioritizeRevenueRequests } = usePreferences();
  const goal = useRevenueGoal();
  const setGoal = useSetRevenueGoal();

  function promptGoal() {
    haptic.tap();
    // Para birimi BASLIKTA yaziyor: hedef, o anki goruntuleme para birimiyle
    // kaydediliyor. Sormadan kaydetmek sessiz bir tuzak - "90000" yazan biri
    // TL sanip GBP kaydedebiliyordu (olculdu: 90.000 GBP hedefi ~₺5,8M cikti).
    Alert.prompt(
      t("Aylık gelir hedefi ({cur})", { cur: currency }),
      t("Tutarı {cur} cinsinden gir. İlerleme ayın gerçek gelir toplamından hesaplanır. Para birimini değiştirmek için önce yukarıdan seç.", { cur: currency }),
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
      t("Gelir çarpanı"),
      t("1 ile 100 arası bir değer. Yalnızca yerel gösterimi etkiler, veriyi değiştirmez."),
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

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader eyebrow={t("AYARLAR")} title={t("Veri ve biçim")} onBack={() => router.back()} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.screenX,
            paddingBottom: 120,
            gap: space.tileGap,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Rise index={0}>
            <BentoTile>
              {/* Para birimi artik burada, "Gorunum"de degil: hangi kur ile
                  okudugun bir bicimlendirme karari, gorsel tercih degil. */}
              <Row
                label={t("Para birimi")}
                sub={t("tüm tutarlar bu birime çevrilir")}
                right={
                  <BentoSegment
                    options={CURRENCIES}
                    value={currency}
                    onChange={(c) => preferences.setCurrency(c)}
                  />
                }
              />
              <Row
                label={t("Aylık gelir hedefi")}
                divider
                onPress={promptGoal}
                // Kayitli para birimiyle gosterilir (secili olanla DEGIL): hedef
                // o birimde kaydedildi, cevirmek yaniltirdi.
                value={
                  goal.data?.target_amount != null
                    ? formatCurrency(goal.data.target_amount, goal.data.currency)
                    : t("Belirle")
                }
              />
              <Row
                label={t("Gelir çarpanı")}
                sub={t("yalnızca yerel gösterim")}
                divider
                onPress={promptMultiplier}
                value={`×${revenueMultiplier}`}
              />
              <Row
                label={t("Gelir önceliği")}
                sub={t("gelir sorgusu önce yüklensin")}
                divider
                right={
                  <Toggle
                    on={prioritizeRevenueRequests}
                    offColor={theme.tile2}
                    onColor={theme.accent}
                    onChange={(v) => {
                      haptic.tap();
                      preferences.setPrioritizeRevenueRequests(v);
                    }}
                  />
                }
              />
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
