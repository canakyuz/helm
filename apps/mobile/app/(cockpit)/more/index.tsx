import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";

import { ModuleCard } from "~/components/module-card";
import { usePreferences } from "~/lib/preferences";
import { formatInteger } from "~/lib/format";
import { useProperties } from "~/hooks/use-properties";
import { useAppVersions } from "~/hooks/use-app-versions";
import { useAlerts } from "~/hooks/use-alerts";
import { useSegments } from "~/hooks/use-segments";
import { useAudit } from "~/hooks/use-audit";
import { useSystemHealth } from "~/hooks/use-system-health";
import { useUsers } from "~/hooks/use-users";
import { useSentryIssues } from "~/hooks/use-sentry-issues";
import { colors } from "~/theme/tokens";

function PropertiesCard() {
  const { data, isLoading } = useProperties();
  const healthy = (data ?? []).filter((p) => p.status === "healthy").length;
  const down = (data ?? []).filter((p) => p.status === "down").length;
  const total = data?.length ?? 0;

  return (
    <ModuleCard
      href="/(cockpit)/more/properties"
      icon="layers"
      accent={colors.accent}
      label="Properties"
      sublabel={`${total} property · heartbeat`}
      loading={isLoading}
      primaryValue={`${healthy} UP`}
      primaryAccent={healthy > 0 ? colors.accent : colors.fgMuted}
      secondaryValue={down > 0 ? `${down} DOWN` : "0 DOWN"}
      secondaryAccent={down > 0 ? colors.accentDanger : colors.fgSubtle}
    />
  );
}

function VersionsCard() {
  const { data, isLoading } = useAppVersions("all");
  const ios = data?.latestIos?.version ?? "—";
  const and = data?.latestAndroid?.version ?? "—";
  const total = (data?.iosCount ?? 0) + (data?.androidCount ?? 0);

  return (
    <ModuleCard
      href="/(cockpit)/more/versions"
      icon="circleDashed"
      accent={colors.accentInfo}
      label="Versions"
      sublabel={`${total} sürüm · iOS · android`}
      loading={isLoading}
      primaryValue={`iOS ${ios}`}
      primaryAccent={colors.accentInfo}
      secondaryValue={`AND ${and}`}
      secondaryAccent={colors.accent}
    />
  );
}

function AlertsCard() {
  const { data, isLoading } = useAlerts();
  const open = (data ?? []).filter((a) => !a.delivered);
  const critical = open.filter((a) => a.severity === "critical").length;
  const warn = open.filter((a) => a.severity === "warn").length;
  const tone =
    critical > 0
      ? colors.accentDanger
      : open.length > 0
      ? colors.accentWarn
      : colors.accent;

  return (
    <ModuleCard
      href="/(cockpit)/more/alerts"
      icon="bell"
      accent={tone}
      label="Alerts"
      sublabel="Açık uyarılar"
      loading={isLoading}
      primaryValue={`${open.length} AÇIK`}
      primaryAccent={tone}
      secondaryValue={
        critical > 0
          ? `${critical} KRİTİK`
          : warn > 0
          ? `${warn} UYARI`
          : "HEPSİ TEMİZ"
      }
      secondaryAccent={
        critical > 0
          ? colors.accentDanger
          : warn > 0
          ? colors.accentWarn
          : colors.accent
      }
    />
  );
}

function SegmentsCard() {
  const { data, isLoading } = useSegments();
  const count = data?.length ?? 0;

  return (
    <ModuleCard
      href="/(cockpit)/more/segments"
      icon="users"
      accent={colors.accentWarn}
      label="Segments"
      sublabel="Şablonlar · sayım"
      loading={isLoading}
      primaryValue={count > 0 ? `${count}` : "0"}
      primaryAccent={count > 0 ? colors.accentWarn : colors.fgMuted}
      secondaryValue="4 ŞABLON"
      secondaryAccent={colors.fgSecondary}
    />
  );
}

function AuditCard() {
  const { data, isLoading } = useAudit();
  const last24h = (data ?? []).filter(
    (e) => Date.now() - new Date(e.createdAt).getTime() < 86_400_000,
  ).length;
  const totalRecent = data?.length ?? 0;

  return (
    <ModuleCard
      href="/(cockpit)/more/audit"
      icon="history"
      accent={colors.accentDanger}
      label="Audit"
      sublabel="Müdahale geçmişi"
      loading={isLoading}
      primaryValue={`${last24h}`}
      primaryAccent={last24h > 0 ? colors.accentDanger : colors.fgMuted}
      secondaryValue={`/ 24SA · ${formatInteger(totalRecent)} TOPLAM`}
      secondaryAccent={colors.fgSecondary}
    />
  );
}

function SystemCard() {
  const { data, isLoading } = useSystemHealth();
  const ok = data?.okCount ?? 0;
  const err = data?.errorCount ?? 0;
  const total = data?.totalIntegrations ?? 0;
  const tone =
    err > 0
      ? colors.accentDanger
      : ok > 0
      ? colors.accent
      : colors.fgMuted;

  return (
    <ModuleCard
      href="/(cockpit)/more/system"
      icon="wifi"
      accent={tone}
      label="System"
      sublabel="Entegrasyon sağlığı"
      loading={isLoading}
      primaryValue={`${ok}/${total} OK`}
      primaryAccent={tone}
      secondaryValue={err > 0 ? `${err} HATA` : "TÜMÜ TEMİZ"}
      secondaryAccent={err > 0 ? colors.accentDanger : colors.fgSubtle}
    />
  );
}

function ErrorsCard() {
  const { data, isLoading } = useSentryIssues();
  const total = data?.length ?? 0;
  const fatal = (data ?? []).filter((i) => i.level === "fatal").length;
  const unresolved = (data ?? []).filter((i) => i.status === "unresolved").length;
  const tone =
    fatal > 0
      ? colors.accentDanger
      : unresolved > 0
      ? colors.accentWarn
      : colors.accent;

  return (
    <ModuleCard
      href="/(cockpit)/more/errors"
      icon="circleAlert"
      accent={tone}
      label="Hatalar"
      sublabel="Sentry · 14 gün"
      loading={isLoading}
      primaryValue={`${formatInteger(unresolved)} AÇIK`}
      primaryAccent={tone}
      secondaryValue={
        fatal > 0
          ? `${fatal} FATAL`
          : total > 0
          ? `${total} TOPLAM`
          : "TEMİZ"
      }
      secondaryAccent={
        fatal > 0
          ? colors.accentDanger
          : total > 0
          ? colors.fgSecondary
          : colors.accent
      }
    />
  );
}

function UsersCard() {
  const { data, isLoading } = useUsers();
  const total = data?.length ?? 0;
  const cutoff24h = Date.now() - 86_400_000;
  const active24h = (data ?? []).filter(
    (u) => u.lastSignInAt && new Date(u.lastSignInAt).getTime() >= cutoff24h,
  ).length;

  return (
    <ModuleCard
      href="/(cockpit)/more/users"
      icon="users"
      accent={colors.accentInfo}
      label="Users"
      sublabel="Kullanıcı + konum"
      loading={isLoading}
      primaryValue={formatInteger(total)}
      primaryAccent={colors.accentInfo}
      secondaryValue={`${formatInteger(active24h)} AKTİF`}
      secondaryAccent={active24h > 0 ? colors.accent : colors.fgSubtle}
    />
  );
}

function SettingsCard() {
  const { currency } = usePreferences();
  const version = Constants.expoConfig?.version ?? "0.0.0";
  const build = Constants.expoConfig?.ios?.buildNumber ?? "?";

  return (
    <ModuleCard
      href="/(cockpit)/more/settings"
      icon="settings"
      accent={colors.fgSecondary}
      label="Ayarlar"
      sublabel="Para · sürüm · çıkış"
      primaryValue={currency}
      primaryAccent={colors.accent}
      secondaryValue={`v${version} · #${build}`}
      secondaryAccent={colors.fgSubtle}
    />
  );
}

export default function MoreIndex() {
  return (
    <SafeAreaView
      edges={[]}
      style={{ flex: 1, backgroundColor: colors.bgBase }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingTop: 4,
            paddingHorizontal: 2,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
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
            MODÜLLER
          </Text>
          <View
            style={{ flex: 1, height: 1, backgroundColor: colors.border }}
          />
          <Text
            style={{
              fontFamily: "GeistMono-500",
              fontSize: 9,
              letterSpacing: 1.2,
              color: colors.fgSubtle,
            }}
          >
            9 SAYFA
          </Text>
        </View>

        {/* Cards — her biri ayrı glass + accent corner */}
        <View style={{ gap: 12 }}>
          <PropertiesCard />
          <AlertsCard />
          <ErrorsCard />
          <UsersCard />
          <SystemCard />
          <VersionsCard />
          <SegmentsCard />
          <AuditCard />
          <SettingsCard />
        </View>

        {/* Footer */}
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: 9,
            color: colors.fgSubtle,
            textAlign: "center",
            letterSpacing: 1.5,
            paddingTop: 8,
          }}
        >
          KARTA DOKUN · DETAYA GİT
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
