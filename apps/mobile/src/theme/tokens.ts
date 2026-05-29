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
  accent: "#D4FF4D",
  accentInk: "#11130A",
  accentSoft: "#A8CC3D",
  accentDanger: "#FF5C7A",
  accentWarn: "#FFB100",
  accentInfo: "#7AA8FF",
  accentViolet: "#B89CFF",
  green: "#57E08B",
  blue: "#7AA8FF",
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

// Liquid-glass design recipe (prototype: liquid.css :root)
export const glass = {
  tint: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.10)",
  sheen: "rgba(255,255,255,0.12)",
  hairline: "rgba(255,255,255,0.06)",
  blurIntensity: 60,
  radius: 28,
  radiusSm: 18,
  gap: 13,
} as const;
