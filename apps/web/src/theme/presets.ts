// helm tema sistemi.
// Yeni tema = HELM_THEMES'e bir girdi + src/styles/index.css'e bir
// [data-helm-theme="..."] bloğu. Başka değişiklik yok.

export interface HelmTheme {
  key: string;
  label: string;
  isDark: boolean;
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
    key: "glass",
    label: "Liquid Glass",
    isDark: true,
    chart: {
      grid: "rgba(255,255,255,0.07)",
      axis: "#6b7280",
      revenue: "#a3e635",
      users: "#38bdf8",
    },
  },
  {
    key: "terminal",
    label: "Terminal",
    isDark: true,
    chart: {
      grid: "rgba(20,184,166,0.12)",
      axis: "#5b6b68",
      revenue: "#2dd4bf",
      users: "#22d3ee",
    },
  },
  {
    key: "helm-dark",
    label: "Helm Dark",
    isDark: true,
    chart: {
      grid: "rgba(255,255,255,0.06)",
      axis: "#6b7280",
      revenue: "#10b981",
      users: "#818cf8",
    },
  },
  {
    key: "helm-light",
    label: "Helm Light",
    isDark: false,
    chart: {
      grid: "rgba(0,0,0,0.06)",
      axis: "#9ca3af",
      revenue: "#059669",
      users: "#6366f1",
    },
  },
  {
    key: "midnight",
    label: "Midnight",
    isDark: true,
    chart: {
      grid: "rgba(168,139,250,0.12)",
      axis: "#7c7c93",
      revenue: "#34d399",
      users: "#a78bfa",
    },
  },
];

export const DEFAULT_THEME_KEY = "glass";

export const getTheme = (key: string): HelmTheme =>
  HELM_THEMES.find((t) => t.key === key) ?? HELM_THEMES[0];
