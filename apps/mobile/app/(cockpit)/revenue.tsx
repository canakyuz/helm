import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space, radius as R, press } from "@helm/design";
import { weekRange, type RevenueBucket } from "@helm/api";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useProperties } from "~/hooks/use-properties";
import { usePayouts } from "~/hooks/use-payouts";
import { useMrrMovement } from "~/hooks/use-mrr-movement";
import { useRevenueHistory } from "~/hooks/use-revenue-history";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { useScreenRefresh } from "~/hooks/use-screen-refresh";
import { formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
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

const GRAINS = ["Ay", "Hafta"] as const;
type Grain = (typeof GRAINS)[number];

const VIEWS = ["Abonelik", "Ödeme"] as const;
type View_ = (typeof VIEWS)[number];

const HERO_NUMBER = {
  marginTop: 12,
  fontFamily: "Geist-600",
  fontSize: 44,
  lineHeight: 46,
  letterSpacing: -2,
} as const;

/** Kaynak renkleri — seri ladder'i (pos/neg/warn DURUM renkleri, seri degil). */
const SOURCE_TINT: Record<string, string> = {
  ad_revenue: "#D4FF4D",
  subscription_revenue: "#B89CFF",
  iap_revenue: "#7AA8FF",
};

/** API etiketleri Ingilizce ve web ile paylasiliyor; metrik anahtarindan cevrilir. */
const SOURCE_LABEL: Record<string, string> = {
  ad_revenue: "Reklam",
  subscription_revenue: "Abonelik",
  iap_revenue: "Uygulama içi",
};

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** "2026-08" → "Ağustos" (bu yil) / "Ağustos 25" (onceki yillar). */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS_TR[(m ?? 1) - 1] ?? key;
  return y === new Date().getFullYear() ? name : `${name} ${String(y).slice(2)}`;
}

/** Hafta kovasi → "5–11 Ağu". */
function weekLabel(bucket: RevenueBucket): string {
  const { from, to } = weekRange(bucket);
  const [, , fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  return `${fd}–${td} ${MONTHS_SHORT[(tm ?? 1) - 1]}`;
}

export default function Revenue() {
  const { theme, glass } = useTheme();
  const fmt = useFormatCurrency();
  const [grain, setGrain] = useState<Grain>("Ay");
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [view, setView] = useState<View_>("Abonelik");
  const { selectedPropertyId, prioritizeRevenueRequests } = usePreferences();
  const { refreshing, onRefresh } = useScreenRefresh();
  const [replayKey, setReplayKey] = useState(0);

  const history = useRevenueHistory();
  const ready = !prioritizeRevenueRequests || history.data != null || history.isError;
  const kpis = useCockpitKpis({ enabled: ready });
  const properties = useProperties({ enabled: ready });
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;
  const movement = useMrrMovement(projectId, { enabled: ready && view === "Abonelik" });
  const payouts = usePayouts(projectId, { enabled: ready && view === "Ödeme" });
  const trial = useMetricDetail("subs_trial", { enabled: ready && view === "Abonelik" });

  const buckets = useMemo(
    () => (grain === "Ay" ? (history.data?.months ?? []) : (history.data?.weeks ?? [])),
    [history.data, grain],
  );

  // Secili kova. Granularite degisince eski anahtar gecersiz kalir — en guncel
  // doneme duser, bos ekran gostermez.
  const picked = useMemo(
    () => buckets.find((b) => b.key === pickedKey) ?? buckets[0] ?? null,
    [buckets, pickedKey],
  );

  const handleRefresh = () => {
    void onRefresh().then(() => setReplayKey((k) => k + 1));
  };

  if (history.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (history.isError) return <ScreenStatus label="Gelir yüklenemedi" tone="danger" />;

  const totalUsers = kpis.data?.totalUsers ?? 0;
  const arpu = totalUsers > 0 ? (kpis.data?.mrr ?? 0) / totalUsers : 0;
  const trialSeries = trial.data?.series ?? [];
  const trialNow = trialSeries.length > 0 ? trialSeries[trialSeries.length - 1]!.value : null;

  // Sifir kalan kaynak gizlenir — "bagli ama uretmiyor" izlenimi vermesin.
  // Ilk sifir-disi degerde kendiliginden geri gelir (activeSources API'den).
  const sources = (history.data?.activeSources ?? []).map((metric) => ({
    metric,
    value: picked?.bySource[metric] ?? 0,
  }));

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
          <Rise index={0} replayKey={replayKey}>
            <BentoTile padding={space.tilePadLg}>
              <View className="flex-row items-center justify-between">
                <Text className="font-mono-medium text-eyebrow tracking-wider text-fg3">
                  TOPLAM GELİR
                </Text>
                <BentoSegment
                  options={GRAINS}
                  value={grain}
                  onChange={(g) => {
                    setGrain(g);
                    setPickedKey(null);
                  }}
                  mono={false}
                />
              </View>

              <CountUp
                value={picked?.total ?? 0}
                format={fmt}
                fitOneLine
                style={{ ...HERO_NUMBER, color: theme.fg }}
              />
              <Text className="mt-[6px] text-meta text-fg2">
                {picked == null
                  ? "Veri yok"
                  : `${grain === "Ay" ? monthLabel(picked.key) : weekLabel(picked)} · ${picked.days.length} gün`}
              </Text>

              {/* Kaynak kirilimi — toplamin NEREDEN geldigi, dogrudan burada */}
              {sources.length > 0 && picked != null ? (
                <>
                  <View className="mt-tilePad">
                    <BentoStack
                      parts={sources.map((s) => ({
                        ratio: picked.total > 0 ? s.value / picked.total : 0,
                        color: SOURCE_TINT[s.metric] ?? theme.fg3,
                      }))}
                    />
                  </View>
                  <View className="mt-headerY gap-sm">
                    {sources.map((s) => (
                      <View key={s.metric} className="flex-row items-center gap-[10px]">
                        <View
                          className="h-[9px] w-[9px] rounded-bar"
                          style={{ backgroundColor: SOURCE_TINT[s.metric] ?? theme.fg3 }}
                        />
                        <Text className="flex-1 font-medium text-row text-fg">
                          {SOURCE_LABEL[s.metric] ?? s.metric}
                        </Text>
                        <Text className="font-semibold text-row tracking-tight text-fg">
                          {fmt(s.value)}
                        </Text>
                        <Text className="w-[38px] text-right font-mono-medium text-[11px] text-fg3">
                          %{picked.total > 0 ? Math.round((s.value / picked.total) * 100) : 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {picked != null && picked.days.length > 1 ? (
                <View className="mt-tilePad">
                  <BentoBars
                    points={picked.days}
                    activeColor="#D4FF4D"
                    dimColor={glass.chartDim}
                    height={64}
                    gap={3}
                    replayKey={replayKey}
                  />
                </View>
              ) : null}
            </BentoTile>
          </Rise>

          {/* Donem gezinmesi — yatay kaydirmali, en guncel solda */}
          <Rise index={1} replayKey={replayKey}>
            <PeriodStrip
              buckets={buckets}
              activeKey={picked?.key ?? null}
              grain={grain}
              onPick={(k) => {
                haptic.tap();
                setPickedKey(k);
              }}
            />
          </Rise>

          <View className="flex-row gap-tileGap">
            <Rise index={2} replayKey={replayKey} style={{ flex: 1 }}>
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
            <MiniTile index={3} replayKey={replayKey} label="ARPU" value={fmt(arpu)} />
            <MiniTile
              index={4}
              replayKey={replayKey}
              label="ABONE"
              value={formatInteger(kpis.data?.activeSubs ?? 0)}
            />
          </View>

          <Rise index={5} replayKey={replayKey}>
            <BentoSegment
              options={VIEWS}
              value={view}
              onChange={setView}
              tone="chrome"
              mono={false}
              fill
            />
          </Rise>

          {view === "Abonelik" ? (
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

// ─── Donem seridi ─────────────────────────────────────────────────────────────

function PeriodStrip({
  buckets,
  activeKey,
  grain,
  onPick,
}: {
  buckets: readonly RevenueBucket[];
  activeKey: string | null;
  grain: Grain;
  onPick: (key: string) => void;
}) {
  const { theme } = useTheme();

  if (buckets.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {buckets.map((b) => {
        const active = b.key === activeKey;
        return (
          <Pressable key={b.key} onPress={() => onPick(b.key)} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: R.field,
                  backgroundColor: active ? theme.chrome : theme.tile2,
                  borderWidth: 1,
                  borderColor: active ? theme.fg3 : "transparent",
                  opacity: pressed && !active ? press.opacity : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: active ? "Geist-600" : "Geist-500",
                    fontSize: 12,
                    color: active ? theme.fg : theme.fg2,
                  }}
                >
                  {grain === "Ay" ? monthLabel(b.key) : weekLabel(b)}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Alt gorunumler ───────────────────────────────────────────────────────────

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
  const peak = Math.max(...segments.map((s) => Math.abs(s.value)), 1);
  const rows: RailRow[] = segments.map((s) => ({
    label: s.label,
    value: `${s.value >= 0 ? "+" : "−"}${fmt(Math.abs(s.value))}`,
    ratio: Math.abs(s.value) / peak,
    color: s.value >= 0 ? theme.pos : theme.neg,
  }));

  return (
    <>
      <Rise index={6} replayKey={replayKey}>
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
          index={7}
          replayKey={replayKey}
          label="AKTİF ABONE"
          value={formatInteger(activeSubs)}
        />
        <MiniTile
          index={8}
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
  // Time: O(n), Space: O(s).
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payouts.data?.pending ?? []) {
      m.set(p.source, (m.get(p.source) ?? 0) + p.amount);
    }
    return [...m.entries()];
  }, [payouts.data]);

  return (
    <Rise index={6} replayKey={replayKey}>
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
