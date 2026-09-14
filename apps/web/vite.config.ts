import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // NEDEN: modul yollarindan turetilen varsayilan chunk adi (ornegin
        // "social-<hash>.js") icerik engelleyicilerin (adblock/privacy) "social"
        // desenini eslestirmesine yol aciyor - bu ise Integrations sayfasini
        // TUM saglayicilar icin kirar (bkz. I3). Hash-only ad bu esleseni ortadan
        // kaldirir.
        chunkFileNames: "assets/[hash].js",
      },
    },
  },
});
