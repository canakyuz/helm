import { useT } from "~/lib/i18n";
import { useMemo } from "react";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { ProjectAccessory } from "~/components/bento/project-accessory";
import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useIngestWatcher } from "~/hooks/use-last-sync";
import { useSocialAccounts } from "~/hooks/use-social";
import { useWidgetSync } from "~/hooks/use-widget-sync";
import { haptic } from "~/lib/haptics";
import { usePreferences } from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";

/**
 * Tek geçişte sayar; ara filtre dizisi ayırmaz.
 * Time: O(n); Space: O(1) auxiliary.
 */
function countWhere<T>(items: readonly T[] | undefined, match: (item: T) => boolean): number {
  let count = 0;
  for (const item of items ?? []) {
    if (match(item)) count += 1;
  }
  return count;
}

export default function TabsLayout() {
  const pathname = usePathname();
  const t = useT();
  const { name: themeName, theme } = useTheme();
  const { prioritizeRevenueRequests } = usePreferences();
  const deferShellQueries =
    prioritizeRevenueRequests && pathname.endsWith("/revenue");
  const kpis = useCockpitKpis({ enabled: !deferShellQueries });
  useWidgetSync(kpis.data, { enabled: !deferShellQueries });
  const social = useSocialAccounts();
  // Ingest bitince ekrani tazeler. Tek mount noktasi bilerek burasi - bkz.
  // use-last-sync.ts icindeki gerekce.
  useIngestWatcher();

  const reconnectCount = useMemo(
    () => countWhere(social.data, (a) => a.needs_reconnection),
    [social.data],
  );

  const dark = themeName === "dark";
  // Aktif ikon accent SADECE koyu temada. Etiket her temada fg: lime/camgobegi
  // beyaz zeminde ~1.3:1 kaliyordu, aktif sekme etiketi okunmuyordu.
  const selectedIcon = dark ? theme.accent : theme.fg;
  const selectedLabel = { fontFamily: "GeistMono-600", color: theme.fg } as const;
  // Sekme gecisinde, ekran zemini cizilmeden once beyaz flas olmasin.
  const content = { backgroundColor: theme.bg };

  return (
    // minimizeBehavior (iOS 26+): asagi kaydirinca bar kuculur ve aksesuar inline'a
    // geçer. Calismasi icin ekranlarin ScrollView'i ScrollViewMarker ile kayitli.
    <NativeTabs
      labelStyle={{ fontFamily: "GeistMono-500", fontSize: 10 }}
      tintColor={theme.fg}
      iconColor={theme.fg3}
      badgeBackgroundColor={theme.neg}
      badgeTextColor={theme.bg}
      blurEffect={dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
      minimizeBehavior="onScrollDown"
      // iPad/Mac'te kenar cubuguna donusur; iPhone'da etkisiz.
      sidebarAdaptable
      screenListeners={{
        tabPress: () => {
          void haptic.selection();
        },
      }}
      // Android: uygulama bugun yalnizca iOS'a gidiyor ama app.config'te android
      // paketi tanimli; build alinirsa bar marka rengini ve gecmis davranisini korur.
      backBehavior="history"
      labelVisibilityMode="labeled"
      indicatorColor={theme.chrome}
      rippleColor={theme.chrome}
      tabBarRespectsIMEInsets
    >
      <NativeTabs.Trigger name="overview" contentStyle={content}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
          md="insights"
          selectedColor={selectedIcon}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>{t("Özet")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="revenue" contentStyle={content}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "creditcard", selected: "creditcard.fill" }}
          md="payments"
          selectedColor={selectedIcon}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>{t("Gelir")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics" contentStyle={content}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="bar_chart"
          selectedColor={selectedIcon}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>{t("Kullanıcı")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Ayarlar sekme degil: sag ustteki disliyle sekmelerin ustune itilir
          (bkz. ../_layout.tsx). Bosalan yer Sosyal'in. */}
      <NativeTabs.Trigger name="social" contentStyle={content}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "megaphone", selected: "megaphone.fill" }}
          md="campaign"
          selectedColor={selectedIcon}
        />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>{t("Sosyal")}</NativeTabs.Trigger.Label>
        {/* Rozet = yeniden baglanmasi gereken hesap. Sayim degil eylem cagrisi.
            Kosullu render, `hidden` DEGIL: simulatorde hidden'li rozet "0" gosterdi. */}
        {reconnectCount > 0 ? (
          <NativeTabs.Trigger.Badge selectedBackgroundColor={theme.neg}>
            {String(reconnectCount)}
          </NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      {/* iOS 26: role="search" sekmesi bardan ayrik, sagda yuvarlak durur. */}
      <NativeTabs.Trigger name="search" role="search" contentStyle={content}>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" selectedColor={selectedIcon} />
        <NativeTabs.Trigger.Label selectedStyle={selectedLabel}>{t("Arama")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.BottomAccessory>
        <ProjectAccessory />
      </NativeTabs.BottomAccessory>
    </NativeTabs>
  );
}
