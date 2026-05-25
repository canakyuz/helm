import { Stack } from "expo-router";

import { HeaderAlertsButton } from "~/components/header-alerts-button";
import { HeaderSyncButton } from "~/components/header-sync-button";
import { colors } from "~/theme/tokens";

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgBase },
        headerTintColor: colors.fgPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "Geist-600", fontSize: 16 },
        headerBackTitle: "Geri",
        headerRight: () => <HeaderAlertsButton />,
        contentStyle: { backgroundColor: colors.bgBase },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Daha",
          headerLeft: () => <HeaderSyncButton />,
        }}
      />
      <Stack.Screen
        name="alerts"
        options={{ title: "Alerts", headerRight: () => null }}
      />
      <Stack.Screen name="errors" options={{ title: "Hatalar" }} />
      <Stack.Screen name="properties" options={{ title: "Properties" }} />
      <Stack.Screen name="audit" options={{ title: "Audit" }} />
      <Stack.Screen name="versions" options={{ title: "Versions" }} />
      <Stack.Screen name="segments" options={{ title: "Segments" }} />
      <Stack.Screen name="system" options={{ title: "System" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
      <Stack.Screen name="settings" options={{ title: "Ayarlar" }} />
    </Stack>
  );
}
