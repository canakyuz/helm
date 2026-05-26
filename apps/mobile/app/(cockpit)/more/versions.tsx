import { useMemo, useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useAppVersions,
  type PlatformFilter,
  type AppVersion,
} from "~/hooks/use-app-versions";
import { SegmentedControl } from "~/components/segmented-control";
import { DetailHeader } from "~/components/detail-header";
import { ScreenStatus } from "~/components/screen-status";
import { EmptyState } from "~/components/empty-state";
import { formatRelativeTime } from "~/lib/format";
import { colors } from "~/theme/tokens";

const PLATFORM_META = {
  ios: { label: "iOS", color: colors.accentInfo },
  android: { label: "AND", color: colors.accent },
} as const;

const STATUS_META: Record<
  NonNullable<AppVersion["status"]>,
  { label: string; color: string }
> = {
  live: { label: "CANLI", color: colors.accent },
  in_review: { label: "İNCELEME", color: colors.accentWarn },
  ready: { label: "HAZIR", color: colors.accentInfo },
  testflight: { label: "TESTFLIGHT", color: colors.accentViolet },
  rejected: { label: "RED", color: colors.accentDanger },
  expired: { label: "DOLDU", color: colors.fgSubtle },
  removed: { label: "KALDIRILDI", color: colors.fgSubtle },
  unknown: { label: "—", color: colors.fgSubtle },
};

function StatusPill({
  status,
  expiresAt,
}: {
  status: AppVersion["status"];
  expiresAt: string | null;
}) {
  if (!status) return null;
  const meta = STATUS_META[status];
  return (
    <View
      style={{
        backgroundColor: `${meta.color}15`,
        borderWidth: 1,
        borderColor: `${meta.color}40`,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Text
        style={{
          fontFamily: "GeistMono-600",
          fontSize: 9,
          color: meta.color,
          letterSpacing: 1.3,
        }}
      >
        {meta.label}
      </Text>
      {status === "testflight" && expiresAt
        ? (() => {
            const days = Math.ceil(
              (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
            );
            if (days <= 0) return null;
            return (
              <Text
                style={{
                  fontFamily: "GeistMono-500",
                  fontSize: 9,
                  color: meta.color,
                  opacity: 0.7,
                }}
              >
                {days}g
              </Text>
            );
          })()
        : null}
    </View>
  );
}

function LatestHero({
  latestIos,
  latestAndroid,
}: {
  latestIos: AppVersion | null;
  latestAndroid: AppVersion | null;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 18,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.accentInfo,
            shadowColor: colors.accentInfo,
            shadowOpacity: 0.8,
            shadowRadius: 6,
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
          EN YENİ SÜRÜMLER
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 14 }}>
        <PlatformPill
          platform="ios"
          version={latestIos?.version ?? "—"}
          relative={
            latestIos?.releaseDate ? formatRelativeTime(latestIos.releaseDate) : "—"
          }
        />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <PlatformPill
          platform="android"
          version={latestAndroid?.version ?? "—"}
          relative={
            latestAndroid?.releaseDate
              ? formatRelativeTime(latestAndroid.releaseDate)
              : "—"
          }
        />
      </View>
    </View>
  );
}

function PlatformPill({
  platform,
  version,
  relative,
}: {
  platform: keyof typeof PLATFORM_META;
  version: string;
  relative: string;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <View
        style={{
          backgroundColor: `${meta.color}15`,
          borderWidth: 1,
          borderColor: `${meta.color}40`,
          alignSelf: "flex-start",
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 4,
        }}
      >
        <Text
          style={{
            fontFamily: "GeistMono-600",
            fontSize: 9,
            color: meta.color,
            letterSpacing: 1.3,
          }}
        >
          {meta.label}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "GeistMono-600",
          fontSize: 26,
          color: colors.fgPrimary,
          letterSpacing: -1,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {version}
      </Text>
      <Text
        style={{
          fontFamily: "GeistMono-500",
          fontSize: 9,
          color: colors.fgSubtle,
          letterSpacing: 0.8,
        }}
      >
        {relative.toUpperCase()}
      </Text>
    </View>
  );
}

function VersionRow({ version }: { version: AppVersion }) {
  const meta = PLATFORM_META[version.source];
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <View style={{ width: 4, backgroundColor: meta.color }} />
      <View style={{ flex: 1, padding: 14, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              fontFamily: "GeistMono-600",
              fontSize: 17,
              color: colors.fgPrimary,
              letterSpacing: -0.3,
              fontVariant: ["tabular-nums"],
            }}
          >
            {version.version}
            {version.buildNumber ? ` (${version.buildNumber})` : ""}
          </Text>
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
                letterSpacing: 1.3,
              }}
            >
              {meta.label}
            </Text>
          </View>
          <StatusPill status={version.status} expiresAt={version.expiresAt} />
          <View style={{ flex: 1 }} />
          {version.releaseDate ? (
            <Text
              style={{
                fontFamily: "GeistMono-500",
                fontSize: 10,
                color: colors.fgSubtle,
              }}
            >
              {formatRelativeTime(version.releaseDate)}
            </Text>
          ) : null}
        </View>

        {version.propertyName ? (
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              color: colors.fgMuted,
              letterSpacing: 1,
            }}
            numberOfLines={1}
          >
            {version.propertyName.toUpperCase()}
          </Text>
        ) : null}

        {version.releaseNotes ? (
          <Text
            style={{
              fontFamily: "Geist-400",
              fontSize: 12,
              color: colors.fgSecondary,
              lineHeight: 17,
              marginTop: 2,
            }}
            numberOfLines={3}
          >
            {version.releaseNotes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function Versions() {
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const versions = useAppVersions(platform);

  const segments = useMemo(
    () =>
      [
        {
          value: "all" as const,
          label: "Tümü",
          count: (versions.data?.iosCount ?? 0) + (versions.data?.androidCount ?? 0),
        },
        { value: "ios" as const, label: "iOS", count: versions.data?.iosCount ?? 0 },
        {
          value: "android" as const,
          label: "Android",
          count: versions.data?.androidCount ?? 0,
        },
      ] satisfies Array<{ value: PlatformFilter; label: string; count: number }>,
    [versions.data],
  );

  if (versions.isLoading) return <ScreenStatus label="Yükleniyor" />;
  if (versions.isError) return <ScreenStatus label="Sürümler yüklenemedi" tone="danger" />;

  const data = versions.data;
  if (!data) return <ScreenStatus label="Veri yok" />;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.fgPrimary}
            refreshing={versions.isRefetching}
            onRefresh={versions.refetch}
          />
        }
      >
        <LatestHero latestIos={data.latestIos} latestAndroid={data.latestAndroid} />

        <DetailHeader
          title="Sürüm sayımı"
          kpis={[
            { label: "Toplam", value: String(data.iosCount + data.androidCount) },
            { label: "iOS", value: String(data.iosCount), accent: PLATFORM_META.ios.color },
            { label: "AND", value: String(data.androidCount), accent: PLATFORM_META.android.color },
          ]}
        />

        <SegmentedControl segments={segments} active={platform} onChange={setPlatform} />

        {data.versions.length === 0 ? (
          <View style={{ minHeight: 240 }}>
            <EmptyState title="Sürüm yok" subtitle="Bu filtreye uyan sürüm bulunamadı." />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {data.versions.map((v) => (
              <VersionRow key={`${v.source}-${v.id}`} version={v} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
