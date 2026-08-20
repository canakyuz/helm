import { currentLocale, tr } from "~/lib/i18n";
import type { PropertyStatus, PropertyType } from "@helm/api";

/**
 * Ekranlarda gorunen sabit etiketler ve tarih bicimleyicileri.
 *
 * NEDEN TEK DOSYA: MONTHS_TR iki, TYPE_LABEL uc ekranda kopyalanmisti. Uc tekrar
 * DRY esigidir; kopyalar kacinilmaz olarak birbirinden ayrisir - nitekim
 * property-picker "Uygulama" derken overview "mobile_app" diyordu.
 */

export const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

export const MONTHS_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
] as const;

export const TYPE_LABEL: Record<PropertyType, string> = {
  website: "Web",
  web_app: "Web app",
  mobile_app: "Uygulama",
  desktop_app: "Masaüstü",
  game: "Oyun",
};

export const STATUS_LABEL: Record<PropertyStatus, string> = {
  healthy: "sağlıklı",
  stale: "veri bayat",
  down: "kapalı",
  unknown: "bilinmiyor",
};

/** "2026-08" → "Ağustos" (bu yıl) / "Ağustos 25" (önceki yıllar). */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = tr(MONTHS_TR[(m ?? 1) - 1] ?? key);
  return y === new Date().getFullYear() ? name : `${name} ${String(y).slice(2)}`;
}

/** "2026-07-28" → "28 Tem" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ""}`;
}

/** "2026-08-09" → "9 AĞUSTOS" - hero eyebrow'unda seçili gün. */
export function longDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y == null || m == null || d == null) return iso;
  // Intl'e gidilmiyordu ve "tr-TR" sabitti - Ingilizce arayuzde de "9 AGUSTOS"
  // cikiyordu. Ay adi ceviri tablosundan gelir, buyutme de dile gore yapilir.
  const month = tr(MONTHS_TR[m - 1] ?? "");
  const locale = currentLocale();
  return `${d} ${month}`.toLocaleUpperCase(locale);
}

/**
 * Proje monogramı - adın ilk iki harfi. "Orbit Runner" → "OR".
 * Noktalama atılır: "Wesan · Corporate site" ikinci kelime olarak "·" veriyordu.
 */
export function monogram(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (first + second).toUpperCase();
}

/** Cihazın yerel günü, metrics.date ile aynı YYYY-MM-DD formatında. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Grafik serisi renkleri - ilki seçili accent.
 *
 * pos/neg/warn burada YOK: onlar durum renkleri. Seri olarak kullanılırlarsa
 * "yeşil ülke çubuğu" ile "pozitif delta" aynı anlamı taşıyormuş gibi okunur.
 */
export const seriesTints = (accent: string): readonly string[] => [
  accent,
  "#B89CFF",
  "#7AA8FF",
  "#FF8A3D",
];
