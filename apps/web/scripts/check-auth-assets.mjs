import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const variants = [
  ["light", "avif", 280 * 1024],
  ["light", "webp", 420 * 1024],
  ["dark", "avif", 280 * 1024],
  ["dark", "webp", 420 * 1024],
];

for (const [theme, format, byteLimit] of variants) {
  const filePath = resolve(`public/auth/cockpit-${theme}.${format}`);
  const [{ size }, metadata] = await Promise.all([stat(filePath), sharp(filePath).metadata()]);

  if (size > byteLimit) throw new Error(`${filePath}: ${size} > ${byteLimit} byte`);
  if (metadata.width !== 1800 || metadata.height !== 1200) {
    throw new Error(`${filePath}: beklenen ölçü 1800x1200`);
  }
}

console.info("Auth asset bütçesi doğrulandı.");
