import { useMemo, useState } from "react";
import { Linking, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSentryIssues, type SentryIssue, type SentryLevel } from "~/hooks/use-sentry-issues";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useAppVersions } from "~/hooks/use-app-versions";
import { useProperties, type Property } from "~/hooks/use-properties";
import { useMetricDetail } from "~/hooks/use-metric-detail";
import { formatInteger, formatRelativeTime } from "~/lib/format";
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
  Seg,
  ActionBtn,
  SearchInput,
  StatusDot,
  EmptyHint,
  ShowMore,
  ReviewsSection,
} from "~/components/liquid";

const TOP_N = 5; // glance-first lists: show the top few, total stays in the header
import type { HeroStat } from "~/components/liquid";

const MONO_500 = "GeistMono-500";
const MONO_600 = "GeistMono-600";
const SANS_600 = "Geist-600";

// Provider/source keys → proper brand casing for display.
const BRAND: Record<string, string> = {
  revenuecat: "RevenueCat",
  admob: "AdMob",
  posthog: "PostHog",
  sentry: "Sentry",
  supabase: "Supabase",
  google_play_developer: "Google Play",
  app_store_connect: "App Store Connect",
  appstore: "App Store",
  playstore: "Play Store",
  itunes: "iTunes",
  ios: "iOS",
  android: "Android",
  web: "Web",
};
const brand = (k: string) => BRAND[k.toLowerCase()] ?? k;

function levelColor(level: SentryLevel): string {
  if (level === "fatal" || level === "error") return colors.accentDanger;
  if (level === "warning") return colors.accentWarn;
  return colors.accentInfo;
}

// ── Crashes (real: Sentry) ──────────────────────────────────────
type CrashFilter = "All" | "Fatal" | "Error" | "Warn";
const FILTER_LEVEL: Record<CrashFilter, SentryLevel | null> = {
  All: null,
  Fatal: "fatal",
  Error: "error",
  Warn: "warning",
};

function CrashRows({ issues }: { issues: SentryIssue[] }) {
  const [filter, setFilter] = useState<CrashFilter>("All");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, "resolved" | "ignored">>({});
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return issues.filter((c) => {
      if (status[c.id] === "ignored") return false;
      if (FILTER_LEVEL[filter] && c.level !== FILTER_LEVEL[filter]) return false;
      const hay = `${c.title} ${c.culprit ?? ""} ${c.propertyName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [issues, filter, q, status]);
  const visible = showAll ? list : list.slice(0, TOP_N);

  return (
    <View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <Seg<CrashFilter>
          value={filter}
          options={["All", "Fatal", "Error", "Warn"]}
          onChange={(v) => {
            setFilter(v);
            setOpenId(null);
          }}
          full
        />
      </View>
      <SearchInput value={q} onChange={setQ} placeholder="Search crashes, files…" />
      {list.length === 0 ? (
        <EmptyHint>NO MATCHING ISSUES</EmptyHint>
      ) : (
        <>
        {visible.map((c, i) => {
          const open = openId === c.id;
          const resolved = status[c.id] === "resolved";
          const lc = levelColor(c.level);
          const stripe = resolved ? colors.green : lc;
          return (
            <View
              key={c.id}
              style={{
                flexDirection: "row",
                borderBottomWidth: i === visible.length - 1 ? 0 : 1,
                borderBottomColor: "rgba(255,255,255,0.055)",
                opacity: resolved ? 0.6 : 1,
              }}
            >
              <View style={{ width: 3, backgroundColor: stripe, opacity: c.level === "fatal" && !resolved ? 1 : 0.7 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Row
                  open={open}
                  onToggle={() => setOpenId(open ? null : c.id)}
                  isLast
                  header={
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: SANS_600,
                            fontSize: type.bodySm,
                            color: colors.fgPrimary,
                            letterSpacing: -0.2,
                            textDecorationLine: resolved ? "line-through" : "none",
                          }}
                          numberOfLines={1}
                        >
                          {c.title}
                        </Text>
                        {resolved ? (
                          <Badge label="FIXED" bg={colors.green} />
                        ) : c.level === "fatal" ? (
                          <Badge label="FATAL" bg={colors.accentDanger} />
                        ) : null}
                        <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgSubtle }}>
                          {formatRelativeTime(c.lastSeen)}
                        </Text>
                      </View>
                      <Text
                        style={{ fontFamily: MONO_500, fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.4, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {(c.culprit ?? "—")} · {formatInteger(c.count)} EVENTS · {formatInteger(c.userCount)} USERS
                      </Text>
                    </View>
                  }
                  detail={
                    <>
                      <KV
                        items={[
                          { label: "Events", value: formatInteger(c.count) },
                          { label: "Users affected", value: formatInteger(c.userCount), color: colors.accentDanger },
                          { label: "Project", value: c.propertyName ?? "—" },
                          { label: "Level", value: c.level.toUpperCase(), color: lc },
                          { label: "Location", value: c.culprit ?? "—", full: true },
                        ]}
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {!resolved ? (
                          <ActionBtn
                            label="RESOLVE"
                            tone="accent"
                            onPress={() => {
                              haptic.tap();
                              setStatus((s) => ({ ...s, [c.id]: "resolved" }));
                            }}
                          />
                        ) : null}
                        <ActionBtn label="IGNORE" onPress={() => setStatus((s) => ({ ...s, [c.id]: "ignored" }))} />
                        <ActionBtn
                          label="OPEN IN SENTRY"
                          onPress={() => {
                            if (c.permalink) Linking.openURL(c.permalink).catch(() => {});
                          }}
                        />
                      </View>
                    </>
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
        </>
      )}
    </View>
  );
}

function Badge({ label, bg }: { label: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: bg }}>
      <Text style={{ fontFamily: MONO_600, fontSize: 8, color: colors.accentInk, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

// ── Integrations (real: system health) ──────────────────────────
type Integration = {
  id: string;
  provider: string;
  status: "ok" | "error" | "pending";
  lastSyncedAt: string | null;
  propertyName: string | null;
  enabled: boolean;
};

function IntegrationRows({ items }: { items: Integration[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) return <EmptyHint>NO INTEGRATIONS</EmptyHint>;
  return (
    <View>
      {items.map((ig, i) => {
        const open = openId === ig.id;
        const c = ig.status === "ok" ? colors.green : ig.status === "pending" ? colors.accentWarn : colors.accentDanger;
        const statusLabel = ig.status === "ok" ? "OK" : ig.status === "pending" ? "PENDING" : "ERROR";
        return (
          <Row
            key={ig.id}
            open={open}
            onToggle={() => setOpenId(open ? null : ig.id)}
            isLast={i === items.length - 1}
            header={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: c }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: SANS_600, fontSize: type.body, color: colors.fgPrimary }} numberOfLines={1}>
                    {brand(ig.provider)}
                  </Text>
                  {ig.propertyName ? (
                    <Text style={{ fontFamily: MONO_500, fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.4 }} numberOfLines={1}>
                      {ig.propertyName.toUpperCase()}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: c, letterSpacing: 0.6 }}>{statusLabel}</Text>
              </View>
            }
            detail={
              <KV
                items={[
                  { label: "Status", value: statusLabel, color: c },
                  { label: "Last sync", value: ig.lastSyncedAt ? formatRelativeTime(ig.lastSyncedAt) : "—" },
                  { label: "Enabled", value: ig.enabled ? "Yes" : "No" },
                  { label: "Provider", value: brand(ig.provider) },
                ]}
              />
            }
          />
        );
      })}
    </View>
  );
}
function heartbeatColor(status: Property["status"]): string {
  if (status === "down") return colors.accentDanger;
  if (status === "healthy") return colors.green;
  if (status === "unknown") return colors.fgMuted;
  return colors.accentWarn; // stale
}

export default function Health() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;
  const [versionsAll, setVersionsAll] = useState(false);

  const issuesQuery = useSentryIssues();
  const healthQuery = useSystemHealth();
  const versionsQuery = useAppVersions();
  const properties = useProperties();
  const crashFree = useMetricDetail("crash_free_sessions");

  const issues = issuesQuery.data ?? [];
  const integrations = (healthQuery.data?.integrations ?? []) as Integration[];
  const okCount = healthQuery.data?.okCount ?? 0;
  const totalIntegrations = healthQuery.data?.totalIntegrations ?? integrations.length;
  const versions = versionsQuery.data?.versions ?? [];
  const props = properties.data ?? [];

  const fatalCount = issues.filter((c) => c.level === "fatal").length;
  const totalEvents = issues.reduce((a, c) => a + c.count, 0);

  // crash_free_sessions oran metriği — son mevcut gün = güncel %, puan-delta dünden.
  const cfSeries = (crashFree.data?.series ?? []).map((p) => p.value);
  const cfHas = cfSeries.length > 0;
  const cfValue = cfHas ? cfSeries[cfSeries.length - 1]! : 0;
  const cfDelta =
    cfSeries.length > 1
      ? Number((cfValue - cfSeries[cfSeries.length - 2]!).toFixed(1))
      : undefined;

  const stats: HeroStat[] = [
    { label: "Active issues", value: formatInteger(issues.length) },
    { label: "Fatal", value: formatInteger(fatalCount) },
    { label: "Events", value: formatInteger(totalEvents) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <LiquidBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <LiquidHeader />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }} showsVerticalScrollIndicator={false}>
          <OpenHero
            eyebrow="Crash-free · sessions"
            live
            value={cfValue}
            format={(v) => (cfHas ? v.toFixed(1) + "%" : "—")}
            delta={cfDelta}
            chartWidth={chartW}
            chartData={cfSeries.length >= 2 ? cfSeries : [cfValue, cfValue]}
            color={colors.green}
            chartH={86}
            stats={stats}
          />

          <LiquidGlass padding={0}>
            <CardSection index="01" title="Crashes" count={issues.length} pt={14}>
              <CrashRows issues={issues} />
            </CardSection>

            <FullDivider />
            <CardSection index="02" title="Integrations" action={`${okCount}/${totalIntegrations} ok`}>
              <IntegrationRows items={integrations} />
            </CardSection>

            <FullDivider />
            <CardSection index="03" title="App versions" count={versions.length}>
              {versions.length === 0 ? (
                <EmptyHint>NO VERSIONS TRACKED</EmptyHint>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
                  {(versionsAll ? versions : versions.slice(0, TOP_N)).map((v) => (
                    <View key={v.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ fontFamily: MONO_600, fontSize: type.bodySm, color: colors.fgPrimary, width: 56 }}>
                        {v.version}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 5,
                          backgroundColor: "rgba(255,255,255,0.05)",
                        }}
                      >
                        <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgMuted, letterSpacing: 0.4 }}>
                          {brand(v.source)}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontFamily: MONO_500, fontSize: type.label, color: colors.fgSecondary }} numberOfLines={1}>
                        {(v.status ?? "—").toUpperCase()}
                      </Text>
                      <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgSubtle }}>
                        {v.releaseDate ? formatRelativeTime(v.releaseDate) : "—"}
                      </Text>
                    </View>
                  ))}
                  <ShowMore
                    hidden={versions.length - TOP_N}
                    expanded={versionsAll}
                    onPress={() => {
                      haptic.tap();
                      setVersionsAll((v) => !v);
                    }}
                  />
                </View>
              )}
            </CardSection>

            <FullDivider />
            <CardSection index="04" title="Project heartbeat" count={props.length}>
              {props.length === 0 ? (
                <EmptyHint>NO PROJECTS</EmptyHint>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 15 }}>
                  {props.map((p) => {
                    // Real heartbeat signal only: ping freshness + interval. No fabricated %.
                    const c = heartbeatColor(p.status);
                    const ping = p.lastPingAt ? `last ping ${formatRelativeTime(p.lastPingAt)}` : "no ping yet";
                    const every = p.intervalMinutes ? ` · every ${p.intervalMinutes}m` : "";
                    return (
                      <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                        <StatusDot color={c} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                            <Text style={{ fontFamily: SANS_600, fontSize: type.body, color: colors.fgPrimary }} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: c, letterSpacing: 0.6 }}>
                              {p.status.toUpperCase()}
                            </Text>
                          </View>
                          <Text
                            style={{ fontFamily: MONO_500, fontSize: 9.5, color: colors.fgMuted, letterSpacing: 0.3, marginTop: 3 }}
                            numberOfLines={1}
                          >
                            {(p.heartbeatName ?? "heartbeat")} · {ping}
                            {every}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </CardSection>

            <FullDivider />
            <ReviewsSection index="05" />
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
