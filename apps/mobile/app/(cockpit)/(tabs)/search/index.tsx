import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { press, space, withAlpha } from "@helm/design";

import { BentoTile, Empty } from "~/components/bento";
import { useAlerts } from "~/hooks/use-alerts";
import { useProperties } from "~/hooks/use-properties";
import { useSocialAccounts } from "~/hooks/use-social";
import { haptic } from "~/lib/haptics";
import { useT } from "~/lib/i18n";
import { preferences } from "~/lib/preferences";
import { buildSearchIndex, searchIndex, type SearchHit } from "~/lib/search-index";
import { useTheme } from "~/theme/use-theme";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  project: "PROJE",
  alert: "UYARI",
  account: "HESAP",
};

/**
 * Projeler, uyarılar ve sosyal hesaplar içinde tek arama.
 *
 * Index veri değişince kurulur, sorgu her tuşta yalnızca filtrelenir
 * (bkz. search-index.ts karmaşıklık notları).
 */
export default function SearchScreen() {
  const t = useT();
  const router = useRouter();
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const properties = useProperties();
  const alerts = useAlerts();
  const accounts = useSocialAccounts();

  const index = useMemo(
    () =>
      buildSearchIndex({
        properties: properties.data ?? [],
        alerts: alerts.data ?? [],
        accounts: accounts.data ?? [],
      }),
    [properties.data, alerts.data, accounts.data],
  );
  const hits = useMemo(() => searchIndex(index, query), [index, query]);

  const open = (hit: SearchHit) => {
    haptic.tap();
    if (hit.kind === "project") {
      preferences.setSelectedProperty(hit.id);
      router.navigate("/(cockpit)/(tabs)/overview");
      return;
    }
    // Uyarılar Özet'teki "Dikkat gerekiyor" kartında çözülüyor.
    router.navigate(hit.kind === "alert" ? "/(cockpit)/(tabs)/overview" : "/(cockpit)/(tabs)/social");
  };

  const hint =
    query.trim().length === 0
      ? t("Projeler, uyarılar ve sosyal hesaplar içinde ara")
      : t("Sonuç yok");

  return (
    <>
      <Stack.SearchBar
        placement="automatic"
        placeholder={t("Proje, uyarı veya hesap ara")}
        autoCapitalize="none"
        onChangeText={(e) => setQuery(e.nativeEvent.text)}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: space.screenX, gap: space.tileGap }}
      >
        {hits.length === 0 ? (
          <Empty label={hint} />
        ) : (
          <BentoTile>
            {hits.map((hit, i) => (
              <Pressable
                key={`${hit.kind}-${hit.id}`}
                onPress={() => open(hit)}
                accessibilityRole="button"
              >
                {({ pressed }) => (
                  <View
                    style={{
                      paddingVertical: space.tilePadSm,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: withAlpha(theme.fg3, 0.2),
                      opacity: pressed ? press.opacity : 1,
                    }}
                  >
                    <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                      {t(KIND_LABEL[hit.kind])}
                    </Text>
                    <Text className="mt-xs font-semibold text-body text-fg" numberOfLines={1}>
                      {hit.title}
                    </Text>
                    {/* Yalnizca proje turu sozluk anahtari ("Oyun"). Uyari mesaji ve
                        hesap adi gercek icerik; t()'den gecirmek yanlis eslesme riski. */}
                    <Text className="text-meta text-fg3" numberOfLines={1}>
                      {hit.kind === "project" ? t(hit.sub) : hit.sub}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </BentoTile>
        )}
      </ScrollView>
    </>
  );
}
