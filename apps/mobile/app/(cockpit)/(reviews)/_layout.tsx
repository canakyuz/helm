import { Stack } from "expo-router";

import { PropertyPicker } from "~/components/property-picker";
import { HeaderSyncButton } from "~/components/header-sync-button";
import { HeaderAlertsButton } from "~/components/header-alerts-button";
import { colors } from "~/theme/tokens";

export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgBase },
        headerShadowVisible: false,
        headerTintColor: colors.fgPrimary,
        headerTitleStyle: { fontFamily: "Geist-600", fontSize: 16 },
        headerTitle: () => <PropertyPicker />,
        headerLeft: () => <HeaderSyncButton />,
        headerRight: () => <HeaderAlertsButton />,
        contentStyle: { backgroundColor: colors.bgBase },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
