// Tema → CSS custom property üretici.
//
// apps/web Tailwind v4 kullanıyor (@theme inline + CSS değişkenleri); apps/mobile
// Tailwind v3 JS config kullanıyor. İkisi aynı dosyayı okuyamaz - bu yüzden
// ortak kaynak düz TS, web çıktısı buradan TÜRETİLİR.
//
// Bu tur mobil odaklı; fonksiyon web adımı geldiğinde tüketilecek.

import { brand } from "./palette";
import { radius, space, type } from "./scale";
import { themes, type ThemeName } from "./themes";

/** Tek bir temanın değişken bloğunu üretir (süslü parantezsiz, satır satır). */
export const themeVars = (name: ThemeName): string => {
  const t = themes[name];
  return Object.entries(t)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
};

/** "#131318" → "19 19 24". NativeWind/Tailwind `rgb(var(--x) / <alpha-value>)` formu. */
export const toRgbChannels = (hex: string): string => {
  const c = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(" ");
};

/**
 * NativeWind tema bloğu - renkler RGB kanal üçlüsü olarak yazılır ki
 * Tailwind alfa modifier'ı (`bg-tile/50`) çalışsın. Hex yazılırsa alfa kırılır.
 */
export const nativewindVars = (name: ThemeName): string => {
  const t = themes[name];
  return Object.entries(t)
    .map(([key, value]) => `  --${key}: ${toRgbChannels(value)};`)
    .join("\n");
};

/** Temadan bağımsız değişkenler - marka, ölçek. */
export const staticVars = (): string =>
  [
    ...Object.entries(brand).map(([k, v]) => `  --${k}: ${v};`),
    ...Object.entries(radius).map(([k, v]) => `  --radius-${k}: ${v}px;`),
    ...Object.entries(space).map(([k, v]) => `  --space-${k}: ${v}px;`),
    ...Object.entries(type).map(([k, v]) => `  --text-${k}: ${v}px;`),
  ].join("\n");

/** Tam stylesheet parçası - :root + [data-theme] blokları. */
export const toStylesheet = (): string =>
  [
    `:root {\n${staticVars()}\n}`,
    `[data-theme="dark"] {\n${themeVars("dark")}\n}`,
    `[data-theme="light"] {\n${themeVars("light")}\n}`,
  ].join("\n\n");
