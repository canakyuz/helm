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
      return past ? `${value}${unit} önce` : `${value}${unit} sonra`;
    }
    value = Math.round(value / factor);
  }
  return past ? `${value}y önce` : `${value}y sonra`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
