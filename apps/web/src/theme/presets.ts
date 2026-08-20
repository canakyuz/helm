// helm tema sistemi - Flat (Kravio referansı), iki mod (light default + dark).
// Tek toggle ile geçiş. Yeni mod eklemek için: HELM_THEMES'e bir girdi +
// src/styles/index.css'e bir [data-helm-theme="..."] bloğu.

export type HelmMode = "dark" | "light";

export interface HelmTheme {
  key: string;
  label: string;
  mode: HelmMode;
  /** recharts grafiklerinin okuduğu palet (recharts string renk ister). */
  chart: {
    grid: string;
    axis: string;
    revenue: string;
    users: string;
  };
}

export const HELM_THEMES: HelmTheme[] = [
  {
    key: "glass-light",
    label: "Light",
    mode: "light",
    chart: {
      grid: "rgba(0,0,0,0.05)",
      axis: "#9a9ca3",
      revenue: "#16a34a",
      users: "#2563eb",
    },
  },
  {
    key: "glass-dark",
    label: "Dark",
    mode: "dark",
    chart: {
      grid: "rgba(255,255,255,0.07)",
      axis: "#6b7280",
      revenue: "#4ade80",
      users: "#60a5fa",
    },
  },
];

export const DEFAULT_THEME_KEY: string = "glass-light";

export const getTheme = (key: string): HelmTheme =>
  HELM_THEMES.find((t) => t.key === key) ?? HELM_THEMES[0];

/** Mod tersine çevir - Moon/Sun toggle için. */
export const otherKey = (key: string): string =>
  key === "glass-dark" ? "glass-light" : "glass-dark";
