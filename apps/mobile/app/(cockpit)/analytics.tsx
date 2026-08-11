import { useEffect, useState } from "react";
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
import { duration, radius as R, space } from "@helm/design";
import { GAME_STEP_LABEL, orderedGameSteps } from "@helm/api";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import { useGeoBreakdown } from "~/hooks/use-analytics";
import { useGameFunnels } from "~/hooks/use-game-funnels";
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
import { FunnelTile, PlatformTile, type FunnelRow } from "~/components/analytics";

const SPARK_BARS = 14;
const TOP_COUNTRIES = 5;

/** Ilki secili accent — geri kalani sabit seri ladder'i. */
const tintsFor = (accent: string): readonly string[] => [accent, "#B89CFF", "#7AA8FF", "#FF8A3D"];

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
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;

  const kpis = useCockpitKpis();
  const dauDetail = useMetricDetail("dau");
  const mauDetail = useMetricDetail("mau");
  const sessDetail = useMetricDetail("avg_session_sec");
  const geo = useGeoBreakdown(projectId);
  const funnels = useGameFunnels(30);

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data)
    return <ScreenStatus label="Analiz yüklenemedi" tone="danger" />;

  const last = (d: typeof mauDetail): number | null => {
    const s = d.data?.series ?? [];
    return s.length > 0 ? s[s.length - 1]!.value : null;
  };

  const dau = kpis.data.dau;
  const mau = last(mauDetail) ?? kpis.data.totalUsers ?? 0;
  const session = last(sessDetail);
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : null;
  const dauPoints = (dauDetail.data?.series ?? []).slice(-SPARK_BARS);

  const f = funnels.data;

  // ── Oyun akisi: sabit sirada, en buyuk adima gore oranli ──
  const steps = f != null ? orderedGameSteps(f.game) : [];
  const stepPeak = Math.max(...steps.map((s) => s.count), 1);
  const gameRows: FunnelRow[] = steps.map((s) => ({
    label: GAME_STEP_LABEL[s.key] ?? s.key,
    value: formatInteger(s.count),
    ratio: s.count / stepPeak,
  }));

  // ── Satin alma: magaza acilisi → satin alma ──
  const shopOpened = f?.game.find((g) => g.key === "shop_opened")?.count ?? 0;
  const purchaseTotal = (f?.purchases ?? []).reduce((a, p) => a + p.count, 0);
  const purchaseRows: FunnelRow[] =
    shopOpened === 0 && purchaseTotal === 0
      ? []
      : [
          {
            label: "Mağaza açıldı",
            value: formatInteger(shopOpened),
            ratio: 1,
          },
          {
            label: "Satın alındı",
            value: formatInteger(purchaseTotal),
            ratio: shopOpened > 0 ? Math.min(1, purchaseTotal / shopOpened) : 1,
            note:
              shopOpened > 0
                ? `dönüşüm %${Math.round((purchaseTotal / shopOpened) * 100)}`
                : "mağaza açılışı ölçülmüyor",
            tone: shopOpened === 0 ? "warn" : "normal",
          },
        ];

  const countries = (geo.data?.rows ?? []).slice(0, TOP_COUNTRIES);
  const peak = Math.max(...countries.map((c) => c.users), 1);
  const countryRows: RailRow[] = countries.map((c, i) => ({
    label: c.country_name ?? c.country,
    value: formatInteger(c.users),
    ratio: c.users / peak,
    color: tintsFor(theme.accent)[i % 4]!,
  }));

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="ANALİZ"
          title="Kullanıcılar"
          onSync={handleRefresh}
          syncing={refreshing}
          picker
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
          {/* Kim — sayaç. Geri kalan ekran "ne yapıyorlar"ı anlatır. */}
          <Rise index={0} replayKey={replayKey}>
            <BentoTile padding={space.tilePadLg}>
              <View className="flex-row items-center justify-between">
                <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
                  AKTİF KULLANICI · 30G
                </Text>
                <View className="flex-row items-center gap-[6px]">
                  <LiveDot color={theme.accent} />
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
                {session != null ? ` · oturum ${fmtSession(session)}` : ""}
              </Text>

              {dauPoints.length > 1 ? (
                <View className="mt-tilePad">
                  <BentoBars
                    points={dauPoints}
                    activeColor={theme.blue}
                    dimColor={glass.chartDim}
                    height={76}
                    gap={3}
                    replayKey={replayKey}
                  />
                </View>
              ) : null}
            </BentoTile>
          </Rise>

          <Rise index={1} replayKey={replayKey}>
            <FunnelTile
              title="Oyun akışı"
              rows={gameRows}
              empty={funnels.isLoading ? "YÜKLENİYOR…" : "OYUN OLAYI YOK"}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={2} replayKey={replayKey}>
            <FunnelTile
              title="Satın alma"
              rows={purchaseRows}
              empty={funnels.isLoading ? "YÜKLENİYOR…" : "SATIN ALMA OLAYI YOK"}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={3} replayKey={replayKey}>
            <PlatformTile rows={f?.platforms ?? []} />
          </Rise>

          <Rise index={4} replayKey={replayKey}>
            <BentoTile>
              <Text className="font-semibold text-emph tracking-tight text-fg">
                Ülkeler
              </Text>
              {countryRows.length === 0 ? (
                <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
                  {geo.isLoading ? "YÜKLENİYOR…" : "ÜLKE VERİSİ YOK"}
                </Text>
              ) : (
                <View className="mt-tilePadSm">
                  <BentoRails rows={countryRows} replayKey={replayKey} />
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
