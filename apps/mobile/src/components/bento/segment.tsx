import { Pressable, Text, View } from "react-native";
import { press, radius as R } from "@helm/design";

import { haptic } from "~/lib/haptics";
import { useTheme } from "~/theme/use-theme";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** "accent": secili pill lime dolu (donem secici). "chrome": secili pill
   *  yuzey rengi, metin fg (alt sekmeler). Tasarim ikisini de kullaniyor. */
  tone?: "accent" | "chrome";
  /** Mono yazi tipi — donem/para birimi gibi kisa kodlar icin. */
  mono?: boolean;
  /** Segmentler esit genislikte yayilsin (alt sekmeler) veya icerige otursun. */
  fill?: boolean;
};

/**
 * Bento segment kontrolu — pill kap, secili pill dolu.
 *
 * NEDEN NATIVE DEGIL: design.md §1/§6 "native > custom" diyor ve bugune kadar
 * @expo/ui SwiftUI Picker kullaniliyordu. Bento tasarimi segmentleri kendi
 * ciziyor: pill kap, accent dolgulu secili durum, 11px mono etiket. Stok iOS
 * segmented control'un yaricapi, rengi ve tipografisi bunlarin hicbirini
 * tutmuyor — sistemin ortasinda yabanci bir parca olarak duruyordu. Bento
 * benimsendigi icin custom kazaniyor; bu bilincli bir sapma.
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

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 3,
        padding: 3,
        borderRadius: R.pill,
        backgroundColor: tone === "accent" ? theme.tile2 : theme.tile,
        ...(fill ? {} : { alignSelf: "flex-start" }),
      }}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => {
              if (active) return;
              haptic.tap();
              onChange(opt);
            }}
            style={({ pressed }) => ({
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: R.pill,
              backgroundColor: active
                ? tone === "accent"
                  ? "#D4FF4D"
                  : theme.chrome
                : "transparent",
              opacity: pressed && !active ? press.opacity : 1,
              ...(fill ? { flex: 1, alignItems: "center" as const } : {}),
            })}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={{
                fontFamily: mono
                  ? active
                    ? "GeistMono-600"
                    : "GeistMono-500"
                  : active
                    ? "Geist-600"
                    : "Geist-500",
                fontSize: 11,
                color: active
                  ? tone === "accent"
                    ? "#11130A"
                    : theme.fg
                  : theme.fg2,
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
