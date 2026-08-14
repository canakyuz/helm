// Ayarlarda gorunen etiketler.
//
// ETIKET ARTIK ESLEME ANAHTARI DEGIL. Onceki hali `Record<"Sistem"|"Koyu"|
// "Açık", ThemeMode>` idi: gorunen metin ayni zamanda saklanan degere giden
// anahtardi. Ceviri gelince o metin degisiyor ve esleme sessizce kiriliyordu.
// Simdi kaynak MOD; etiket moddan turetiliyor, ters yon calisma zamaninda
// kuruluyor (bkz. appearance.tsx).

import type { ThemeMode } from "~/lib/preferences";

export const THEME_MODES: readonly ThemeMode[] = ["system", "dark", "light"];

/** Mod → ceviri anahtari (= Turkce kaynak dizgi, bkz. src/lib/i18n.ts). */
export const MODE_LABEL_KEY: Record<ThemeMode, string> = {
  system: "Sistem",
  dark: "Koyu",
  light: "Açık",
};
