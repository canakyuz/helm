import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { type IntegrationHealth } from "@helm/api";
import { providerLabel } from "@helm/domain";
import { press, space } from "@helm/design";

import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { useSystemHealth } from "~/hooks/use-system-health";
import { formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
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
                <Empty label="HENÜZ KAYNAK YOK" />
              ) : (
                integrations.map((it, i) => (
                  <SourceRow
                    key={it.id}
                    item={it}
                    divider={i > 0}
                    // Sablon dizgi degil nesne formu: typed-routes dinamik
                    // segmenti ancak boyle dogrulayabiliyor.
                    onPress={() =>
                      router.push({
                        pathname: "/settings/sources/[id]",
                        params: { id: it.id },
                      })
                    }
                  />
                ))
              )}
            </BentoTile>
          </Rise>

          <Rise index={1}>
            <Pressable
              onPress={() => {
                haptic.tap();
                router.push("/settings/sources/new");
              }}
              accessibilityRole="button"
            >
              {({ pressed }) => (
                <View style={pressed ? { opacity: press.opacity } : undefined}>
                  <BentoTile padding={space.tilePadSm}>
                    <Text
                      className="font-semibold text-emph"
                      style={{ color: theme.accent }}
                    >
                      Yeni kaynak bağla
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
 * Tek entegrasyon satiri.
 *
 * Durum RENK ILE TEK BASINA anlatilmiyor: renk korlugunde "ok" ile "error"
 * ayirt edilemez. Sagda her zaman METIN var (son senkron ya da hata), nokta
 * yalnizca yedek kodlama.
 */
function SourceRow({
  item,
  divider,
  onPress,
}: {
  item: IntegrationHealth;
  divider: boolean;
  onPress: () => void;
}) {
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
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View
          className={`flex-row items-center justify-between py-rowY${
            divider ? " border-t border-line" : ""
          }`}
          style={pressed ? { opacity: press.opacity } : undefined}
        >
          <View className="mr-rowY flex-1 flex-row items-center gap-sm">
            <View
              style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dot }}
            />
            <View className="flex-1">
              <Text className="font-medium text-row text-fg" numberOfLines={1}>
                {providerLabel(item.provider)}
                {item.enabled ? "" : " · kapalı"}
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
            {right} ›
          </Text>
        </View>
      )}
    </Pressable>
  );
}
