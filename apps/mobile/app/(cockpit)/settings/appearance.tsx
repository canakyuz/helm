import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { space } from "@helm/design";

import { useT } from "~/lib/i18n";
import { preferences, usePreferences, type Language, type ThemeMode } from "~/lib/preferences";
import { BentoBackground, BentoHeader, BentoSegment, BentoTile, Rise } from "~/components/bento";
import {
  AccentPicker,
  MODE_LABEL_KEY,
  SettingsRow as Row,
  THEME_MODES,
} from "~/components/settings";

const LANGUAGES: readonly Language[] = ["tr", "en"];
const LANGUAGE_LABEL: Record<Language, string> = { tr: "Türkçe", en: "İngilizce" };

export default function Appearance() {
  const router = useRouter();
  const t = useT();
  const { themeMode, accent, language } = usePreferences();

  // Etiket ceviriyle degistigi icin ters esleme RENDER SIRASINDA kuruluyor;
  // sabit bir tabloda tutulamaz (bkz. labels.ts).
  const themeOptions = useMemo(() => THEME_MODES.map((m) => t(MODE_LABEL_KEY[m])), [t]);
  const labelToMode = useMemo(() => {
    const map: Record<string, ThemeMode> = {};
    THEME_MODES.forEach((m, i) => {
      map[themeOptions[i]!] = m;
    });
    return map;
  }, [themeOptions]);

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* onSync yok: burada yenilenecek uzak veri yok, tercihler yerel. */}
        <BentoHeader eyebrow={t("AYARLAR")} title={t("Görünüm")} onBack={() => router.back()} />

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
              <Row
                label={t("Tema")}
                sub={t("sistem / koyu / açık")}
                right={
                  <BentoSegment
                    options={themeOptions}
                    value={t(MODE_LABEL_KEY[themeMode])}
                    onChange={(l) => {
                      const mode = labelToMode[l];
                      if (mode != null) preferences.setThemeMode(mode);
                    }}
                    mono={false}
                  />
                }
              />
              <Row
                label={t("Dil")}
                sub={t("arayüz dili")}
                divider
                right={
                  <BentoSegment
                    options={LANGUAGES.map((l) => t(LANGUAGE_LABEL[l]))}
                    value={t(LANGUAGE_LABEL[language])}
                    onChange={(label) => {
                      const next = LANGUAGES.find((l) => t(LANGUAGE_LABEL[l]) === label);
                      if (next != null) preferences.setLanguage(next);
                    }}
                    mono={false}
                  />
                }
              />
              <Row
                label={t("Vurgu rengi")}
                sub={t("dolgu ve aktif durumlar")}
                divider
                right={<AccentPicker value={accent} />}
              />
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
