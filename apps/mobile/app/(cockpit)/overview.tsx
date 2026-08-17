import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toUsd, FX_FALLBACK, type AlertSeverity } from "@helm/api";
import { space, withAlpha, type Theme } from "@helm/design";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useDataCoverage } from "~/hooks/use-data-coverage";
import { useAlerts, useAckAlert } from "~/hooks/use-alerts";
import { useProperties, type PropertyStatus, type PropertyType } from "~/hooks/use-properties";
import { usePropertyMetrics } from "~/hooks/use-property-metrics";
import { useFormatCurrency, useFormatCurrencyCompact } from "~/hooks/use-format-currency";
import { useFxRates } from "~/hooks/use-fx-rates";
import { useRevenueGoal } from "~/hooks/use-revenue-goal";
import { useRevenueMix } from "~/hooks/use-revenue-mix";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatDelta, formatInteger, formatPercent, formatRelativeTime, isFlatDelta } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import {
  longDayLabel,
  monogram,
  MONTHS_TR,
  seriesTints,
  STATUS_LABEL,
  TYPE_LABEL,
} from "~/lib/labels";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { CountUp } from "~/components/liquid";
import { AttentionTile, StatTile, statFontSize, toItems } from "~/components/overview";
import { useT } from "~/lib/i18n";
import {
  BentoBackground,
  HERO_NUMBER,
  BentoBars,
  BentoHeader,
  BentoTile,
  Rise,
  SegmentMeter,
  SolidTile,
} from "~/components/bento";

/** Hero sparkline'daki cubuk sayisi — tasarim 10 kullaniyor. */
const SPARK_BARS = 10;
/** Listede gosterilen proje sayisi; toplam basliktaki sayida kalir. */
const TOP_N = 5;

/** Hero rakaminin stili — CountUp ve duz Text ayni gorunmeli. */
/**
 * Iki gunluk seriyi tarihe gore toplar.
 *
 * NEDEN GEREKLI: hero'daki rakam reklam + magaza gelirinin toplami, ama sparkline
 * sadece ad_revenue serisinden geliyordu. Bir cubuga basinca basliktakinden BASKA
 * bir metrik gorunurdu. Ayni sayiyi gostermeleri sart.
 *
 * Time: O(n+m), Space: O(n+m).
 */
function mergeSeries(
  a: readonly { date: string; value: number }[],
  b: readonly { date: string; value: number }[],
): { date: string; value: number }[] {
  const byDate = new Map<string, number>();
  for (const p of a) byDate.set(p.date, p.value);
  for (const p of b) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
  return [...byDate.entries()]
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    .map(([date, value]) => ({ date, value }));
}

/**
 * Bir gunun serideki degeri ve bir onceki OLCUME gore yuzde degisimi.
 *
 * date verilmezse (gun secili degil) null doner — cagiran taraf bugunun
 * kpi'sine duser. Seride o gun YOKSA da null: sifir gostermek "o gun sifirdi"
 * demek olurdu, oysa dogru cevap "olcum yok".
 *
 * Onceki nokta takvimsel dun DEGIL, seride bir onceki gun: veri bosluklu
 * oldugunda "dune gore" demek yaniltirdi.
 */
function dayPoint(
  series: ReadonlyArray<{ date: string; value: number }>,
  date: string | undefined,
  /** "percent" yuzde degisim; "points" ham fark. Crash-free zaten bir yuzde —
   *  %99.5'ten %99.0'a dusus "%0.5 dustu" degil "0.5 PUAN dustu"dur. */
  deltaMode: "percent" | "points" = "percent",
): { value: number; delta: number | null } | null {
  if (date == null) return null;
  const i = series.findIndex((p) => p.date === date);
  if (i < 0) return null;
  const value = series[i]!.value;
  const prev = i > 0 ? series[i - 1]!.value : null;
  if (prev == null) return { value, delta: null };
  if (deltaMode === "points") return { value, delta: Number((value - prev).toFixed(1)) };
  return { value, delta: prev !== 0 ? ((value - prev) / prev) * 100 : null };
}

export default function Overview() {
  const t = useT();
  const { theme, glass } = useTheme();
  const fmt = useFormatCurrency();
  // Stat kutularinda kurussuz: uzun deger tum satirin punto'sunu dusuruyordu.
  const fmtStat = useFormatCurrencyCompact();
  const { data: rates } = useFxRates();
  const kpis = useCockpitKpis();
  const alerts = useAlerts();
  const coverage = useDataCoverage();
  const ack = useAckAlert();
  const properties = useProperties();
  const propMetrics = usePropertyMetrics();
  const revenue = useMetricDetail("ad_revenue");
  const appRevDetail = useMetricDetail("app_revenue");
  const crashFree = useMetricDetail("crash_free_sessions");
  // Gun secilince alttaki kartlar da O GUNU gostermeli. kpis yalnizca bugunun
  // anlik goruntusu; onceki hal gecmis bir gun secilince hero'yu degistirip
  // altindaki uc karti bugunde birakiyordu — ekran iki farkli gunu ayni anda
  // gosteriyor ve secim calismiyormus gibi duruyordu.
  const mrrDetail = useMetricDetail("mrr");
  const dauDetail = useMetricDetail("dau");
  const goal = useRevenueGoal();
  const mix = useRevenueMix();
  const { refreshing, onRefresh } = useScreenRefresh();

  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  // Yenileme sayaci: giris animasyonlarini SADECE taze veri geldiginde tekrar
  // oynatir. Sekme degisiminde oynatmaz — o siklikta animasyon gecikme demek
  // (packages/design/src/motion.ts → replayOn).
  const [replayKey, setReplayKey] = useState(0);
  /** Hero'da hangi gun gosteriliyor. null = bugun. */
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const sparkPoints = useMemo(
    () =>
      mergeSeries(revenue.data?.series ?? [], appRevDetail.data?.series ?? []).slice(
        -SPARK_BARS,
      ),
    [revenue.data, appRevDetail.data],
  );

  if (kpis.isLoading) return <ScreenStatus label={t("Yükleniyor…")} />;
  if (kpis.isError || !kpis.data)
    return <ScreenStatus label={t("Cockpit yüklenemedi")} tone="danger" />;

  const data = kpis.data;

  // Hero = GUNLUK gelir (bugun reklam + magaza). Hepsi USD canonical; fmt secili
  // para birimine cevirir.
  const todayRevenue = (revenue.data?.today ?? 0) + (appRevDetail.data?.today ?? 0);
  const yestRevenue = (revenue.data?.yesterday ?? 0) + (appRevDetail.data?.yesterday ?? 0);
  const revDelta = yestRevenue > 0 ? ((todayRevenue - yestRevenue) / yestRevenue) * 100 : 0;

  const cfSeries = (crashFree.data?.series ?? []).map((p) => p.value);
  const cfNow = cfSeries.length > 0 ? cfSeries[cfSeries.length - 1]! : null;
  const cfDelta =
    cfSeries.length > 1
      ? Number((cfNow! - cfSeries[cfSeries.length - 2]!).toFixed(1))
      : null;

  // Ilerleme = bu ayin GERCEK geliri (revenue-mix toplami), MRR projeksiyonu degil.
  const goalTarget =
    goal.data?.target_amount != null
      ? toUsd(goal.data.target_amount, goal.data.currency, rates ?? FX_FALLBACK)
      : null;
  const goalCurrent = mix.data?.total ?? 0;
  const goalRatio = goalTarget != null && goalTarget > 0 ? goalCurrent / goalTarget : 0;

  // Secili gun. Yenileme seriyi kisaltabilecegi icin indeks dogrulanir —
  // aksi halde eski bir indeks undefined'a duser.
  const picked = selectedDay != null ? (sparkPoints[selectedDay] ?? null) : null;

  // Secili gun varsa kartlar o gunun serisinden okur; yoksa bugunun kpi'si.
  const mrrDay = dayPoint(mrrDetail.data?.series ?? [], picked?.date);
  const dauDay = dayPoint(dauDetail.data?.series ?? [], picked?.date);
  const cfDay = dayPoint(crashFree.data?.series ?? [], picked?.date, "points");

  // Uc kutunun metinleri once uretilir; ortak rakam boyutu EN UZUNUNA gore
  // secilip ucune de verilir (bkz. statFontSize). Aksi halde her kutu kendi
  // basina kuculuyor ve satirin tipografik ritmi bozuluyordu.
  const mrrText =
    picked != null ? (mrrDay != null ? fmtStat(mrrDay.value) : "—") : data.mrr != null ? fmtStat(data.mrr) : "—";
  const dauText =
    picked != null
      ? (dauDay != null ? formatInteger(dauDay.value) : "—")
      : data.dau != null
        ? formatInteger(data.dau)
        : "—";
  const crashText =
    picked != null
      ? (cfDay != null ? formatPercent(cfDay.value, 1) : "—")
      : cfNow != null
        ? formatPercent(cfNow, 1)
        : "—";
  const statSize = statFontSize([mrrText, dauText, crashText]);

  // Kaydedilmis uyarilar ve turetilen veri sinyalleri TEK LISTE: kullanici
  // acisindan ikisi de "dikkat gerektiren sey". Kaynak ayrimi aksiyonlarda
  // duruyor (turetilende "Çöz" yok).
  const attention = toItems(alerts.data ?? [], coverage.data ?? []).filter(
    (it) => !dismissed[it.key],
  );
  const allProjects = properties.data ?? [];
  const visibleProjects = allProjects.slice(0, TOP_N);

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow={t("PORTFÖY")}
          title={t("Tüm projeler")}
          onSync={handleRefresh}
          syncing={refreshing}
          picker
          alertCount={attention.length}
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
          {/* Hero — accent dolgu, cam DEGIL: accent'in altinda bulaniklastiracak
              bir sey yok, cam orada sadece rengi kirletirdi. */}
          <Rise index={0} replayKey={replayKey}>
            <SolidTile color={theme.accent} padding={space.tilePadLg}>
              <View className="flex-row items-center justify-between">
                {/* .60 alfa 10px'te 4.70:1 ile sinirdaydi; .78 → 8.64:1. */}
                <Text className="font-mono-medium text-eyebrow tracking-wider"
                  style={{ color: withAlpha(theme.accentInk, 0.78) }}>
                  {picked != null ? longDayLabel(picked.date) : t("BUGÜN · GELİR")}
                </Text>
                {picked == null ? (
                  // Rozet accent zeminin UZERINDE duruyor. Onceki hal ink'i .14
                  // alfayla zemine katiyordu: hem koyu hem acik temada rozet
                  // accent'ten ayirt edilemiyordu (alti da ustu de ayni renk
                  // ailesi). Cozum ters kontrast — hero sayisinin kullandigi
                  // ink/accent ciftinin AYNISI, sadece yer degistirmis halde.
                  // px-sm / py-xs ARTIK gercek deger uretiyor: olcekte `sm` ve
                  // `xs` yoktu, Tailwind'in varsayilaninda da yok — rozet
                  // padding'siz, metin kenara yapisik duruyordu (scale.ts).
                  <View
                    className="rounded-pill px-sm py-xs"
                    style={{ backgroundColor: theme.accentInk }}
                  >
                    <Text
                      className="font-mono-semibold text-[11px]"
                      style={{ color: theme.accent }}
                    >
                      {formatDelta(revDelta)}
                    </Text>
                  </View>
                ) : (
                  // Gecmis bir gun secildiginde delta gizlenir: o oran "dun'e
                  // gore bugun" demek, secili gunle ilgisi yok.
                  // Delta pill ile AYNI dikey olculer: pill'in padding'i varken
                  // bu duz metin olsa satir alcalir ve cubuga her basista tum
                  // duzen yukari ziplardi.
                  <Text
                    onPress={() => {
                      haptic.tap();
                      setSelectedDay(null);
                    }}
                    suppressHighlighting
                    className="rounded-pill px-sm py-xs font-mono-semibold text-[11px]"
                    style={{ color: withAlpha(theme.accentInk, 0.78) }}
                  >
                    BUGÜNE DÖN ✕
                  </Text>
                )}
              </View>

              {picked != null ? (
                // Secim degisiminde sayac YOK: cubuklara arka arkaya basilir,
                // her seferinde 900ms saymak etkilesimi agirlastirir.
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[HERO_NUMBER, { color: theme.accentInk }]}
                >
                  {fmt(picked.value)}
                </Text>
              ) : (
                <CountUp value={todayRevenue} format={fmt} fitOneLine style={[HERO_NUMBER, { color: theme.accentInk }]} />
              )}

              <View className="mt-tilePadSm">
                <BentoBars
                  points={sparkPoints}
                  activeColor={theme.accentInk}
                  // .22 alfa zemine karsi 1.61:1 idi — grafik goruunmuyordu.
                  // .50 → 3.42:1 (non-text esigi 3:1) ve vurgulu barla 4.75:1.
                  dimColor={withAlpha(theme.accentInk, 0.5)}
                  height={44}
                  selectedIndex={selectedDay}
                  onSelect={(i) => {
                    haptic.tap();
                    setSelectedDay((prev) => (prev === i ? null : i));
                  }}
                  replayKey={replayKey}
                />
              </View>
            </SolidTile>
          </Rise>

          {/* Uc kucuk stat — cam */}
          <View className="flex-row gap-tileGap">
            {/* Gun secildiginde uc kart da O GUNU gosterir. Secili gun seride
                yoksa "—": o gun icin olcum yok demek, sifir demek degil. */}
            <StatTile
              index={1}
              replayKey={replayKey}
              label="MRR"
              value={mrrText}
              delta={picked != null ? mrrDay?.delta : data.mrrDelta}
              fontSize={statSize}
              note={mrrText === "—" ? t("ölçüm yok") : undefined}
            />
            <StatTile
              index={2}
              replayKey={replayKey}
              label="DAU"
              value={dauText}
              delta={picked != null ? dauDay?.delta : data.dauDelta}
              fontSize={statSize}
              note={dauText === "—" ? t("ölçüm yok") : undefined}
            />
            <StatTile
              index={3}
              replayKey={replayKey}
              label="CRASH"
              value={crashText}
              note={crashText === "—" ? t("ölçüm yok") : undefined}
              fontSize={statSize}
              // Crash-free'de delta YUZDE DEGISIM degil PUAN farki: %99.5'ten
              // %99.0'a dusus "%0.5 dustu" degil "0.5 puan dustu".
              delta={picked != null ? cfDay?.delta : cfDelta}
            />
          </View>

          {/* Aylik hedef */}
          <Rise index={4} replayKey={replayKey}>
            <BentoTile>
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  {MONTHS_TR[new Date().getMonth()]} hedefi
                </Text>
                {goalTarget != null ? (
                  <Text className="font-mono-semibold text-body text-fg2">
                    {fmt(goalCurrent)} <Text className="text-fg3">/ {fmt(goalTarget)}</Text>
                  </Text>
                ) : (
                  <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                    AYARLARDAN BELİRLE
                  </Text>
                )}
              </View>
              <View className="mt-headerY">
                <SegmentMeter
                  ratio={goalRatio}
                  filledColor={theme.accent}
                  // `theme.line` DEGIL: hairline rengi cam yuzeye karsi 1.3:1,
                  // bos segmentler her iki temada da tamamen kayboluyordu.
                  // chartDim bu is icin olculmus token (bkz glass.ts).
                  emptyColor={glass.chartDim}
                  replayKey={replayKey}
                />
              </View>
            </BentoTile>
          </Rise>

          {/* Projeler */}
          <Rise index={5} replayKey={replayKey}>
            <BentoTile>
              <View className="mb-xs flex-row items-center justify-between">
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  Projeler
                </Text>
                <Text className="font-mono-medium text-[11px] text-fg3">
                  {allProjects.length}
                </Text>
              </View>

              {visibleProjects.length === 0 ? (
                <Text className="py-rowY font-mono-medium text-eyebrow tracking-wide text-fg3">
                  HENÜZ PROJE YOK
                </Text>
              ) : (
                visibleProjects.map((p, i) => {
                  const pm = propMetrics.data?.[p.id];
                  return (
                    <View
                      key={p.id}
                      className="flex-row items-center gap-rowY border-t border-line py-rowY"
                    >
                      <View className="h-[36px] w-[36px] items-center justify-center rounded-icon bg-tile2">
                        <Text
                          className="font-semibold text-meta"
                          style={{ color: seriesTints(theme.accent)[i % 4]! }}
                        >
                          {monogram(p.name)}
                        </Text>
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text
                          className="font-medium text-emph tracking-tight text-fg"
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        {/* Tur + durum. brandName KULLANILMIYOR: cogu projede
                            marka adi proje adiyla ayni, satir "Block Forge ·
                            Block Forge" diye tekrar ediyordu. */}
                        <Text className="mt-[1px] text-meta text-fg3" numberOfLines={1}>
                          {TYPE_LABEL[p.type] ?? p.type} · {STATUS_LABEL[p.status]}
                        </Text>
                      </View>
                      {/* Proje bazli delta kaynagi yok — uydurmak yerine
                          yalnizca gelir gosteriliyor (design.md §10). */}
                      <Text className="font-semibold text-emph tracking-tighter text-fg">
                        {pm != null ? fmt(pm.adRevenue) : "—"}
                      </Text>
                    </View>
                  );
                })
              )}
            </BentoTile>
          </Rise>

          {/* Dikkat gerekiyor — kaydedilmis uyarilar + turetilen veri sinyalleri */}
          <Rise index={6} replayKey={replayKey}>
            <AttentionTile
              items={attention}
              onResolve={(eventId, key) => {
                ack.mutate(eventId);
                setDismissed((d) => ({ ...d, [key]: true }));
              }}
              onMute={(key) => {
                haptic.tap();
                setDismissed((d) => ({ ...d, [key]: true }));
              }}
            />
          </Rise>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}




