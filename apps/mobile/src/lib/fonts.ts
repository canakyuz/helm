import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";

// Tek hook - `_layout.tsx` font yüklenmeden splash tutar.
export function useAppFonts() {
  return useFonts({
    "Geist-400": Geist_400Regular,
    "Geist-500": Geist_500Medium,
    "Geist-600": Geist_600SemiBold,
    "Geist-700": Geist_700Bold,
    "GeistMono-400": GeistMono_400Regular,
    "GeistMono-500": GeistMono_500Medium,
    "GeistMono-600": GeistMono_600SemiBold,
  });
}
