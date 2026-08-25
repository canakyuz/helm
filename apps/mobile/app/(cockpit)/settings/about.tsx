import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { space } from "@helm/design";

import { useAlertRulesCount } from "~/hooks/use-property-metrics";
import { useProperties } from "~/hooks/use-properties";
import { useT } from "~/lib/i18n";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { useSystemHealth } from "~/hooks/use-system-health";
import { formatRelativeTime } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { ScreenGround, BentoHeader, BentoTile, InfoRow, Rise } from "~/components/bento";

export default function About() {
  const router = useRouter();
  const { theme } = useTheme();
  const t = useT();
  const { refreshing, onRefresh } = useScreenRefresh();

  const health = useSystemHealth();
  const properties = useProperties();
  const alertRules = useAlertRulesCount();

  const lastSync = health.data?.lastSyncRun?.finishedAt ?? null;
  const runs24h = health.data?.syncRunsLast24h ?? 0;
  const version = Constants.expoConfig?.version ?? "-";

  return (
    <ScreenGround>
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow={t("AYARLAR")}
          title={t("Hakkında")}
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
              <InfoRow label={t("Sürüm")} value={version} />
              <InfoRow
                label={t("Son senkron")}
                divider
                value={lastSync != null ? formatRelativeTime(lastSync) : "-"}
              />
              {/* Cron saat basi calisiyor; 24 saatte beklenen ~24 tur. Ham sayi
                  "calisiyor mu" sorusunu tek bakista cevapliyor. */}
              <InfoRow label={t("Son 24 saat")} divider value={t("{n} tur", { n: runs24h })} />
            </BentoTile>
          </Rise>

          <Rise index={1}>
            <BentoTile>
              <InfoRow label={t("Projeler")} value={String(properties.data?.length ?? 0)} />
              <InfoRow
                label={t("Uyarı kuralları")}
                divider
                value={String(alertRules.data ?? 0)}
              />
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </ScreenGround>
  );
}
