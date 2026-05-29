import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAlerts } from "~/hooks/use-alerts";
import { useCockpitKpis } from "~/hooks/use-cockpit-kpis";
import { useWidgetSync } from "~/hooks/use-widget-sync";
import { colors } from "~/theme/tokens";

export default function CockpitLayout() {
  const kpis = useCockpitKpis();
  useWidgetSync(kpis.data);
  const alerts = useAlerts();
  const openCount = (alerts.data ?? []).filter((a) => !a.delivered).length;

  return (
    <NativeTabs
      labelStyle={{ fontFamily: "GeistMono-500", fontSize: 10 }}
      tintColor={colors.accent}
      blurEffect="systemChromeMaterialDark"
    >
      <NativeTabs.Trigger name="overview">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
        />
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="revenue">
        <NativeTabs.Trigger.Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} />
        <NativeTabs.Trigger.Label>Revenue</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <NativeTabs.Trigger.Label>Analytics</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="health">
        <NativeTabs.Trigger.Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <NativeTabs.Trigger.Label>Health</NativeTabs.Trigger.Label>
        {openCount > 0 ? (
          <NativeTabs.Trigger.Badge>{String(openCount)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
