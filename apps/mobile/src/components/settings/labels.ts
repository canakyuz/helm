// Ayarlarda gorunen etiketler.
//
// NEDEN AYRI DOSYA: bu degerler hem hub'da (ozet metni) hem de alt ekranda
// (segment secenekleri) lazim. Iki route dosyasi birbirinden import etmesin
// diye ortak yere alindi. i18n geldiginde (bkz. dil destegi isi) ceviri
// katmanının baglanacagi yer burasi — o zamana kadar tek dil.

import type { ThemeMode } from "~/lib/preferences";

export const THEME_LABELS = ["Sistem", "Koyu", "Açık"] as const;
export type ThemeLabel = (typeof THEME_LABELS)[number];

export const LABEL_TO_MODE: Record<ThemeLabel, ThemeMode> = {
  Sistem: "system",
  Koyu: "dark",
  Açık: "light",
};

export const MODE_TO_LABEL: Record<ThemeMode, ThemeLabel> = {
  system: "Sistem",
  dark: "Koyu",
  light: "Açık",
};
