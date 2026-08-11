import { useEffect } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useState } from "react";
import { duration, space, radius as R } from "@helm/design";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import { useGeoBreakdown, useRetention } from "~/hooks/use-analytics";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger } from "~/lib/format";
import { usePreferences } from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { CountUp } from "~/components/liquid";
import {
  BentoBackground,
  BentoBars,
  BentoHeader,
  BentoRails,
  BentoTile,
  Rise,
  type RailRow,
} from "~/components/bento";

/** Tasarim 14 cubuk kullaniyor. */
const SPARK_BARS = 14;
const TOP_COUNTRIES = 5;

/** Seri ladder'i — pos/neg/warn DURUM renkleri, seri degil. */
const SERIES_TINTS = ["#D4FF4D", "#B89CFF", "#7AA8FF", "#FF8A3D"] as const;

const HERO_NUMBER = {
  marginTop: 12,
  fontFamily: "Geist-600",
  fontSize: 46,
  lineHeight: 48,
  letterSpacing: -2,
} as const;

function fmtSession(sec: number): string {
  return `${Math.floor(sec / 60)}d ${Math.round(sec % 60)}s`;
}

export default function Analytics() {
  const { theme, glass } = useTheme();
  const { refreshing, onRefresh } = useScreenRefresh();
  const [replayKey, setReplayKey] = useState(0);
  const { selectedPropertyId } = usePreferences();
  const properties = useProperties();
  // PostHog uclari tek proje scope'lu — "all" ise ilk projeye duser.
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;

  const kpis = useCockpitKpis();
  const dauDetail = useMetricDetail("dau");
  const mauDetail = useMetricDetail("mau");
  const sessDetail = useMetricDetail("avg_session_sec");
  const geo = useGeoBreakdown(projectId);
  const retention = useRetention(projectId);

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data)
    return <ScreenStatus label="Analitik yüklenemedi" tone="danger" />;

  const last = (d: typeof mauDetail): number | null => {
    const s = d.data?.series ?? [];
    return s.length > 0 ? s[s.length - 1]!.value : null;
  };

  const dau = kpis.data.dau;
  const mau = last(mauDetail) ?? kpis.data.totalUsers ?? 0;
  const session = last(sessDetail);
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : null;
  const dauPoints = (dauDetail.data?.series ?? []).slice(-SPARK_BARS);

  const countries = (geo.data?.rows ?? []).slice(0, TOP_COUNTRIES);
  const peak = Math.max(...countries.map((c) => c.users), 1);
  const countryRows: RailRow[] = countries.map((c, i) => ({
    label: c.country_name ?? c.country,
    value: formatInteger(c.users),
    ratio: c.users / peak,
    color: SERIES_TINTS[i % SERIES_TINTS.length]!,
  }));

  const cohorts = retention.data?.cohorts ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="ANALİTİK"
          title="Kullanıcılar"
          onSync={handleRefresh}
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
              onRefresh={handleRefresh}
            />
          }
        >
          <Rise index={0} replayKey={replayKey}>
            <BentoTile padding={space.tilePadLg}>
              <View className="flex-row items-center justify-between">
                <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
                  AKTİF KULLANICI · 30G
                </Text>
                <View className="flex-row items-center gap-[6px]">
                  <LiveDot color="#D4FF4D" />
                  <Text className="font-mono-medium text-eyebrow tracking-wide text-fg2">
                    CANLI
                  </Text>
                </View>
              </View>

              <CountUp
                value={dau}
                format={(v) => formatInteger(v)}
                fitOneLine
                style={{ ...HERO_NUMBER, color: theme.fg }}
              />
              <Text className="mt-[6px] text-meta text-fg2">
                MAU {formatInteger(mau)}
                {stickiness != null ? ` · yapışkanlık %${stickiness}` : ""}
              </Text>

              {dauPoints.length > 1 ? (
                <View className="mt-tilePad">
                  <BentoBars
                    points={dauPoints}
                    activeColor="#7AA8FF"
                    dimColor={glass.chartDim}
                    height={76}
                    gap={3}
                    replayKey={replayKey}
                  />
                </View>
              ) : null}
            </BentoTile>
          </Rise>

          <View className="flex-row gap-tileGap">
            <MiniTile
              index={1}
              replayKey={replayKey}
              label="OTURUM"
              value={session != null ? fmtSession(session) : "—"}
            />
            <MiniTile
              index={2}
              replayKey={replayKey}
              label="YENİ"
              value={formatInteger(kpis.data.newUsers ?? 0)}
            />
          </View>

          <Rise index={3} replayKey={replayKey}>
            <BentoTile>
              <Text className="font-semibold text-emph tracking-tight text-fg">
                Ülkeler
              </Text>
              {countryRows.length === 0 ? (
                <Empty label={geo.isLoading ? "YÜKLENİYOR…" : "ÜLKE VERİSİ YOK"} />
              ) : (
                <View className="mt-tilePadSm">
                  <BentoRails rows={countryRows} replayKey={replayKey} />
                </View>
              )}
            </BentoTile>
          </Rise>

          <Rise index={4} replayKey={replayKey}>
            <BentoTile>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  Tutundurma
                </Text>
                <Text className="font-mono-medium text-[11px] text-fg3">
                  {cohorts.map((c) => c.day.toLocaleUpperCase("tr-TR")).join(" · ")}
                </Text>
              </View>
              {cohorts.length === 0 ? (
                <Empty
                  label={retention.isLoading ? "YÜKLENİYOR…" : "TUTUNDURMA VERİSİ YOK"}
                />
              ) : (
                <View className="mt-tilePadSm flex-row gap-tileGap">
                  {cohorts.map((c) => (
                    <View
                      key={c.day}
                      className="flex-1 items-center rounded-inner bg-tile2 p-boxPad"
                    >
                      <Text
                        className="font-semibold text-statSm tracking-tighter text-fg"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        %{Math.round(c.pct)}
                      </Text>
                      <Text className="mt-xs font-mono-medium text-eyebrow tracking-wide text-fg3">
                        {c.day.toLocaleUpperCase("tr-TR")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </BentoTile>
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Nabiz atan canli gostergesi — 1800ms, sonsuz. */
function LiveDot({ color }: { color: string }) {
  const pulse = useSharedValue(1);
  const noMotion = useReducedMotion();

  useEffect(() => {
    if (noMotion) return;
    pulse.value = withRepeat(
      withTiming(0, { duration: duration.pulse / 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [noMotion, pulse]);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.55,
    transform: [{ scale: 1 - pulse.value * 0.18 }],
  }));

  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: R.pill, backgroundColor: color },
        animated,
      ]}
    />
  );
}

function MiniTile({
  index,
  replayKey,
  label,
  value,
}: {
  index: number;
  replayKey: number;
  label: string;
  value: string;
}) {
  return (
    <Rise index={index} replayKey={replayKey} style={{ flex: 1 }}>
      <BentoTile padding={space.tilePadSm}>
        <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
          {label}
        </Text>
        <Text
          className="mt-sm font-semibold text-stat tracking-tightest text-fg"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </BentoTile>
    </Rise>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
      {label}
    </Text>
  );
}
