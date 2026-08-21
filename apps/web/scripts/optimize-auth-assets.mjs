import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const [masterPath, theme] = process.argv.slice(2);
const themes = new Set(["light", "dark"]);

if (!masterPath || !themes.has(theme)) {
  throw new Error("Kullanım: bun run assets:auth <master-path> <light|dark>");
}

const outputDirectory = resolve("public/auth");
const outputStem = resolve(outputDirectory, `cockpit-${theme}`);
const baseImage = sharp(resolve(masterPath)).resize(1800, 1200, {
  fit: "cover",
  position: "attention",
});

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  baseImage.clone().avif({ quality: 58, effort: 6 }).toFile(`${outputStem}.avif`),
  baseImage.clone().webp({ quality: 76, smartSubsample: true }).toFile(`${outputStem}.webp`),
]);
