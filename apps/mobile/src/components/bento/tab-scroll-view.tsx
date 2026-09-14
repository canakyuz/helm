import type { ComponentProps } from "react";
import { ScrollView } from "react-native";
import { ScrollViewMarker } from "react-native-screens/experimental";

/**
 * Sekme ekranlarının ana kaydırma alanı.
 *
 * NEDEN MARKER: native tabs, tab bar'ı küçülteceği (`minimizeBehavior`) ve sekmeye
 * tekrar basınca başa kaydıracağı ScrollView'ı yalnızca ilk-alt-görünüm zincirinde
 * arıyor (`RNSScrollViewFinder`, hep `subviews[0]`). Ekranlarda önce zemin ve
 * BentoHeader geliyor, zincir ScrollView'a hiç ulaşmıyor. Marker ScrollView'ı
 * sekme ekranına doğrudan kaydeder; ekran yapısını bozmaya gerek kalmaz.
 */
export function TabScrollView(props: ComponentProps<typeof ScrollView>) {
  return (
    <ScrollViewMarker style={{ flex: 1 }}>
      <ScrollView {...props} />
    </ScrollViewMarker>
  );
}
