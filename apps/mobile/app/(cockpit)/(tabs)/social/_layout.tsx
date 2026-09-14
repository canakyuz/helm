import { Stack } from "expo-router";

// Sosyal artik kendi sekmesi. Yigin olarak kaldi: alt proje 2-3 buraya
// posts/, inbox/ ekler (settings/sources ile ayni desen).
export default function SocialLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
