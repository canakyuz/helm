import { useMemo, useState } from "react";
import { View, Text, RefreshControl, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAudit, type AuditEntry } from "~/hooks/use-audit";
import { FilterChip } from "~/components/filter-chip";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

type Section =
  | { kind: "header"; date: string }
  | { kind: "entry"; entry: AuditEntry };

function startOfDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const today = startOfDay(new Date().toISOString());
  const yesterday = startOfDay(new Date(Date.now() - 86_400_000).toISOString());
  if (iso === today) return "BUGÜN";
  if (iso === yesterday) return "DÜN";
  return new Date(iso)
    .toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      weekday: "short",
    })
    .toUpperCase();
}

export default function Audit() {
  const [filter, setFilter] = useState<string>("all");
  const audit = useAudit();

  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const entry of audit.data ?? []) set.add(entry.action);
    return [...set].sort();
  }, [audit.data]);

  // En sık aksiyon türü — KPI özetinde göster.
  const topAction = useMemo(() => {
    const counter = new Map<string, number>();
    for (const e of audit.data ?? []) {
      counter.set(e.action, (counter.get(e.action) ?? 0) + 1);
    }
    let top = { action: "—", count: 0 };
    for (const [action, count] of counter) {
      if (count > top.count) top = { action, count };
    }
    return top;
  }, [audit.data]);

  const stats = useMemo(() => {
    const entries = audit.data ?? [];
    const last24h = entries.filter(
      (e) => Date.now() - new Date(e.createdAt).getTime() < 86_400_000,
    ).length;
    const last7d = entries.filter(
      (e) => Date.now() - new Date(e.createdAt).getTime() < 7 * 86_400_000,
    ).length;
    return { total: entries.length, last24h, last7d };
  }, [audit.data]);

  const sections: Section[] = useMemo(() => {
    const entries = (audit.data ?? []).filter(
      (e) => filter === "all" || e.action === filter,
    );

    const out: Section[] = [];
    let currentDate = "";
    for (const entry of entries) {
      const date = startOfDay(entry.createdAt);
      if (date !== currentDate) {
        out.push({ kind: "header", date });
        currentDate = date;
      }
      out.push({ kind: "entry", entry });
    }
    return out;
  }, [audit.data, filter]);

  if (audit.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (audit.isError) return <ScreenStatus label="Audit yüklenemedi" tone="danger" />;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
        <DetailHeader
          title="Müdahale geçmişi"
          suffix={`${formatInteger(stats.total)} kayıt`}
          kpis={[
            { label: "Toplam", value: formatInteger(stats.total) },
            {
              label: "24 saat",
              value: formatInteger(stats.last24h),
              accent: stats.last24h > 0 ? colors.accentDanger : colors.fgMuted,
            },
            {
              label: "7 gün",
              value: formatInteger(stats.last7d),
              accent: stats.last7d > 0 ? colors.accentWarn : colors.fgMuted,
            },
          ]}
        />

        {/* Top action highlight */}
        {topAction.count > 0 ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 9,
                letterSpacing: 1.5,
                color: colors.fgSubtle,
              }}
            >
              EN SIK
            </Text>
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
              {topAction.action}
            </Text>
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 12,
                color: colors.accent,
                fontVariant: ["tabular-nums"],
              }}
            >
              ×{topAction.count}
            </Text>
          </View>
        ) : null}

        {actionTypes.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            <FilterChip
              label="Tümü"
              count={audit.data?.length ?? 0}
              active={filter === "all"}
              onPress={() => setFilter("all")}
            />
            {actionTypes.slice(0, 10).map((action) => (
              <FilterChip
                key={action}
                label={action}
                count={(audit.data ?? []).filter((e) => e.action === action).length}
                active={filter === action}
                onPress={() => setFilter(action)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {sections.length === 0 ? (
        <EmptyState
          title="Audit boş"
          subtitle="Son aksiyonlar burada görünecek."
          icon="history"
        />
      ) : (
        <FlashList
          data={sections}
          keyExtractor={(item, idx) =>
            item.kind === "header" ? `h-${item.date}` : `e-${item.entry.id}-${idx}`
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 96 }}
          getItemType={(item) => item.kind}
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingTop: 16,
                    paddingBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "GeistMono-600",
                      fontSize: 10,
                      letterSpacing: 2,
                      color: colors.fgMuted,
                    }}
                  >
                    {dayLabel(item.date)}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>
              );
            }
            const e = item.entry;
            return (
              <View
                style={{
                  backgroundColor: colors.bgElevated,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 13,
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: colors.bgHigher,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GeistMono-600",
                        fontSize: 9,
                        color: colors.accent,
                        letterSpacing: 1.2,
                      }}
                      numberOfLines={1}
                    >
                      {e.action.toUpperCase().slice(0, 18)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Text
                    style={{
                      fontFamily: "GeistMono-500",
                      fontSize: 9,
                      color: colors.fgSubtle,
                      letterSpacing: 0.5,
                    }}
                  >
                    {formatRelativeTime(e.createdAt)}
                  </Text>
                </View>
                {e.propertyName || e.targetUser ? (
                  <Text
                    style={{
                      fontFamily: "Geist-500",
                      fontSize: 13,
                      color: colors.fgPrimary,
                      letterSpacing: -0.2,
                    }}
                    numberOfLines={1}
                  >
                    {e.propertyName ?? "—"}
                    {e.targetUser ? ` → ${e.targetUser}` : ""}
                  </Text>
                ) : null}
                {e.detail ? (
                  <Text
                    style={{
                      fontFamily: "Geist-400",
                      fontSize: 12,
                      color: colors.fgSecondary,
                      lineHeight: 17,
                    }}
                    numberOfLines={2}
                  >
                    {e.detail}
                  </Text>
                ) : null}
              </View>
            );
          }}
          refreshControl={
            <RefreshControl
              tintColor={colors.fgPrimary}
              refreshing={audit.isRefetching}
              onRefresh={audit.refetch}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
