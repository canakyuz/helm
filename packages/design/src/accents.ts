// Accent aileleri.
//
// KAYNAK: uygulama ikonu (assets/icon.png). Bes yaprak, bes aile. Renkler
// ikondan PIKSEL BAZINDA orneklendi, gozle tahmin edilmedi:
//   indigo #496BFB · pembe #F3538C · camgobegi #02B8EE · teal #13CED0 · yesil #65CD64
//
// ACCENT TEK BIR HEX DEGILDIR - cifttir. Koyu temada accent'in ACIK olmasi
// gerekir (koyu tile uzerinde metin olarak okunsun, dolgusunun ustune siyah
// murekkep gitsin); acik temada tam tersi. Murekkep kurali tek satir: koyu tema
// accent'i hep acik renktir, uzerine koyu murekkep; acik tema accent'i hep koyu
// renktir, uzerine beyaz.
//
// OLCUM YUZEYI: "cam" sutunu #353438'e karsi olculur, #131318'e DEGIL. GlassView
// malzemesi tile'i gercekte ~#353438 olarak render ediyor (bkz themes.ts fg2
// yorumu). Bu yuzeyi kullanmazsan olcumler gercekte tutmayan degerler uretir.
//
// IKON RENGI NEDEN AYNEN ALINMADI: palette.ts durum renklerinin her accent'ten
// Lab ΔE ile ayrik olmasini sart kosuyor (renk korlugunde ton ayrimi kaybolur,
// geriye sadece parlaklik/doygunluk farki kalir). Ham ikon renkleri bu sarti iki
// yerde kiriyordu:
//   yesil #65CD64 ↔ pos #4ADE80 → ΔE 12.4   (kabul bari 30)
//   pembe #F3538C ↔ neg #FB7185 → ΔE 15.6
// Cozum dosyanin kendi yontemi: ton korunur, parlaklik + doygunluk ayrisana
// kadar kaydirilir. Asagidaki degerler "AA + ΔE≥30 (durum) + ΔE≥25 (diger
// accent)" kisitlarini saglayan, ikon rengine EN YAKIN cozumlerdir. Her satirda
// ikon renginden ne kadar saptigi (ΔE) yaziyor - sifira yakin olan ikonla birebir.
//
// ROSE FLAME (#E63946) ve INFERNO (#FF3030) hala listede YOK: ikisi de orta
// parlaklikta, hicbir yuzeyde 4.5:1'i tutturmuyor.

export type AccentId = "camgobegi" | "teal" | "indigo" | "pembe" | "yesil";

export type AccentFamily = {
  id: AccentId;
  /** Ayarlarda gorunen ad. */
  label: string;
  /** Koyu tema - acik renk. */
  dark: string;
  /** Acik tema - koyu renk. */
  light: string;
};

/** Accent dolgusu UZERINDEKI metin. Tema adina gore, aileden bagimsiz. */
export const ACCENT_INK = { dark: "#11130A", light: "#FFFFFF" } as const;

// Yorumdaki sayilar: (cam yuzeyde metin / murekkeple dolgu) · ikondan sapma ΔE.
export const ACCENTS: readonly AccentFamily[] = [
  {
    id: "camgobegi",
    label: "Camgöbeği",
    dark: "#06B9EF", // 5.41 / 8.20 · ΔE 0.4 - ikonla neredeyse birebir
    light: "#037FAB", // 4.54          · ΔE 22.2
  },
  {
    id: "teal",
    label: "Teal",
    dark: "#11CED0", // 6.33 / 9.60 · ΔE 0.1 - ikonla birebir
    light: "#05857E", // 4.50          · ΔE 27.9
  },
  {
    id: "indigo",
    label: "İndigo",
    dark: "#8F92FE", // 4.54 / 6.88 · ΔE 27.1 - acildi, ham ton camda 3.1'de kaliyordu
    light: "#4668F6", // 4.59          · ΔE 1.5 - ikonla neredeyse birebir
  },
  {
    id: "pembe",
    label: "Pembe",
    dark: "#F99ACC", // 6.19 / 9.38 · ΔE 31.0 - neg'den ayrismak icin acildi
    light: "#D7287E", // 4.67          · ΔE 13.5
  },
  {
    id: "yesil",
    label: "Yeşil",
    dark: "#36B71A", // 4.67 / 7.09 · ΔE 22.9 - pos'tan ayrismak icin doyuruldu
    light: "#1F8925", // 4.50          · ΔE 24.6
  },
] as const;

// Ikonun baskin tonu ve ikon rengine en sadik aile (ΔE 0.4). Listenin de basi:
// accentById bilinmeyen id'de ACCENTS[0]'a duser, boylece fallback == varsayilan.
export const DEFAULT_ACCENT: AccentId = "camgobegi";

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
