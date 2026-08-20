import { useEffect } from "react";
import { colorScheme, useColorScheme } from "nativewind";
import {
  buildTheme,
  glass as glassRecipes,
  type GlassRecipe,
  type Theme,
  type ThemeName,
} from "@helm/design";

import { usePreferences } from "~/lib/preferences";

export type ResolvedTheme = {
  /** Cozulmus tema adi - "system" burada asla gorunmez. */
  name: ThemeName;
  /** Renk token'lari. className ile cozulemeyen yerler icin: Skia, GlassView,
   *  Reanimated interpolasyonu, native prop'lar. Duz View/Text icin className kullan. */
  theme: Theme;
  /** Cam recetesi - fill/border/sheen/blur/golge/aurora opakligi. */
  glass: GlassRecipe;
};

/**
 * Tema tercihini iOS gorunum ayariyla birlestirir ve NativeWind'e uygular.
 *
 * NEDEN TEK YERDE: NativeWind'in colorScheme'i CSS degiskenlerini (.dark sinifi)
 * surer; useTheme() ise runtime renkleri dondurur. Bu ikisi ayri ayri set
 * edilirse kacinilmaz olarak ayrisirlar - className koyu, Skia grafigi acik
 * kalir. Burada tek kaynak tercihtir; NativeWind ondan TUREYIR.
 *
 * Time: O(1). Space: O(1).
 */
export function useTheme(): ResolvedTheme {
  const { themeMode, accent } = usePreferences();
  const { colorScheme: active } = useColorScheme();

  // Yan etki render sirasinda calistirilmaz - NativeWind global store'a yazar.
  useEffect(() => {
    colorScheme.set(themeMode);
  }, [themeMode]);

  // NativeWind "system" modda cihazin semasini cozup dondurur; yine de
  // undefined gelebilecegi icin dark'a duseriz (uygulamanin varsayilani).
  const name: ThemeName = active === "light" ? "light" : "dark";

  return { name, theme: buildTheme(name, accent), glass: glassRecipes[name] };
}
