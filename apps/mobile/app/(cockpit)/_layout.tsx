import { useT } from "~/lib/i18n";
import { useMemo } from "react";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAlerts } from "~/hooks/use-alerts";
import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useIngestWatcher } from "~/hooks/use-last-sync";
import { useWidgetSync } from "~/hooks/use-widget-sync";
import { usePreferences } from "~/lib/preferences";
import { useTheme } from "~/theme/use-theme";

export default function CockpitLayout() {
  const pathname = usePathname();
  const t = useT();
  const { name: themeName, theme } = useTheme();
  const { prioritizeRevenueRequests } = usePreferences();
  const deferShellQueries =
    prioritizeRevenueRequests && pathname.endsWith("/revenue");
  const kpis = useCockpitKpis({ enabled: !deferShellQueries });
  useWidgetSync(kpis.data, { enabled: !deferShellQueries });
  const alerts = useAlerts({ enabled: !deferShellQueries });
  // Ingest bitince ekrani tazeler. Tek mount noktasi bilerek burasi - bkz.
  // use-last-sync.ts icindeki gerekce.
  useIngestWatcher();
  // Time:  O(n) alerts; Space: O(1) auxiliary.
  // Note:  Counts in one pass without allocating an intermediate filtered array.
  const openCount = useMemo(() => {
    let count = 0;
    for (const alert of alerts.data ?? []) {
      if (!alert.delivered) count += 1;
    }
    return count;
  }, [alerts.data]);

  return (
    // tintColor accent DEGIL fg: lime beyaz zemin uzerinde ~1.3:1, light temada
    // aktif sekme etiketi okunmuyordu. Tasarim da aktif sekme icin accent degil
    // fg kullaniyor (kaynak: tabs[].fg = s.tab === id ? on : off).
    <NativeTabs
      labelStyle={{ fontFamily: "GeistMono-500", fontSize: 10 }}
      tintColor={theme.fg}
      blurEffect={
        themeName === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight"
      }
    >
      <NativeTabs.Trigger name="overview">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
        />
        <NativeTabs.Trigger.Label>{t("Özet")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="revenue">
        <NativeTabs.Trigger.Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} />
        <NativeTabs.Trigger.Label>{t("Gelir")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <NativeTabs.Trigger.Label>{t("Kullanıcı")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="health">
        <NativeTabs.Trigger.Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <NativeTabs.Trigger.Label>{t("Sağlık")}</NativeTabs.Trigger.Label>
        {openCount > 0 ? (
          <NativeTabs.Trigger.Badge>{String(openCount)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>{t("Ayar")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
