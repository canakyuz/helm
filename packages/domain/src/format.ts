const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  TRY: "₺",
  EUR: "€",
  GBP: "£",
};

// Kuruş hassasiyeti: 2 ondalık + binlik separator (virgül) + ondalık ayrıcı (nokta).
// Örn: 1.234,56 yerine 1,234.56 (helm web format'ı ile aynı).
export function formatCurrency(value: number, currency = "USD"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const sign = value < 0 ? "-" : "";
  const [intPart, decPart] = Math.abs(value).toFixed(2).split(".");
  const withSeparator = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${symbol}${withSeparator}.${decPart}`;
}

// Tam sayı metric'ler (DAU, kullanıcı sayısı vb) — binlik separator, ondalık yok.
export function formatInteger(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Hermes'te `Intl.RelativeTimeFormat` yok — manuel TR formatter.
const UNITS: Array<readonly [number, string]> = [
  [60, "sn"],
  [60, "dk"],
  [24, "sa"],
  [7, "g"],
  [4.345, "h"],
  [12, "ay"],
];

export function formatRelativeTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - date.getTime();
  const past = diffMs >= 0;
  let value = Math.abs(Math.round(diffMs / 1000));

  if (value < 5) return past ? "şimdi" : "az sonra";

  for (const [factor, unit] of UNITS) {
    if (value < factor) {
      return past ? `${value} ${unit} önce` : `${value} ${unit} sonra`;
    }
    value = Math.round(value / factor);
  }
  return past ? `${value} y önce` : `${value} y sonra`;
}

/**
 * Saat damgasi — "10:12". Cihazin YEREL saatinde.
 *
 * Intl'e gidilmiyor: Hermes'te `Intl.DateTimeFormat` var ama hour12 davranisi
 * cihaz bolgesine gore degisiyor; 24 saat sabit olsun (panel Turkce ve
 * tum ekranlarda ayni okunmali).
 */
export function formatClock(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Yuzde — TEK kural: sayi once, `%` sonek (`98%`). Ekranlarin bir kismi elde
// Turkce onek (`%98`) yaziyordu; ayni uygulamada iki kural yasamasin diye
// hepsi buraya baglandi. Ondalik basamak metrige gore degisir (huni orani 0,
// crash-free 1) — degisen SADECE hassasiyet, gosterim degil.
// ---------------------------------------------------------------------------

/** Zaten yuzde olan deger (0–100). Isaretsiz. */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** Oran (0–1) → yuzde. Cagri yerlerinde `* 100` unutmasin diye ayri fonksiyon. */
export function formatRatio(ratio: number, decimals = 0): string {
  return formatPercent(ratio * 100, decimals);
}

// Yuvarlandiginda sifira dusen degisim "degismedi" demektir; "+0.0%" yazmak
// yanlis bir yon ima eder. Renk mantigi da ayni esigi kullanmali, bu yuzden
// esik disari aciliyor.
export const FLAT_DELTA_EPSILON = 0.05;

export function isFlatDelta(value: number): boolean {
  return Math.abs(value) < FLAT_DELTA_EPSILON;
}

/**
 * Degisim yuzdesi — isaretli. Negatifte typografik eksi (U+2212) kullanilir:
 * mono'da rakamlarla ayni genislikte ve tire'den uzun, sutunlar kaymaz.
 */
export function formatDelta(value: number, decimals = 1): string {
  if (isFlatDelta(value)) return `${(0).toFixed(decimals)}%`;
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}
