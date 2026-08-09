import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error(
    "Pass the extracted Natural Earth I NE1_LR_LC_SR_W.tif as the first argument."
  );
}

const outputPath = path.join(
  repositoryRoot,
  "scripts",
  "assets",
  "natural-earth-i-relief-source.webp"
);
const metadata = await sharp(sourcePath, {
  failOn: "warning",
  limitInputPixels: false,
}).metadata();

if (!metadata.width || !metadata.height || metadata.width / metadata.height !== 2) {
  throw new Error(
    `Natural Earth I source must use a 2:1 equirectangular projection; received ${metadata.width}x${metadata.height}.`
  );
}

await mkdir(path.dirname(outputPath), { recursive: true });
const result = await sharp(sourcePath, {
  failOn: "warning",
  limitInputPixels: false,
})
  .resize(4096, 2048, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .sharpen({ sigma: 0.38, m1: 0.32, m2: 0.74 })
  .webp({ quality: 92, effort: 6, smartSubsample: true })
  .toFile(outputPath);

console.log(
  `Prepared ${path.relative(repositoryRoot, outputPath)} from ${metadata.width}x${metadata.height} ` +
    `Natural Earth I (${result.size} bytes).`
);
