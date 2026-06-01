import { useState } from "react";
import { Text, View, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useProperties } from "~/hooks/use-properties";
import {
  useAcquisition,
  useFunnel,
  useGeoBreakdown,
  useRetention,
  useOsBreakdown,
} from "~/hooks/use-analytics";
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
  Bars,
  NativeSegmented,
  ReviewsSection,
  EmptyHint,
  ShowMore,
} from "~/components/liquid";

const TOP_N = 5; // glance-first lists: show the top few, total stays in the header
import type { HeroStat } from "~/components/liquid";

// ─── Types ────────────────────────────────────────────────────────────────────

// Only DAU + MAU are real metrics (from the `metrics` table). WAU was a synthetic
// midpoint with no backing data, so it's dropped — never show an unsourced number.
type Metric = "DAU" | "MAU";

const MONO_600 = "GeistMono-600";
const MONO_500 = "GeistMono-500";
const ACQ_COLORS = [colors.blue, colors.accentViolet, colors.green, colors.accentWarn, colors.accent];

// Raw event / source keys → readable Title Case. "paywall_dismissed" → "Paywall
// Dismissed"; already-spaced labels ("Application Became Active") pass through.
function humanize(s: string): string {
  if (!s.includes("_") && s !== s.toLowerCase()) return s;
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── 01 · Retention (vertical bars, per design) ───────────────────────────────

function RetentionSection({ projectId }: { projectId?: string | undefined }) {
  const q = useRetention(projectId);
  const cohorts = q.data?.cohorts ?? [];
  const maxPct = cohorts.reduce((m, c) => Math.max(m, c.pct), 0);
  if (projectId && !q.isLoading && cohorts.length === 0) return null;

  return (
    <CardSection index="01" title="Retention" pt={14}>
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 10,
            height: 104,
            paddingHorizontal: 18,
            paddingTop: 4,
            paddingBottom: 14,
          }}
        >
          {cohorts.map((r) => {
            // Normalize to the tallest cohort so low real-world retention still reads.
            const h = maxPct > 0 ? Math.round((r.pct / maxPct) * 100) : 0;
            return (
              <View
                key={r.day}
                style={{ flex: 1, alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}
              >
                <Text style={{ fontFamily: MONO_600, fontSize: 11, color: colors.fgPrimary }}>{r.pct}%</Text>
                <View style={{ width: "62%", flex: 1, justifyContent: "flex-end" }}>
                  <View
                    style={{
                      width: "100%",
                      height: `${h}%`,
                      minHeight: 4,
                      borderRadius: 6,
                      backgroundColor: colors.blue,
                    }}
                  />
                </View>
                <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, letterSpacing: 0.4 }}>
                  {r.day}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </CardSection>
  );
}

// ─── 02 · Conversion funnel (horizontal bars, per design) ─────────────────────

function FunnelSection({ projectId }: { projectId?: string | undefined }) {
  const q = useFunnel(projectId);
  const steps = q.data?.steps ?? [];
  if (projectId && !q.isLoading && steps.length === 0) return null;

  const entry = steps[0]?.count ?? 0;
  // Collapse the trailing all-zero tail into one muted summary line.
  const lastReal = steps.reduce((acc, s, i) => (s.count > 0 ? i : acc), -1);
  const visible = lastReal >= 0 ? steps.slice(0, lastReal + 1) : steps;
  const zeroTail = steps.length - visible.length;

  return (
    <>
      <FullDivider />
      <CardSection
        index="02"
        title="Conversion funnel"
        pt={14}
        {...(q.data ? { action: `${Math.round(q.data.overall_conversion)}% conv` } : {})}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 13 }}>
          {!projectId ? (
            <EmptyHint>SELECT A PROJECT</EmptyHint>
          ) : q.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : (
            <>
              {visible.map((step, i) => {
                const pct = entry > 0 ? (step.count / entry) * 100 : 0;
                const prev = steps[i - 1]?.count ?? step.count;
                const drop = i > 0 && prev > 0 ? Math.round((1 - step.count / prev) * 100) : 0;
                const last = i === visible.length - 1;
                return (
                  <View key={`${step.event}-${step.order}`}>
                    <View
                      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}
                    >
                      <Text
                        style={{ flex: 1, fontFamily: "Geist-600", fontSize: type.body, color: colors.fgPrimary, letterSpacing: -0.2 }}
                        numberOfLines={1}
                      >
                        {humanize(step.event)}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginLeft: 8 }}>
                        <Text style={{ fontFamily: MONO_600, fontSize: 12.5, color: colors.fgPrimary }}>
                          {formatInteger(step.count)}
                        </Text>
                        {i > 0 ? (
                          <Text style={{ fontFamily: MONO_500, fontSize: 10, color: colors.accentDanger, width: 42, textAlign: "right" }}>
                            −{drop}%
                          </Text>
                        ) : (
                          <View style={{ width: 42 }} />
                        )}
                      </View>
                    </View>
                    <HBar pct={pct} color={last ? colors.accent : colors.blue} height={8} />
                  </View>
                );
              })}
              {zeroTail > 0 ? (
                <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgSubtle, letterSpacing: 0.3, paddingTop: 2 }}>
                  + {zeroTail} more step{zeroTail > 1 ? "s" : ""} · no conversions
                </Text>
              ) : null}
            </>
          )}
        </View>
      </CardSection>
    </>
  );
}

// ─── 03 · Acquisition (expandable rows, per design) ───────────────────────────

function AcquisitionSection({ projectId }: { projectId?: string | undefined }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const q = useAcquisition(projectId);
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  if (projectId && !q.isLoading && rows.length === 0) return null;
  const visible = showAll ? rows : rows.slice(0, TOP_N);

  return (
    <>
      <FullDivider />
      <CardSection index="03" title="Acquisition" pt={14} {...(total > 0 ? { action: `${formatInteger(total)} · 30d` } : {})}>
        {!projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : q.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : (
          <>
          {visible.map((a, i) => {
            const open = openId === a.source;
            const color = ACQ_COLORS[i % ACQ_COLORS.length]!;
            const pct = total > 0 ? Math.round((a.users / total) * 100) : 0;
            return (
              <Row
                key={a.source}
                open={open}
                onToggle={() => {
                  haptic.tap();
                  setOpenId(open ? null : a.source);
                }}
                isLast={i === visible.length - 1}
                header={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                    <Text
                      style={{ flex: 1, fontFamily: "Geist-600", fontSize: type.body, color: colors.fgPrimary, letterSpacing: -0.2 }}
                      numberOfLines={1}
                    >
                      {humanize(a.source)}
                    </Text>
                    <Text style={{ fontFamily: MONO_600, fontSize: 12, color: colors.fgSecondary }}>{formatInteger(a.users)}</Text>
                    <Text style={{ fontFamily: MONO_500, fontSize: 10.5, color: colors.fgMuted, width: 32, textAlign: "right" }}>
                      {pct}%
                    </Text>
                  </View>
                }
                detail={
                  <KV
                    items={[
                      { label: "Users", value: formatInteger(a.users), color },
                      { label: "Share", value: `${pct}%` },
                      { label: "Type", value: a.type },
                      { label: "Window", value: `${q.data?.days ?? 30}d` },
                    ]}
                  />
                }
              />
            );
          })}
          <ShowMore
            hidden={rows.length - TOP_N}
            expanded={showAll}
            onPress={() => {
              haptic.tap();
              setShowAll((v) => !v);
            }}
          />
          </>
        )}
        <View style={{ height: 8 }} />
      </CardSection>
    </>
  );
}

// ─── 04 · Top countries (expandable rows, per design) ─────────────────────────

function CountriesSection({ projectId }: { projectId?: string | undefined }) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const q = useGeoBreakdown(projectId);
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const maxUsers = rows.reduce((m, r) => Math.max(m, r.users), 0);
  if (projectId && !q.isLoading && rows.length === 0) return null;
  const visible = showAll ? rows : rows.slice(0, TOP_N);

  return (
    <>
    <FullDivider />
    <CardSection index="04" title="Top countries" pt={14} {...(rows.length ? { count: rows.length } : {})}>
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : (
        <>
        {visible.map((c, i) => {
          const open = openCode === c.country;
          const pct = total > 0 ? Math.round((c.users / total) * 100) : 0;
          const barPct = maxUsers > 0 ? (c.users / maxUsers) * 100 : 0;
          return (
            <Row
              key={c.country}
              open={open}
              onToggle={() => {
                haptic.tap();
                setOpenCode(open ? null : c.country);
              }}
              isLast={i === visible.length - 1}
              header={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <Text
                    style={{
                      width: 26,
                      paddingVertical: 3,
                      textAlign: "center",
                      borderRadius: 5,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      fontFamily: MONO_600,
                      fontSize: 10.5,
                      color: colors.fgSecondary,
                      letterSpacing: 0.4,
                    }}
                  >
                    {c.country}
                  </Text>
                  <Text
                    style={{ flex: 1, fontFamily: "Geist-600", fontSize: type.body, color: colors.fgPrimary, letterSpacing: -0.2 }}
                    numberOfLines={1}
                  >
                    {c.country_name ?? c.country}
                  </Text>
                  <View style={{ width: 60 }}>
                    <HBar pct={barPct} color={colors.blue} height={5} />
                  </View>
                  <Text style={{ fontFamily: MONO_500, fontSize: 10.5, color: colors.fgMuted, width: 30, textAlign: "right" }}>
                    {pct}%
                  </Text>
                </View>
              }
              detail={
                <KV
                  items={[
                    { label: "Users", value: formatInteger(c.users), color: colors.blue },
                    { label: "Share", value: `${pct}%` },
                    { label: "Country", value: c.country_name ?? c.country },
                    { label: "Window", value: `${q.data?.days ?? 30}d` },
                  ]}
                />
              }
            />
          );
        })}
        <ShowMore
          hidden={rows.length - TOP_N}
          expanded={showAll}
          onPress={() => {
            haptic.tap();
            setShowAll((v) => !v);
          }}
        />
        </>
      )}
      <View style={{ height: 8 }} />
    </CardSection>
    </>
  );
}

// ─── 05 · OS versions (expandable rows, per design) ───────────────────────────

function OsSection({ projectId }: { projectId?: string | undefined }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const q = useOsBreakdown(projectId);
  const rows = q.data?.rows ?? [];
  const maxPct = rows.reduce((m, r) => Math.max(m, r.pct), 0);
  if (projectId && !q.isLoading && rows.length === 0) return null;
  const visible = showAll ? rows : rows.slice(0, TOP_N);

  return (
    <>
    <FullDivider />
    <CardSection index="05" title="OS versions" pt={14}>
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : (
        <>
        {visible.map((o, i) => {
          const label = `${humanize(o.os)}${o.version ? ` ${o.version}` : ""}`;
          const open = openLabel === label;
          const barPct = maxPct > 0 ? (o.pct / maxPct) * 100 : 0;
          return (
            <Row
              key={label}
              open={open}
              onToggle={() => {
                haptic.tap();
                setOpenLabel(open ? null : label);
              }}
              isLast={i === visible.length - 1}
              header={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <Text
                    style={{ width: 92, fontFamily: "Geist-600", fontSize: type.body, color: colors.fgPrimary, letterSpacing: -0.2 }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <HBar pct={barPct} color={colors.accentViolet} height={5} />
                  </View>
                  <Text style={{ fontFamily: MONO_500, fontSize: 10.5, color: colors.fgMuted, width: 30, textAlign: "right" }}>
                    {o.pct}%
                  </Text>
                </View>
              }
              detail={
                <KV
                  items={[
                    { label: "Share", value: `${o.pct}%`, color: colors.accentViolet },
                    { label: "Users", value: formatInteger(o.users) },
                    { label: "OS", value: o.os },
                    { label: "Window", value: `${q.data?.days ?? 30}d` },
                  ]}
                />
              }
            />
          );
        })}
        <ShowMore
          hidden={rows.length - TOP_N}
          expanded={showAll}
          onPress={() => {
            haptic.tap();
            setShowAll((v) => !v);
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

export default function Analytics() {
  const { width } = useWindowDimensions();
  const chartW = width - 32;
  const barsW = width - 44; // screen pad (32) + OpenHero inner pad (12)

  const [metric, setMetric] = useState<Metric>("DAU");
  const { selectedPropertyId } = usePreferences();
  const properties = useProperties();
  // PostHog-backed edges need a single project; "all" → fall back to first property.
  const projectId = selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;

  const kpis = useCockpitKpis();
  const dauDetail = useMetricDetail("dau");
  const mauDetail = useMetricDetail("mau");
  const sessDetail = useMetricDetail("avg_session_sec");
  const dauSeries = (dauDetail.data?.series ?? []).map((p) => p.value);

  const heroValue = kpis.data?.dau ?? 0;
  const dauDelta: number | undefined = kpis.data?.dauDelta ?? undefined;

  const latestVal = (d: typeof mauDetail): number | null => {
    const s = d.data?.series ?? [];
    return s.length > 0 ? s[s.length - 1]!.value : null;
  };
  const mauVal = latestVal(mauDetail);
  const sessVal = latestVal(sessDetail);
  const stickiness = mauVal != null && mauVal > 0 ? Math.round((heroValue / mauVal) * 100) : null;
  const fmtSession = (sec: number) => `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;

  const dauVal = heroValue;
  const mau = mauVal ?? kpis.data?.totalUsers ?? 0;
  const metricValue = metric === "DAU" ? dauVal : mau;
  const metricDelta = metric === "DAU" ? dauDelta : undefined;

  const heroStats: HeroStat[] = [
    { label: "Stickiness", value: stickiness != null ? `${stickiness}%` : "—" },
    { label: "Avg session", value: sessVal != null ? fmtSession(sessVal) : "—" },
    { label: "New users", value: formatInteger(kpis.data?.newUsers ?? 0) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: 18 }} showsVerticalScrollIndicator={false}>
          {/* Card-less hero on the aurora background: number + bar chart + mini-stats. */}
          <Animated.View entering={FadeIn.duration(420)} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <OpenHero
              eyebrow="Active users · 30D"
              live
              right={
                <View style={{ width: 124 }}>
                  <NativeSegmented<Metric>
                    value={metric}
                    options={["DAU", "MAU"]}
                    onChange={(v) => {
                      haptic.tap();
                      setMetric(v);
                    }}
                  />
                </View>
              }
              value={metricValue}
              format={formatInteger}
              {...(metricDelta !== undefined ? { delta: metricDelta } : {})}
              caption={`MAU ${formatInteger(mau)}`}
              chartWidth={chartW}
              chartEl={
                <Bars
                  data={dauSeries.length >= 2 ? dauSeries : [heroValue, heroValue]}
                  width={barsW}
                  height={84}
                  color={colors.blue}
                />
              }
              stats={heroStats}
              color={colors.blue}
            />
          </Animated.View>

          {/* One big compact card — sections in design order, fixed dividers. */}
          <LiquidGlass padding={0} style={{ marginHorizontal: 16 }}>
            <RetentionSection projectId={projectId} />
            <FunnelSection projectId={projectId} />
            <AcquisitionSection projectId={projectId} />
            <CountriesSection projectId={projectId} />
            <OsSection projectId={projectId} />
            <FullDivider />
            <ReviewsSection index="06" />
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
