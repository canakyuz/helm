// global.css + tailwind.tokens.js dosyalarini @helm/design'dan uretir.
//
// NEDEN URETILIYOR: Tema/olcek degerleri iki yerde yasarsa kacinilmaz olarak
// birbirinden kayar. Tek kaynak packages/design/src/*; bu script onlarin
// Tailwind karsiliklarini yazar. tailwind.config.js bir .ts dosyasini require
// edemedigi icin olcek degerleri de duz JS olarak uretilir.
//
// Elle duzenleme — degisiklik icin packages/design'i duzenle, sonra:
//
//   bun run gen:design
//
// Renkler RGB kanal ucluleri olarak yazilir ("19 19 24"), hex degil — Tailwind'in
// alfa modifier'i (bg-tile/50) ancak bu formda calisir.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { nativewindVars } from "../../../packages/design/src/css.ts";
import { brand } from "../../../packages/design/src/palette.ts";
import { radius, space, type } from "../../../packages/design/src/scale.ts";

const here = dirname(fileURLToPath(import.meta.url));

const BANNER = `URETILMIS DOSYA — elle duzenleme.
   Kaynak: packages/design/src/
   Yeniden uret: bun run gen:design`;

// ---- global.css -------------------------------------------------------------

writeFileSync(
  join(here, "..", "global.css"),
  `@tailwind base;
@tailwind components;
@tailwind utilities;

/* ${BANNER} */

@layer base {
  :root {
${nativewindVars("light")}
  }

  .dark:root {
${nativewindVars("dark")}
  }
}
`,
  "utf8",
);

// ---- tailwind.tokens.js -----------------------------------------------------

// Tema-duyarli renkler CSS degiskeninden okunur; marka renkleri sabit hex.
const themed = ["bg", "tile", "tile2", "line", "fg", "fg2", "fg3", "pos", "neg", "warn", "chrome", "violet", "blue"];

const colors = {
  ...Object.fromEntries(themed.map((k) => [k, `rgb(var(--${k}) / <alpha-value>)`])),
  accent: brand.accent,
  "accent-ink": brand.accentInk,
  "accent-soft": brand.accentSoft,
};

const px = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v}px`]));

writeFileSync(
  join(here, "..", "tailwind.tokens.js"),
  `/* ${BANNER} */
module.exports = ${JSON.stringify({ colors, spacing: px(space), borderRadius: px(radius), fontSize: px(type) }, null, 2)};
`,
  "utf8",
);

console.log("global.css + tailwind.tokens.js yazildi");
