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
  /** Aurora blob opaklık aralığı [min, max].
   *
   *  Önce bento için 0.12–0.18'e kısılmıştı; simulator'da cam malzeme olarak
   *  değil düz gri yüzey olarak okundu. Can'ın kararıyla eski Liquid Glass
   *  yoğunluğuna (0.28–0.45) dönüldü: cam belirgin okunuyor, bedeli 5-7 tile
   *  ile birlikte daha canlı bir zemin. */
  auroraOpacity: readonly [number, number];
};

export const glass: Record<ThemeName, GlassRecipe> = {
  dark: {
    // Aurora camı GÖRÜNÜR yapan şey; fill ise yüzeyi YIKAYAN şey. 0.12'de
    // render edilen tile #3C3E36'ya çıkıyor ve fg2/fg3 kontrastı AA'nın altına
    // düşüyordu (3.25:1 / 2.84:1 — ekran görüntüsünden ölçüldü). Aurora güçlü
    // kalır, fill geri çekilir: cam belirginliği aurora'dan gelir, bedeli metin
    // ödemez.
    fill: "rgba(255,255,255,0.09)",
    border: "rgba(255,255,255,0.14)",
    sheen: "rgba(255,255,255,0.10)",
    blurIntensity: 60,
    colorScheme: "dark",
    shadow: null,
    auroraOpacity: [0.28, 0.45],
  },
  light: {
    fill: "rgba(255,255,255,0.62)",
    border: "rgba(20,21,26,0.09)",
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
    // Light'ta dark'ın yaklaşık yarısı: beyaz zeminde aynı opaklık renkli
    // bir sis gibi okunur, metin kontrastını da düşürür.
    auroraOpacity: [0.14, 0.22],
  },
};
