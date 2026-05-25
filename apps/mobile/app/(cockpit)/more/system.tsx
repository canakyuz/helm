import { useMemo } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useSystemHealth,
  type IntegrationHealth,
  type IntegrationStatus,
} from "~/hooks/use-system-health";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { Icon, type IconName } from "~/components/ui/icon";
import { formatRelativeTime, formatInteger } from "~/lib/format";
import { colors } from "~/theme/tokens";

const PROVIDER_META: Record<
  string,
  { label: string; icon: IconName; color: string }
> = {
  revenuecat: { label: "RevenueCat", icon: "dollar", color: colors.accent },
  admob: { label: "AdMob", icon: "activity", color: colors.accentInfo },
  posthog: { label: "PostHog", icon: "trendUp", color: colors.accentViolet },
  supabase: { label: "Supabase", icon: "users", color: colors.accentSoft },
  rest: { label: "REST", icon: "layers", color: colors.fgMuted },
  sentry: { label: "Sentry", icon: "alert", color: colors.accentDanger },
  appstoreconnect: {
    label: "App Store",
    icon: "circleDashed",
    color: colors.accentInfo,
  },
  resend: { label: "Resend", icon: "bell", color: colors.accentWarn },
};

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; color: string }
> = {
  ok: { label: "OK", color: colors.accent },
  error: { label: "HATA", color: colors.accentDanger },
  pending: { label: "BEKLİYOR", color: colors.fgMuted },
};

function IntegrationRow({
  integration,
  isLast,
}: {
  integration: IntegrationHealth;
  isLast: boolean;
}) {
  const meta =
    PROVIDER_META[integration.provider] ?? {
      label: integration.provider,
      icon: "layers" as IconName,
      color: colors.fgMuted,
    };
  const status = STATUS_META[integration.status];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 13,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Provider icon */}
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          backgroundColor: `${meta.color}15`,
          borderWidth: 1,
          borderColor: `${meta.color}38`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={meta.icon} size={14} color={meta.color} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: "Geist-600",
            fontSize: 13,
            color: colors.fgPrimary,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {meta.label}
        </Text>
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgMuted,
            letterSpacing: 1,
          }}
          numberOfLines={1}
        >
          {(integration.propertyName ?? "—").toUpperCase()}
          {integration.lastSyncedAt
            ? ` · ${formatRelativeTime(integration.lastSyncedAt).toUpperCase()}`
            : " · HİÇ"}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <View
          style={{
            backgroundColor: `${status.color}15`,
            borderWidth: 1,
            borderColor: `${status.color}40`,
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 9,
              color: status.color,
              letterSpacing: 1.3,
            }}
          >
            {status.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

function GroupedIntegrations({
  integrations,
}: {
  integrations: IntegrationHealth[];
}) {
  const byProvider = useMemo(() => {
    const map = new Map<string, IntegrationHealth[]>();
    for (const i of integrations) {
      if (!map.has(i.provider)) map.set(i.provider, []);
      map.get(i.provider)!.push(i);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [integrations]);

  return (
    <View style={{ gap: 14 }}>
      {byProvider.map(([provider, items]) => {
        const meta =
          PROVIDER_META[provider] ?? {
            label: provider,
            icon: "layers" as IconName,
            color: colors.fgMuted,
          };
        const errorCount = items.filter((i) => i.status === "error").length;
        return (
          <View key={provider} style={{ gap: 8 }}>
            {/* Provider header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 4,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: errorCount > 0 ? colors.accentDanger : meta.color,
                  shadowColor: errorCount > 0 ? colors.accentDanger : meta.color,
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
                {meta.label.toUpperCase()}
              </Text>
              <View
                style={{ flex: 1, height: 1, backgroundColor: colors.border }}
              />
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: errorCount > 0 ? colors.accentDanger : colors.fgSubtle,
                }}
              >
                {items.length} · {errorCount > 0 ? `${errorCount} HATA` : "OK"}
              </Text>
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
              {items.map((it, idx) => (
                <IntegrationRow
                  key={it.id}
                  integration={it}
                  isLast={idx === items.length - 1}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function System() {
  const health = useSystemHealth();

  if (health.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (health.isError) {
    return <ScreenStatus label="System health yüklenemedi" tone="danger" />;
  }

  const data = health.data;
  if (!data) return <ScreenStatus label="Veri yok" />;

  const lastRun = data.lastSyncRun;
  const lastRunDuration =
    lastRun && lastRun.finishedAt
      ? Math.max(
          0,
          (new Date(lastRun.finishedAt).getTime() -
            new Date(lastRun.startedAt).getTime()) /
            1000,
        )
      : null;

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
            refreshing={health.isRefetching}
            onRefresh={health.refetch}
          />
        }
      >
        <DetailHeader
          title="Sistem sağlığı"
          suffix={`${data.totalIntegrations} entegrasyon`}
          kpis={[
            {
              label: "OK",
              value: String(data.okCount),
              accent: colors.accent,
            },
            {
              label: "Hata",
              value: String(data.errorCount),
              accent: data.errorCount > 0 ? colors.accentDanger : colors.fgMuted,
            },
            {
              label: "Bekliyor",
              value: String(data.pendingCount),
              accent:
                data.pendingCount > 0 ? colors.accentWarn : colors.fgMuted,
            },
            {
              label: "24sa Sync",
              value: String(data.syncRunsLast24h),
              accent: colors.accentInfo,
            },
          ]}
        />

        {/* Last sync run card */}
        {lastRun ? (
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: 14,
              borderWidth: 1,
              borderColor:
                lastRun.errorCount > 0
                  ? `${colors.accentDanger}40`
                  : colors.border,
              padding: 14,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  backgroundColor:
                    lastRun.errorCount > 0
                      ? `${colors.accentDanger}15`
                      : `${colors.accent}15`,
                  borderWidth: 1,
                  borderColor:
                    lastRun.errorCount > 0
                      ? `${colors.accentDanger}40`
                      : `${colors.accent}40`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={lastRun.errorCount > 0 ? "wifiOff" : "wifi"}
                  size={14}
                  color={
                    lastRun.errorCount > 0 ? colors.accentDanger : colors.accent
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 11,
                    letterSpacing: 1.5,
                    color:
                      lastRun.errorCount > 0
                        ? colors.accentDanger
                        : colors.accent,
                  }}
                >
                  SON SYNC ·{" "}
                  {lastRun.errorCount > 0
                    ? `${lastRun.errorCount} HATA`
                    : "TEMİZ"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Geist-400",
                    fontSize: 12,
                    color: colors.fgMuted,
                    marginTop: 2,
                  }}
                >
                  {formatRelativeTime(
                    lastRun.finishedAt ?? lastRun.startedAt,
                  )}{" "}
                  · {lastRun.trigger.toUpperCase()}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                paddingTop: 4,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1, paddingTop: 8 }}>
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 9,
                    color: colors.fgSubtle,
                    letterSpacing: 1.3,
                  }}
                >
                  INGEST
                </Text>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 14,
                    color: colors.fgPrimary,
                    marginTop: 2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatInteger(lastRun.ingested)}
                </Text>
              </View>
              <View style={{ flex: 1, paddingTop: 8 }}>
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 9,
                    color: colors.fgSubtle,
                    letterSpacing: 1.3,
                  }}
                >
                  OK
                </Text>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 14,
                    color: colors.accent,
                    marginTop: 2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatInteger(lastRun.okCount)}
                </Text>
              </View>
              <View style={{ flex: 1, paddingTop: 8 }}>
                <Text
                  style={{
                    fontFamily: "GeistMono-500",
                    fontSize: 9,
                    color: colors.fgSubtle,
                    letterSpacing: 1.3,
                  }}
                >
                  SÜRE
                </Text>
                <Text
                  style={{
                    fontFamily: "GeistMono-600",
                    fontSize: 14,
                    color: colors.fgPrimary,
                    marginTop: 2,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {lastRunDuration !== null ? `${lastRunDuration.toFixed(1)}s` : "—"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Provider integrations grouped */}
        {data.integrations.length === 0 ? (
          <View style={{ minHeight: 200 }}>
            <EmptyState
              title="Entegrasyon yok"
              subtitle="Hub'da kayıtlı entegrasyon bulunamadı."
            />
          </View>
        ) : (
          <GroupedIntegrations integrations={data.integrations} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
