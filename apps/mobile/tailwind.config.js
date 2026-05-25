/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Founder's Bridge — koyu karbon, sıcak kremimsi yazı, electric lime accent.
        bg: {
          base: "#08080A",       // gece carbon
          surface: "#0E0E12",    // panel
          elevated: "#15151B",   // raised card / tile
          higher: "#1C1C24",     // hover / selected
        },
        fg: {
          primary: "#F5F5F0",    // warm cream — yumuşak white
          secondary: "#C8C8BC",
          muted: "#7A7A82",
          subtle: "#46464E",
        },
        border: {
          DEFAULT: "#1C1C24",
          strong: "#2A2A33",
          glow: "#3A3A46",
        },
        accent: {
          DEFAULT: "#D4FF4D",    // electric lime — hero accent
          soft: "#A8CC3D",
          danger: "#FF5C7A",     // coral, kırmızıdan daha refined
          warn: "#FFB100",       // amber
          info: "#7AA8FF",       // sky
          violet: "#B89CFF",     // tertiary accent
        },
      },
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
