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
      {/* Saglik da sekme degil: iOS 26 ayrik arama sekmesi toplam 5 sekmede
          cikiyor, 6'da UIKit "More" menusune kesiyor. Giris Ozet'teki CRASH karti. */}
      <Stack.Screen name="health" />
      {/* Baslik ve tab bar aksesuari ayni sheet'i acar; route oldugu icin
          aksesuarin iki kopyasi arasinda state paylasmak gerekmez. */}
      <Stack.Screen
        name="project-picker"
        options={{ presentation: "formSheet", sheetAllowedDetents: [0.5, 1], sheetGrabberVisible: true }}
      />
    </Stack>
  );
}
