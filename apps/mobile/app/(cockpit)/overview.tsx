import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toUsd, FX_FALLBACK, type AlertSeverity } from "@helm/api";
import { space, withAlpha, type Theme } from "@helm/design";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useAlerts, useAckAlert } from "~/hooks/use-alerts";
import { useProperties, type PropertyStatus, type PropertyType } from "~/hooks/use-properties";
import { usePropertyMetrics } from "~/hooks/use-property-metrics";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { useFxRates } from "~/hooks/use-fx-rates";
import { useRevenueGoal } from "~/hooks/use-revenue-goal";
import { useRevenueMix } from "~/hooks/use-revenue-mix";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";
import { ScreenStatus } from "~/components/screen-status";
import { CountUp } from "~/components/liquid";
import {
  BentoBackground,
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

const TYPE_LABEL: Record<PropertyType, string> = {
  website: "Web",
  web_app: "Web app",
  mobile_app: "Uygulama",
  desktop_app: "Masaüstü",
  game: "Oyun",
};

const STATUS_LABEL: Record<PropertyStatus, string> = {
  healthy: "sağlıklı",
  stale: "veri bayat",
  down: "kapalı",
  unknown: "bilinmiyor",
};

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/**
 * Proje monogrami — ad'in ilk iki harfi. "Orbit Runner" → "OR".
 *
 * Noktalama ATILIR: "Wesan · Corporate site" ikinci kelime olarak "·" veriyordu,
 * monogram "W·" cikiyordu.
 */
function monogram(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (first + second).toUpperCase();
}

/** Hero rakaminin stili — CountUp ve duz Text ayni gorunmeli. */
const HERO_NUMBER = {
  marginTop: 14,
  fontFamily: "Geist-600",
  fontSize: 48,
  lineHeight: 50,
  letterSpacing: -2.2,
} as const;

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

/** "2026-08-09" → "9 AĞUSTOS". Secili gun eyebrow'da tarihi gosterir. */
function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y == null || m == null || d == null) return iso;
  return new Date(y, m - 1, d)
    .toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
    .toLocaleUpperCase("tr-TR");
}

export default function Overview() {
  const { theme } = useTheme();
  const fmt = useFormatCurrency();
  const { data: rates } = useFxRates();
  const kpis = useCockpitKpis();
  const alerts = useAlerts();
  const ack = useAckAlert();
  const properties = useProperties();
  const propMetrics = usePropertyMetrics();
  const revenue = useMetricDetail("ad_revenue");
  const appRevDetail = useMetricDetail("app_revenue");
  const crashFree = useMetricDetail("crash_free_sessions");
  const goal = useRevenueGoal();
  const mix = useRevenueMix();
  const { refreshing, onRefresh } = useScreenRefresh();

  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});
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

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data)
    return <ScreenStatus label="Cockpit yüklenemedi" tone="danger" />;

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

  const openAlerts = (alerts.data ?? []).filter((a) => !dismissed[a.id]);
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
          eyebrow="PORTFÖY"
          title="Tüm projeler"
          onSync={handleRefresh}
          syncing={refreshing}
          alertCount={openAlerts.length}
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
                  {picked != null ? formatDayLabel(picked.date) : "BUGÜN · GELİR"}
                </Text>
                {picked == null ? (
                  <View
                    className="rounded-pill px-sm py-[3px]"
                    style={{ backgroundColor: withAlpha(theme.accentInk, 0.14) }}
                  >
                    <Text
                      className="font-mono-semibold text-[11px]"
                      style={{ color: theme.accentInk }}
                    >
                      {revDelta >= 0 ? "+" : ""}
                      {revDelta.toFixed(1)}%
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
                    className="rounded-pill px-sm py-[3px] font-mono-semibold text-[11px]"
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
            <StatTile
              index={1}
              replayKey={replayKey}
              label="MRR"
              value={fmt(data.mrr)}
              delta={data.mrrDelta}
            />
            <StatTile
              index={2}
              replayKey={replayKey}
              label="DAU"
              value={formatInteger(data.dau)}
              delta={data.dauDelta}
            />
            <StatTile
              index={3}
              replayKey={replayKey}
              label="CRASH"
              value={cfNow != null ? cfNow.toFixed(1) : "—"}
              delta={cfDelta}
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
                  emptyColor={theme.line}
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
                          style={{ color: tintsFor(theme.accent)[i % 4]! }}
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

          {/* Dikkat gerekiyor */}
          {openAlerts.length > 0 ? (
            <Rise index={6} replayKey={replayKey}>
              <BentoTile>
                <Text className="font-semibold text-emph tracking-tight text-fg">
                  Dikkat gerekiyor
                </Text>
                {openAlerts.slice(0, 2).map((a) => (
                  <View
                    key={a.id}
                    className="mt-headerY border-l-2 pl-headerY"
                    // Tasarim tek kirmizi kenar kullaniyordu; elimizde gercek
                    // siddet var, onu gostermemek bilgi saklamak olurdu.
                    style={{ borderLeftColor: SEVERITY_COLOR(theme, a.severity) }}
                  >
                    <Text className="font-medium text-row tracking-tight text-fg">
                      {a.ruleName}
                    </Text>
                    <Text className="mt-[3px] text-meta leading-[18px] text-fg2">
                      {a.message} · {formatRelativeTime(a.triggeredAt)}
                    </Text>
                    <View className="mt-headerY flex-row gap-sm">
                      <Pill
                        label="Çöz"
                        background={theme.accent}
                        color={theme.accentInk}
                        onPress={() => {
                          haptic.tap();
                          ack.mutate(a.id);
                          setDismissed((d) => ({ ...d, [a.id]: true }));
                        }}
                      />
                      <Pill
                        label="Sustur"
                        background={theme.tile2}
                        color={theme.fg}
                        onPress={() => setDismissed((d) => ({ ...d, [a.id]: true }))}
                      />
                    </View>
                  </View>
                ))}
              </BentoTile>
            </Rise>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Proje monogram renkleri — seri ladder'i (pos/neg/warn DURUM renkleridir, seri degil). */
/** Proje monogram renkleri. Ilki secili accent — geri kalani sabit seri ladder'i. */
const tintsFor = (accent: string): readonly string[] => [accent, "#B89CFF", "#7AA8FF", "#FF8A3D"];

function SEVERITY_COLOR(theme: Theme, severity: AlertSeverity): string {
  if (severity === "critical") return theme.neg;
  if (severity === "warn") return theme.warn;
  return theme.blue;
}

function StatTile({
  index,
  replayKey,
  label,
  value,
  delta,
}: {
  index: number;
  replayKey: number;
  label: string;
  value: string;
  delta: number | null | undefined;
}) {
  const { theme } = useTheme();
  const hasDelta = delta != null && Number.isFinite(delta);
  // Yuvarlandiginda sifira dusen degisim "degismedi" demektir — "+0.0" yazmak
  // yanlis bir yon ima eder. Notr renkte, isaretsiz gosterilir.
  const flat = hasDelta && Math.abs(delta) < 0.05;
  const positive = (delta ?? 0) >= 0;

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
        {hasDelta ? (
          <Text
            className="mt-[6px] font-mono-medium text-[11px]"
            style={{ color: flat ? theme.fg3 : positive ? theme.pos : theme.neg }}
          >
            {flat ? "" : positive ? "+" : "−"}
            {Math.abs(delta).toFixed(1)}
          </Text>
        ) : (
          <View className="mt-[6px] h-[13px]" />
        )}
      </BentoTile>
    </Rise>
  );
}

function Pill({
  label,
  background,
  color,
  onPress,
}: {
  label: string;
  background: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      suppressHighlighting
      className="rounded-btn px-[18px] py-[9px] font-semibold text-meta"
      style={{ backgroundColor: background, color }}
    >
      {label}
    </Text>
  );
}
