// Tailwind config ile birebir senkron — runtime/inline kullanım için aynı palet.

export const colors = {
  bgBase: "#07070A",
  bgDeep: "#050507",
  bgSurface: "#0E0E12",
  bgElevated: "#15151B",
  bgHigher: "#1C1C24",
  fgPrimary: "#F6F6F1",
  fgSecondary: "#C9C9BE",
  fgMuted: "#8C8C94",
  fgSubtle: "#585860",
  border: "#1C1C24",
  borderStrong: "#2A2A33",
  borderGlow: "#3A3A46",
  // İkondan türetilen varsayılan accent (camgöbeği). Tek kaynak
  // packages/design/src/accents.ts — buradaki kopya legacy inline kullanımlar için.
  accent: "#06B9EF",
  accentInk: "#11130A",
  accentSoft: "#037FAB",
  accentDanger: "#FF5C7A", // yeni accent ailesine ΔE 37.7 — dokunulmadı
  accentWarn: "#FFB100", // ΔE 81.8 — dokunulmadı
  // accentInfo/blue/violet, packages/design series değerlerine hizalandı: eski
  // #7AA8FF yeni indigo accent'ine ΔE 18.8, #B89CFF ise ΔE 11.6 kalıyordu — grafikte
  // accent ile yan yana ayırt edilemezlerdi. Yeni değerler ΔE 25.0 ve 25.2.
  accentInfo: "#82AEF8",
  accentViolet: "#DDAEFF",
  green: "#57E08B", // ΔE 34.5 — dokunulmadı
  blue: "#82AEF8",
} as const;

export const fonts = {
  sans: "Geist-400",
  medium: "Geist-500",
  semibold: "Geist-600",
  bold: "Geist-700",
  mono: "GeistMono-400",
  monoMedium: "GeistMono-500",
  monoSemibold: "GeistMono-600",
} as const;

// Liquid-glass design recipe — see docs/superpowers/specs/2026-05-30-liquid-glass-ruleset.md
export const glass = {
  tint: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.10)",
  sheen: "rgba(255,255,255,0.08)",
  hairline: "rgba(255,255,255,0.07)",
  blurIntensity: 60,
  radius: 22,
  radiusSm: 14,
} as const;

// 4pt spacing scale — the ONLY allowed spacing values (no arbitrary/half px).
export const space = {
  xs2: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

// Type scale — 6 steps, no half points.
export const type = {
  label: 10,
  bodySm: 12,
  body: 13,
  emph: 15,
  stat: 20,
  hero: 40,
} as const;

// Corner radii.
export const radius = {
  lg: 22,
  md: 14,
  pill: 999,
} as const;
