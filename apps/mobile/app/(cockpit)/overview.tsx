import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useAlerts, useAckAlert, type Alert } from "~/hooks/use-alerts";
import { useProperties, type Property } from "~/hooks/use-properties";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { demoData } from "~/lib/demo-data";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";
import { ScreenStatus } from "~/components/screen-status";
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
  Seg,
  ActionBtn,
  StatusDot,
  Glyph,
  Eyebrow,
  EmptyHint,
  DemoChip,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

const PROJECT_TINTS = [colors.accent, colors.accentViolet, colors.blue, colors.green, colors.accentWarn];
const PROJECT_GLYPHS = ["◆", "✦", "❖", "◇", "●"];

type Kind = "All" | "Games" | "Apps" | "Web";

function statusColor(s: Property["status"]): string {
  return s === "healthy" ? colors.green : s === "down" ? colors.accentDanger : colors.accentWarn;
}
function statusLabel(s: Property["status"]): string {
  return s === "healthy" ? "Healthy" : s === "down" ? "Down" : "Watch";
}
function matchesKind(p: Property, k: Kind): boolean {
  if (k === "All") return true;
  if (k === "Games") return p.type === "game";
  if (k === "Web") return p.type === "website" || p.type === "web_app";
  return p.type === "mobile_app" || p.type === "desktop_app";
}

function ProjectRows({
  properties,
  fmt,
}: {
  properties: ReturnType<typeof useProperties>;
  fmt: (n: number) => string;
}) {
  const [filter, setFilter] = useState<Kind>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [muted, setMuted] = useState<Record<string, boolean>>({});

  const list = useMemo(
    () => (properties.data ?? []).filter((p) => matchesKind(p, filter)),
    [properties.data, filter],
  );

  return (
    <View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <Seg<Kind>
          value={filter}
          options={["All", "Games", "Apps", "Web"]}
          onChange={(v) => {
            setFilter(v);
            setOpenId(null);
          }}
          full
        />
      </View>
      {list.length === 0 ? (
        <EmptyHint>NO PROJECTS IN THIS GROUP</EmptyHint>
      ) : (
        list.map((p, i) => {
          const open = openId === p.id;
          const tint = PROJECT_TINTS[i % PROJECT_TINTS.length]!;
          const glyph = PROJECT_GLYPHS[i % PROJECT_GLYPHS.length]!;
          return (
            <Row
              key={p.id}
              open={open}
              onToggle={() => setOpenId(open ? null : p.id)}
              isLast={i === list.length - 1}
              header={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Glyph glyph={glyph} tint={tint} size={30} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Text
                        style={{ fontFamily: "Geist-600", fontSize: 14, color: colors.fgPrimary, letterSpacing: -0.2 }}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      <StatusDot color={statusColor(p.status)} />
                    </View>
                    <Text
                      style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.4 }}
                      numberOfLines={1}
                    >
                      {(p.brandName ?? p.type).toUpperCase()}
                    </Text>
                  </View>
                  <StatusDot color={statusColor(p.status)} label={statusLabel(p.status)} />
                </View>
              }
              detail={
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Eyebrow size={8}>METRICS</Eyebrow>
                    <DemoChip />
                  </View>
                  <KV
                    items={[
                      { label: "Revenue today", value: fmt(demoData.projectDetail.revToday), color: colors.accent },
                      { label: "MRR", value: fmt(demoData.projectDetail.mrr), color: colors.accentViolet },
                      { label: "Status", value: statusLabel(p.status), color: statusColor(p.status) },
                      { label: "Crash-free", value: demoData.projectDetail.crashFree + "%", color: colors.green },
                    ]}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <ActionBtn label="OPEN DETAIL" tone="accent" onPress={() => haptic.tap()} />
                    <ActionBtn
                      label={muted[p.id] ? "ALERTS MUTED" : "MUTE ALERTS"}
                      onPress={() => setMuted((m) => ({ ...m, [p.id]: !m[p.id] }))}
                    />
                  </View>
                </>
              }
            />
          );
        })
      )}
    </View>
  );
}

function AlertRows() {
  const alerts = useAlerts();
  const ack = useAckAlert();
  const [openId, setOpenId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});

  const list = (alerts.data ?? []).filter((a) => !dismissed[a.id]);
  if (list.length === 0) return <EmptyHint>ALL CLEAR · NO OPEN ALERTS</EmptyHint>;

  return (
    <View>
      {list.map((a: Alert, i) => {
        const open = openId === a.id;
        const sev =
          a.severity === "critical"
            ? colors.accentDanger
            : a.severity === "warn"
              ? colors.accentWarn
              : colors.accentInfo;
        return (
          <View
            key={a.id}
            style={{
              flexDirection: "row",
              borderBottomWidth: i === list.length - 1 ? 0 : 1,
              borderBottomColor: "rgba(255,255,255,0.055)",
            }}
          >
            <View style={{ width: 3, backgroundColor: sev, opacity: a.severity === "critical" ? 1 : 0.7 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Row
                open={open}
                onToggle={() => setOpenId(open ? null : a.id)}
                isLast
                header={
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text
                        style={{ flex: 1, fontFamily: "Geist-600", fontSize: 12.5, color: colors.fgPrimary, letterSpacing: -0.2 }}
                        numberOfLines={1}
                      >
                        {a.ruleName}
                      </Text>
                      <Text style={{ fontFamily: "GeistMono-500", fontSize: 10, color: colors.fgSubtle }}>
                        {formatRelativeTime(a.triggeredAt)}
                      </Text>
                    </View>
                    <Text
                      style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.4 }}
                      numberOfLines={1}
                    >
                      {a.metric.toUpperCase()} · {a.condition.toUpperCase()}
                    </Text>
                  </View>
                }
                detail={
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <ActionBtn
                      label="RESOLVE"
                      tone="accent"
                      onPress={() => {
                        haptic.tap();
                        ack.mutate(a.id);
                        setDismissed((d) => ({ ...d, [a.id]: true }));
                      }}
                    />
                    <ActionBtn label="MUTE" onPress={() => setDismissed((d) => ({ ...d, [a.id]: true }))} />
                  </View>
                }
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function Overview() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;
  const fmt = useFormatCurrency();
  const kpis = useCockpitKpis();
  const alerts = useAlerts();
  const properties = useProperties();
  const revenue = useMetricDetail("ad_revenue");

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data) return <ScreenStatus label="Cockpit yüklenemedi" tone="danger" />;

  const data = kpis.data;
  const series = (revenue.data?.series ?? []).map((p) => p.value);
  const today = revenue.data?.today ?? data.adRevenue;
  const yest = revenue.data?.yesterday ?? 0;
  const revDelta = yest > 0 ? ((today - yest) / yest) * 100 : 0;
  const goalPct = Math.round((demoData.goal.current / demoData.goal.target) * 100);

  const stats: HeroStat[] = [
    { label: "DAU", value: formatInteger(data.dau), delta: data.dauDelta ?? undefined },
    { label: "Crash-free", value: demoData.crashFree + "%", delta: demoData.crashFreeDelta, invert: true },
    { label: "MRR", value: fmt(data.mrr), delta: data.mrrDelta ?? undefined },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 18 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              tintColor={colors.fgPrimary}
              refreshing={kpis.isRefetching}
              onRefresh={() => {
                haptic.tap();
                kpis.refetch();
                alerts.refetch();
                revenue.refetch();
              }}
            />
          }
        >
          <OpenHero
            eyebrow="Today"
            live
            value={today}
            format={(v) => fmt(v)}
            delta={Number(revDelta.toFixed(1))}
            caption="Revenue · all projects"
            chartWidth={chartW}
            chartData={series.length >= 2 ? series : [today, today]}
            color={colors.accent}
            chartH={92}
            stats={stats}
            right={
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                }}
              >
                <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.accent }} />
                <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgSecondary, letterSpacing: 0.4 }}>
                  {formatInteger(data.dau)} ACTIVE
                </Text>
              </View>
            }
          />

          {/* monthly goal — DEMO */}
          <LiquidGlass padding={14}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Eyebrow>{demoData.goal.label}</Eyebrow>
                <DemoChip />
              </View>
              <Text style={{ fontFamily: "GeistMono-500", fontSize: 11.5, color: colors.fgSecondary }}>
                <Text style={{ color: colors.fgPrimary, fontFamily: "GeistMono-600" }}>{fmt(demoData.goal.current)}</Text>
                {" / "}
                {fmt(demoData.goal.target)}
              </Text>
            </View>
            <HBar pct={goalPct} color={colors.accent} height={8} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.accent, letterSpacing: 0.4 }}>
                {goalPct}% REACHED
              </Text>
            </View>
          </LiquidGlass>

          {/* projects + needs attention */}
          <LiquidGlass padding={0}>
            <CardSection index="01" title="Projects" count={(properties.data ?? []).length} pt={14}>
              <ProjectRows properties={properties} fmt={fmt} />
            </CardSection>
            <FullDivider />
            <CardSection index="02" title="Needs attention" count={(alerts.data ?? []).length}>
              <AlertRows />
              <View style={{ height: 4 }} />
            </CardSection>
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
