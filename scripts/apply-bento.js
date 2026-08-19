const fs = require("fs");

const cssPath = "apps/web/src/styles/index.css";
let cssContent = fs.readFileSync(cssPath, "utf-8");

const themeInlineInsert = `
  /* Bento Design System Tokens */
  --color-bento-canvas: rgb(var(--bento-bg));
  --color-bento-tile: rgb(var(--bento-tile));
  --color-bento-tile2: rgb(var(--bento-tile2));
  --color-bento-line: rgb(var(--bento-line));
  --color-bento-fg: rgb(var(--bento-fg));
  --color-bento-fg2: rgb(var(--bento-fg2));
  --color-bento-fg3: rgb(var(--bento-fg3));
  --color-bento-pos: rgb(var(--bento-pos));
  --color-bento-neg: rgb(var(--bento-neg));
  --color-bento-warn: rgb(var(--bento-warn));
  --color-bento-chrome: rgb(var(--bento-chrome));
  --color-bento-violet: rgb(var(--bento-violet));
  --color-bento-blue: rgb(var(--bento-blue));
  --color-bento-amber: rgb(var(--bento-amber));
  --color-bento-accent: #06B9EF;
  --color-bento-accent-ink: #11130A;
  --color-bento-accent-soft: #037FAB;

  --spacing-bento-xs: 6px;
  --spacing-bento-sm: 8px;
  --spacing-bento-screenX: 16px;
  --spacing-bento-tileGap: 10px;
  --spacing-bento-tilePad: 18px;
  --spacing-bento-tilePadLg: 20px;
  --spacing-bento-tilePadSm: 16px;
  --spacing-bento-boxPad: 14px;
  --spacing-bento-rowY: 12px;
  --spacing-bento-headerY: 14px;
  --spacing-bento-tabBarTop: 12px;
  --spacing-bento-tabBarBottom: 26px;

  --radius-bento-tile: 22px;
  --radius-bento-inner: 16px;
  --radius-bento-field: 14px;
  --radius-bento-icon: 13px;
  --radius-bento-btn: 12px;
  --radius-bento-logo: 18px;
  --radius-bento-rail: 4px;
  --radius-bento-bar: 3px;
  --radius-bento-pill: 999px;

  --text-bento-eyebrow: 10px;
  --text-bento-meta: 12px;
  --text-bento-body: 13px;
  --text-bento-row: 14px;
  --text-bento-emph: 15px;
  --text-bento-title: 19px;
  --text-bento-statSm: 22px;
  --text-bento-stat: 28px;
  --text-bento-hero: 48px;

  --tracking-bento-hero: -0.045em;
  --tracking-bento-tightest: -0.04em;
  --tracking-bento-tighter: -0.03em;
  --tracking-bento-tight: -0.02em;
  --tracking-bento-wide: 0.16em;
  --tracking-bento-wider: 0.18em;
`;

const darkVarsInsert = `
  /* Bento Tokens (Dark) */
  --bento-bg: 10 10 12;
  --bento-tile: 19 19 24;
  --bento-tile2: 26 26 33;
  --bento-line: 31 31 38;
  --bento-fg: 246 246 241;
  --bento-fg2: 158 158 164;
  --bento-fg3: 158 158 164;
  --bento-pos: 74 222 128;
  --bento-neg: 251 113 133;
  --bento-warn: 255 177 0;
  --bento-chrome: 23 23 28;
  --bento-violet: 221 174 255;
  --bento-blue: 130 174 248;
  --bento-amber: 254 138 62;
`;

const lightVarsInsert = `
  /* Bento Tokens (Light) */
  --bento-bg: 241 241 237;
  --bento-tile: 255 255 255;
  --bento-tile2: 247 247 243;
  --bento-line: 231 231 225;
  --bento-fg: 20 21 26;
  --bento-fg2: 95 96 103;
  --bento-fg3: 109 109 115;
  --bento-pos: 25 126 71;
  --bento-neg: 212 36 60;
  --bento-warn: 149 100 9;
  --bento-chrome: 255 255 255;
  --bento-violet: 120 61 189;
  --bento-blue: 36 111 214;
  --bento-amber: 187 74 7;
`;

if (!cssContent.includes("--color-bento-canvas")) {
  // Insert into @theme inline
  cssContent = cssContent.replace(
    /(@theme inline \{[^]*?)(^\})/m,
    "$1" + themeInlineInsert + "$2"
  );

  // Insert into dark theme
  cssContent = cssContent.replace(
    /(:root,\s*\n\[data-helm-theme="glass-dark"\]\s*\{[^]*?)(^\})/m,
    "$1" + darkVarsInsert + "$2"
  );

  // Insert into light theme
  cssContent = cssContent.replace(
    /(\[data-helm-theme="glass-light"\]\s*\{[^]*?)(^\})/m,
    "$1" + lightVarsInsert + "$2"
  );

  fs.writeFileSync(cssPath, cssContent);
  console.log("Tokens applied successfully!");
} else {
  console.log("Tokens already applied!");
}
