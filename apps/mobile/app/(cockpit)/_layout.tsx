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
      labelStyle={{
        fontFamily: "GeistMono-500",
        fontSize: 10,
      }}
      tintColor={colors.fgPrimary}
      blurEffect="systemChromeMaterialDark"
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
        />
        <NativeTabs.Trigger.Label>Cockpit</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(growth)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
        />
        <NativeTabs.Trigger.Label>Growth</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(reviews)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "star", selected: "star.fill" }}
        />
        <NativeTabs.Trigger.Label>Reviews</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
        />
        <NativeTabs.Trigger.Label>Daha</NativeTabs.Trigger.Label>
        {openCount > 0 ? (
          <NativeTabs.Trigger.Badge>{String(openCount)}</NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
