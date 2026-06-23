import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import { usePropertyMetrics } from "~/hooks/use-property-metrics";
import { usePayouts } from "~/hooks/use-payouts";
import { useRevenueMix } from "~/hooks/use-revenue-mix";
import { useMrrMovement } from "~/hooks/use-mrr-movement";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { usePreferences } from "~/lib/preferences";
import { formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { colors, type } from "~/theme/tokens";
import {
  LiquidBackground,
  LiquidHeader,
  LiquidGlass,
  OpenHero,
  CardSection,
  FullDivider,
  Row,
  KV,
  HBar,
  StackBar,
  AreaChart,
  NativeSegmented,
  Glyph,
  Eyebrow,
  Delta,
  EmptyHint,
  ShowMore,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

const TOP_N = 5; // glance-first lists: show the top few, total stays in the header

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7D" | "30D" | "90D";
type TabView = "Mix" | "Subs" | "Payouts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GLYPH_TINTS = [colors.accent, colors.accentViolet, colors.blue, colors.green];
const PROJECT_GLYPHS = ["◆", "✦", "❖", "◇"];

// Time:  O(n) series length; Space: O(1) auxiliary.
// Note:  Single pass is optimal because every value contributes to the total.
function sumSeries(arr: number[]): number {
  let total = 0;
  for (const v of arr) total += v;
  return total;
}

// ─── Mix tab ──────────────────────────────────────────────────────────────────

function MixView({
  fmt,
  queriesEnabled,
}: {
  fmt: (n: number) => string;
  queriesEnabled: boolean;
}) {
  const properties = useProperties({ enabled: queriesEnabled });
  const propMetrics = usePropertyMetrics({ enabled: queriesEnabled });
  const mix = useRevenueMix({ enabled: queriesEnabled });
  const segments = mix.data?.segments ?? [];
  const [openSplit, setOpenSplit] = useState<string | null>(null);
  const [openEarner, setOpenEarner] = useState<string | null>(null);

  // Real per-project earnings: rank by ad_revenue + mrr from the metrics table.
  const earners = useMemo(() => {
    const m = propMetrics.data ?? {};
    return (properties.data ?? [])
      .map((p) => ({ p, rev: (m[p.id]?.adRevenue ?? 0) + (m[p.id]?.mrr ?? 0) }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 4);
  }, [properties.data, propMetrics.data]);
  const maxEarn = earners[0]?.rev ?? 0;

  return (
    <>
      {/* Revenue mix */}
      <CardSection index="01" title="Revenue mix" pt={14}>
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          {/* Bu ay tahsil edilen gelir (akış) — üstteki MRR anlık run-rate'tir, farklı. */}
          <Eyebrow size={9}>BU AY · KAYNAĞA GÖRE (MRR HARIC)</Eyebrow>
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
          {!queriesEnabled || mix.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : (mix.data?.total ?? 0) === 0 ? (
            <EmptyHint>NO REVENUE THIS MONTH</EmptyHint>
          ) : (
            <>
              <StackBar
                segments={segments.map((s) => ({ pct: s.pct, color: s.color }))}
                height={14}
              />
              {segments.map((s, i) => {
                const open = openSplit === s.label;
                return (
                  <Row
                    key={s.label}
                    open={open}
                    onToggle={() => {
                      haptic.tap();
                      setOpenSplit(open ? null : s.label);
                    }}
                    isLast={i === segments.length - 1}
                    header={
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: s.color }}
                        />
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: "Geist-600",
                            fontSize: type.body,
                            color: colors.fgPrimary,
                            letterSpacing: -0.2,
                          }}
                          numberOfLines={1}
                        >
                          {s.label}
                        </Text>
                        <Text
                          style={{ fontFamily: "GeistMono-600", fontSize: type.body, color: s.color }}
                        >
                          {fmt(s.value)}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "GeistMono-500",
                            fontSize: type.label,
                            color: colors.fgMuted,
                            width: 32,
                            textAlign: "right",
                          }}
                        >
                          {s.pct}%
                        </Text>
                      </View>
                    }
                    detail={
                      <KV
                        items={[
                          { label: "This month", value: fmt(s.value), color: s.color },
                          { label: "Share", value: `${s.pct}%` },
                        ]}
                      />
                    }
                  />
                );
              })}
            </>
          )}
        </View>
      </CardSection>

      <FullDivider />

      {/* Top earners */}
      <CardSection
        index="02"
        title="Top earners"
        action="SEE ALL"
        onAction={() => haptic.tap()}
        pt={14}
      >
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Eyebrow size={9}>REVENUE PER PROJECT · TODAY</Eyebrow>
        </View>
        {!queriesEnabled ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : earners.length === 0 ? (
          <EmptyHint>NO PROJECTS FOUND</EmptyHint>
        ) : (
          earners.map(({ p: prop, rev }, i) => {
            const tint = GLYPH_TINTS[i % GLYPH_TINTS.length]!;
            const glyph = PROJECT_GLYPHS[i % PROJECT_GLYPHS.length]!;
            const pct = maxEarn > 0 ? Math.round((rev / maxEarn) * 100) : 0;
            const m = propMetrics.data?.[prop.id];
            const open = openEarner === prop.id;
            return (
              <Row
                key={prop.id}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenEarner(open ? null : prop.id);
                }}
                isLast={i === earners.length - 1}
                header={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Glyph glyph={glyph} tint={tint} size={28} />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text
                        style={{
                          fontFamily: "Geist-600",
                          fontSize: type.body,
                          color: colors.fgPrimary,
                          letterSpacing: -0.2,
                        }}
                        numberOfLines={1}
                      >
                        {prop.name}
                      </Text>
                      <View style={{ width: "80%" }}>
                        <HBar pct={pct} color={tint} height={5} />
                      </View>
                    </View>
                    <Text
                      style={{ fontFamily: "GeistMono-600", fontSize: type.body, color: tint }}
                    >
                      {fmt(rev)}
                    </Text>
                  </View>
                }
                detail={
                  <KV
                    items={[
                      { label: "Ad revenue", value: fmt(m?.adRevenue ?? 0), color: colors.accent },
                      { label: "MRR", value: fmt(m?.mrr ?? 0), color: colors.accentViolet },
                      { label: "DAU", value: formatInteger(m?.dau ?? 0), color: colors.blue },
                      { label: "Type", value: prop.type.replace("_", " ").toUpperCase() },
                    ]}
                  />
                }
              />
            );
          })
        )}
        <View style={{ height: 8 }} />
      </CardSection>

    </>
  );
}

// ─── Subs tab ─────────────────────────────────────────────────────────────────

function SubsView({
  fmt,
  chartW,
  activeSubs,
  trial,
  projectId,
  queriesEnabled,
}: {
  fmt: (n: number) => string;
  chartW: number;
  activeSubs: number;
  trial: number | null;
  projectId?: string | undefined;
  queriesEnabled: boolean;
}) {
  const [openMrr, setOpenMrr] = useState<string | null>(null);
  const [showAllMoves, setShowAllMoves] = useState(false);
  const mrr = useMrrMovement(projectId, { enabled: queriesEnabled });
  const moves = useMemo(() => mrr.data?.segments ?? [], [mrr.data?.segments]);
  const visibleMoves = showAllMoves ? moves : moves.slice(0, TOP_N);
  // Time:  O(n) movement count; Space: O(1) auxiliary.
  // Note:  Single pass avoids allocating an intermediate absolute-value array.
  const maxAbs = useMemo(() => {
    let max = 1;
    for (const move of moves) {
      max = Math.max(max, Math.abs(move.value));
    }
    return max;
  }, [moves]);
  const segColor = (v: number) => (v >= 0 ? colors.green : colors.accentDanger);

  // Real daily MRR series (metrics table) → real trend chart + delta.
  const mrrDetail = useMetricDetail("mrr", { enabled: queriesEnabled });
  const mrrSeries = (mrrDetail.data?.series ?? []).map((p) => p.value);
  const mrrDelta =
    mrrSeries.length >= 2 && mrrSeries[0]! > 0
      ? Number((((mrrSeries[mrrSeries.length - 1]! - mrrSeries[0]!) / mrrSeries[0]!) * 100).toFixed(1))
      : undefined;

  return (
    <>
      {/* MRR movement */}
      <CardSection
        index="01"
        title="MRR movement"
        {...(mrr.data ? { action: `net ${mrr.data.net >= 0 ? "+" : ""}${fmt(mrr.data.net)}` } : {})}
        pt={14}
      >
        {!queriesEnabled ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : !projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : mrr.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : moves.length === 0 ? (
          <EmptyHint>NO MRR MOVEMENT DATA</EmptyHint>
        ) : (
          <>
          {visibleMoves.map((m, i) => {
            const open = openMrr === m.label;
            const pct = Math.round((Math.abs(m.value) / maxAbs) * 100);
            const color = segColor(m.value);
            return (
              <Row
                key={m.label}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenMrr(open ? null : m.label);
                }}
                isLast={i === visibleMoves.length - 1}
                header={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text
                      style={{
                        fontFamily: "Geist-600",
                        fontSize: type.body,
                        color: colors.fgPrimary,
                        width: 88,
                        letterSpacing: -0.2,
                        textTransform: "capitalize",
                      }}
                      numberOfLines={1}
                    >
                      {m.label}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <HBar pct={pct} color={color} height={6} />
                    </View>
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: type.body,
                        color,
                        width: 72,
                        textAlign: "right",
                      }}
                    >
                      {m.value > 0 ? "+" : ""}
                      {fmt(m.value)}
                    </Text>
                  </View>
                }
                detail={
                  <KV
                    items={[
                      {
                        label: "Amount",
                        value: `${m.value > 0 ? "+" : ""}${fmt(m.value)}`,
                        color,
                      },
                      { label: "Share of movement", value: `${pct}%` },
                    ]}
                  />
                }
              />
            );
          })}
          <ShowMore
            hidden={moves.length - TOP_N}
            expanded={showAllMoves}
            onPress={() => {
              haptic.tap();
              setShowAllMoves((v) => !v);
            }}
          />
          </>
        )}
        <View style={{ height: 8 }} />
      </CardSection>

      <FullDivider />

      {/* Subscription stats — real only (active subs + trials) */}
      <CardSection index="02" title="Subscriptions" pt={14}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 16,
            gap: 8,
          }}
        >
          {(
            [
              { label: "Active subs", value: formatInteger(activeSubs), color: colors.green },
              { label: "Trials", value: trial != null ? formatInteger(trial) : "—", color: colors.accentViolet },
            ] as const
          ).map((stat) => (
            <View
              key={stat.label}
              style={{
                width: "47%",
                padding: 12,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.07)",
                gap: 4,
              }}
            >
              <Eyebrow size={9}>{stat.label}</Eyebrow>
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: type.stat,
                  color: stat.color,
                  letterSpacing: -0.5,
                }}
              >
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      </CardSection>

      <FullDivider />

      {/* MRR trend — real daily MRR series from the metrics table */}
      <CardSection index="03" title="MRR trend" pt={14}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          {!queriesEnabled || mrrDetail.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : mrrSeries.length < 2 ? (
            <EmptyHint>NO MRR DATA</EmptyHint>
          ) : (
            <>
              <AreaChart data={mrrSeries} width={chartW - 8} height={72} color={colors.accentViolet} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "GeistMono-500", fontSize: type.label, color: colors.fgSubtle }}>
                  {mrrSeries.length} days
                </Text>
                {mrrDelta != null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Delta value={mrrDelta} size={10} invert={false} />
                    <Text style={{ fontFamily: "GeistMono-500", fontSize: type.label, color: colors.fgMuted }}>
                      over window
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </CardSection>
    </>
  );
}

// ─── Payouts tab ──────────────────────────────────────────────────────────────

function PayoutsView({
  fmt,
  projectId,
  queriesEnabled,
}: {
  fmt: (n: number) => string;
  projectId?: string | undefined;
  queriesEnabled: boolean;
}) {
  const [openPayout, setOpenPayout] = useState<string | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const q = usePayouts(projectId, { enabled: queriesEnabled });
  const pending = useMemo(() => q.data?.pending ?? [], [q.data?.pending]);
  const recent = useMemo(() => q.data?.recent ?? [], [q.data?.recent]);
  const visibleRecent = showAllRecent ? recent : recent.slice(0, TOP_N);

  // Pending'i kaynağa göre topla.
  // Time:  O(n) pending payouts; Space: O(s) unique sources.
  // Note:  Map gives O(1) average source aggregation without nested scans.
  const pendingBySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pending) m.set(p.source, (m.get(p.source) ?? 0) + p.amount);
    return [...m.entries()].map(([source, amount]) => ({ source, amount }));
  }, [pending]);

  const PENDING_COLORS = [colors.accent, colors.accentViolet, colors.blue];

  return (
    <>
      {/* Pending balance */}
      <CardSection index="01" title="Pending balance" pt={14}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          {!queriesEnabled ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : !projectId ? (
            <EmptyHint>SELECT A PROJECT</EmptyHint>
          ) : q.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : pendingBySource.length === 0 ? (
            <EmptyHint>NO PENDING PAYOUTS</EmptyHint>
          ) : (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {pendingBySource.map((block, i) => {
                const color = PENDING_COLORS[i % PENDING_COLORS.length]!;
                return (
                  <View
                    key={block.source}
                    style={{
                      flex: 1,
                      minWidth: "45%",
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderWidth: 1,
                      borderColor: `${color}33`,
                      gap: 8,
                    }}
                  >
                    <Eyebrow size={9} color={color}>
                      {block.source}
                    </Eyebrow>
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: type.stat,
                        color,
                        letterSpacing: -0.5,
                      }}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {fmt(block.amount)}
                    </Text>
                    <Text
                      style={{ fontFamily: "GeistMono-500", fontSize: type.label, color: colors.fgMuted }}
                    >
                      PENDING
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </CardSection>

      <FullDivider />

      {/* Recent payouts */}
      <CardSection index="02" title="Recent payouts" {...(recent.length ? { count: recent.length } : {})} pt={14}>
        {!queriesEnabled ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : !projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : q.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : recent.length === 0 ? (
          <EmptyHint>NO RECENT PAYOUTS</EmptyHint>
        ) : (
          <>
          {visibleRecent.map((p, i) => {
            const key = `${p.source}-${p.arrival_date}-${i}`;
            const open = openPayout === key;
            return (
              <Row
                key={key}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenPayout(open ? null : key);
                }}
                isLast={i === visibleRecent.length - 1}
                header={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.green }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontFamily: "Geist-600",
                          fontSize: type.body,
                          color: colors.fgPrimary,
                          letterSpacing: -0.2,
                        }}
                        numberOfLines={1}
                      >
                        {p.source}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "GeistMono-500",
                          fontSize: type.label,
                          color: colors.fgMuted,
                          letterSpacing: 0.4,
                        }}
                      >
                        {p.arrival_date} · {p.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "GeistMono-600", fontSize: type.body, color: colors.green }}>
                      +{fmt(p.net)}
                    </Text>
                  </View>
                }
                detail={
                  <KV
                    items={[
                      { label: "Net", value: fmt(p.net), color: colors.green },
                      { label: "Currency", value: p.currency },
                      { label: "Status", value: p.status },
                      { label: "Arrival", value: p.arrival_date },
                    ]}
                  />
                }
              />
            );
          })}
          <ShowMore
            hidden={recent.length - TOP_N}
            expanded={showAllRecent}
            onPress={() => {
              haptic.tap();
              setShowAllRecent((v) => !v);
            }}
          />
          </>
        )}
        <View style={{ height: 8 }} />
      </CardSection>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Revenue() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;

  const fmt = useFormatCurrency();
  const [period, setPeriod] = useState<Period>("30D");
  const [view, setView] = useState<TabView>("Mix");
  const { selectedPropertyId, prioritizeRevenueRequests } = usePreferences();

  const adRev = useMetricDetail("ad_revenue");
  const primaryRevenueReady = adRev.data != null || adRev.isError;
  const secondaryQueriesEnabled =
    !prioritizeRevenueRequests || primaryRevenueReady;
  const kpis = useCockpitKpis({ enabled: secondaryQueriesEnabled });
  const properties = useProperties({
    enabled: secondaryQueriesEnabled && view !== "Mix",
  });
  // Payouts edge tek proje scope'lu — "all" ise ilk projeye düş.
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;
  const trialDetail = useMetricDetail("subs_trial", {
    enabled: secondaryQueriesEnabled && view === "Subs",
  });
  const trialSeries = trialDetail.data?.series ?? [];
  const trialVal = trialSeries.length > 0 ? trialSeries[trialSeries.length - 1]!.value : null;
  // Real ad_revenue daily series (~30d window). 7D = last 7; 30D/90D = full
  // available window (metrics only holds ~30d, so we don't fabricate 90d).
  const series = useMemo(() => {
    const real = (adRev.data?.series ?? []).map((p) => p.value);
    return period === "7D" ? real.slice(-7) : real;
  }, [adRev.data, period]);
  const heroValue = useMemo(() => sumSeries(series), [series]);

  // ARPU derived from real KPIs (monthly recurring revenue per user).
  const totalUsers = kpis.data?.totalUsers ?? 0;
  const arpu = totalUsers > 0 ? (kpis.data?.mrr ?? 0) / totalUsers : 0;

  const heroStats: HeroStat[] = [
    {
      label: "MRR",
      value: fmt(kpis.data?.mrr ?? 0),
      delta: kpis.data?.mrrDelta ?? undefined,
    },
    { label: "ARPU", value: fmt(arpu) },
    { label: "Active subs", value: formatInteger(kpis.data?.activeSubs ?? 0) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <OpenHero
            eyebrow={`Reklam geliri · ${period}`}
            live
            right={
              <View style={{ width: 150 }}>
                <NativeSegmented<Period>
                  value={period}
                  options={["7D", "30D", "90D"]}
                  onChange={(v) => {
                    haptic.tap();
                    setPeriod(v);
                  }}
                />
              </View>
            }
            value={heroValue}
            format={(n) => fmt(n)}
            caption="Ad revenue · all projects"
            chartWidth={chartW}
            chartData={series.length >= 2 ? series : [heroValue, heroValue]}
            color={colors.accent}
            chartH={116}
            stats={heroStats}
          />

          {/* Tab card */}
          <LiquidGlass padding={0}>
            <View style={{ padding: 12 }}>
              <NativeSegmented<TabView>
                value={view}
                options={["Mix", "Subs", "Payouts"]}
                onChange={(v) => {
                  haptic.tap();
                  setView(v);
                }}
              />
            </View>
            <FullDivider />

            {view === "Mix" ? (
              <MixView fmt={fmt} queriesEnabled={secondaryQueriesEnabled} />
            ) : view === "Subs" ? (
              <SubsView
                fmt={fmt}
                chartW={chartW}
                activeSubs={kpis.data?.activeSubs ?? 0}
                trial={trialVal}
                projectId={projectId}
                queriesEnabled={secondaryQueriesEnabled}
              />
            ) : (
              <PayoutsView
                fmt={fmt}
                projectId={projectId}
                queriesEnabled={secondaryQueriesEnabled}
              />
            )}
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
