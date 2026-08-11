// Accent aileleri.
//
// ACCENT TEK BIR HEX DEGILDIR — cifttir. Koyu temada accent'in ACIK olmasi
// gerekir (koyu tile uzerinde metin olarak okunsun, dolgusunun ustune siyah
// murekkep gitsin); acik temada tam tersi. Olculdu: gonderilen renklerin hepsi
// tam olarak bu iki gruba ayriliyor, hicbiri ikisini birden yapamiyor.
//
//   #C2F8CB  ink ustunde 15.68 ✓   beyaz ustunde 1.19 ✗   → yalnizca KOYU tema
//   #1B512D  ink ustunde  2.02 ✗   beyaz ustunde 9.29 ✓   → yalnizca ACIK tema
//
// Bu yuzden murekkep kurali tek satir: koyu tema accent'i hep acik renktir, uzerine
// koyu murekkep; acik tema accent'i hep koyu renktir, uzerine beyaz.
//
// ROSE FLAME (#E63946) ve INFERNO (#FF3030) accent listesinde YOK: ikisi de orta
// parlaklikta, hicbir yuzeyde 4.5:1'i tutturmuyor (olculdu: 2.96–4.49). Durum
// rengi olarak bir islevleri olabilir, accent olarak kullanilamazlar.

export type AccentId = "lime" | "yesil" | "teal" | "cyan" | "kirmizi";

export type AccentFamily = {
  id: AccentId;
  /** Ayarlarda gorunen ad. */
  label: string;
  /** Koyu tema — acik renk. */
  dark: string;
  /** Acik tema — koyu renk. */
  light: string;
};

/** Accent dolgusu UZERINDEKI metin. Tema adina gore, aileden bagimsiz. */
export const ACCENT_INK = { dark: "#11130A", light: "#FFFFFF" } as const;

// Olculen en kotu kontrast degerleri yorumda: (tile'da metin / murekkeple dolgu).
export const ACCENTS: readonly AccentFamily[] = [
  {
    id: "lime",
    label: "Lime",
    dark: "#D4FF4D", // 10.71 / 16.24
    light: "#627523", //  4.54 /  5.14  — turetildi, lime tonu korunarak
  },
  {
    id: "yesil",
    label: "Yeşil",
    dark: "#C2F8CB", // 10.35 / 15.68  — TEA GREEN
    light: "#1B512D", //  8.20 /  9.29  — FOREST GREEN
  },
  {
    id: "teal",
    label: "Teal",
    dark: "#40E0D0", //  7.53 / 11.41  — TURQUOISE
    light: "#006666", //  6.00 /  6.79  — DEEP TEAL
  },
  {
    id: "cyan",
    label: "Cyan",
    dark: "#B2FFFF", // 10.97 / 16.62  — PALE AQUA
    light: "#007A7C", //  4.55 /  5.15  — turetildi (TROPICAL CYAN beyazda 2.28 kaliyordu)
  },
  {
    id: "kirmizi",
    label: "Kırmızı",
    dark: "#CB8B98", //  4.52 /  6.85  — turetildi (RUBY tonundan)
    light: "#8E0320", //  8.49 /  9.62  — RUBY RED
  },
] as const;

export const DEFAULT_ACCENT: AccentId = "lime";

export function accentById(id: string): AccentFamily {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
}

/**
 * Hex + alfa → rgba(). Accent artık çalışma zamanında değiştiği için
 * `text-accent-ink/[0.78]` gibi Tailwind alfa modifier'ları kullanılamıyor:
 * o sınıflar derleme anında sabitleniyor.
 */
export function withAlpha(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
