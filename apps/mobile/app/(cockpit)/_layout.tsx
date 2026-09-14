import { Stack } from "expo-router";

/**
 * Sekmeler + sekme disi yiginlar.
 *
 * NEDEN STACK: Ayarlar tab bar'dan cikti, sag ustteki disliyle aciliyor.
 * NativeTabs'ta `hidden` sekmeye hic gidilemiyor ve kok layout Slot; bu yuzden
 * Ayarlar sekmelerin USTUNE itilen bir yigin. Gruplar URL'de gorunmedigi icin
 * `/settings/...` linkleri degismedi.
 */
export default function CockpitLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
