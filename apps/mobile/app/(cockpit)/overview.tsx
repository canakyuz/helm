import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { useAlerts, useAckAlert, type Alert } from "~/hooks/use-alerts";
import { useProperties, type Property, type PropertyStatus } from "~/hooks/use-properties";
import { usePropertyMetrics } from "~/hooks/use-property-metrics";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { useFxRates } from "~/hooks/use-fx-rates";
import { useRevenueGoal } from "~/hooks/use-revenue-goal";
import { useRevenueMix } from "~/hooks/use-revenue-mix";
import { useGeoBreakdown } from "~/hooks/use-analytics";
import { toUsd, FX_FALLBACK } from "@helm/api";
import { formatInteger, formatRelativeTime } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { usePreferences } from "~/lib/preferences";
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
  NativeSegmented,
  ActionBtn,
  StatusDot,
  Glyph,
  Eyebrow,
  EmptyHint,
  ShowMore,
  AudienceMap,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

const TOP_N = 5; // glance-first lists: show the top few, total stays in the header

const PROJECT_TINTS = [colors.accent, colors.accentViolet, colors.blue, colors.green, colors.accentWarn];
const PROJECT_GLYPHS = ["◆", "✦", "❖", "◇", "●"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Kind = "All" | "Games" | "Apps" | "Web";

const STATUS_COLOR: Record<PropertyStatus, string> = {
  healthy: colors.green,
  stale: colors.accentWarn,
  down: colors.accentDanger,
  unknown: colors.fgSubtle,
};
const STATUS_LABEL: Record<PropertyStatus, string> = {
  healthy: "Healthy",
  stale: "Stale",
  down: "Down",
  unknown: "Unknown",
};
function statusColor(s: PropertyStatus): string {
  return STATUS_COLOR[s];
}
function statusLabel(s: PropertyStatus): string {
  return STATUS_LABEL[s];
}
function matchesKind(p: Property, k: Kind): boolean {
  if (k === "All") return true;
  if (k === "Games") return p.type === "game";
  if (k === "Web") return p.type === "website" || p.type === "web_app";
  return p.type === "mobile_app" || p.type === "desktop_app";
}

function ProjectRows({
  properties,
  metrics,
  fmt,
}: {
  properties: ReturnType<typeof useProperties>;
  metrics: ReturnType<typeof usePropertyMetrics>;
  fmt: (n: number) => string;
}) {
  const [filter, setFilter] = useState<Kind>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(
    () => (properties.data ?? []).filter((p) => matchesKind(p, filter)),
    [properties.data, filter],
  );
  const visible = showAll ? list : list.slice(0, TOP_N);

  return (
    <View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <NativeSegmented<Kind>
          value={filter}
          options={["All", "Games", "Apps", "Web"]}
          onChange={(v) => {
            setFilter(v);
            setOpenId(null);
          }}
        />
      </View>
      {list.length === 0 ? (
        <EmptyHint>NO PROJECTS IN THIS GROUP</EmptyHint>
      ) : (
        <>
        {visible.map((p, i) => {
          const open = openId === p.id;
          const tint = PROJECT_TINTS[i % PROJECT_TINTS.length]!;
          const glyph = PROJECT_GLYPHS[i % PROJECT_GLYPHS.length]!;
          // The metrics map only holds an entry for projects with at least one
          // metric row — a missing entry means "no data source", not real zeros.
          const pm = metrics.data?.[p.id];
          return (
            <Row
              key={p.id}
              open={open}
              onToggle={() => setOpenId(open ? null : p.id)}
              isLast={i === visible.length - 1}
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
                  {metrics.isLoading ? (
                    <EmptyHint>LOADING METRICS…</EmptyHint>
                  ) : pm != null ? (
                    <KV
                      items={[
                        { label: "Revenue today", value: fmt(pm.adRevenue), color: colors.accent },
                        { label: "MRR", value: fmt(pm.mrr), color: colors.accentViolet },
                        { label: "DAU", value: formatInteger(pm.dau), color: colors.blue },
                        { label: "Status", value: statusLabel(p.status), color: statusColor(p.status) },
                      ]}
                    />
                  ) : (
                    <EmptyHint>NO METRICS YET · CONNECT A SOURCE IN SETTINGS</EmptyHint>
                  )}
                  <View style={{ flexDirection: "row", gap: 24, justifyContent: "center" }}>
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
        })}
        <ShowMore
          hidden={list.length - TOP_N}
          expanded={showAll}
          onPress={() => {
            haptic.tap();
            setShowAll((v) => !v);
          }}
        />
        </>
      )}
    </View>
  );
}

function AlertRows({
  list,
  ack,
  onDismiss,
}: {
  list: Alert[];
  ack: ReturnType<typeof useAckAlert>;
  onDismiss: (id: number) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (list.length === 0) return <EmptyHint>ALL CLEAR · NO OPEN ALERTS</EmptyHint>;
  const visible = showAll ? list : list.slice(0, TOP_N);

  return (
    <View>
      {visible.map((a: Alert, i) => {
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
              borderBottomWidth: i === visible.length - 1 ? 0 : 1,
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
                        onDismiss(a.id);
                      }}
                    />
                    <ActionBtn label="MUTE" onPress={() => onDismiss(a.id)} />
                  </View>
                }
              />
            </View>
          </View>
        );
      })}
      <ShowMore
        hidden={list.length - TOP_N}
        expanded={showAll}
        onPress={() => {
          haptic.tap();
          setShowAll((v) => !v);
        }}
      />
    </View>
  );
}

export default function Overview() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;
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
  // Geo edge PostHog-backed, tek proje scope'lu (analytics.tsx / revenue.tsx ile
  // aynı desen) — "all" seçiliyken diğer hook'lar gibi otomatik toplanamaz, o yüzden
  // seçili projeyi burada kendimiz çözüyoruz; kaynak yine usePreferences.
  const { selectedPropertyId } = usePreferences();
  const geoProjectId =
    selectedPropertyId !== "all" ? selectedPropertyId : properties.data?.[0]?.id;
  const geo = useGeoBreakdown(geoProjectId);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<number, boolean>>({});

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data) return <ScreenStatus label="Cockpit yüklenemedi" tone="danger" />;

  const data = kpis.data;
  const series = (revenue.data?.series ?? []).map((p) => p.value);
  // Hero = GÜNLÜK gelir (bugün reklam + mağaza). Aylık/diğer veriler altta
  // (goal + statlar). Hepsi USD canonical → fmt seçili currency'ye çevirir.
  const todayRevenue =
    (revenue.data?.today ?? 0) + (appRevDetail.data?.today ?? 0);
  const yestRevenue =
    (revenue.data?.yesterday ?? 0) + (appRevDetail.data?.yesterday ?? 0);
  const revDelta =
    yestRevenue > 0 ? ((todayRevenue - yestRevenue) / yestRevenue) * 100 : 0;
  const cfSeries = (crashFree.data?.series ?? []).map((p) => p.value);
  const cfHas = cfSeries.length > 0;
  const cfNow = cfHas ? cfSeries[cfSeries.length - 1]! : null;
  const cfDelta =
    cfSeries.length > 1
      ? Number((cfNow! - cfSeries[cfSeries.length - 2]!).toFixed(1))
      : undefined;
  // İlerleme = bu ayın GERÇEK geliri (reklam + abonelik + IAP), MRR projeksiyonu
  // DEĞİL ve çift sayım yok → revenue-mix toplamı. Hedef kullanıcının currency'sinde
  // saklı → USD'ye normalize (ikisi de USD baz, fmt tutarlı).
  const goalTarget =
    goal.data?.target_amount != null
      ? toUsd(goal.data.target_amount, goal.data.currency, rates ?? FX_FALLBACK)
      : null;
  const goalCurrent = mix.data?.total ?? 0;
  const goalPct =
    goalTarget != null && goalTarget > 0
      ? Math.round((goalCurrent / goalTarget) * 100)
      : 0;
  const goalLabel = `${MONTHS[new Date().getMonth()]} target`;
  const openAlerts = (alerts.data ?? []).filter((a) => !dismissedAlerts[a.id]);
  const dismissAlert = (id: number) => setDismissedAlerts((d) => ({ ...d, [id]: true }));

  const stats: HeroStat[] = [
    { label: "DAU", value: formatInteger(data.dau), delta: data.dauDelta ?? undefined },
    { label: "Crash-free", value: cfHas ? cfNow!.toFixed(1) + "%" : "—", delta: cfDelta },
    { label: "MRR", value: fmt(data.mrr), delta: data.mrrDelta ?? undefined },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              tintColor={colors.fgPrimary}
              refreshing={kpis.isRefetching}
              onRefresh={() => {
                haptic.tap();
                kpis.refetch();
                alerts.refetch();
                properties.refetch();
                revenue.refetch();
                crashFree.refetch();
                goal.refetch();
                mix.refetch();
                geo.refetch();
              }}
            />
          }
        >
          <OpenHero
            eyebrow="Bugün · gelir"
            eyebrowMeta={new Date(kpis.dataUpdatedAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            live
            value={todayRevenue}
            format={(v) => fmt(v)}
            delta={Number(revDelta.toFixed(1))}
            caption="Reklam + mağaza · tüm projeler"
            chartWidth={chartW}
            chartData={series.length >= 2 ? series : [todayRevenue, todayRevenue]}
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

          {/* monthly revenue goal */}
          <LiquidGlass padding={12}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Eyebrow>{goalLabel}</Eyebrow>
              {goalTarget != null ? (
                <Text style={{ fontFamily: "GeistMono-500", fontSize: 11.5, color: colors.fgSecondary }}>
                  <Text style={{ color: colors.fgPrimary, fontFamily: "GeistMono-600" }}>{fmt(goalCurrent)}</Text>
                  {" / "}
                  {fmt(goalTarget)}
                </Text>
              ) : (
                <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgSubtle, letterSpacing: 0.4 }}>
                  SET IN SETTINGS
                </Text>
              )}
            </View>
            {goalTarget != null ? (
              <>
                <HBar pct={goalPct} color={colors.accent} height={8} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.accent, letterSpacing: 0.4 }}>
                    {goalPct}% REACHED
                  </Text>
                </View>
              </>
            ) : (
              <Text style={{ fontFamily: "GeistMono-500", fontSize: 9.5, color: colors.fgSubtle, letterSpacing: 0.4 }}>
                {fmt(goalCurrent)} THIS MONTH · NO TARGET YET
              </Text>
            )}
          </LiquidGlass>

          {/* audience map — veri yokken (yükleniyor/hata/boş) hiç render etme:
              boş harita "hiç oyuncun yok" gibi okunur, bu yanıltıcı olur. */}
          {geo.data && geo.data.rows.length > 0 ? (
            <AudienceMap rows={geo.data.rows} height={220} />
          ) : null}

          {/* projects + needs attention */}
          <LiquidGlass padding={0}>
            <CardSection index="01" title="Projects" count={(properties.data ?? []).length} pt={14}>
              <ProjectRows properties={properties} metrics={propMetrics} fmt={fmt} />
            </CardSection>
            <FullDivider />
            <CardSection index="02" title="Needs attention" count={openAlerts.length}>
              <AlertRows list={openAlerts} ack={ack} onDismiss={dismissAlert} />
              <View style={{ height: 4 }} />
            </CardSection>
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
