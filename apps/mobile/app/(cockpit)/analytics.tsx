import { useT } from "~/lib/i18n";
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
import { flagOf, GAME_STEP_LABEL, orderedGameSteps } from "@helm/api";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import { useCountryMetrics } from "~/hooks/use-country-metrics";
import { useGameFunnels } from "~/hooks/use-game-funnels";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger, formatRatio } from "~/lib/format";
import { usePreferences } from "~/lib/preferences";
import { seriesTints } from "~/lib/labels";
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
  const t = useT();
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
  const geo = useCountryMetrics();
  const funnels = useGameFunnels(30);

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (kpis.isLoading) return <ScreenStatus label={t("Yükleniyor…")} />;
  if (kpis.isError || !kpis.data)
    return <ScreenStatus label={t("Analiz yüklenemedi")} tone="danger" />;

  const last = (d: typeof mauDetail): number | null => {
    const s = d.data?.series ?? [];
    return s.length > 0 ? s[s.length - 1]!.value : null;
  };

  const dau = kpis.data.dau;
  // `?? 0` YOK: mau serisi de toplam kullanici da olculmemisse dogru cevap
  // "bilmiyoruz". Sifir yazmak DAU ile ayni yalani soyler.
  const mau = last(mauDetail) ?? kpis.data.totalUsers;
  const session = last(sessDetail);
  // Oran olarak tutulur, yuvarlanmaz: DAU/MAU tipik olarak %1–%5 bandinda ve
  // tam sayiya yuvarlayinca 1.34 ile 1.49 ayni "%1" oluyordu.
  const stickiness = dau != null && mau != null && mau > 0 ? dau / mau : null;
  const dauPoints = (dauDetail.data?.series ?? []).slice(-SPARK_BARS);

  const f = funnels.data;

  // ── Oyun akisi ──
  //
  // Her oyunun kendi olay sozlugu var; toplamak anlamsiz veri uretir. "Tum
  // projeler" seciliyken proje basina ayri kart, tek proje seciliyken tek kart.
  const toRows = (rows: readonly { key: string; count: number }[]): FunnelRow[] => {
    const ordered = orderedGameSteps(rows);
    const peak = Math.max(...ordered.map((r) => r.count), 1);
    return ordered.map((r) => ({
      label: t(GAME_STEP_LABEL[r.key] ?? r.key),
      value: formatInteger(r.count),
      ratio: r.count / peak,
    }));
  };

  const perProject = f?.gameByProject ?? [];
  const splitFlow = selectedPropertyId === "all" && perProject.length > 1;
  const gameRows = toRows(f?.game ?? []);

  // ── Satin alma: magaza acilisi → satin alma ──
  const shopOpened = f?.game.find((g) => g.key === "shop_opened")?.count ?? 0;
  const purchaseTotal = (f?.purchases ?? []).reduce((a, p) => a + p.count, 0);
  const purchaseRows: FunnelRow[] =
    shopOpened === 0 && purchaseTotal === 0
      ? []
      : [
          {
            label: t("Mağaza açıldı"),
            value: formatInteger(shopOpened),
            ratio: 1,
          },
          {
            label: t("Satın alındı"),
            value: formatInteger(purchaseTotal),
            ratio: shopOpened > 0 ? Math.min(1, purchaseTotal / shopOpened) : 1,
            note:
              shopOpened > 0
                ? `dönüşüm ${formatRatio(purchaseTotal / shopOpened)}`
                : "mağaza açılışı ölçülmüyor",
            tone: shopOpened === 0 ? "warn" : "normal",
          },
        ];

  // Kaynak metrics_country / app_downloads — PostHog geo ucu bos donuyor.
  // Etiket "indirme": dau kirilimi 15 satir ve Mayis'ta donmus, onu kullanici
  // diye gostermek yaniltici olurdu.
  const countries = (geo.data?.rows ?? []).slice(0, TOP_COUNTRIES);
  const peak = Math.max(...countries.map((c) => c.value), 1);
  const countryRows: RailRow[] = countries.map((c, i) => ({
    label: `${flagOf(c.code)}  ${c.code}`,
    value: formatInteger(c.value),
    ratio: c.value / peak,
    color: seriesTints(theme.accent)[i % 4]!,
  }));

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow={t("ANALİZ")}
          title={t("Kullanıcılar")}
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
                  {/* "· 30G" DEGIL: bu rakam kpis.dau, yani GUNLUK aktif
                      kullanici — Ozet'teki "DAU" tile'i ile ayni deger. 30 gun
                      yazmak metrigi 30 gunluk sanmaya yol aciyordu; ustelik
                      alttaki grafik de 30 degil 14 gun. 30 gunluk olcu zaten
                      yandaki MAU. */}
                  {t("GÜNLÜK AKTİF KULLANICI")}
                </Text>
                <View className="flex-row items-center gap-[6px]">
                  <LiveDot color={theme.accent} />
                  <Text className="font-mono-medium text-eyebrow tracking-wide text-fg2">
                    {t("CANLI")}
                  </Text>
                </View>
              </View>

              {/* Olcum yoksa "—": bu projede kullanici kaynagi bagli degil,
                  "0 kullanici" demek DEGIL. Sifir yazmak "kimse oynamiyor"
                  diye okunur ve yanlis bir panik uretir. */}
              {dau != null ? (
                <CountUp
                  value={dau}
                  format={(v) => formatInteger(v)}
                  fitOneLine
                  style={{ ...HERO_NUMBER, color: theme.fg }}
                />
              ) : (
                <Text style={{ ...HERO_NUMBER, color: theme.fg3 }}>—</Text>
              )}
              <Text className="mt-[6px] text-meta text-fg2">
                MAU {mau != null ? formatInteger(mau) : "—"}
                {stickiness != null ? t("· yapışkanlık {value}", { value: formatRatio(stickiness, 1) }) : ""}
                {session != null ? ` · oturum ${fmtSession(session)}` : ""}
              </Text>

              {dauPoints.length > 1 ? (
                <View className="mt-tilePad">
                  <BentoBars
                    points={dauPoints}
                    // `theme.blue` DEGILDI: blue bir SERI rengi (palette.ts bu
                    // ayrimi acikca yaziyor), vurgu rengi degil. Ayni grafigin
                    // aktif cubugu Gelir'de accent, burada mavi cikiyordu.
                    activeColor={theme.accent}
                    dimColor={glass.chartDim}
                    height={76}
                    gap={3}
                    replayKey={replayKey}
                  />
                </View>
              ) : null}
            </BentoTile>
          </Rise>

          {splitFlow ? (
            perProject.map((proj, i) => (
              <Rise key={proj.projectId} index={1 + i} replayKey={replayKey}>
                <FunnelTile
                  title={`Akış · ${proj.projectName}`}
                  rows={toRows(proj.steps)}
                  empty="OYUN OLAYI YOK"
                  replayKey={replayKey}
                />
              </Rise>
            ))
          ) : (
            <Rise index={1} replayKey={replayKey}>
              <FunnelTile
                title={t("Oyun akışı")}
                rows={gameRows}
                empty={funnels.isLoading ? t("YÜKLENİYOR…") : t("OYUN OLAYI YOK")}
                replayKey={replayKey}
              />
            </Rise>
          )}

          <Rise index={2} replayKey={replayKey}>
            <FunnelTile
              title={t("Satın alma")}
              rows={purchaseRows}
              empty={funnels.isLoading ? t("YÜKLENİYOR…") : t("SATIN ALMA OLAYI YOK")}
              replayKey={replayKey}
            />
          </Rise>

          <Rise index={3} replayKey={replayKey}>
            <PlatformTile rows={f?.platforms ?? []} />
          </Rise>

          <Rise index={4} replayKey={replayKey}>
            <BentoTile>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  Ülkeler
                </Text>
                <Text className="font-mono-medium text-[11px] text-fg3">
                  İNDİRME · 30G
                </Text>
              </View>
              {countryRows.length === 0 ? (
                <Text className="py-tilePad font-mono-medium text-eyebrow tracking-wide text-fg3">
                  {geo.isLoading ? t("YÜKLENİYOR…") : t("ÜLKE VERİSİ YOK")}
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
