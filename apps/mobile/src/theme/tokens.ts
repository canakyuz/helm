// Tailwind config ile birebir senkron — runtime/inline kullanım için aynı palet.

export const colors = {
  bgBase: "#08080A",
  bgSurface: "#0E0E12",
  bgElevated: "#15151B",
  bgHigher: "#1C1C24",
  fgPrimary: "#F5F5F0",
  fgSecondary: "#C8C8BC",
  fgMuted: "#7A7A82",
  fgSubtle: "#46464E",
  border: "#1C1C24",
  borderStrong: "#2A2A33",
  borderGlow: "#3A3A46",
  accent: "#D4FF4D",
  accentSoft: "#A8CC3D",
  accentDanger: "#FF5C7A",
  accentWarn: "#FFB100",
  accentInfo: "#7AA8FF",
  accentViolet: "#B89CFF",
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
