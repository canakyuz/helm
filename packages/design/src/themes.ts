// İki tema, aynı anahtarlar. Bir bileşen `Theme` okur, hangi temada olduğunu bilmez.
//
// Kaynak: "Helm Bento Sistemi" tasarımının [data-theme] CSS değişkenleri.
// Tasarımdan SAPMALAR aşağıda `AA:` yorumlarıyla işaretli — hepsi kontrast
// ölçümü sonucu (WCAG 2.1, normal metin 4.5:1). Mockup'ın light paleti
// test edilmemişti: pos 3.15:1, warn 3.72:1, neg 4.10:1, fg3 2.67:1 kalıyordu.

import { ACCENT_INK, accentById, DEFAULT_ACCENT, type AccentId } from "./accents";
import { series } from "./palette";

export type Theme = {
  /** Ekran zemini. */
  bg: string;
  /** Ana bento tile — cam yüzeyin fallback/taban rengi. */
  tile: string;
  /** Tile İÇİ kutu. Asla cam değil (cam içinde cam = çamur + 2x maliyet). */
  tile2: string;
  /** Hairline ayraç. SADECE 1px çizgi.
   *  Dolmamış rail/metre yolu için `line` DEĞİL `glass.chartDim` kullan:
   *  hairline'ın görünmemesi normaldir, boş yolun görünmemesi ise metreyi
   *  tamamen yok eder (bkz Özet "aylık hedef" — her iki temada da kayboluyordu). */
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
  /** Seçili accent — kullanıcı tercihine göre değişir (bkz accents.ts). */
  accent: string;
  /** Accent dolgusu ÜZERİNDEKİ metin. */
  accentInk: string;
};

export const darkTheme: Omit<Theme, "accent" | "accentInk"> = {
  bg: "#0A0A0C",
  tile: "#131318",
  tile2: "#1A1A21",
  line: "#1F1F26",
  fg: "#F6F6F1",
  // fg2 ve fg3 dark temada AYNI DEĞER — bilinçli.
  //
  // Cam yüzey GlassView malzemesi yüzünden token'daki #131318'e değil ~#353438'e
  // render ediliyor (ekran görüntüsünden ölçüldü). O yüzeyde 4.5:1'i tutturan en
  // koyu gri #9E9EA4; hem fg2 hem fg3 oraya çıkmak zorunda, aralarında yer
  // kalmıyor (parlaklık farkı 1.001x). Üç kademeli gri merdiven bu yüzeyde AA ile
  // birlikte mümkün değil.
  //
  // Ayrım kaybolmuyor, taşıyıcısı değişiyor: fg3 metni her zaman 10px mono,
  // BÜYÜK HARF, .16em tracking — biçim farkı renk farkından güçlü.
  // Light tema etkilenmez, orada tile opak beyaz (bkz lightTheme).
  fg2: "#9E9EA4",
  fg3: "#9E9EA4",
  // Accent aileleri yeşili ve pembeyi de içeriyor; durum renkleri onlardan AYRIK
  // olmak zorunda (renk körlüğünde ton ayrımı kaybolur). Lab ΔE ile ölçüldü,
  // accent'ler ikondan yeniden türetildikten SONRA:
  //   pos ↔ yesil (#36B71A) ΔE 30.0 · neg ↔ pembe (#F99ACC) ΔE 30.2
  // Kabul barı 30; ikisi de sınırda ama geçiyor. Accent ailesine yeni bir yeşil
  // veya pembe eklenecekse bu iki değer YENİDEN ölçülmeli.
  pos: "#4ADE80", // kontrast 7.09:1
  neg: "#FB7185", // kontrast 4.59:1
  warn: "#FFB100",
  chrome: "#17171C",
  violet: series.dark.violet,
  blue: series.dark.blue,
  amber: series.dark.amber,
};

export const lightTheme: Omit<Theme, "accent" | "accentInk"> = {
  bg: "#F1F1ED",
  tile: "#FFFFFF",
  tile2: "#F7F7F3",
  line: "#E7E7E1",
  fg: "#14151A",
  fg2: "#5F6067",
  fg3: "#6D6D73", // AA: mockup #93949B → 2.67:1, 4.54:1'e çekildi
  // Açık temada hem accent hem durum rengi koyu bölgede yaşamak zorunda, bu yüzden
  // ayrım dar: ΔE ~22. Karıştırmaz çünkü farklı rollerde ve boyutlarda yaşıyorlar
  // (accent = büyük dolgu/aktif pill, durum = 11px mono delta) ve uygulama zaten
  // +/− işareti basıyor — renk yedek kodlamadır.
  pos: "#197E47",
  neg: "#D4243C", // AA: mockup #E0263F → 4.10:1, 4.50:1'e çekildi
  warn: "#956409", // AA: mockup #A8700A → 3.72:1, 4.52:1'e çekildi
  chrome: "#FFFFFF",
  violet: series.light.violet,
  blue: series.light.blue,
  amber: series.light.amber,
};

export type ThemeName = "dark" | "light";

const BASE: Record<ThemeName, Omit<Theme, "accent" | "accentInk">> = {
  dark: darkTheme,
  light: lightTheme,
};

/**
 * Tema + seçili accent → tam Theme.
 *
 * Accent artık statik değil: kullanıcı Ayarlar'dan seçiyor, dolayısıyla tema
 * tek bir sabit obje olamaz. Türetme TEK YERDE kalsın diye burada.
 */
export function buildTheme(name: ThemeName, accent: AccentId = DEFAULT_ACCENT): Theme {
  const family = accentById(accent);
  return {
    ...(BASE[name] as Theme),
    accent: name === "dark" ? family.dark : family.light,
    accentInk: ACCENT_INK[name],
  };
}

/** Varsayılan accent ile temalar — üretim hattı (gen:design) bunu kullanır. */
export const themes: Record<ThemeName, Theme> = {
  dark: buildTheme("dark"),
  light: buildTheme("light"),
};
