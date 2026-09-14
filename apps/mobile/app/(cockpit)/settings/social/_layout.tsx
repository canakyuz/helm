import { Stack } from "expo-router";

// Sosyal yigini Ayarlar altinda: kok layout Slot, kok Stack yok; NativeTabs
// altinda sekmesiz rota bu repoda kanitli degil, settings/sources kanitli.
// Alt proje 2-3 buraya posts/, inbox/ ekler.
export default function SocialLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
