// İki tema, aynı anahtarlar. Bir bileşen `Theme` okur, hangi temada olduğunu bilmez.
//
// Kaynak: "Helm Bento Sistemi" tasarımının [data-theme] CSS değişkenleri.
// Tasarımdan SAPMALAR aşağıda `AA:` yorumlarıyla işaretli — hepsi kontrast
// ölçümü sonucu (WCAG 2.1, normal metin 4.5:1). Mockup'ın light paleti
// test edilmemişti: pos 3.15:1, warn 3.72:1, neg 4.10:1, fg3 2.67:1 kalıyordu.

import { series } from "./palette";

export type Theme = {
  /** Ekran zemini. */
  bg: string;
  /** Ana bento tile — cam yüzeyin fallback/taban rengi. */
  tile: string;
  /** Tile İÇİ kutu. Asla cam değil (cam içinde cam = çamur + 2x maliyet). */
  tile2: string;
  /** Hairline ayraç, dolmamış rail. */
  line: string;
  /** Başlık, büyük rakam. */
  fg: string;
  /** Gövde metni, ikincil değer. */
  fg2: string;
  /** Eyebrow, meta, zaman damgası. Ayrımı renkten çok TİPOGRAFİ taşır:
   *  fg3 metni her zaman 10px mono, büyük harf, geniş tracking. */
  fg3: string;
  /** Pozitif delta, sağlıklı durum. DURUM rengi — seri rengi olarak kullanma. */
  pos: string;
  /** Negatif delta, fatal, iptal. */
  neg: string;
  /** Uyarı, degraded, bayat veri. */
  warn: string;
  /** Header ikon butonu / aktif sekme zemini — tile'dan bir tık ayrı. */
  chrome: string;
  /** Grafik serisi renkleri (dolgu; metin değil). */
  violet: string;
  blue: string;
  amber: string;
};

export const darkTheme: Theme = {
  bg: "#0A0A0C",
  tile: "#131318",
  tile2: "#1A1A21",
  line: "#1F1F26",
  fg: "#F6F6F1",
  fg2: "#8C8C94",
  fg3: "#828289", // AA: mockup #5F5F68 → 2.74:1 kalıyordu, 4.53:1'e çekildi
  pos: "#C2F8CB", // marka yeşili (Can) — tile üstünde 15.51:1
  neg: "#FF5C7A",
  warn: "#FFB100",
  chrome: "#17171C",
  violet: series.dark.violet,
  blue: series.dark.blue,
  amber: series.dark.amber,
};

export const lightTheme: Theme = {
  bg: "#F1F1ED",
  tile: "#FFFFFF",
  tile2: "#F7F7F3",
  line: "#E7E7E1",
  fg: "#14151A",
  fg2: "#5F6067",
  fg3: "#6D6D73", // AA: mockup #93949B → 2.67:1, 4.54:1'e çekildi
  pos: "#1B512D", // marka yeşili (Can) — tile üstünde 9.29:1
  neg: "#D4243C", // AA: mockup #E0263F → 4.10:1, 4.50:1'e çekildi
  warn: "#956409", // AA: mockup #A8700A → 3.72:1, 4.52:1'e çekildi
  chrome: "#FFFFFF",
  violet: series.light.violet,
  blue: series.light.blue,
  amber: series.light.amber,
};

export type ThemeName = "dark" | "light";

export const themes: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
