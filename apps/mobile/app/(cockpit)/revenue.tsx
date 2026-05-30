import { useMemo, useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import { usePayouts } from "~/hooks/use-payouts";
import { useRevenueMix } from "~/hooks/use-revenue-mix";
import { useMrrMovement } from "~/hooks/use-mrr-movement";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { usePreferences } from "~/lib/preferences";
import { formatInteger } from "~/lib/format";
import { demoData } from "~/lib/demo-data";
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
  Seg,
  ActionBtn,
  SearchInput,
  Glyph,
  Eyebrow,
  Delta,
  EmptyHint,
  DemoChip,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7D" | "30D" | "90D";
type TabView = "Mix" | "Subs" | "Payouts";
type RefundedMap = Record<string, boolean>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GLYPH_TINTS = [colors.accent, colors.accentViolet, colors.blue, colors.green];
const PROJECT_GLYPHS = ["◆", "✦", "❖", "◇"];

function sumSeries(arr: number[]): number {
  let total = 0;
  for (const v of arr) total += v;
  return total;
}

const KIND_COLOR: Record<string, string> = {
  sub: colors.accentViolet,
  iap: colors.accent,
  refund: colors.accentDanger,
};

// ─── Mix tab ──────────────────────────────────────────────────────────────────

function MixView({ fmt }: { fmt: (n: number) => string }) {
  const properties = useProperties();
  const mix = useRevenueMix();
  const segments = mix.data?.segments ?? [];
  const [openSplit, setOpenSplit] = useState<string | null>(null);
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);
  const [openEarner, setOpenEarner] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState("");
  const [openTx, setOpenTx] = useState<string | null>(null);
  const [refunded, setRefunded] = useState<RefundedMap>({});

  const filteredTx = useMemo(() => {
    const q = txSearch.toLowerCase();
    if (!q) return demoData.transactions;
    return demoData.transactions.filter(
      (t) =>
        t.type.toLowerCase().includes(q) ||
        t.detail.toLowerCase().includes(q) ||
        t.project.toLowerCase().includes(q),
    );
  }, [txSearch]);

  const topProperties = (properties.data ?? []).slice(0, 4);
  const earnerPcts = [87, 64, 51, 38];
  const earnerRevs = [54200, 39800, 31600, 23600];

  return (
    <>
      {/* Revenue mix */}
      <CardSection index="01" title="Revenue mix" pt={14}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
          {mix.isLoading ? (
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

      {/* By platform — DEMO: Android gelir kaynağı yok, türetilemiyor */}
      <CardSection index="02" title="By platform" pt={14}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <DemoChip />
          </View>
          {demoData.platformSplit.map((p, i) => {
            const open = openPlatform === p.label;
            return (
              <Row
                key={p.label}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenPlatform(open ? null : p.label);
                }}
                isLast={i === demoData.platformSplit.length - 1}
                header={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: p.color }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: "Geist-600",
                        fontSize: type.body,
                        color: colors.fgPrimary,
                        letterSpacing: -0.2,
                      }}
                    >
                      {p.label}
                    </Text>
                    <View style={{ width: 80 }}>
                      <HBar pct={p.pct} color={p.color} height={6} />
                    </View>
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: type.body,
                        color: p.color,
                        width: 72,
                        textAlign: "right",
                      }}
                    >
                      {fmt(p.value)}
                    </Text>
                  </View>
                }
                detail={
                  <KV
                    items={[
                      { label: "Revenue", value: fmt(p.value), color: p.color },
                      { label: "Share", value: `${p.pct}%` },
                      { label: "vs last period", value: "+8.3%" },
                      {
                        label: "Avg transaction",
                        value: fmt(Math.round(p.value / 420)),
                      },
                    ]}
                  />
                }
              />
            );
          })}
        </View>
      </CardSection>

      <FullDivider />

      {/* Top earners */}
      <CardSection
        index="03"
        title="Top earners"
        action="SEE ALL"
        onAction={() => haptic.tap()}
        pt={14}
      >
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Eyebrow size={9}>REVENUE PER PROJECT</Eyebrow>
            <DemoChip />
          </View>
        </View>
        {topProperties.length === 0 ? (
          <EmptyHint>NO PROJECTS FOUND</EmptyHint>
        ) : (
          topProperties.map((prop, i) => {
            const tint = GLYPH_TINTS[i % GLYPH_TINTS.length]!;
            const glyph = PROJECT_GLYPHS[i % PROJECT_GLYPHS.length]!;
            const pct = earnerPcts[i] ?? 40;
            const rev = earnerRevs[i] ?? 20000;
            const open = openEarner === prop.id;
            return (
              <Row
                key={prop.id}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenEarner(open ? null : prop.id);
                }}
                isLast={i === topProperties.length - 1}
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
                      { label: "Revenue", value: fmt(rev), color: tint },
                      { label: "Share", value: `${pct}%` },
                      { label: "Type", value: prop.type.replace("_", " ").toUpperCase() },
                      { label: "MRR share", value: `${Math.round(pct * 0.6)}%` },
                    ]}
                  />
                }
              />
            );
          })
        )}
        <View style={{ height: 8 }} />
      </CardSection>

      <FullDivider />

      {/* Recent payments */}
      <CardSection
        index="04"
        title="Recent payments"
        count={filteredTx.length}
        pt={14}
      >
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <DemoChip />
          </View>
        </View>
        <SearchInput
          value={txSearch}
          onChange={setTxSearch}
          placeholder="Filter by type, detail or project…"
        />
        {filteredTx.length === 0 ? (
          <EmptyHint>NO TRANSACTIONS MATCH</EmptyHint>
        ) : (
          filteredTx.map((tx, i) => {
            const open = openTx === tx.id;
            const dotColor = KIND_COLOR[tx.kind] ?? colors.fgMuted;
            const isRefunded = refunded[tx.id] ?? false;
            return (
              <Row
                key={tx.id}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenTx(open ? null : tx.id);
                }}
                isLast={i === filteredTx.length - 1}
                dimmed={isRefunded}
                header={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: dotColor }}
                    />
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
                        {tx.type} · {tx.detail}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "GeistMono-500",
                          fontSize: type.label,
                          color: colors.fgMuted,
                          letterSpacing: 0.4,
                        }}
                        numberOfLines={1}
                      >
                        {tx.project} · {tx.ago}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: type.body,
                        color: tx.amount < 0 ? colors.accentDanger : colors.fgPrimary,
                      }}
                    >
                      {tx.amount < 0 ? "-" : "+"}
                      {fmt(Math.abs(tx.amount))}
                    </Text>
                  </View>
                }
                detail={
                  <>
                    <KV
                      items={[
                        { label: "Type", value: tx.type },
                        { label: "Project", value: tx.project },
                        {
                          label: "Detail",
                          value: tx.detail,
                          full: true,
                        },
                        {
                          label: "Amount",
                          value: `${tx.amount < 0 ? "-" : "+"}${fmt(Math.abs(tx.amount))}`,
                          color: tx.amount < 0 ? colors.accentDanger : colors.green,
                        },
                      ]}
                    />
                    {tx.kind !== "refund" ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <ActionBtn
                          label={isRefunded ? "REFUNDED" : "REFUND"}
                          tone="danger"
                          onPress={() => {
                            if (!isRefunded) {
                              haptic.tap();
                              setRefunded((r) => ({ ...r, [tx.id]: true }));
                            }
                          }}
                        />
                        <ActionBtn label="RECEIPT" onPress={() => haptic.tap()} />
                      </View>
                    ) : null}
                  </>
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
}: {
  fmt: (n: number) => string;
  chartW: number;
  activeSubs: number;
  trial: number | null;
  projectId?: string | undefined;
}) {
  const [openMrr, setOpenMrr] = useState<string | null>(null);
  const mrr = useMrrMovement(projectId);
  const moves = mrr.data?.segments ?? [];
  const maxAbs = useMemo(
    () => Math.max(1, ...moves.map((m) => Math.abs(m.value))),
    [moves],
  );
  const segColor = (v: number) => (v >= 0 ? colors.green : colors.accentDanger);

  return (
    <>
      {/* MRR movement */}
      <CardSection
        index="01"
        title="MRR movement"
        {...(mrr.data ? { action: `net ${mrr.data.net >= 0 ? "+" : ""}${fmt(mrr.data.net)}` } : {})}
        pt={14}
      >
        {!projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : mrr.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : moves.length === 0 ? (
          <EmptyHint>NO MRR MOVEMENT DATA</EmptyHint>
        ) : (
          moves.map((m, i) => {
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
                isLast={i === moves.length - 1}
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
          })
        )}
        <View style={{ height: 8 }} />
      </CardSection>

      <FullDivider />

      {/* Subscription stats */}
      <CardSection index="02" title="Subscriptions" pt={14}>
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <DemoChip />
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: 16,
            paddingBottom: 16,
            gap: 8,
          }}
        >
          {(
            [
              { label: "Active subs", value: formatInteger(activeSubs), color: colors.green },
              { label: "Trials", value: trial != null ? formatInteger(trial) : "—", color: colors.accentViolet },
              {
                label: "Trial → paid",
                value: demoData.subs.trialConv + "%",
                color: colors.accent,
              },
              {
                label: "Churn rate",
                value: demoData.subs.churnRate + "%",
                color: colors.accentDanger,
              },
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

      {/* MRR trend */}
      <CardSection index="03" title="MRR trend" pt={14}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <DemoChip />
          </View>
          <AreaChart
            data={[...demoData.subs.trend]}
            width={chartW - 8}
            height={72}
            color={colors.accentViolet}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: type.label,
                color: colors.fgSubtle,
              }}
            >
              30 days
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Delta value={8.4} size={10} invert={false} />
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: type.label,
                  color: colors.fgMuted,
                }}
              >
                vs prev period
              </Text>
            </View>
          </View>
        </View>
      </CardSection>
    </>
  );
}

// ─── Payouts tab ──────────────────────────────────────────────────────────────

function PayoutsView({ fmt, projectId }: { fmt: (n: number) => string; projectId?: string | undefined }) {
  const [openPayout, setOpenPayout] = useState<string | null>(null);
  const q = usePayouts(projectId);
  const pending = q.data?.pending ?? [];
  const recent = q.data?.recent ?? [];

  // Pending'i kaynağa göre topla.
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
          {!projectId ? (
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
        {!projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : q.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : recent.length === 0 ? (
          <EmptyHint>NO RECENT PAYOUTS</EmptyHint>
        ) : (
          recent.map((p, i) => {
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
                isLast={i === recent.length - 1}
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
          })
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
  const kpis = useCockpitKpis();
  const { selectedPropertyId } = usePreferences();
  const properties = useProperties();
  // Payouts edge tek proje scope'lu — "all" ise ilk projeye düş.
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;

  const [period, setPeriod] = useState<Period>("30D");
  const [view, setView] = useState<TabView>("Mix");

  const adRev = useMetricDetail("ad_revenue");
  const trialDetail = useMetricDetail("subs_trial");
  const trialSeries = trialDetail.data?.series ?? [];
  const trialVal = trialSeries.length > 0 ? trialSeries[trialSeries.length - 1]!.value : null;
  // Real ad_revenue daily series (~30d window). 7D = last 7; 30D/90D = full
  // available window (metrics only holds ~30d, so we don't fabricate 90d).
  const series = useMemo(() => {
    const real = (adRev.data?.series ?? []).map((p) => p.value);
    const base = real.length >= 2 ? real : [...demoData.revTrend];
    return period === "7D" ? base.slice(-7) : base;
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
            eyebrow={`Total revenue · ${period}`}
            live
            right={
              <Seg<Period>
                value={period}
                options={["7D", "30D", "90D"]}
                onChange={(v) => {
                  haptic.tap();
                  setPeriod(v);
                }}
              />
            }
            value={heroValue}
            format={(n) => fmt(n)}
            caption="Ad revenue · all projects"
            chartWidth={chartW}
            chartData={series}
            color={colors.accent}
            chartH={116}
            stats={heroStats}
          />

          {/* Demo notice */}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6 }}
          >
            <DemoChip />
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: type.label,
                color: colors.fgSubtle,
                letterSpacing: 0.3,
                flex: 1,
              }}
            >
              Hero · payouts (Stripe) · active subs · trials real · mix / MRR movement / churn demo (API limiti)
            </Text>
          </View>

          {/* Tab card */}
          <LiquidGlass padding={0}>
            <View style={{ padding: 12 }}>
              <Seg<TabView>
                value={view}
                options={["Mix", "Subs", "Payouts"]}
                onChange={(v) => {
                  haptic.tap();
                  setView(v);
                }}
                full
              />
            </View>
            <FullDivider />

            {view === "Mix" ? (
              <MixView fmt={fmt} />
            ) : view === "Subs" ? (
              <SubsView
                fmt={fmt}
                chartW={chartW}
                activeSubs={kpis.data?.activeSubs ?? 0}
                trial={trialVal}
                projectId={projectId}
              />
            ) : (
              <PayoutsView fmt={fmt} projectId={projectId} />
            )}
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
