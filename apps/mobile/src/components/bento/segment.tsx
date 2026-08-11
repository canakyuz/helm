import { Pressable, Text, View, type ViewStyle } from "react-native";
import { press, radius as R } from "@helm/design";

import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** "accent": secili pill lime dolu (donem/para birimi secici).
   *  "chrome": secili pill yuzey rengi, metin fg (alt sekmeler). */
  tone?: "accent" | "chrome";
  /** Mono yazi tipi — kisa kodlar icin (7G, USD). */
  mono?: boolean;
  /** Segmentler esit genislikte yayilsin (alt sekmeler). */
  fill?: boolean;
};

/**
 * Bento segment kontrolu — pill kap, secili pill dolu.
 *
 * NEDEN NATIVE DEGIL: design.md §1/§6 "native > custom" diyor ve bugune kadar
 * @expo/ui SwiftUI Picker kullaniliyordu. Bento tasarimi segmentleri kendi
 * ciziyor: pill kap, accent dolgulu secili durum, 11px mono etiket. Stok iOS
 * segmented control'un yaricapi, rengi ve tipografisi bunlarin hicbirini
 * tutmuyor. Bento benimsendigi icin custom kazaniyor; bilincli sapma.
 *
 * KRITIK: Pressable'in style'i FONKSIYON DEGIL. Fonksiyon-style'da layout ve
 * renk ozellikleri uygulanmiyor (design.md §8) — ilk surumde tam olarak bu
 * yuzden secili pill'in dolgusu ve hizalamasi kayboldu. Basma geri bildirimi
 * icin ayri bir sarmalayici View kullaniliyor.
 */
export function BentoSegment<T extends string>({
  options,
  value,
  onChange,
  tone = "accent",
  mono = true,
  fill = false,
}: Props<T>) {
  const { theme } = useTheme();

  const container: ViewStyle = {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: R.pill,
    backgroundColor: tone === "accent" ? theme.tile2 : theme.tile2,
    ...(fill ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }),
  };

  return (
    <View style={container}>
      {options.map((opt) => {
        const active = opt === value;
        const cell: ViewStyle = {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: R.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active
            ? tone === "accent"
              ? theme.accent
              : theme.chrome
            : "transparent",
          ...(fill ? { flex: 1 } : {}),
        };

        return (
          <Pressable
            key={opt}
            onPress={() => {
              if (active) return;
              haptic.tap();
              onChange(opt);
            }}
            style={fill ? { flex: 1 } : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {({ pressed }) => (
              <View style={[cell, pressed && !active ? { opacity: press.opacity } : null]}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: mono
                      ? active
                        ? "GeistMono-600"
                        : "GeistMono-500"
                      : active
                        ? "Geist-600"
                        : "Geist-500",
                    fontSize: 12,
                    color: active
                      ? tone === "accent"
                        ? theme.accentInk
                        : theme.fg
                      : theme.fg2,
                  }}
                >
                  {opt}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
