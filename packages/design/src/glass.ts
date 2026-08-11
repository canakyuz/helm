// Cam reçetesi — tema başına.
//
// KRİTİK (design.md §4): GlassView tek başına görünmez. Koyu zeminde kaybolur,
// bu yüzden ÜSTÜNE her zaman bir tint fill konur. Light temada aynı sorunun
// aynası vardır: beyaz zemine beyaz kenar görünmez, o yüzden kenar rengi
// temayla TERS döner (light'ta koyu hairline).
//
// Yüzey kuralı — sistemin tamamı buna uyar:
//   accent → SOLID   (lime hero; cam olmaz)
//   tile   → GLASS   (cam burada yaşar)
//   tile2  → SOLID   (tile içi kutu; cam içinde cam = çamur + 2x maliyet)

import type { ThemeName } from "./themes";

export type GlassRecipe = {
  /** GlassView/BlurView ÜSTÜNE binen tint. Bu olmadan kart kaybolur. */
  fill: string;
  /** 1px kenar. Temayla ters döner. */
  border: string;
  /** Üst specular şerit. */
  sheen: string;
  /** BlurView fallback yoğunluğu (iOS<26 / Android). */
  blurIntensity: number;
  /** expo-glass-effect `colorScheme` prop'u. */
  colorScheme: ThemeName;
  /** Tile gölgesi. Dark'ta yok — koyu zeminde gölge kir yapar. */
  shadow: {
    color: string;
    offsetY: number;
    opacity: number;
    radius: number;
    /** Android elevation karşılığı. */
    elevation: number;
  } | null;
  /** LiquidBackground aurora blob opaklık aralığı [min, max].
   *  Bento düzeni için kısıldı — camın kıracağı bir şey kalsın ama
   *  tile'ların sakinliği bozulmasın. Eski Liquid Glass: 0.28–0.45. */
  auroraOpacity: readonly [number, number];
};

export const glass: Record<ThemeName, GlassRecipe> = {
  dark: {
    fill: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.10)",
    sheen: "rgba(255,255,255,0.08)",
    blurIntensity: 60,
    colorScheme: "dark",
    shadow: null,
    auroraOpacity: [0.12, 0.18],
  },
  light: {
    fill: "rgba(255,255,255,0.72)",
    border: "rgba(20,21,26,0.06)",
    sheen: "rgba(255,255,255,0.60)",
    blurIntensity: 40,
    colorScheme: "light",
    shadow: {
      color: "#14151A",
      offsetY: 1,
      opacity: 0.06,
      radius: 2,
      elevation: 1,
    },
    auroraOpacity: [0.06, 0.1],
  },
};
