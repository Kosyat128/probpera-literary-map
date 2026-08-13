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

await Promise.all([
  image
    .clone()
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDirectory, "magazine-hero-wide.webp")),
  image
    .clone()
    .resize({ width: 1920, withoutEnlargement: true })
    .avif({ quality: 63, effort: 7, chromaSubsampling: "4:2:0" })
    .toFile(path.join(outputDirectory, "magazine-hero-wide.avif")),
  // The mobile derivative preserves the complete 2:1 composition. Layout
  // uses object-fit: contain, so this smaller file saves bytes without ever
  // cropping the landscape, animals, books, or tree from the supplied image.
  image
    .clone()
    .resize({ width: 960, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDirectory, "magazine-hero-mobile.webp")),
  image
    .clone()
    .resize({ width: 960, withoutEnlargement: true })
    .avif({ quality: 60, effort: 7, chromaSubsampling: "4:2:0" })
    .toFile(path.join(outputDirectory, "magazine-hero-mobile.avif")),
]);

console.log(
  JSON.stringify({
    source: { width: metadata.width, height: metadata.height },
    outputs: [
      "magazine-hero-wide.webp",
      "magazine-hero-wide.avif",
      "magazine-hero-mobile.webp",
      "magazine-hero-mobile.avif",
    ],
  })
);
