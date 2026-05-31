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
  Bars,
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
  const q = useRetention(projectId);
  const cohorts = q.data?.cohorts ?? [];

  return (
    <CardSection index="04" title="Retention" pt={14}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 6 }}>
        {!projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : q.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : cohorts.length === 0 ? (
          <EmptyHint>NO RETENTION DATA</EmptyHint>
        ) : (
          cohorts.map((r, i) => (
            <View
              key={r.day}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 4,
                borderBottomWidth: i === cohorts.length - 1 ? 0 : 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: type.label,
                  color: colors.fgMuted,
                  width: 28,
                  letterSpacing: 0.4,
                }}
              >
                {r.day}
              </Text>
              <View style={{ flex: 1 }}>
                <HBar pct={r.pct} color={colors.blue} height={6} />
              </View>
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: type.bodySm,
                  color: colors.blue,
                  width: 36,
                  textAlign: "right",
                }}
              >
                {r.pct}%
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 8 }} />
      </View>
    </CardSection>
  );
}

// ─── Funnel section ───────────────────────────────────────────────────────────

function FunnelSection({ projectId }: { projectId?: string | undefined }) {
  const q = useFunnel(projectId);
  const steps = q.data?.steps ?? [];

  return (
    <CardSection
      index="02"
      title="Conversion funnel"
      pt={14}
      {...(q.data ? { action: `${Math.round(q.data.overall_conversion)}% conv` } : {})}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 6 }}>
        {!projectId ? (
          <EmptyHint>SELECT A PROJECT</EmptyHint>
        ) : q.isLoading ? (
          <EmptyHint>LOADING…</EmptyHint>
        ) : steps.length === 0 ? (
          <EmptyHint>NO FUNNEL CONFIGURED</EmptyHint>
        ) : (
          steps.map((step, i) => {
            const drop = i > 0 ? Math.max(0, Math.round(100 - step.step_pct)) : 0;
            return (
              <View
                key={`${step.event}-${step.order}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 4,
                  borderBottomWidth: i === steps.length - 1 ? 0 : 1,
                  borderBottomColor: "rgba(255,255,255,0.05)",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Geist-600",
                    fontSize: type.body,
                    color: colors.fgPrimary,
                    width: 72,
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {step.event}
                </Text>
                <View style={{ flex: 1 }}>
                  <HBar pct={Math.round(step.overall_pct)} color={colors.accent} height={6} />
                </View>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: type.body,
                    color: colors.fgPrimary,
                    width: 56,
                    textAlign: "right",
                  }}
                >
                  {formatInteger(step.count)}
                </Text>
                {i > 0 ? (
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: type.label,
                      color: colors.accentDanger,
                      width: 36,
                      textAlign: "right",
                      letterSpacing: 0.3,
                    }}
                  >
                    -{drop}%
                  </Text>
                ) : (
                  <View style={{ width: 36 }} />
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 8 }} />
      </View>
    </CardSection>
  );
}

// ─── Acquisition section ──────────────────────────────────────────────────────

const ACQ_COLORS = [colors.accent, colors.accentViolet, colors.blue, colors.green, colors.accentWarn];

function AcquisitionSection({ projectId }: { projectId?: string | undefined }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useAcquisition(projectId);
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  return (
    <CardSection
      index="03"
      title="Acquisition"
      pt={14}
      {...(total > 0 ? { action: `${formatInteger(total)} · 30d` } : {})}
    >
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : rows.length === 0 ? (
        <EmptyHint>NO ACQUISITION DATA</EmptyHint>
      ) : (
        rows.map((acq, i) => {
          const open = openId === acq.source;
          const color = ACQ_COLORS[i % ACQ_COLORS.length]!;
          const pct = total > 0 ? Math.round((acq.users / total) * 100) : 0;
          return (
            <Row
              key={acq.source}
              open={open}
              onToggle={() => {
                haptic.tap();
                setOpenId(open ? null : acq.source);
              }}
              isLast={i === rows.length - 1}
              header={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color }} />
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
                    {acq.source}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "GeistMono-600",
                      fontSize: type.body,
                      color,
                      width: 48,
                      textAlign: "right",
                    }}
                  >
                    {formatInteger(acq.users)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: type.label,
                      color: colors.fgMuted,
                      width: 32,
                      textAlign: "right",
                      letterSpacing: 0.3,
                    }}
                  >
                    {pct}%
                  </Text>
                </View>
              }
              detail={
                <KV
                  items={[
                    { label: "Users", value: formatInteger(acq.users), color },
                    { label: "Share", value: `${pct}%` },
                    { label: "Type", value: acq.type },
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

// ─── Countries section ────────────────────────────────────────────────────────

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
          const barPct = maxUsers > 0 ? Math.round((c.users / maxUsers) * 100) : 0;
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      paddingHorizontal: 5,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: 9,
                        color: colors.fgSecondary,
                        letterSpacing: 0.6,
                      }}
                    >
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
                  <View style={{ width: 64 }}>
                    <HBar pct={barPct} color={colors.accentViolet} height={5} />
                  </View>
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: type.label,
                      color: colors.fgMuted,
                      width: 30,
                      textAlign: "right",
                      letterSpacing: 0.3,
                    }}
                  >
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
        })
      )}
      <View style={{ height: 8 }} />
    </CardSection>
  );
}

// ─── OS versions section ──────────────────────────────────────────────────────

function OsSection({ projectId }: { projectId?: string | undefined }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const q = useOsBreakdown(projectId);
  const rows = q.data?.rows ?? [];
  const maxPct = rows.reduce((m, r) => Math.max(m, r.pct), 0);

  return (
    <CardSection index="06" title="OS versions" pt={14}>
      {!projectId ? (
        <EmptyHint>SELECT A PROJECT</EmptyHint>
      ) : q.isLoading ? (
        <EmptyHint>LOADING…</EmptyHint>
      ) : rows.length === 0 ? (
        <EmptyHint>NO OS DATA</EmptyHint>
      ) : (
        rows.map((os, i) => {
          const label = `${os.os}${os.version ? ` ${os.version}` : ""}`;
          const open = openLabel === label;
          const barPct = maxPct > 0 ? Math.round((os.pct / maxPct) * 100) : 0;
          return (
            <Row
              key={label}
              open={open}
              onToggle={() => {
                haptic.tap();
                setOpenLabel(open ? null : label);
              }}
              isLast={i === rows.length - 1}
              header={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text
                    style={{
                      fontFamily: "Geist-600",
                      fontSize: type.body,
                      color: colors.fgPrimary,
                      flex: 1,
                      letterSpacing: -0.2,
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                  <View style={{ width: 72 }}>
                    <HBar pct={barPct} color={colors.green} height={5} />
                  </View>
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: type.label,
                      color: colors.fgMuted,
                      width: 30,
                      textAlign: "right",
                      letterSpacing: 0.3,
                    }}
                  >
                    {os.pct}%
                  </Text>
                </View>
              }
              detail={
                <KV
                  items={[
                    { label: "Share", value: `${os.pct}%`, color: colors.green },
                    { label: "Users", value: formatInteger(os.users) },
                    { label: "OS", value: os.os },
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
  const dauDetail = useMetricDetail("dau");
  const mauDetail = useMetricDetail("mau");
  const sessDetail = useMetricDetail("avg_session_sec");
  const dauSeries = (dauDetail.data?.series ?? []).map((p) => p.value);
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
            {geoRows.length > 0 ? <AudienceMap rows={geoRows} fill /> : null}

            {/* DAU trend bars sunk into the bottom strip of the map (faint) */}
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, opacity: 0.4 }}>
              <Bars
                data={dauSeries.length >= 2 ? dauSeries : [heroValue, heroValue]}
                width={width}
                height={72}
                color={colors.blue}
              />
            </View>

            {/* gradient scrim: light at top, strong at bottom → text legible, map visible.
               pointerEvents none so map pan/zoom gestures pass through. */}
            <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Rect x={0} y={0} width={width} height={300}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, 300)}
                  colors={["rgba(7,7,10,0.30)", "rgba(7,7,10,0.45)", "rgba(7,7,10,0.92)"]}
                  positions={[0, 0.45, 1]}
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
                right={
                  <View pointerEvents="auto" style={{ width: 168 }}>
                    <NativeSegmented<Metric>
                      value={metric}
                      options={["DAU", "WAU", "MAU"]}
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
                color={colors.blue}
              />

              <View style={{ flex: 1 }} />

              {/* stat strip on a faint glass plate, pinned above the sunk bars */}
              <View
                style={{
                  flexDirection: "row",
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor: "rgba(10,10,14,0.55)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                {heroStats.map((s, i) => (
                  <View key={s.label} style={{ flex: 1, flexDirection: "row" }}>
                    {i > 0 ? <Sep /> : null}
                    <MiniStat {...s} />
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Analytics sections — audience layout */}
          <LiquidGlass padding={0} style={{ marginHorizontal: 16 }}>
            <CountriesSection projectId={projectId} />
            <FullDivider />
            <FunnelSection projectId={projectId} />
            <FullDivider />
            <AcquisitionSection projectId={projectId} />
            <FullDivider />
            <RetentionSection projectId={projectId} />
            <FullDivider />
            <ReviewsSection index="05" />
            <FullDivider />
            <OsSection projectId={projectId} />
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
