// Marka renkleri — temadan bağımsız. Bunlar iki temada da aynı kalır.
//
// Buradaki her hex bir MARKA kararıdır; tema kararları themes.ts'te.
// Yeni hex uydurma: harmonik ton gerekirse alpha ekle (`${accent}40`).

export const brand = {
  /** Electric lime — CTA, hero dolgu, aktif segment. Her iki temada aynı. */
  accent: "#D4FF4D",
  /** Accent dolgu ÜSTÜNDEKİ metin. #D4FF4D üstünde 16.24:1. */
  accentInk: "#11130A",
  /** Accent'in sakin tonu — ikincil vurgu. */
  accentSoft: "#A8CC3D",
} as const;

// Grafik serisi renkleri. Metin değil, dolgu olarak kullanılır (rail, legend
// noktası, bar) — bu yüzden hedef WCAG 1.4.11 non-text 3:1, 4.5:1 değil.
// Anlamı her zaman yanındaki METİN taşır; renk yedek kodlamadır.
//
// KURAL: pos/neg/warn DURUM renkleridir — seri rengi olarak kullanılmaz.
// Gerekçe: dark temada pos (#C2F8CB) ile accent (#D4FF4D) arasındaki parlaklık
// farkı 1.04:1. Ton olarak ayrılırlar ama kırmızı-yeşil renk körlüğünde bu ayrım
// kaybolur. Tasarımın ülkeler grafiği accent→violet→blue→pos sıralıyordu; 1. ve
// 4. çubuk ayırt edilemezdi. Seriler bu yüzden kendi ladder'ını kullanır.
export const series = {
  dark: {
    violet: "#B89CFF", // abonelik / MRR
    blue: "#7AA8FF", // analitik / kullanıcı
    amber: "#FF8A3D", // 4. seri — lime'dan hem ton hem parlaklık olarak uzak
  },
  light: {
    violet: "#6D4FD1", // koyulaştırıldı — #B89CFF beyaz üstünde 1.9:1
    blue: "#2F6BD8",
    amber: "#B4510D",
  },
} as const;

/** Grafik serisi sırası. 4'ten fazla seri gerekirse renk değil desen/etiket ekle. */
export const seriesOrder = ["accent", "violet", "blue", "amber"] as const;

export type SeriesName = keyof typeof series.dark;
