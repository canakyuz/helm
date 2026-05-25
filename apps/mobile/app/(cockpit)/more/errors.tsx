import { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  Pressable,
  Modal,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useSentryIssues,
  type SentryIssue,
  type SentryLevel,
} from "~/hooks/use-sentry-issues";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { FilterChip } from "~/components/filter-chip";
import { Icon } from "~/components/ui/icon";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { colors } from "~/theme/tokens";

type Filter = "all" | "fatal" | "error" | "warning" | "resolved";

const LEVEL_META: Record<
  SentryLevel,
  { label: string; color: string }
> = {
  fatal: { label: "FATAL", color: colors.accentDanger },
  error: { label: "ERROR", color: colors.accentDanger },
  warning: { label: "WARN", color: colors.accentWarn },
  info: { label: "INFO", color: colors.accentInfo },
  debug: { label: "DEBUG", color: colors.fgMuted },
};

function IssueRow({
  issue,
  onPress,
  isLast,
}: {
  issue: SentryIssue;
  onPress: () => void;
  isLast: boolean;
}) {
  const meta = LEVEL_META[issue.level];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: pressed ? colors.bgHigher : "transparent",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      })}
    >
      {/* Sol: severity stripe — satır boyunca uzanır */}
      <View
        style={{
          width: 3,
          alignSelf: "stretch",
          backgroundColor: meta.color,
        }}
      />

      {/* Orta: content */}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          paddingVertical: 12,
          paddingHorizontal: 12,
          gap: 5,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <View
            style={{
              backgroundColor: `${meta.color}15`,
              borderWidth: 1,
              borderColor: `${meta.color}40`,
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 9,
                color: meta.color,
                letterSpacing: 1.2,
              }}
            >
              {meta.label}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Geist-600",
              fontSize: 13,
              color: colors.fgPrimary,
              flex: 1,
              letterSpacing: -0.2,
            }}
            numberOfLines={1}
          >
            {issue.title}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgMuted,
            letterSpacing: 0.8,
          }}
          numberOfLines={1}
        >
          {issue.propertyName?.toUpperCase() ?? "—"} ·{" "}
          {formatRelativeTime(issue.lastSeen).toUpperCase()}
        </Text>
      </View>

      {/* Sağ: stats — sabit width, shrink olmaz */}
      <View
        style={{
          alignItems: "flex-end",
          gap: 2,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minWidth: 78,
          flexShrink: 0,
        }}
      >
        <Text
          style={{
            fontFamily: "GeistMono-600",
            fontSize: 16,
            color: colors.fgPrimary,
            fontVariant: ["tabular-nums"],
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {formatInteger(issue.count)}
        </Text>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgSubtle,
            letterSpacing: 0.8,
          }}
          numberOfLines={1}
        >
          {formatInteger(issue.userCount)} KİŞİ
        </Text>
      </View>
    </Pressable>
  );
}

function IssueDetailSheet({
  issue,
  onClose,
}: {
  issue: SentryIssue | null;
  onClose: () => void;
}) {
  if (!issue) return null;
  const meta = LEVEL_META[issue.level];

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={["bottom"]}
        style={{ flex: 1, backgroundColor: colors.bgSurface }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              backgroundColor: `${meta.color}15`,
              borderWidth: 1,
              borderColor: `${meta.color}40`,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 5,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 10,
                color: meta.color,
                letterSpacing: 1.3,
              }}
            >
              {meta.label}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 11,
                letterSpacing: 1.5,
                color: colors.fgPrimary,
              }}
            >
              KAPAT
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text
            style={{
              fontFamily: "Geist-600",
              fontSize: 18,
              color: colors.fgPrimary,
              letterSpacing: -0.4,
              lineHeight: 24,
            }}
          >
            {issue.title}
          </Text>
          {issue.culprit ? (
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 11,
                color: colors.fgMuted,
                letterSpacing: 0.4,
              }}
            >
              {issue.culprit}
            </Text>
          ) : null}

          {/* Grid: 2 sütun, koşullu alanlar */}
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            <DetailField
              label="Olay"
              value={formatInteger(issue.count)}
              accent={colors.fgPrimary}
              mono
            />
            <DetailField
              label="Etkilenen"
              value={`${formatInteger(issue.userCount)} kişi`}
              accent={colors.accentDanger}
            />
            <DetailField label="Kısa ID" value={issue.shortId} mono />
            <DetailField
              label="Durum"
              value={issue.status.toUpperCase()}
              accent={
                issue.status === "resolved"
                  ? colors.accent
                  : colors.accentWarn
              }
              mono
            />
            <DetailField
              label="İlk görüldü"
              value={new Date(issue.firstSeen).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            <DetailField
              label="Son görüldü"
              value={formatRelativeTime(issue.lastSeen)}
            />
            <DetailField label="Proje" value={issue.propertyName ?? "—"} />
            {issue.type ? (
              <DetailField label="Tip" value={issue.type} mono />
            ) : null}
          </View>

          {/* Mesaj */}
          {issue.value ? (
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 9,
                  letterSpacing: 1.5,
                  color: colors.fgMuted,
                }}
              >
                MESAJ
              </Text>
              <Text
                style={{
                  fontFamily: "GeistMono-400",
                  fontSize: 12,
                  color: colors.fgSecondary,
                  lineHeight: 18,
                }}
              >
                {issue.value}
              </Text>
            </View>
          ) : null}

          {/* Sentry'de aç — primary CTA */}
          {issue.permalink ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                Linking.openURL(issue.permalink).catch(() => {});
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed
                  ? colors.accentSoft
                  : colors.accent,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginTop: 4,
              })}
            >
              <Icon name="activity" size={16} color={colors.bgBase} />
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 12,
                  letterSpacing: 2,
                  color: colors.bgBase,
                }}
              >
                SENTRY'DE AÇ
              </Text>
              <Icon name="chevronRight" size={14} color={colors.bgBase} />
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DetailField({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <View style={{ width: "50%", paddingVertical: 8, paddingRight: 10 }}>
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 9,
          letterSpacing: 1.2,
          color: colors.fgSubtle,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontFamily: mono ? "GeistMono-600" : "Geist-500",
          fontSize: 13,
          color: accent ?? colors.fgPrimary,
          marginTop: 3,
          letterSpacing: -0.2,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

export default function Errors() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<SentryIssue | null>(null);
  const issues = useSentryIssues();

  const filtered = useMemo(() => {
    const all = issues.data ?? [];
    if (filter === "all") return all;
    if (filter === "resolved")
      return all.filter((i) => i.status === "resolved");
    return all.filter((i) => i.level === filter);
  }, [issues.data, filter]);

  const stats = useMemo(() => {
    const all = issues.data ?? [];
    const fatal = all.filter((i) => i.level === "fatal").length;
    const error = all.filter((i) => i.level === "error").length;
    const unresolved = all.filter((i) => i.status === "unresolved").length;
    const totalEvents = all.reduce((a, b) => a + b.count, 0);
    return { total: all.length, fatal, error, unresolved, totalEvents };
  }, [issues.data]);

  if (issues.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (issues.isError) {
    return <ScreenStatus label="Hatalar yüklenemedi" tone="danger" />;
  }

  return (
    <SafeAreaView
      edges={[]}
      style={{ flex: 1, backgroundColor: colors.bgBase }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.fgPrimary}
            refreshing={issues.isRefetching}
            onRefresh={issues.refetch}
          />
        }
      >
        <DetailHeader
          title="Hatalar"
          suffix="son 14 gün"
          kpis={[
            { label: "Toplam", value: formatInteger(stats.total) },
            {
              label: "Fatal",
              value: formatInteger(stats.fatal),
              accent:
                stats.fatal > 0 ? colors.accentDanger : colors.fgMuted,
            },
            {
              label: "Açık",
              value: formatInteger(stats.unresolved),
              accent:
                stats.unresolved > 0 ? colors.accentWarn : colors.fgMuted,
            },
            {
              label: "Olay",
              value: formatInteger(stats.totalEvents),
              accent: colors.accentInfo,
            },
          ]}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          <FilterChip
            label="Tümü"
            count={stats.total}
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterChip
            label="Fatal"
            count={stats.fatal}
            active={filter === "fatal"}
            onPress={() => setFilter("fatal")}
          />
          <FilterChip
            label="Error"
            count={stats.error}
            active={filter === "error"}
            onPress={() => setFilter("error")}
          />
          <FilterChip
            label="Çözülmüş"
            count={(issues.data ?? []).filter((i) => i.status === "resolved").length}
            active={filter === "resolved"}
            onPress={() => setFilter("resolved")}
          />
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={{ minHeight: 240 }}>
            <EmptyState
              title="Hata yok"
              subtitle={
                filter === "all"
                  ? "Sentry entegrasyonu yok veya temiz."
                  : "Bu filtreye uyan hata yok."
              }
              icon="circleCheck"
            />
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {filtered.map((issue, idx) => (
              <IssueRow
                key={`${issue.propertyId}-${issue.id}`}
                issue={issue}
                isLast={idx === filtered.length - 1}
                onPress={() => {
                  haptic.tap();
                  setSelected(issue);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <IssueDetailSheet
        issue={selected}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}
