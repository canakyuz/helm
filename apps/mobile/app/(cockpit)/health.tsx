import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space } from "@helm/design";
import { AD_FORMAT_LABEL, instrumentationWarnings } from "@helm/api";

import { useSentryIssues } from "~/hooks/use-sentry-issues";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useAppVersions } from "~/hooks/use-app-versions";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useGameFunnels } from "~/hooks/use-game-funnels";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger, formatRatio } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { BentoBackground, BentoHeader, Rise } from "~/components/bento";
import {
  FunnelTile,
  InstrumentationTile,
  PerfTile,
  type FunnelRow,
} from "~/components/analytics";
import { useT } from "~/lib/i18n";
import {
  CrashFreeHero,
  CrashTile,
  IntegrationsTile,
  VersionsTile,
} from "~/components/health";

export default function Health() {
  const t = useT();
  const { theme } = useTheme();
  const { refreshing, onRefresh } = useScreenRefresh();
  const [replayKey, setReplayKey] = useState(0);

  const issuesQuery = useSentryIssues();
  const healthQuery = useSystemHealth();
  const versionsQuery = useAppVersions();
  const crashFree = useMetricDetail("crash_free_sessions");
  const funnels = useGameFunnels(30);

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (issuesQuery.isLoading && healthQuery.isLoading)
    return <ScreenStatus label={t("Yükleniyor…")} />;

  const issues = issuesQuery.data ?? [];
  const integrations = healthQuery.data?.integrations ?? [];
  const okCount = healthQuery.data?.okCount ?? 0;
  const totalIntegrations = healthQuery.data?.totalIntegrations ?? integrations.length;
  const versions = versionsQuery.data?.versions ?? [];

  const fatalCount = issues.filter((c) => c.level === "fatal").length;
  const totalEvents = issues.reduce((a, c) => a + c.count, 0);

  const cfSeries = (crashFree.data?.series ?? []).map((p) => p.value);
  const cfNow = cfSeries.length > 0 ? cfSeries[cfSeries.length - 1]! : null;

  const f = funnels.data;
  const warnings = f != null ? instrumentationWarnings(f) : [];
  const pct = (r: number | null): string => (r == null ? "—" : formatRatio(r));

  // Oturum: degeri "kac oturum" degil, KAPANMAYAN oran — cokme gostergesi.
  const sessionRows: FunnelRow[] = (f?.sessions ?? []).map((s) => ({
    label: s.platform,
    value: `${formatInteger(s.ended)} / ${formatInteger(s.started)}`,
    ratio: s.started > 0 ? s.ended / s.started : 0,
    // Not her satirda dolu: hatasiz satirlarda bos birakinca liste ritmi
    // bozuluyordu (kimi satir iki, kimi tek satir).
    note:
      s.unclosedRate != null && s.unclosed > 0
        ? t("{n} oturum kapanmadı · {rate}", { n: formatInteger(s.unclosed), rate: pct(s.unclosedRate) })
        : s.ended > s.started
          ? t("bitiş sayısı başlangıçtan fazla — ölçüm hatalı")
          : t("tümü kapandı"),
    tone: s.unclosedRate != null && s.unclosedRate >= 0.5 ? "loss" : "normal",
  }));

  // Reklam: burada GELIR degil ARIZA olcusu — kac gosterim basarisiz oldu.
  const adRows: FunnelRow[] = (f?.ads ?? []).map((a) => ({
    label: AD_FORMAT_LABEL[a.format] ?? a.format,
    value: `${formatInteger(a.shown)} / ${formatInteger(a.shown + a.failed)}`,
    ratio: a.failureRate != null ? 1 - a.failureRate : 1,
    note: a.failed > 0 ? `${formatInteger(a.failed)} hata · ${pct(a.failureRate)}` : t("hatasız"),
    tone: a.failureRate != null && a.failureRate >= 0.3 ? "loss" : "normal",
  }));

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow={t("SAĞLIK")}
          title={t("Kararlılık")}
          onSync={handleRefresh}
          syncing={refreshing}
          picker
          alertCount={fatalCount}
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
          <Rise index={0} replayKey={replayKey}>
            <CrashFreeHero
              crashFree={cfNow}
              issueCount={issues.length}
              fatalCount={fatalCount}
              totalEvents={totalEvents}
            />
          </Rise>

          <Rise index={1} replayKey={replayKey}>
            <CrashTile issues={issues} loading={issuesQuery.isLoading} />
          </Rise>

          {/* Ölçüm şüpheleri — aşağıdaki her okumayı nitelendiriyor */}
          <Rise index={2} replayKey={replayKey}>
            <InstrumentationTile warnings={warnings} />
          </Rise>

          <Rise index={3} replayKey={replayKey}>
            <FunnelTile
              title={t("Oturum kapanma")}
              count={f != null ? `${f.days}G` : undefined}
              rows={sessionRows}
              empty={funnels.isLoading ? "YÜKLENİYOR…" : "OTURUM OLAYI YOK"}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={4} replayKey={replayKey}>
            <FunnelTile
              title={t("Reklam arızası")}
              count={t("GÖSTERİM / TOPLAM")}
              rows={adRows}
              empty={funnels.isLoading ? "YÜKLENİYOR…" : "REKLAM OLAYI YOK"}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={5} replayKey={replayKey}>
            <PerfTile rows={f?.perf ?? []} />
          </Rise>

          <Rise index={6} replayKey={replayKey}>
            <IntegrationsTile
              integrations={integrations}
              okCount={okCount}
              total={totalIntegrations}
              loading={healthQuery.isLoading}
            />
          </Rise>

          <Rise index={7} replayKey={replayKey}>
            <VersionsTile versions={versions} loading={versionsQuery.isLoading} />
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
