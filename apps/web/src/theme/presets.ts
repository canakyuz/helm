import { theme as antdTheme, type ThemeConfig } from "antd";

// helm tema sistemi.
// Yeni tema eklemek = HELM_THEMES dizisine bir nesne eklemek. Başka değişiklik yok.

const { darkAlgorithm, defaultAlgorithm } = antdTheme;

export interface HelmTheme {
  key: string;
  label: string;
  isDark: boolean;
  /** Ant Design ConfigProvider'a beslenen tema. */
  config: ThemeConfig;
  /** recharts grafiklerinin okuduğu palet. */
  chart: {
    grid: string;
    axis: string;
    revenue: string;
    users: string;
  };
}

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const HELM_THEMES: HelmTheme[] = [
  {
    key: "glass",
    label: "Liquid Glass",
    isDark: true,
    config: {
      algorithm: darkAlgorithm,
      token: {
        colorPrimary: "#a3e635",
        colorInfo: "#a3e635",
        colorBgBase: "#07070a",
        borderRadius: 14,
        fontFamily: FONT,
        wireframe: false,
      },
    },
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
    config: {
      algorithm: darkAlgorithm,
      token: {
        colorPrimary: "#14b8a6",
        colorInfo: "#14b8a6",
        colorBgBase: "#0a0e0d",
        borderRadius: 8,
        fontFamily: FONT,
        wireframe: false,
      },
    },
    chart: {
      grid: "rgba(20,184,166,0.1)",
      axis: "#5b6b68",
      revenue: "#2dd4bf",
      users: "#22d3ee",
    },
  },
  {
    key: "helm-dark",
    label: "Helm Dark",
    isDark: true,
    config: {
      algorithm: darkAlgorithm,
      token: {
        colorPrimary: "#6366f1",
        colorInfo: "#6366f1",
        colorBgBase: "#0b0b0f",
        borderRadius: 10,
        fontFamily: FONT,
        wireframe: false,
      },
    },
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
    config: {
      algorithm: defaultAlgorithm,
      token: {
        colorPrimary: "#6366f1",
        colorInfo: "#6366f1",
        colorBgLayout: "#f5f5f7",
        borderRadius: 10,
        fontFamily: FONT,
        wireframe: false,
      },
    },
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
    config: {
      algorithm: darkAlgorithm,
      token: {
        colorPrimary: "#8b5cf6",
        colorInfo: "#8b5cf6",
        colorBgBase: "#0c0a14",
        borderRadius: 12,
        fontFamily: FONT,
        wireframe: false,
      },
    },
    chart: {
      grid: "rgba(168,139,250,0.1)",
      axis: "#7c7c93",
      revenue: "#34d399",
      users: "#a78bfa",
    },
  },
];

export const DEFAULT_THEME_KEY = "glass";

export const getTheme = (key: string): HelmTheme =>
  HELM_THEMES.find((t) => t.key === key) ?? HELM_THEMES[0];
