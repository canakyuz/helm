import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Rect, LinearGradient, vec } from "@shopify/react-native-skia";
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
  Donut,
  StackBar,
  AreaChart,
  NativeSegmented,
  AudienceMap,
  ReviewsSection,
  EmptyHint,
  MiniStat,
  Sep,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

// ─── Types ────────────────────────────────────────────────────────────────────

type Metric = "DAU" | "WAU" | "MAU";

// ─── Retention section ────────────────────────────────────────────────────────

function RetentionSection({ projectId }: { projectId?: string | undefined }) {
  const { width } = useWindowDimensions();
  const q = useRetention(projectId);
  const cohorts = q.data?.cohorts ?? [];
  if (projectId && !q.isLoading && cohorts.length === 0) return null;

  const chartW = width - 64; // card margin (32) + section padding (32)
  const series = cohorts.map((c) => c.pct);
  const d1 = cohorts[0]?.pct;

  return (
    <>
      <FullDivider />
      <CardSection index="04" title="Retention" pt={14} {...(d1 != null ? { action: `D1 ${d1}%` } : {})}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
          {!projectId ? (
            <EmptyHint>SELECT A PROJECT</EmptyHint>
          ) : q.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : series.length < 2 ? (
            <EmptyHint>NO RETENTION DATA</EmptyHint>
          ) : (
            <>
              <AreaChart data={series} width={chartW} height={96} color={colors.blue} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {cohorts.map((c) => (
                  <View key={c.day} style={{ alignItems: "center", gap: 3 }}>
                    <Text style={{ fontFamily: "GeistMono-600", fontSize: type.bodySm, color: colors.blue }}>
                      {c.pct}%
                    </Text>
                    <Text style={{ fontFamily: "GeistMono-500", fontSize: type.label, color: colors.fgSubtle, letterSpacing: 0.4 }}>
                      {c.day}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </CardSection>
    </>
  );
}

// ─── Funnel section ───────────────────────────────────────────────────────────

function FunnelSection({ projectId }: { projectId?: string | undefined }) {
  const q = useFunnel(projectId);
  const steps = q.data?.steps ?? [];
  if (projectId && !q.isLoading && steps.length === 0) return null;

  return (
    <>
    <FullDivider />
    <CardSection
      index="02"
      title="Conversion funnel"
      pt={14}
      {...(q.data ? { action: `${Math.round(q.data.overall_conversion)}% conv` } : {})}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 12 }}>
        {!projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : q.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : steps.length === 0 ? (
          <EmptyHint>NO FUNNEL CONFIGURED</EmptyHint>
        ) : (
          steps.map((step, i) => {
            // Centered fill width = share of the entry step → the stack narrows.
            const width = Math.max(1.5, Math.min(100, step.overall_pct));
            const drop = i > 0 ? Math.max(0, Math.round(100 - step.step_pct)) : 0;
            const lost = i > 0 && drop > 0;
            const dead = step.count === 0;
            return (
              <View key={`${step.event}-${step.order}`} style={{ gap: 7, opacity: dead ? 0.55 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: "GeistMono-500", fontSize: type.label, color: colors.fgSubtle, width: 16 }}>
                    {i + 1}
                  </Text>
                  <Text
                    style={{ flex: 1, fontFamily: "Geist-600", fontSize: type.body, color: colors.fgPrimary, letterSpacing: -0.2 }}
                    numberOfLines={1}
                  >
                    {step.event}
                  </Text>
                  <Text style={{ fontFamily: "GeistMono-600", fontSize: type.body, color: colors.fgPrimary }}>
                    {formatInteger(step.count)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: type.label,
                      color: lost ? colors.accentDanger : colors.fgSubtle,
                      width: 44,
                      textAlign: "right",
                      letterSpacing: 0.3,
                    }}
                  >
                    {lost ? `−${drop}%` : i === 0 ? "entry" : "—"}
                  </Text>
                </View>
                {/* centered narrowing fill — the funnel itself */}
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: `${width}%`,
                      minWidth: 4,
                      height: 11,
                      borderRadius: 6,
                      backgroundColor: colors.accent,
                      opacity: Math.max(0.4, 1 - i * 0.13),
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 8 }} />
      </View>
    </CardSection>
    </>
  );
}

// ─── Acquisition section (share split) ────────────────────────────────────────

function AcquisitionSection({ projectId }: { projectId?: string | undefined }) {
  const q = useAcquisition(projectId);
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  // Hide the whole section (incl. its divider) when there's genuinely no data.
  if (projectId && !q.isLoading && rows.length === 0) return null;

  const segments = rows.map((acq, i) => ({
    pct: total > 0 ? (acq.users / total) * 100 : 0,
    color: SHARE_PALETTE[i % SHARE_PALETTE.length]!,
  }));

  return (
    <>
      <FullDivider />
      <CardSection
        index="03"
        title="Acquisition"
        pt={14}
        {...(total > 0 ? { action: `${formatInteger(total)} · 30d` } : {})}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}>
          {!projectId ? (
            <EmptyHint>SELECT A PROJECT</EmptyHint>
          ) : q.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : (
            <>
              <StackBar segments={segments} height={14} />
              <View style={{ gap: 11 }}>
                {rows.map((acq, i) => {
                  const color = SHARE_PALETTE[i % SHARE_PALETTE.length]!;
                  const pct = total > 0 ? Math.round((acq.users / total) * 100) : 0;
                  return (
                    <View key={acq.source} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                      <Text
                        style={{ flex: 1, fontFamily: "Geist-500", fontSize: type.body, color: colors.fgSecondary, letterSpacing: -0.2 }}
                        numberOfLines={1}
                      >
                        {acq.source}
                      </Text>
                      <Text style={{ fontFamily: "GeistMono-600", fontSize: type.body, color: colors.fgPrimary }}>
                        {formatInteger(acq.users)}
                      </Text>
                      <Text
                        style={{ fontFamily: "GeistMono-500", fontSize: type.label, color: colors.fgMuted, width: 34, textAlign: "right", letterSpacing: 0.3 }}
                      >
                        {pct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </CardSection>
    </>
  );
}

// ─── Shared palettes ──────────────────────────────────────────────────────────

// Rank tint: #1 pops lime, podium fades; tail goes muted. Drives leaderboard +
// any rank-ordered share visual.
const RANK_TINT = [colors.accent, colors.accentViolet, colors.blue];
const rankTint = (i: number) => (i < RANK_TINT.length ? RANK_TINT[i]! : colors.fgMuted);
// Categorical share palette (donut / stacked bar segments).
const SHARE_PALETTE = [
  colors.accent,
  colors.accentViolet,
  colors.blue,
  colors.green,
  colors.accentWarn,
  colors.fgMuted,
];

// ─── Countries section (leaderboard) ──────────────────────────────────────────

function CountriesSection({ projectId }: { projectId?: string | undefined }) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const q = useGeoBreakdown(projectId);
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const maxUsers = rows.reduce((m, r) => Math.max(m, r.users), 0);

  return (
    <CardSection index="01" title="Top countries" pt={14} {...(rows.length ? { count: rows.length } : {})}>
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : rows.length === 0 ? (
        <EmptyHint>NO GEO DATA</EmptyHint>
      ) : (
        rows.map((c, i) => {
          const open = openCode === c.country;
          const pct = total > 0 ? Math.round((c.users / total) * 100) : 0;
          const barPct = maxUsers > 0 ? (c.users / maxUsers) * 100 : 0;
          const tint = rankTint(i);
          return (
            <Row
              key={c.country}
              open={open}
              onToggle={() => {
                haptic.tap();
                setOpenCode(open ? null : c.country);
              }}
              isLast={i === rows.length - 1}
              header={
                <View style={{ gap: 9 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    {/* Rank-tinted ISO chip (flag emoji doesn't render on the iOS sim). */}
                    <View
                      style={{
                        width: 30,
                        height: 22,
                        borderRadius: 6,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${tint}1A`,
                        borderWidth: 1,
                        borderColor: `${tint}55`,
                      }}
                    >
                      <Text style={{ fontFamily: "GeistMono-600", fontSize: 10, color: tint, letterSpacing: 0.5 }}>
                        {c.country}
                      </Text>
                    </View>
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
                      {c.country_name ?? c.country}
                    </Text>
                    <Text style={{ fontFamily: "GeistMono-600", fontSize: type.body, color: tint }}>
                      {formatInteger(c.users)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: type.label,
                        color: colors.fgMuted,
                        width: 34,
                        textAlign: "right",
                        letterSpacing: 0.3,
                      }}
                    >
                      {pct}%
                    </Text>
                  </View>
                  <HBar pct={barPct} color={tint} height={6} />
                </View>
              }
              detail={
                <KV
                  items={[
                    { label: "Users", value: formatInteger(c.users), color: tint },
                    { label: "Share", value: `${pct}%` },
                    { label: "Country", value: c.country_name ?? c.country },
                    { label: "Window", value: `${q.data?.days ?? 30}d` },
                  ]}
                />
              }
            />
          );
        })
      )}
      <View style={{ height: 8 }} />
    </CardSection>
  );
}

// ─── OS versions section ──────────────────────────────────────────────────────

function OsSection({ projectId }: { projectId?: string | undefined }) {
  const q = useOsBreakdown(projectId);
  const rows = q.data?.rows ?? [];
  if (projectId && !q.isLoading && rows.length === 0) return null;

  const segments = rows.map((os, i) => ({ pct: os.pct, color: SHARE_PALETTE[i % SHARE_PALETTE.length]! }));
  const top = rows[0];

  return (
    <>
      <FullDivider />
      <CardSection index="06" title="OS versions" pt={14}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          {!projectId ? (
            <EmptyHint>SELECT A PROJECT</EmptyHint>
          ) : q.isLoading ? (
            <EmptyHint>LOADING…</EmptyHint>
          ) : rows.length === 0 ? (
            <EmptyHint>NO OS DATA</EmptyHint>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              <Donut segments={segments} size={104} stroke={18}>
                <Text style={{ fontFamily: "GeistMono-600", fontSize: 19, color: colors.fgPrimary, letterSpacing: -0.5 }}>
                  {Math.round(top?.pct ?? 0)}%
                </Text>
                <Text
                  style={{ fontFamily: "GeistMono-500", fontSize: 9, color: colors.fgMuted, letterSpacing: 1, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {(top?.os ?? "").toUpperCase()}
                </Text>
              </Donut>
              <View style={{ flex: 1, gap: 11 }}>
                {rows.map((os, i) => {
                  const label = `${os.os}${os.version ? ` ${os.version}` : ""}`;
                  const color = SHARE_PALETTE[i % SHARE_PALETTE.length]!;
                  return (
                    <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                      <Text
                        style={{ flex: 1, fontFamily: "Geist-500", fontSize: type.bodySm, color: colors.fgSecondary, letterSpacing: -0.2 }}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                      <Text style={{ fontFamily: "GeistMono-600", fontSize: type.bodySm, color: colors.fgPrimary }}>
                        {os.pct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </CardSection>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { width } = useWindowDimensions();
  const chartW = width - 32;

  const [metric, setMetric] = useState<Metric>("DAU");
  const { selectedPropertyId } = usePreferences();
  const properties = useProperties();
  // PostHog-backed edges need a single project; "all" → fall back to first property.
  const projectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;

  const kpis = useCockpitKpis();
  const mauDetail = useMetricDetail("mau");
  const sessDetail = useMetricDetail("avg_session_sec");
  const geo = useGeoBreakdown(projectId);
  const geoRows = geo.data?.rows ?? [];

  const heroValue = kpis.data?.dau ?? 0;
  const dauDelta: number | undefined = kpis.data?.dauDelta ?? undefined;

  // Son mevcut gün değeri (mau/avg_session_sec günlük yazılır).
  const latestVal = (d: typeof mauDetail): number | null => {
    const s = d.data?.series ?? [];
    return s.length > 0 ? s[s.length - 1]!.value : null;
  };
  const mauVal = latestVal(mauDetail);
  const sessVal = latestVal(sessDetail);
  const stickiness = mauVal != null && mauVal > 0 ? Math.round((heroValue / mauVal) * 100) : null;
  const fmtSession = (sec: number) => `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;

  // Hero number + eyebrow react to the DAU/WAU/MAU segment.
  const dauVal = heroValue;
  const mau = mauVal ?? kpis.data?.totalUsers ?? 0;
  // No WAU metric yet → approximate between DAU and MAU so the segment is responsive.
  const wauVal = mau > 0 ? Math.round((dauVal + mau) / 2) : dauVal;
  const metricValue = metric === "DAU" ? dauVal : metric === "MAU" ? mau : wauVal;
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
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Full-bleed hero over live map background (map-as-background, web style) */}
          <Animated.View
            entering={FadeIn.duration(420)}
            style={{
              height: 300,
              overflow: "hidden",
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.08)",
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255,255,255,0.08)",
            }}
          >
            {geoRows.length > 0 ? <AudienceMap rows={geoRows} fill showPill={false} /> : null}

            {/* gradient scrim: light at top, strong at bottom → text legible, map visible.
               pointerEvents none so map pan/zoom gestures pass through. */}
            <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Rect x={0} y={0} width={width} height={300}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, 300)}
                  colors={[
                    "rgba(7,7,10,0.74)",
                    "rgba(7,7,10,0.52)",
                    "rgba(7,7,10,0.78)",
                    "rgba(7,7,10,0.97)",
                  ]}
                  positions={[0, 0.34, 0.66, 1]}
                />
              </Rect>
            </Canvas>

            {/* hero content — box-none lets touches in empty areas reach the map,
               while the segment + stat strip still receive their own taps. */}
            <View
              pointerEvents="box-none"
              style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}
            >
              <OpenHero
                eyebrow={`${metric} · active users · 30D`}
                live
                value={metricValue}
                format={formatInteger}
                {...(metricDelta !== undefined ? { delta: metricDelta } : {})}
                caption={`MAU ${formatInteger(mau)}`}
                chartWidth={chartW}
                color={colors.blue}
              />

              <View style={{ flex: 1 }} />

              {/* control deck: stat strip + metric segment on one glass plate,
                 pinned above the sunk bars. Segment lives here (not the eyebrow
                 row) so map markers + hero text never collide with it. */}
              <View
                pointerEvents="box-none"
                style={{
                  gap: 8,
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(10,10,14,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <View style={{ flexDirection: "row" }}>
                  {heroStats.map((s, i) => (
                    <View key={s.label} style={{ flex: 1, flexDirection: "row" }}>
                      {i > 0 ? <Sep /> : null}
                      <MiniStat {...s} valueSize={16} />
                    </View>
                  ))}
                </View>
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
                <View pointerEvents="auto">
                  <NativeSegmented<Metric>
                    value={metric}
                    options={["DAU", "WAU", "MAU"]}
                    onChange={(v) => {
                      haptic.tap();
                      setMetric(v);
                    }}
                  />
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Analytics sections — each visual matches its data shape; empty
             sections (incl. their leading divider) self-hide. */}
          <LiquidGlass padding={0} style={{ marginHorizontal: 16 }}>
            <CountriesSection projectId={projectId} />
            <FunnelSection projectId={projectId} />
            <AcquisitionSection projectId={projectId} />
            <RetentionSection projectId={projectId} />
            <FullDivider />
            <ReviewsSection index="05" />
            <OsSection projectId={projectId} />
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
