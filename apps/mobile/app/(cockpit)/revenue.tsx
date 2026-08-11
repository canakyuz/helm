import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space } from "@helm/design";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import { usePayouts } from "~/hooks/use-payouts";
import { useRevenueMix } from "~/hooks/use-revenue-mix";
import { useMrrMovement } from "~/hooks/use-mrr-movement";
import { useFormatCurrency } from "~/hooks/use-format-currency";
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
  BentoSegment,
  BentoStack,
  BentoTile,
  Rise,
  SolidTile,
  type RailRow,
} from "~/components/bento";

/**
 * Donem secenekleri.
 *
 * 90 GUN YOK — bilincli. metrics tablosu ~30 gunluk pencere tutuyor; eski ekran
 * "90D" segmentini gosteriyor ama 30D ile AYNI seriyi donduruyordu (kod:
 * period === "7D" ? real.slice(-7) : real). Ayni veriyi iki farkli etiketle
 * sunmak yanlis bir derinlik ima eder. Veri penceresi genisleyince eklenir.
 */
const PERIODS = ["7G", "30G"] as const;
type Period = (typeof PERIODS)[number];

const VIEWS = ["Kırılım", "Abonelik", "Ödeme"] as const;
type View_ = (typeof VIEWS)[number];

/** Hero rakaminin stili — CountUp ve duz Text ayni gorunmeli. */
const HERO_NUMBER = {
  marginTop: 14,
  fontFamily: "Geist-600",
  fontSize: 44,
  lineHeight: 46,
  letterSpacing: -2,
} as const;

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export default function Revenue() {
  const { theme } = useTheme();
  const fmt = useFormatCurrency();
  const [period, setPeriod] = useState<Period>("30G");
  const [view, setView] = useState<View_>("Kırılım");
  const { selectedPropertyId, prioritizeRevenueRequests } = usePreferences();
  const { refreshing, onRefresh } = useScreenRefresh();
  const [replayKey, setReplayKey] = useState(0);

  const adRev = useMetricDetail("ad_revenue");
  // Birincil sorgu bitmeden ikincilleri tetikleme — bu ekranin gelir rakami
  // en onemli sey, sebeke onu beklesin.
  const ready = !prioritizeRevenueRequests || adRev.data != null || adRev.isError;
  const kpis = useCockpitKpis({ enabled: ready });
  const properties = useProperties({ enabled: ready && view !== "Kırılım" });
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;
  const mix = useRevenueMix();
  const movement = useMrrMovement(projectId, { enabled: ready && view === "Abonelik" });
  const payouts = usePayouts(projectId, { enabled: ready && view === "Ödeme" });
  const trial = useMetricDetail("subs_trial", { enabled: ready && view === "Abonelik" });

  const points = useMemo(() => {
    const all = adRev.data?.series ?? [];
    return period === "7G" ? all.slice(-7) : all;
  }, [adRev.data, period]);

  const periodTotal = useMemo(() => sum(points.map((p) => p.value)), [points]);

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (adRev.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (adRev.isError) return <ScreenStatus label="Gelir yüklenemedi" tone="danger" />;

  const totalUsers = kpis.data?.totalUsers ?? 0;
  const arpu = totalUsers > 0 ? (kpis.data?.mrr ?? 0) / totalUsers : 0;
  const trialSeries = trial.data?.series ?? [];
  const trialNow = trialSeries.length > 0 ? trialSeries[trialSeries.length - 1]!.value : null;

  return (
    <View className="flex-1 bg-canvas">
      <BentoBackground />
      <SafeAreaView edges={["top"]} className="flex-1">
        <BentoHeader
          eyebrow="GELİR"
          title="Kazanç"
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
          {/* Hero — cam, accent DEGIL: Overview'daki accent hero "bugun" icin;
              burada donem toplami var, iki ekranda iki lime hero rekabet ederdi. */}
          <Rise index={0} replayKey={replayKey}>
            <BentoTile padding={space.tilePadLg}>
              <View className="flex-row items-center justify-between">
                <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
                  REKLAM GELİRİ
                </Text>
                <BentoSegment options={PERIODS} value={period} onChange={setPeriod} />
              </View>

              <CountUp
                value={periodTotal}
                format={fmt}
                fitOneLine
                style={{ ...HERO_NUMBER, color: theme.fg }}
              />
              <Text className="mt-[6px] text-meta text-fg2">
                Son {period === "7G" ? "7" : "30"} gün · tüm projeler
              </Text>

              <View className="mt-tilePad">
                <BentoBars
                  points={points}
                  activeColor="#D4FF4D"
                  dimColor={theme.line}
                  height={70}
                  gap={3}
                  replayKey={replayKey}
                />
              </View>
            </BentoTile>
          </Rise>

          {/* Uc stat — MRR accent dolu (tasarim boyle), digerleri cam */}
          <View className="flex-row gap-tileGap">
            <Rise index={1} replayKey={replayKey} style={{ flex: 1 }}>
              <SolidTile color="#D4FF4D" padding={space.tilePadSm}>
                <Text className="font-mono-medium text-eyebrow tracking-wide text-accent-ink/[0.78]">
                  MRR
                </Text>
                <Text
                  className="mt-sm font-semibold text-stat tracking-tightest text-accent-ink"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmt(kpis.data?.mrr ?? 0)}
                </Text>
              </SolidTile>
            </Rise>
            <MiniTile index={2} replayKey={replayKey} label="ARPU" value={fmt(arpu)} />
            <MiniTile
              index={3}
              replayKey={replayKey}
              label="ABONE"
              value={formatInteger(kpis.data?.activeSubs ?? 0)}
            />
          </View>

          {/* Alt sekmeler */}
          <Rise index={4} replayKey={replayKey}>
            <BentoSegment
              options={VIEWS}
              value={view}
              onChange={setView}
              tone="chrome"
              mono={false}
              fill
            />
          </Rise>

          {view === "Kırılım" ? (
            <MixView mix={mix} fmt={fmt} replayKey={replayKey} />
          ) : view === "Abonelik" ? (
            <SubsView
              movement={movement}
              fmt={fmt}
              replayKey={replayKey}
              activeSubs={kpis.data?.activeSubs ?? 0}
              trial={trialNow}
            />
          ) : (
            <PayoutsView payouts={payouts} fmt={fmt} replayKey={replayKey} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Alt gorunumler ───────────────────────────────────────────────────────────

const SERIES_TINTS = ["#D4FF4D", "#B89CFF", "#7AA8FF", "#FF8A3D"] as const;

function MixView({
  mix,
  fmt,
  replayKey,
}: {
  mix: ReturnType<typeof useRevenueMix>;
  fmt: (n: number) => string;
  replayKey: number;
}) {
  const segments = mix.data?.segments ?? [];
  const total = mix.data?.total ?? 0;

  return (
    <Rise index={5} replayKey={replayKey}>
      <BentoTile>
        <Text className="font-semibold text-emph tracking-tight text-fg">
          Gelir kırılımı
        </Text>

        {segments.length === 0 ? (
          <Empty label={mix.isLoading ? "YÜKLENİYOR…" : "KIRILIM VERİSİ YOK"} />
        ) : (
          <>
            <View className="mt-headerY">
              <BentoStack
                parts={segments.map((s, i) => ({
                  ratio: total > 0 ? s.value / total : 0,
                  color: SERIES_TINTS[i % SERIES_TINTS.length]!,
                }))}
              />
            </View>
            <View className="mt-tilePadSm gap-[10px]">
              {segments.map((s, i) => (
                <View key={s.metric} className="flex-row items-center gap-[10px]">
                  <View
                    className="h-[9px] w-[9px] rounded-bar"
                    style={{ backgroundColor: SERIES_TINTS[i % SERIES_TINTS.length]! }}
                  />
                  <Text className="flex-1 font-medium text-row text-fg">{s.label}</Text>
                  <Text className="font-semibold text-row tracking-tight text-fg">
                    {fmt(s.value)}
                  </Text>
                  <Text className="w-[34px] text-right font-mono-medium text-[11px] text-fg3">
                    %{Math.round(s.pct)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </BentoTile>
    </Rise>
  );
}

function SubsView({
  movement,
  fmt,
  replayKey,
  activeSubs,
  trial,
}: {
  movement: ReturnType<typeof useMrrMovement>;
  fmt: (n: number) => string;
  replayKey: number;
  activeSubs: number;
  trial: number | null;
}) {
  const { theme } = useTheme();
  const segments = movement.data?.segments ?? [];
  const net = movement.data?.net ?? 0;

  // Oranlar en buyuk MUTLAK degere gore — negatif kalemler de gorunur olsun.
  const peak = Math.max(...segments.map((s) => Math.abs(s.value)), 1);
  const rows: RailRow[] = segments.map((s) => ({
    label: s.label,
    value: `${s.value >= 0 ? "+" : "−"}${fmt(Math.abs(s.value))}`,
    ratio: Math.abs(s.value) / peak,
    color: s.value >= 0 ? theme.pos : theme.neg,
  }));

  return (
    <>
      <Rise index={5} replayKey={replayKey}>
        <BentoTile>
          <View className="flex-row items-center justify-between">
            <Text className="font-semibold text-emph tracking-tight text-fg">
              MRR hareketi
            </Text>
            <Text
              className="font-mono-semibold text-body"
              style={{ color: net >= 0 ? theme.pos : theme.neg }}
            >
              net {net >= 0 ? "+" : "−"}
              {fmt(Math.abs(net))}
            </Text>
          </View>
          {rows.length === 0 ? (
            <Empty label={movement.isLoading ? "YÜKLENİYOR…" : "HAREKET VERİSİ YOK"} />
          ) : (
            <View className="mt-tilePadSm">
              <BentoRails rows={rows} replayKey={replayKey} />
            </View>
          )}
        </BentoTile>
      </Rise>

      <View className="flex-row gap-tileGap">
        <MiniTile
          index={6}
          replayKey={replayKey}
          label="AKTİF ABONE"
          value={formatInteger(activeSubs)}
        />
        <MiniTile
          index={7}
          replayKey={replayKey}
          label="DENEME"
          value={trial != null ? formatInteger(trial) : "—"}
        />
      </View>
    </>
  );
}

function PayoutsView({
  payouts,
  fmt,
  replayKey,
}: {
  payouts: ReturnType<typeof usePayouts>;
  fmt: (n: number) => string;
  replayKey: number;
}) {
  // Kaynaga gore topla. Para birimi DONUSTURULMUYOR — eski ekranin davranisi
  // buydu; finansal gosterimi sessizce degistirmek yanlis olur.
  // Time: O(n), Space: O(s) — s = benzersiz kaynak sayisi.
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payouts.data?.pending ?? []) {
      m.set(p.source, (m.get(p.source) ?? 0) + p.amount);
    }
    return [...m.entries()];
  }, [payouts.data]);

  return (
    <Rise index={5} replayKey={replayKey}>
      <BentoTile>
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-emph tracking-tight text-fg">
            Bekleyen ödeme
          </Text>
          <Text className="font-mono-medium text-[11px] text-fg3">
            {bySource.length} KAYNAK
          </Text>
        </View>

        {bySource.length === 0 ? (
          <Empty label={payouts.isLoading ? "YÜKLENİYOR…" : "BEKLEYEN ÖDEME YOK"} />
        ) : (
          <View className="mt-headerY flex-row gap-tileGap">
            {bySource.map(([source, amount]) => (
              <View key={source} className="flex-1 rounded-inner bg-tile2 p-boxPad">
                <Text className="font-mono-medium text-eyebrow tracking-wide text-fg3">
                  {source.toLocaleUpperCase("tr-TR")}
                </Text>
                <Text
                  className="mt-[6px] font-semibold text-statSm tracking-tighter text-fg"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fmt(amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </BentoTile>
    </Rise>
  );
}

// ─── Ortak parcalar ───────────────────────────────────────────────────────────

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
