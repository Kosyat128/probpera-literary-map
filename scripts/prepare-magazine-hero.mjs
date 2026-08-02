import path from "node:path";

import sharp from "sharp";

const [, , sourcePath, outputDirectory] = process.argv;

if (!sourcePath || !outputDirectory) {
  throw new Error(
    "Usage: node scripts/prepare-magazine-hero.mjs <source> <output-directory>"
  );
}

const image = sharp(sourcePath, { failOn: "warning" });
const metadata = await image.metadata();

if (!metadata.width || !metadata.height) {
  throw new Error("The source image has no readable dimensions");
}

await image
  .clone()
  .resize({ width: 1920, withoutEnlargement: true })
  .webp({ quality: 86, effort: 6, smartSubsample: true })
  .toFile(path.join(outputDirectory, "magazine-hero-wide.webp"));

await image
  .clone()
  .extract({
    left: Math.max(0, Math.min(metadata.width - 682, 875)),
    top: 0,
    width: Math.min(682, metadata.width),
    height: metadata.height,
  })
  .resize(768, 1024, { fit: "cover" })
  .webp({ quality: 84, effort: 6, smartSubsample: true })
  .toFile(path.join(outputDirectory, "magazine-hero-mobile.webp"));

console.log(
  JSON.stringify({
    source: { width: metadata.width, height: metadata.height },
    outputs: ["magazine-hero-wide.webp", "magazine-hero-mobile.webp"],
  })
);
