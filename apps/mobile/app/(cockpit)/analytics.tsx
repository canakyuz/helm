import { useState } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { demoData } from "~/lib/demo-data";
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
  Seg,
  DemoChip,
  EmptyHint,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

// ─── Types ────────────────────────────────────────────────────────────────────

type Metric = "DAU" | "WAU" | "MAU";

// ─── Retention section ────────────────────────────────────────────────────────

function RetentionSection() {
  return (
    <CardSection index="01" title="Retention" pt={14}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <DemoChip />
        </View>
        {demoData.retention.map((r, i) => (
          <View
            key={r.day}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 4,
              borderBottomWidth: i === demoData.retention.length - 1 ? 0 : 1,
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
        ))}
        <View style={{ height: 8 }} />
      </View>
    </CardSection>
  );
}

// ─── Funnel section ───────────────────────────────────────────────────────────

function FunnelSection() {
  const funnel = demoData.funnel;
  const top = funnel[0]?.value ?? 1;

  return (
    <CardSection index="02" title="Conversion funnel" pt={14}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 4, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <DemoChip />
        </View>
        {funnel.map((step, i) => {
          const prevValue = i > 0 ? (funnel[i - 1]?.value ?? step.value) : step.value;
          const drop = i > 0 ? Math.round(((prevValue - step.value) / prevValue) * 100) : 0;
          const barPct = Math.round((step.value / top) * 100);

          return (
            <View
              key={step.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 4,
                borderBottomWidth: i === funnel.length - 1 ? 0 : 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Geist-600",
                  fontSize: type.body,
                  color: colors.fgPrimary,
                  width: 64,
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              <View style={{ flex: 1 }}>
                <HBar pct={barPct} color={colors.accent} height={6} />
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
                {formatInteger(step.value)}
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
        })}
        <View style={{ height: 8 }} />
      </View>
    </CardSection>
  );
}

// ─── Acquisition section ──────────────────────────────────────────────────────

function AcquisitionSection() {
  const [openId, setOpenId] = useState<string | null>(null);
  const total = demoData.acquisition.reduce((s, a) => s + a.users, 0);

  return (
    <CardSection
      index="03"
      title="Acquisition"
      action="70K · 30d"
      onAction={() => haptic.tap()}
      pt={14}
    >
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <DemoChip />
        </View>
      </View>
      {demoData.acquisition.map((acq, i) => {
        const open = openId === acq.label;
        const cac = total > 0 ? (total / acq.users) * 0.8 : 0;
        return (
          <Row
            key={acq.label}
            open={open}
            onToggle={() => {
              haptic.tap();
              setOpenId(open ? null : acq.label);
            }}
            isLast={i === demoData.acquisition.length - 1}
            header={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 2,
                    backgroundColor: acq.color,
                  }}
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
                  {acq.label}
                </Text>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: type.body,
                    color: acq.color,
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
                  {acq.pct}%
                </Text>
              </View>
            }
            detail={
              <KV
                items={[
                  { label: "New users", value: formatInteger(acq.users), color: acq.color },
                  { label: "Share", value: `${acq.pct}%` },
                  { label: "CAC", value: `$${cac.toFixed(2)}` },
                  { label: "Trial → paid", value: `${Math.round(acq.pct * 0.38)}%` },
                ]}
              />
            }
          />
        );
      })}
      <View style={{ height: 8 }} />
    </CardSection>
  );
}

// ─── Countries section ────────────────────────────────────────────────────────

function CountriesSection() {
  const [openCode, setOpenCode] = useState<string | null>(null);

  return (
    <CardSection
      index="04"
      title="Top countries"
      count={demoData.countries.length}
      pt={14}
    >
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <DemoChip />
        </View>
      </View>
      {(demoData.countries as readonly (typeof demoData.countries)[number][]).length === 0 ? (
        <EmptyHint>NO DATA</EmptyHint>
      ) : (
        demoData.countries.map((c, i) => {
          const open = openCode === c.code;
          const barPct = Math.min(100, Math.round(c.pct * 2.6));
          return (
            <Row
              key={c.code}
              open={open}
              onToggle={() => {
                haptic.tap();
                setOpenCode(open ? null : c.code);
              }}
              isLast={i === demoData.countries.length - 1}
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
                      {c.code}
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
                    {c.name}
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
                    {c.pct}%
                  </Text>
                </View>
              }
              detail={
                <KV
                  items={[
                    { label: "DAU", value: formatInteger(c.dau), color: colors.blue },
                    { label: "Share", value: `${c.pct}%` },
                    { label: "Revenue", value: `$${formatInteger(Math.round(c.dau * 0.42))}` },
                    { label: "ARPU", value: "$0.42" },
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

function OsSection() {
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  return (
    <CardSection index="05" title="OS versions" pt={14}>
      <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <DemoChip />
        </View>
      </View>
      {demoData.os.map((os, i) => {
        const open = openLabel === os.label;
        const barPct = Math.min(100, Math.round(os.pct * 1.7));
        return (
          <Row
            key={os.label}
            open={open}
            onToggle={() => {
              haptic.tap();
              setOpenLabel(open ? null : os.label);
            }}
            isLast={i === demoData.os.length - 1}
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
                  {os.label}
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
                  { label: "Share", value: `${os.pct}%` },
                  { label: "Crash-free", value: "99.2%" },
                  { label: "Avg session", value: "6m 14s" },
                  {
                    label: "Users",
                    value: formatInteger(Math.round((os.pct / 100) * demoData.analyticsStats.mau)),
                  },
                ]}
              />
            }
          />
        );
      })}
      <View style={{ height: 8 }} />
    </CardSection>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;

  const [metric, setMetric] = useState<Metric>("DAU");
  const kpis = useCockpitKpis();

  const heroValue = kpis.data?.dau ?? 0;
  const dauDelta: number | undefined = kpis.data?.dauDelta ?? undefined;

  const heroStats: HeroStat[] = [
    {
      label: "Stickiness",
      value: `${demoData.analyticsStats.stickiness}%`,
      delta: undefined,
      invert: false,
    },
    {
      label: "Avg session",
      value: demoData.analyticsStats.avgSession,
      delta: undefined,
      invert: false,
    },
    {
      label: "New users",
      value: formatInteger(demoData.analyticsStats.newUsers),
      delta: undefined,
      invert: false,
    },
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
          {/* Hero — DAU real, chart + stats demo */}
          <OpenHero
            eyebrow="Active users · 30D"
            live
            right={
              <Seg<Metric>
                value={metric}
                options={["DAU", "WAU", "MAU"]}
                onChange={(v) => {
                  haptic.tap();
                  setMetric(v);
                }}
              />
            }
            value={heroValue}
            format={formatInteger}
            {...(dauDelta !== undefined ? { delta: dauDelta } : {})}
            caption={`MAU ${formatInteger(kpis.data?.totalUsers ?? 0)}`}
            chartWidth={chartW}
            chartEl={
              <Bars
                data={[...demoData.dauSeries]}
                width={chartW}
                height={84}
                color={colors.blue}
              />
            }
            color={colors.blue}
            chartH={84}
            stats={heroStats}
          />

          {/* Demo notice for hero stats */}
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
              Stickiness · session · new users are demo · DAU is real
            </Text>
          </View>

          {/* Analytics sections */}
          <LiquidGlass padding={0}>
            <RetentionSection />
            <FullDivider />
            <FunnelSection />
            <FullDivider />
            <AcquisitionSection />
            <FullDivider />
            <CountriesSection />
            <FullDivider />
            <OsSection />
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
