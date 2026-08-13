import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { space } from "@helm/design";

import { useAlertRulesCount } from "~/hooks/use-property-metrics";
import { useProperties } from "~/hooks/use-properties";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { useSystemHealth } from "~/hooks/use-system-health";
import { formatRelativeTime } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { BentoBackground, BentoHeader, BentoTile, InfoRow, Rise } from "~/components/bento";

export default function About() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refreshing, onRefresh } = useScreenRefresh();

  const health = useSystemHealth();
  const properties = useProperties();
  const alertRules = useAlertRulesCount();

  const lastSync = health.data?.lastSyncRun?.finishedAt ?? null;
  const runs24h = health.data?.syncRunsLast24h ?? 0;
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="AYARLAR"
          title="Hakkında"
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
              <InfoRow label="Sürüm" value={version} />
              <InfoRow
                label="Son senkron"
                divider
                value={lastSync != null ? formatRelativeTime(lastSync) : "—"}
              />
              {/* Cron saat basi calisiyor; 24 saatte beklenen ~24 tur. Ham sayi
                  "calisiyor mu" sorusunu tek bakista cevapliyor. */}
              <InfoRow label="Son 24 saat" divider value={`${runs24h} tur`} />
            </BentoTile>
          </Rise>

          <Rise index={1}>
            <BentoTile>
              <InfoRow label="Projeler" value={String(properties.data?.length ?? 0)} />
              <InfoRow
                label="Uyarı kuralları"
                divider
                value={String(alertRules.data ?? 0)}
              />
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
