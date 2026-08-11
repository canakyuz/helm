import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space } from "@helm/design";
import { AD_FORMAT_LABEL, instrumentationWarnings, type SentryLevel } from "@helm/api";

import { useSentryIssues } from "~/hooks/use-sentry-issues";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useAppVersions } from "~/hooks/use-app-versions";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useGameFunnels } from "~/hooks/use-game-funnels";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { Ring } from "~/components/liquid";
import { BentoBackground, BentoHeader, BentoTile, Rise } from "~/components/bento";
import {
  FunnelTile,
  InstrumentationTile,
  PerfTile,
  type FunnelRow,
} from "~/components/analytics";

const TOP_CRASHES = 4;
const TOP_VERSIONS = 4;

/** Crash-free esikleri — tasarimin "Saglikli" metnini bunlar belirler. */
const HEALTHY_AT = 99.5;
const DEGRADED_AT = 99.0;

export default function Health() {
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
    return <ScreenStatus label="Yükleniyor…" />;

  const issues = issuesQuery.data ?? [];
  const integrations = healthQuery.data?.integrations ?? [];
  const okCount = healthQuery.data?.okCount ?? 0;
  const totalIntegrations = healthQuery.data?.totalIntegrations ?? integrations.length;
  const versions = versionsQuery.data?.versions ?? [];

  const fatalCount = issues.filter((c) => c.level === "fatal").length;
  const totalEvents = issues.reduce((a, c) => a + c.count, 0);

  const cfSeries = (crashFree.data?.series ?? []).map((p) => p.value);
  const cfNow = cfSeries.length > 0 ? cfSeries[cfSeries.length - 1]! : null;

  const verdict =
    cfNow == null
      ? { label: "Veri yok", color: theme.fg3 }
      : cfNow >= HEALTHY_AT
        ? { label: "Sağlıklı", color: theme.pos }
        : cfNow >= DEGRADED_AT
          ? { label: "Zayıflamış", color: theme.warn }
          : { label: "Kritik", color: theme.neg };

  const f = funnels.data;
  const warnings = f != null ? instrumentationWarnings(f) : [];
  const pct = (r: number | null): string => (r == null ? "—" : `%${Math.round(r * 100)}`);

  // Oturum: degeri "kac oturum" degil, KAPANMAYAN oran — cokme gostergesi.
  const sessionRows: FunnelRow[] = (f?.sessions ?? []).map((s) => ({
    label: s.platform,
    value: `${formatInteger(s.ended)} / ${formatInteger(s.started)}`,
    ratio: s.started > 0 ? s.ended / s.started : 0,
    note:
      s.unclosedRate != null && s.unclosed > 0
        ? `${formatInteger(s.unclosed)} oturum kapanmadı · ${pct(s.unclosedRate)}`
        : undefined,
    tone: s.unclosedRate != null && s.unclosedRate >= 0.5 ? "loss" : "normal",
  }));

  // Reklam: burada GELIR degil ARIZA olcusu — kac gosterim basarisiz oldu.
  const adRows: FunnelRow[] = (f?.ads ?? []).map((a) => ({
    label: AD_FORMAT_LABEL[a.format] ?? a.format,
    value: `${formatInteger(a.shown)} / ${formatInteger(a.shown + a.failed)}`,
    ratio: a.failureRate != null ? 1 - a.failureRate : 1,
    note: a.failed > 0 ? `${formatInteger(a.failed)} hata · ${pct(a.failureRate)}` : undefined,
    tone: a.failureRate != null && a.failureRate >= 0.3 ? "loss" : "normal",
  }));

  const levelColor = (level: SentryLevel): string => {
    if (level === "fatal") return theme.neg;
    if (level === "error") return theme.neg;
    if (level === "warning") return theme.warn;
    return theme.fg3;
  };

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="SAĞLIK"
          title="Kararlılık"
          onSync={handleRefresh}
          syncing={refreshing}
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
          {/* Hero — gauge + durum, yan yana */}
          <Rise index={0} replayKey={replayKey}>
            <BentoTile padding={space.tilePadLg}>
              <View className="flex-row items-center gap-tilePadLg">
                <Ring
                  value={cfNow ?? 0}
                  size={96}
                  stroke={9}
                  color={verdict.color}
                  trackColor={theme.line}
                >
                  <Text className="font-semibold text-title tracking-tighter text-fg">
                    {cfNow != null ? `%${cfNow.toFixed(1)}` : "—"}
                  </Text>
                </Ring>

                <View className="min-w-0 flex-1">
                  <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
                    CRASH-FREE OTURUM
                  </Text>
                  <Text
                    className="mt-[6px] font-semibold text-statSm tracking-tighter"
                    style={{ color: verdict.color }}
                  >
                    {verdict.label}
                  </Text>
                  <Text className="mt-xs text-meta leading-[18px] text-fg2">
                    {issues.length} aktif sorun · {fatalCount} fatal ·{" "}
                    {formatInteger(totalEvents)} olay
                  </Text>
                </View>
              </View>
            </BentoTile>
          </Rise>

          {/* Crash'ler */}
          <Rise index={1} replayKey={replayKey}>
            <BentoTile>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  Crash'ler
                </Text>
                <Text className="font-mono-medium text-[11px] text-fg3">
                  {issues.length}
                </Text>
              </View>

              {issues.length === 0 ? (
                <Empty
                  label={issuesQuery.isLoading ? "YÜKLENİYOR…" : "AÇIK CRASH YOK"}
                />
              ) : (
                issues.slice(0, TOP_CRASHES).map((c) => (
                  <View
                    key={c.id}
                    className="flex-row items-center gap-rowY border-t border-line py-rowY"
                  >
                    <View
                      className="h-sm w-sm rounded-bar"
                      style={{ backgroundColor: levelColor(c.level) }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text
                        className="font-medium text-row tracking-tight text-fg"
                        numberOfLines={1}
                      >
                        {c.title}
                      </Text>
                      <Text className="mt-[1px] text-meta text-fg3" numberOfLines={1}>
                        {c.propertyName ?? "—"} · {c.level} ·{" "}
                        {formatRelativeTime(c.lastSeen)}
                      </Text>
                    </View>
                    <Text className="font-mono-semibold text-body text-fg2">
                      {formatInteger(c.count)}
                    </Text>
                  </View>
                ))
              )}
            </BentoTile>
          </Rise>

          {/* Ölçüm şüpheleri — aşağıdaki her okumayı nitelendiriyor */}
          <Rise index={2} replayKey={replayKey}>
            <InstrumentationTile warnings={warnings} />
          </Rise>

          <Rise index={3} replayKey={replayKey}>
            <FunnelTile
              title="Oturum kapanma"
              count={f != null ? `${f.days} GÜN` : undefined}
              rows={sessionRows}
              empty={funnels.isLoading ? "YÜKLENİYOR…" : "OTURUM OLAYI YOK"}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={4} replayKey={replayKey}>
            <FunnelTile
              title="Reklam arızası"
              count="GÖSTERİM / TOPLAM"
              rows={adRows}
              empty={funnels.isLoading ? "YÜKLENİYOR…" : "REKLAM OLAYI YOK"}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={5} replayKey={replayKey}>
            <PerfTile rows={f?.perf ?? []} />
          </Rise>

          {/* Entegrasyonlar */}
          <Rise index={6} replayKey={replayKey}>
            <BentoTile>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  Entegrasyonlar
                </Text>
                <Text
                  className="font-mono-medium text-[11px]"
                  style={{ color: okCount === totalIntegrations ? theme.pos : theme.warn }}
                >
                  {okCount}/{totalIntegrations} OK
                </Text>
              </View>

              {integrations.length === 0 ? (
                <Empty
                  label={healthQuery.isLoading ? "YÜKLENİYOR…" : "ENTEGRASYON YOK"}
                />
              ) : (
                <View className="mt-headerY flex-row flex-wrap gap-sm">
                  {integrations.map((i) => {
                    const bad = i.status === "error";
                    return (
                      <View
                        key={i.id}
                        className="rounded-field px-headerY py-[9px]"
                        style={{
                          backgroundColor: bad ? `${theme.neg}1F` : theme.tile2,
                        }}
                      >
                        <Text
                          className="font-medium text-meta"
                          style={{ color: bad ? theme.neg : theme.fg }}
                        >
                          {i.provider}
                          {bad ? " · hata" : ""}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </BentoTile>
          </Rise>

          {/* Surumler */}
          <Rise index={7} replayKey={replayKey}>
            <BentoTile>
              <Text className="font-semibold text-emph tracking-tight text-fg">
                Sürümler
              </Text>
              {versions.length === 0 ? (
                <Empty
                  label={versionsQuery.isLoading ? "YÜKLENİYOR…" : "SÜRÜM KAYDI YOK"}
                />
              ) : (
                versions.slice(0, TOP_VERSIONS).map((v) => (
                  <View
                    key={v.id}
                    className="flex-row items-center gap-rowY border-t border-line py-[11px]"
                  >
                    <Text className="w-[52px] font-mono-semibold text-body text-fg">
                      {v.version}
                    </Text>
                    <Text className="flex-1 text-meta text-fg2" numberOfLines={1}>
                      {v.source === "ios" ? "App Store" : "Play Store"}
                      {v.status != null ? ` · ${v.status}` : ""}
                    </Text>
                    <Text className="font-mono-medium text-[11px] text-fg3">
                      {v.releaseDate != null ? formatRelativeTime(v.releaseDate) : "—"}
                    </Text>
                  </View>
                ))
              )}
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
      {label}
    </Text>
  );
}
