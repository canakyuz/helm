import { useMemo, useState } from "react";
import { Linking, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSentryIssues, type SentryIssue, type SentryLevel } from "~/hooks/use-sentry-issues";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useAppVersions } from "~/hooks/use-app-versions";
import { useReviews } from "~/hooks/use-reviews";
import { useReviewReply } from "~/hooks/use-review-reply";
import { useProperties, type Property } from "~/hooks/use-properties";
import { demoData } from "~/lib/demo-data";
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
  HBar,
  Seg,
  ActionBtn,
  SearchInput,
  Stars,
  StatusDot,
  Eyebrow,
  DemoChip,
  EmptyHint,
} from "~/components/liquid";
import type { HeroStat } from "~/components/liquid";

const MONO_500 = "GeistMono-500";
const MONO_600 = "GeistMono-600";
const SANS_600 = "Geist-600";

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

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return issues.filter((c) => {
      if (status[c.id] === "ignored") return false;
      if (FILTER_LEVEL[filter] && c.level !== FILTER_LEVEL[filter]) return false;
      const hay = `${c.title} ${c.culprit ?? ""} ${c.propertyName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [issues, filter, q, status]);

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
        list.map((c, i) => {
          const open = openId === c.id;
          const resolved = status[c.id] === "resolved";
          const lc = levelColor(c.level);
          const stripe = resolved ? colors.green : lc;
          return (
            <View
              key={c.id}
              style={{
                flexDirection: "row",
                borderBottomWidth: i === list.length - 1 ? 0 : 1,
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
                            if (c.permalink) Linking.openURL(c.permalink);
                          }}
                        />
                      </View>
                    </>
                  }
                />
              </View>
            </View>
          );
        })
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
                  <Text style={{ fontFamily: SANS_600, fontSize: type.bodySm, color: colors.fgPrimary }} numberOfLines={1}>
                    {ig.provider}
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
                  { label: "Provider", value: ig.provider },
                ]}
              />
            }
          />
        );
      })}
    </View>
  );
}

// ── Reviews (real) ──────────────────────────────────────────────
type ReviewItem = {
  id: number;
  rating: number | null;
  body: string | null;
  source: "appstore" | "playstore";
  review_date: string | null;
  developer_response: string | null;
};

function ReviewRows({ items, reply }: { items: ReviewItem[]; reply: ReturnType<typeof useReviewReply> }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [replied, setReplied] = useState<Record<number, boolean>>({});
  if (items.length === 0) return <EmptyHint>NO REVIEWS YET</EmptyHint>;
  return (
    <View>
      {items.map((r, i) => {
        const open = openId === r.id;
        const hasReply = replied[r.id] || !!r.developer_response;
        return (
          <Row
            key={r.id}
            open={open}
            onToggle={() => setOpenId(open ? null : r.id)}
            isLast={i === items.length - 1}
            header={
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Stars n={r.rating ?? 0} size={10} />
                  <Text style={{ flex: 1, fontFamily: MONO_500, fontSize: 9, color: colors.fgMuted, letterSpacing: 0.4 }}>
                    {r.source.toUpperCase()}
                  </Text>
                  {hasReply ? (
                    <Text style={{ fontFamily: MONO_500, fontSize: 8, color: colors.green, letterSpacing: 0.6 }}>✓ REPLIED</Text>
                  ) : null}
                  <Text style={{ fontFamily: MONO_500, fontSize: type.label, color: colors.fgSubtle }}>
                    {r.review_date ? formatRelativeTime(r.review_date) : ""}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Geist-400", fontSize: type.bodySm, color: colors.fgSecondary }} numberOfLines={1}>
                  {r.body ?? "—"}
                </Text>
              </View>
            }
            detail={
              <>
                <Text style={{ fontFamily: "Geist-400", fontSize: type.body, color: colors.fgSecondary, lineHeight: 18 }}>
                  {r.body ?? "—"}
                </Text>
                {hasReply ? (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: `${colors.green}14`,
                      borderWidth: 1,
                      borderColor: `${colors.green}3D`,
                    }}
                  >
                    <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.green, letterSpacing: 0.6 }}>YOUR REPLY</Text>
                    <Text style={{ fontFamily: "Geist-400", fontSize: type.bodySm, color: colors.fgSecondary, marginTop: 4 }}>
                      {r.developer_response ?? draft[r.id] ?? "Thanks for the feedback — we're on it!"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      value={draft[r.id] ?? ""}
                      onChangeText={(t) => setDraft((d) => ({ ...d, [r.id]: t }))}
                      placeholder="Write a reply…"
                      placeholderTextColor={colors.fgSubtle}
                      multiline
                      style={{
                        minHeight: 56,
                        backgroundColor: "rgba(255,255,255,0.04)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: 12,
                        color: colors.fgPrimary,
                        fontFamily: "Geist-400",
                        fontSize: type.body,
                        textAlignVertical: "top",
                      }}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <ActionBtn
                        label="SEND REPLY"
                        tone="accent"
                        onPress={() => {
                          const body = draft[r.id];
                          if (!body || !body.trim()) return;
                          haptic.tap();
                          reply.mutate({ review_id: r.id, body });
                          setReplied((s) => ({ ...s, [r.id]: true }));
                        }}
                      />
                    </View>
                  </>
                )}
              </>
            }
          />
        );
      })}
    </View>
  );
}

function heartbeatDemoPct(status: Property["status"]): number {
  if (status === "down") return 94.1;
  if (status === "stale") return 97.2;
  if (status === "unknown") return 96.0;
  return 99.5;
}

export default function Health() {
  const { width } = useWindowDimensions();
  const chartW = width - 44;

  const issuesQuery = useSentryIssues();
  const healthQuery = useSystemHealth();
  const versionsQuery = useAppVersions();
  const reviewsQuery = useReviews();
  const reply = useReviewReply();
  const properties = useProperties();

  const issues = issuesQuery.data ?? [];
  const integrations = (healthQuery.data?.integrations ?? []) as Integration[];
  const okCount = healthQuery.data?.okCount ?? 0;
  const totalIntegrations = healthQuery.data?.totalIntegrations ?? integrations.length;
  const versions = versionsQuery.data?.versions ?? [];
  const reviews = (reviewsQuery.data?.reviews ?? []).slice(0, 6) as ReviewItem[];
  const ratingAvg = reviewsQuery.data?.average ?? 0;
  const ratingTotal = reviewsQuery.data?.total ?? 0;
  const distribution = reviewsQuery.data?.distribution;
  const props = properties.data ?? [];

  const fatalCount = issues.filter((c) => c.level === "fatal").length;
  const totalEvents = issues.reduce((a, c) => a + c.count, 0);

  const histMax = distribution
    ? Math.max(distribution[1], distribution[2], distribution[3], distribution[4], distribution[5], 1)
    : 1;

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
            value={demoData.crashFree}
            format={(v) => v.toFixed(1) + "%"}
            delta={demoData.crashFreeDelta}
            deltaInvert
            chartWidth={chartW}
            chartData={[...demoData.crashTrend]}
            color={colors.green}
            chartH={86}
            stats={stats}
            right={<DemoChip />}
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
                  {versions.slice(0, 6).map((v) => (
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
                        <Text style={{ fontFamily: MONO_500, fontSize: 8.5, color: colors.fgMuted, letterSpacing: 0.6 }}>
                          {v.source.toUpperCase()}
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
                </View>
              )}
            </CardSection>

            <FullDivider />
            <CardSection index="04" title="Project heartbeat" count={props.length}>
              <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Eyebrow size={8}>CRASH-FREE</Eyebrow>
                  <DemoChip />
                </View>
              </View>
              {props.length === 0 ? (
                <EmptyHint>NO PROJECTS</EmptyHint>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
                  {props.map((p) => {
                    const pct = heartbeatDemoPct(p.status);
                    const c = p.status === "down" ? colors.accentDanger : p.status === "healthy" ? colors.green : colors.accentWarn;
                    return (
                      <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                        <StatusDot color={c} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                            <Text style={{ fontFamily: SANS_600, fontSize: type.bodySm, color: colors.fgPrimary }} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Text style={{ fontFamily: MONO_600, fontSize: type.label, color: colors.fgSecondary }}>
                              {p.lastPingAt ? formatRelativeTime(p.lastPingAt) : "no ping"}
                            </Text>
                          </View>
                          <HBar pct={pct} color={c} height={5} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </CardSection>

            <FullDivider />
            <CardSection index="05" title="Reviews & ratings" action="App Store">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontFamily: MONO_600, fontSize: 32, color: colors.fgPrimary, letterSpacing: -1, lineHeight: 34 }}>
                    {ratingAvg.toFixed(1)}
                  </Text>
                  <Stars n={Math.round(ratingAvg)} size={11} />
                  <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, letterSpacing: 0.6, marginTop: 4 }}>
                    {formatInteger(ratingTotal)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {[5, 4, 3, 2, 1].map((s) => {
                    const n = distribution ? distribution[s as 1 | 2 | 3 | 4 | 5] : 0;
                    return (
                      <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontFamily: MONO_500, fontSize: 9, color: colors.fgSubtle, width: 8 }}>{s}</Text>
                        <View style={{ flex: 1 }}>
                          <HBar pct={(n / histMax) * 100} color={colors.accentWarn} height={4} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
              <ReviewRows items={reviews} reply={reply} />
            </CardSection>
          </LiquidGlass>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
