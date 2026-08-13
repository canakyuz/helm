import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { space } from "@helm/design";

import { preferences, usePreferences } from "~/lib/preferences";
import { BentoBackground, BentoHeader, BentoSegment, BentoTile, Rise } from "~/components/bento";
import {
  AccentPicker,
  LABEL_TO_MODE,
  MODE_TO_LABEL,
  SettingsRow as Row,
  THEME_LABELS,
} from "~/components/settings";

export default function Appearance() {
  const router = useRouter();
  const { themeMode, accent } = usePreferences();

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* onSync yok: burada yenilenecek uzak veri yok, tercihler yerel. */}
        <BentoHeader eyebrow="AYARLAR" title="Görünüm" onBack={() => router.back()} />

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
              {/* Dil satiri BURAYA gelecek (i18n isi). Simdi eklenmiyor: calismayan
                  bir satir koymak `rows.tsx`'te bilerek temizlenen hatanin aynisi. */}
              <Row
                label="Vurgu rengi"
                sub="dolgu ve aktif durumlar"
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
