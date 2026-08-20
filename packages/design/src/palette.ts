// Marka renkleri - temadan bağımsız. Bunlar iki temada da aynı kalır.
//
// Buradaki her hex bir MARKA kararıdır; tema kararları themes.ts'te.
// Yeni hex uydurma: harmonik ton gerekirse alpha ekle (`${accent}40`).

// LEGACY: accent artık tema-duyarlı ve kullanıcı seçimli (bkz accents.ts).
// Buradaki sabitler Tailwind'in derleme-anı `accent` utility'si için duruyor;
// yeni kod `theme.accent` okumalı. Değerler varsayılan aileden (camgöbeği) alındı.
export const brand = {
  /** İkonun baskın tonu - CTA, hero dolgu, aktif segment. */
  accent: "#06B9EF",
  /** Accent dolgu ÜSTÜNDEKİ metin. #06B9EF üstünde 8.20:1. */
  accentInk: "#11130A",
  /** Accent'in sakin tonu - ikincil vurgu. Açık tema camgöbeği değeri, beyazda 4.54:1. */
  accentSoft: "#037FAB",
} as const;

// Grafik serisi renkleri. Metin değil, dolgu olarak kullanılır (rail, legend
// noktası, bar) - bu yüzden hedef WCAG 1.4.11 non-text 3:1, 4.5:1 değil.
// Anlamı her zaman yanındaki METİN taşır; renk yedek kodlamadır.
//
// KURAL: pos/neg/warn DURUM renkleridir - seri rengi olarak kullanılmaz.
// Gerekçe: durum rengi ile accent yan yana geldiğinde ton olarak ayrılsalar bile
// kırmızı-yeşil renk körlüğünde ayrım kaybolur. Tasarımın ülkeler grafiği
// accent→violet→blue→pos sıralıyordu; 1. ve 4. çubuk ayırt edilemezdi.
// Seriler bu yüzden kendi ladder'ını kullanır.
// Accent ailesi ikondan yeniden türetilince seriler de kaydırıldı: eski
// blue #7AA8FF yeni indigo accent'ine ΔE 11.6 kalıyordu, grafikte accent ile
// blue yan yana ayırt edilemezdi. Bağımlılık yönü marka → grafik, tersi değil;
// bu yüzden accent'ler ikona sadık bırakılıp seriler kaçırıldı.
// Her değer: tüm accent'lere ΔE ≥ 25, durum renklerine ΔE ≥ 30, kontrast ≥ 3:1.
export const series = {
  dark: {
    violet: "#DDAEFF", // abonelik / MRR - 6.81:1, en yakın accent ΔE 25.2
    blue: "#82AEF8", // analitik / kullanıcı - 5.51:1, en yakın accent ΔE 25.0
    amber: "#FE8A3E", // 4. seri - 5.25:1, en yakın accent ΔE 68.9
  },
  light: {
    violet: "#783DBD", // beyazda 6.56:1
    blue: "#246FD6", // beyazda 4.86:1
    amber: "#BB4A07", // beyazda 5.13:1
  },
} as const;

/** Grafik serisi sırası. 4'ten fazla seri gerekirse renk değil desen/etiket ekle. */
export const seriesOrder = ["accent", "violet", "blue", "amber"] as const;

export type SeriesName = keyof typeof series.dark;
