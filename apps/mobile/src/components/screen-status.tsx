import { View, Text, ActivityIndicator } from "react-native";
import { type } from "@helm/design";

import { ScreenGround } from "~/components/bento/ground";
import { useTheme } from "~/theme/use-theme";

type Props = {
  label: string;
  tone?: "default" | "danger";
};

/**
 * Ekranın TAMAMININ yerine geçen yükleniyor/hata durumu.
 *
 * NEDEN ScreenGround: burası bir "durum kutusu" değil, o an ekranın kendisi -
 * overview/revenue/analytics/health veri gelene kadar bunu döndürüyor. Eskiden
 * legacy `colors.bgBase` (#07070A) ile opak boyanıyordu; hem tema zemininden
 * (#0A0A0C) FARKLI bir renkti hem de ışığı tamamen yiyordu. Sonuç: her yükleme
 * anında ekran ışıksız ve yanlış tonda bir zemine düşüp veri gelince sıçrıyordu.
 */
export function ScreenStatus({ label, tone = "default" }: Props) {
  const { theme } = useTheme();
  const labelColor = tone === "danger" ? theme.neg : theme.fg3;

  return (
    <ScreenGround>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
        {tone === "default" ? (
          <ActivityIndicator color={theme.fg3} />
        ) : (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.neg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "GeistMono-600", fontSize: 14, color: theme.neg }}>!</Text>
          </View>
        )}
        <Text
          style={{
            fontFamily: "GeistMono-500",
            fontSize: type.eyebrow,
            letterSpacing: 2,
            color: labelColor,
          }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
    </ScreenGround>
  );
}
