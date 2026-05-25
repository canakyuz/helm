import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSegments, type SegmentRuleType } from "~/hooks/use-segments";
import { useSegmentMetrics } from "~/hooks/use-segment-template-counts";
import { SegmentTemplateCard } from "~/components/segment-template-card";
import { SegmentedControl } from "~/components/segmented-control";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { Icon } from "~/components/ui/icon";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

type Period = "7" | "30" | "90" | "365";

const PERIOD_DAYS: Record<Period, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "365": 365,
};

const RULE_META: Record<SegmentRuleType, { label: string; color: string }> = {
  new: { label: "YENİ", color: colors.accent },
  active: { label: "AKTİF", color: colors.accentInfo },
  inactive: { label: "PASİF", color: colors.accentWarn },
};

export default function Segments() {
  const [period, setPeriod] = useState<Period>("30");
  const segments = useSegments();
  const metrics = useSegmentMetrics(PERIOD_DAYS[period]);

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
            refreshing={segments.isRefetching || metrics.isRefetching}
            onRefresh={() => {
              segments.refetch();
              metrics.refetch();
            }}
          />
        }
      >
        <DetailHeader
          title="Segment yönetimi"
          kpis={[
            {
              label: "Toplam",
              value: metrics.data ? formatInteger(metrics.data.total) : "—",
            },
            {
              label: "Kayıtlı",
              value: segments.data ? String(segments.data.length) : "—",
              accent:
                (segments.data?.length ?? 0) > 0
                  ? colors.accentWarn
                  : colors.fgMuted,
            },
          ]}
          loading={metrics.isLoading || segments.isLoading}
        />

        {/* Period segmented */}
        <SegmentedControl
          segments={[
            { value: "7" as const, label: "7G" },
            { value: "30" as const, label: "30G" },
            { value: "90" as const, label: "90G" },
            { value: "365" as const, label: "365G" },
          ]}
          active={period}
          onChange={setPeriod}
        />

        {/* Section: 4 mini segment cards yan yana */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
              shadowOpacity: 0.7,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 10,
              letterSpacing: 2,
              color: colors.fgMuted,
            }}
          >
            SON {period}G
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <SegmentTemplateCard
            icon="trendUp"
            accent={colors.accent}
            label="Yeni"
            count={metrics.data?.new ?? null}
            loading={metrics.isLoading}
          />
          <SegmentTemplateCard
            icon="activity"
            accent={colors.accentInfo}
            label="Aktif"
            count={metrics.data?.active ?? null}
            loading={metrics.isLoading}
          />
          <SegmentTemplateCard
            icon="trendDown"
            accent={colors.accentDanger}
            label="Pasif"
            count={metrics.data?.passive ?? null}
            loading={metrics.isLoading}
          />
          <SegmentTemplateCard
            icon="users"
            accent={colors.fgPrimary}
            label="Toplam"
            count={metrics.data?.total ?? null}
            loading={metrics.isLoading}
          />
        </View>

        {/* Section: Kayıtlı segmentler */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingTop: 10,
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.accentWarn,
              shadowColor: colors.accentWarn,
              shadowOpacity: 0.7,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 10,
              letterSpacing: 2,
              color: colors.fgMuted,
            }}
          >
            KAYITLI SEGMENTLER
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              letterSpacing: 1.2,
              color: colors.fgSubtle,
            }}
          >
            {segments.data?.length ?? 0}
          </Text>
        </View>

        {segments.isLoading ? (
          <View style={{ minHeight: 100 }}>
            <ScreenStatus label="Yükleniyor" />
          </View>
        ) : segments.isError ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: `${colors.accentDanger}40`,
              padding: 18,
              gap: 8,
              alignItems: "center",
            }}
          >
            <Icon name="circleAlert" size={20} color={colors.accentDanger} />
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 10,
                letterSpacing: 1.5,
                color: colors.accentDanger,
              }}
            >
              YÜKLENEMEDİ
            </Text>
            <Text
              style={{
                fontFamily: "Geist-400",
                fontSize: 12,
                color: colors.fgMuted,
                textAlign: "center",
              }}
              numberOfLines={3}
            >
              {(segments.error as Error)?.message ?? "Bilinmeyen hata"}
            </Text>
          </View>
        ) : (segments.data?.length ?? 0) === 0 ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 22,
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: colors.bgHigher,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "GeistMono-600",
                  fontSize: 14,
                  color: colors.fgSubtle,
                }}
              >
                ∅
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 11,
                color: colors.fgMuted,
                letterSpacing: 1.5,
              }}
            >
              KAYITLI YOK
            </Text>
            <Text
              style={{
                fontFamily: "Geist-400",
                fontSize: 12,
                color: colors.fgSubtle,
                textAlign: "center",
              }}
            >
              Yeni segment helm web'den oluşturulur.
            </Text>
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
            {segments.data?.map((s, idx) => {
              const rule = RULE_META[s.ruleType];
              const isLast = idx === (segments.data?.length ?? 0) - 1;
              return (
                <View
                  key={s.id}
                  style={{
                    padding: 14,
                    gap: 5,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Geist-600",
                        fontSize: 14,
                        color: colors.fgPrimary,
                        flex: 1,
                        letterSpacing: -0.2,
                      }}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                    <View
                      style={{
                        backgroundColor: `${rule.color}15`,
                        borderWidth: 1,
                        borderColor: `${rule.color}40`,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "GeistMono-600",
                          fontSize: 9,
                          color: rule.color,
                          letterSpacing: 1.2,
                        }}
                      >
                        {rule.label}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: 10,
                        color: colors.fgMuted,
                        letterSpacing: 0.8,
                      }}
                    >
                      {s.ruleDays}G ·{" "}
                      {(s.propertyName ?? "TÜM PROJELER").toUpperCase()}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: 9,
                        color: colors.fgSubtle,
                      }}
                    >
                      {formatRelativeTime(s.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
