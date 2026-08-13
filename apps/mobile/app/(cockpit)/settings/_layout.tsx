import { Stack } from "expo-router";

/**
 * Ayarlar sekmesi artik tek ekran degil, bir yigin.
 *
 * NEDEN: entegrasyonlar, gorunum ve veri ayarlari tek kaydirmaya sigmiyordu;
 * hepsini alt alta dizmek "sonsuz ayar sayfasi" uretir. Hub kisa kalir, agir
 * icerik itilen ekranlara gider — iOS Ayarlar idiomu.
 *
 * headerShown false: baslik ekranin ICINDE (`BentoHeader`), cunku arka plan
 * (`BentoBackground`) basligin altindan gecmeli. Native baslik onu keserdi.
 */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
