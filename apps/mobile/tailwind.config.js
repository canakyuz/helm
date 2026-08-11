const bento = require("./tailwind.tokens.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Tema .dark sinifiyla degisir; renkler global.css'teki CSS degiskenlerinden
  // okunur. Boylece `bg-tile` TEK classname olarak iki temada da dogru cozulur
  // ve CLAUDE.md §7'nin "inline style yasak" kurali korunur.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- Bento sistemi (uretilmis: tailwind.tokens.js) ---
        ...bento.colors,

        // --- Liquid Glass paleti — GECIS DONEMI ---
        // Henuz bento'ya cevrilmemis ekranlar bu adlari kullaniyor. Son ekran
        // cevrildiginde bu blok silinecek. Yeni kodda KULLANMA.
        "bg-base": "#08080A",
        "bg-surface": "#0E0E12",
        "bg-elevated": "#15151B",
        "bg-higher": "#1C1C24",
        "fg-primary": "#F5F5F0",
        "fg-secondary": "#C8C8BC",
        "fg-muted": "#7A7A82",
        "fg-subtle": "#46464E",
        "accent-danger": "#FF5C7A",
        "accent-warn": "#FFB100",
        "accent-info": "#7AA8FF",
        "accent-violet": "#B89CFF",
        border: {
          DEFAULT: "#1C1C24",
          strong: "#2A2A33",
          glow: "#3A3A46",
        },
      },
      spacing: bento.spacing,
      borderRadius: bento.borderRadius,
      fontSize: bento.fontSize,
      fontFamily: {
        sans: ["Geist-400", "System"],
        medium: ["Geist-500", "System"],
        semibold: ["Geist-600", "System"],
        bold: ["Geist-700", "System"],
        mono: ["GeistMono-400", "Menlo"],
        "mono-medium": ["GeistMono-500", "Menlo"],
        "mono-semibold": ["GeistMono-600", "Menlo"],
      },
      letterSpacing: {
        widest: "0.18em",
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
