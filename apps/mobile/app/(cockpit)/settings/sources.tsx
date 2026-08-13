import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PROVIDER_LABEL, type IntegrationHealth } from "@helm/api";
import { space } from "@helm/design";

import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { useSystemHealth } from "~/hooks/use-system-health";
import { formatRelativeTime } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoBackground, BentoHeader, BentoTile, Empty, Rise } from "~/components/bento";

export default function Sources() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refreshing, onRefresh } = useScreenRefresh();
  const health = useSystemHealth();

  const integrations = health.data?.integrations ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="AYARLAR"
          title="Kaynaklar"
          onBack={() => router.back()}
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
          <Rise index={0}>
            <BentoTile>
              {health.isLoading && health.data == null ? (
                <Empty label="YÜKLENİYOR" />
              ) : health.isError ? (
                <Empty label="KAYNAKLAR OKUNAMADI" />
              ) : integrations.length === 0 ? (
                <View>
                  <Empty label="HENÜZ KAYNAK YOK" />
                  {/* Ekleme akisi bu ekranda YOK — calismayan bir "Ekle" butonu
                      koymuyoruz. Kurulum su an web panelinde yapiliyor. */}
                  <Text className="pb-tilePad text-meta text-fg3">
                    Yeni entegrasyon web panelinden eklenir.
                  </Text>
                </View>
              ) : (
                integrations.map((it, i) => (
                  <SourceRow key={it.id} item={it} divider={i > 0} />
                ))
              )}
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Tek entegrasyon satiri.
 *
 * Durum RENK ILE TEK BASINA anlatilmiyor: renk korlugunde "ok" ile "error"
 * ayirt edilemez. Sagda her zaman METIN var (son senkron ya da hata), nokta
 * yalnizca yedek kodlama.
 */
function SourceRow({ item, divider }: { item: IntegrationHealth; divider: boolean }) {
  const { theme } = useTheme();

  const dot =
    item.status === "ok" ? theme.pos : item.status === "error" ? theme.neg : theme.warn;

  const right =
    item.status === "error"
      ? "HATA"
      : item.lastSyncedAt != null
        ? formatRelativeTime(item.lastSyncedAt)
        : "BEKLİYOR";

  return (
    <View
      className={`flex-row items-center justify-between py-rowY${
        divider ? " border-t border-line" : ""
      }`}
    >
      <View className="mr-rowY flex-1 flex-row items-center gap-sm">
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dot }} />
        <View className="flex-1">
          <Text className="font-medium text-row text-fg" numberOfLines={1}>
            {PROVIDER_LABEL[item.provider] ?? item.provider}
          </Text>
          {item.propertyName != null ? (
            <Text className="mt-[1px] text-meta text-fg3" numberOfLines={1}>
              {item.propertyName}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        className="font-mono-semibold text-body"
        style={{ color: item.status === "error" ? theme.neg : theme.fg2 }}
      >
        {right}
      </Text>
    </View>
  );
}
