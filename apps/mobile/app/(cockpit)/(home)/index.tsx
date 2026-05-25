import { useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  Pressable,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useAlerts } from "~/hooks/use-alerts";
import { useProperties } from "~/hooks/use-properties";
import { useFormatCurrency } from "~/hooks/use-format-currency";
import { useSentryIssues } from "~/hooks/use-sentry-issues";
import { usePreferences } from "~/lib/preferences";
import { KpiTile } from "~/components/kpi-tile";
import { RichMetricTile } from "~/components/rich-metric-tile";
import { ProjectsBreakdown } from "~/components/projects-breakdown";
import { Icon } from "~/components/ui/icon";
import { ScreenStatus } from "~/components/screen-status";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { haptic } from "~/lib/haptics";
import { tilesForModules, type ModuleId, type TileDef } from "~/lib/modules";
import { colors } from "~/theme/tokens";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TILE_WIDTH = SCREEN_WIDTH - 32;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function SectionLabel({ children, suffix }: { children: string; suffix?: string }) {
  return (
    <View className="flex-row items-center justify-between px-1 pt-2">
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 10,
          letterSpacing: 2,
          color: colors.fgMuted,
        }}
      >
        {children.toUpperCase()}
      </Text>
      {suffix ? (
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 10,
            letterSpacing: 1,
            color: colors.fgSubtle,
          }}
        >
          {suffix}
        </Text>
      ) : null}
    </View>
  );
}

export default function Cockpit() {
  const router = useRouter();
  const fmt = useFormatCurrency();
  const { selectedPropertyId } = usePreferences();
  const kpis = useCockpitKpis();
  const alerts = useAlerts();
  const properties = useProperties();

  const enabledModules = useMemo<ModuleId[] | "all">(() => {
    if (selectedPropertyId === "all") return "all";
    const property = properties.data?.find((p) => p.id === selectedPropertyId);
    if (!property) return "all";
    return property.enabledModules as ModuleId[];
  }, [selectedPropertyId, properties.data]);

  const tiles = useMemo<TileDef[]>(
    () => tilesForModules(enabledModules),
    [enabledModules],
  );

  const showMrr =
    enabledModules === "all" ||
    (enabledModules as ModuleId[]).includes("subscriptions");
  const showAds =
    enabledModules === "all" || (enabledModules as ModuleId[]).includes("ads");

  // ⚠️ Tüm hooks erken return'dan ÖNCE — React rules-of-hooks.
  const issues = useSentryIssues();
  const topIssues = useMemo(
    () =>
      [...(issues.data ?? [])]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    [issues.data],
  );

  if (kpis.isLoading) return <ScreenStatus label="Yükleniyor…" />;
  if (kpis.isError || !kpis.data) {
    return <ScreenStatus label="Cockpit yüklenemedi" tone="danger" />;
  }

  const data = kpis.data;
  const topAlerts = (alerts.data ?? []).slice(0, 3);
  const tileRows = chunk(tiles, 2);

  const syncIcon = data.syncRunning
    ? "refresh"
    : data.lastSyncStatus === "error"
    ? "wifiOff"
    : "wifi";
  const syncColor =
    data.lastSyncStatus === "error"
      ? colors.accentDanger
      : data.syncRunning
      ? colors.accentInfo
      : data.lastSyncStatus === "ok"
      ? colors.accent
      : colors.accentWarn;
  const syncLabel = {
    ok: "SENKRON OK",
    error: "SYNC HATASI",
    running: "SYNC ÇALIŞIYOR",
    unknown: "SYNC YOK",
  }[data.lastSyncStatus];

  return (
    <SafeAreaView edges={[]} className="flex-1 bg-bg-base">
      <ScrollView
        contentContainerClassName="p-4 gap-3 pb-24"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={colors.fgPrimary}
            refreshing={kpis.isRefetching}
            onRefresh={() => {
              haptic.tap();
              kpis.refetch();
              alerts.refetch();
            }}
          />
        }
      >
        {/* Hero — Ad Revenue (en sık check edilen) */}
        {showAds ? (
          <RichMetricTile
            metric="ad_revenue"
            label="Reklam Geliri"
            isCurrency
            width={TILE_WIDTH}
            accent={colors.accent}
          />
        ) : null}

        {/* Secondary hero — MRR */}
        {showMrr ? (
          <RichMetricTile
            metric="mrr"
            label="MRR"
            isCurrency
            width={TILE_WIDTH}
            accent={colors.accentViolet}
          />
        ) : null}

        {/* Sync status strip */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: `${syncColor}30`,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: `${syncColor}18`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={syncIcon} size={16} color={syncColor} />
          </View>
          <View className="flex-1">
            <Text
              style={{
                fontFamily: "GeistMono-600",
                fontSize: 11,
                letterSpacing: 1.5,
                color: syncColor,
              }}
            >
              {syncLabel}
            </Text>
            <Text
              style={{
                fontFamily: "Geist-400",
                fontSize: 12,
                color: colors.fgMuted,
                marginTop: 2,
              }}
            >
              {data.lastSyncAt ? formatRelativeTime(data.lastSyncAt) : "kayıt yok"}
              {data.syncIngested > 0
                ? ` · ${formatInteger(data.syncIngested)} satır`
                : ""}
            </Text>
          </View>
        </View>

        <SectionLabel suffix={`${tiles.length} METRİK`}>Anlık</SectionLabel>

        {tileRows.map((row, idx) => (
          <View key={idx} className="flex-row gap-3">
            {row.map((tile) => {
              const raw = tile.pick(data);
              const value = tile.isCurrency ? fmt(raw) : formatInteger(raw);
              const tone =
                tile.key === "critical-alerts" && raw > 0
                  ? "danger"
                  : tile.key === "open-alerts" && raw > 0
                  ? "warn"
                  : "default";
              return (
                <KpiTile
                  key={tile.key}
                  icon={tile.icon}
                  label={tile.label}
                  value={value}
                  tone={tone}
                />
              );
            })}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        ))}

        {selectedPropertyId === "all" ? (
          <>
            <SectionLabel>Projeler</SectionLabel>
            <ProjectsBreakdown />
          </>
        ) : null}

        {topAlerts.length > 0 ? (
          <>
            <View className="flex-row items-center justify-between px-1 pt-2">
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: colors.fgMuted,
                }}
              >
                SON UYARILAR
              </Text>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push("/(cockpit)/more/alerts");
                }}
                hitSlop={6}
              >
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 10,
                    letterSpacing: 1,
                    color: colors.accentInfo,
                  }}
                >
                  TÜMÜ →
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {topAlerts.map((alert, idx) => {
                const sevColor =
                  alert.severity === "critical"
                    ? colors.accentDanger
                    : alert.severity === "warn"
                    ? colors.accentWarn
                    : colors.accentInfo;
                return (
                  <View
                    key={alert.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 14,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 3,
                        height: 24,
                        borderRadius: 2,
                        backgroundColor: sevColor,
                      }}
                    />
                    <View className="flex-1">
                      <Text
                        style={{
                          fontFamily: "Geist-500",
                          fontSize: 13,
                          color: colors.fgPrimary,
                        }}
                        numberOfLines={1}
                      >
                        {alert.ruleName}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "GeistMono-400",
                          fontSize: 10,
                          color: colors.fgMuted,
                          marginTop: 2,
                          letterSpacing: 0.5,
                        }}
                      >
                        {alert.metric.toUpperCase()} · {alert.condition}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "GeistMono-500",
                        fontSize: 10,
                        color: colors.fgSubtle,
                      }}
                    >
                      {formatRelativeTime(alert.triggeredAt)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {topIssues.length > 0 ? (
          <>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 4,
                paddingTop: 8,
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
                SON HATALAR
              </Text>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  router.push("/(cockpit)/more/errors");
                }}
                hitSlop={6}
              >
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 10,
                    letterSpacing: 1.2,
                    color: colors.accentInfo,
                  }}
                >
                  TÜMÜ →
                </Text>
              </Pressable>
            </View>

            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: "hidden",
              }}
            >
              {topIssues.map((issue, idx) => {
                const sevColor =
                  issue.level === "fatal" || issue.level === "error"
                    ? colors.accentDanger
                    : issue.level === "warning"
                    ? colors.accentWarn
                    : colors.accentInfo;
                const isLast = idx === topIssues.length - 1;
                return (
                  <Pressable
                    key={`${issue.propertyId}-${issue.id}`}
                    onPress={() => {
                      haptic.tap();
                      router.push("/(cockpit)/more/errors");
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: pressed
                        ? colors.bgHigher
                        : "transparent",
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: colors.border,
                    })}
                  >
                    {/* Severity stripe — full height */}
                    <View
                      style={{
                        width: 3,
                        alignSelf: "stretch",
                        backgroundColor: sevColor,
                      }}
                    />

                    {/* Content */}
                    <View
                      style={{
                        flex: 1,
                        gap: 3,
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        minWidth: 0,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Geist-600",
                          fontSize: 13,
                          color: colors.fgPrimary,
                          letterSpacing: -0.2,
                        }}
                        numberOfLines={1}
                      >
                        {issue.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "GeistMono-500",
                          fontSize: 9,
                          color: colors.fgMuted,
                          letterSpacing: 1,
                        }}
                      >
                        {formatInteger(issue.count)} OLAY ·{" "}
                        {formatInteger(issue.userCount)} KİŞİ
                      </Text>
                    </View>

                    {/* Right — relative time, fixed width slot */}
                    <View
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        minWidth: 78,
                        flexShrink: 0,
                        alignItems: "flex-end",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "GeistMono-500",
                          fontSize: 10,
                          color: colors.fgSubtle,
                        }}
                        numberOfLines={1}
                      >
                        {formatRelativeTime(issue.lastSeen)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
