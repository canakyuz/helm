import { Stack } from "expo-router";

import { useT } from "~/lib/i18n";
import { useTheme } from "~/theme/use-theme";

/**
 * Ara sekmesi (iOS 26 ayrık sekme, `role="search"`).
 *
 * NEDEN NATIVE BAŞLIK: arama çubuğu native header'ın parçası (`Stack.SearchBar`);
 * diğer sekmelerdeki BentoHeader burada kullanılamaz. Rehber de arama sekmesini
 * bir Stack içine sarmayı şart koşuyor.
 */
export default function SearchLayout() {
  const t = useT();
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerTintColor: theme.fg,
        headerLargeTitleStyle: { fontFamily: "Geist-600", color: theme.fg },
        headerTitleStyle: { fontFamily: "Geist-600", color: theme.fg },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      {/* "Arama", "Ara" DEGIL: "Ara" sozlukte Aralik kisaltmasi ("Dec"). */}
      <Stack.Screen name="index" options={{ title: t("Arama") }} />
    </Stack>
  );
}
