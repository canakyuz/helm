import { View } from "react-native";
import { Image } from "expo-image";
import { radius as R } from "@helm/design";

import { useTheme } from "~/theme/use-theme";

/**
 * 9:16 video kapagi. Genislik verilir, yukseklik orandan turer - satirda ve
 * detayda ayni oran, ayni koseli sekil (tek radius kurali: R.btn).
 *
 * transition 120ms: kapak asenkron iniyor; gecissiz belirmesi satirda "pat"
 * diye sicrama yaratiyordu. Daha uzun fade listede gecikme gibi okunur.
 */
export function SocialThumb({ uri, width }: { uri: string | null; width: number }) {
  const { theme } = useTheme();
  const box = { width, height: Math.round((width * 16) / 9), borderRadius: R.btn };

  if (uri == null) return <View style={[box, { backgroundColor: theme.tile2 }]} />;

  return (
    <Image
      source={{ uri }}
      style={[box, { backgroundColor: theme.tile2 }]}
      contentFit="cover"
      transition={120}
      recyclingKey={uri}
      accessibilityIgnoresInvertColors
    />
  );
}
