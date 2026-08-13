import path from "node:path";

import sharp from "sharp";

const [, , sourcePath, outputDirectory, mobileSourcePath = sourcePath] = process.argv;

if (!sourcePath || !outputDirectory) {
  throw new Error(
    "Usage: node scripts/prepare-magazine-hero.mjs <desktop-source> <output-directory> [mobile-source]"
  );
}

const image = sharp(sourcePath, { failOn: "warning" });
const metadata = await image.metadata();
const mobileImage = sharp(mobileSourcePath, { failOn: "warning" });
const mobileMetadata = await mobileImage.metadata();

if (
  !metadata.width ||
  !metadata.height ||
  !mobileMetadata.width ||
  !mobileMetadata.height
) {
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
  // Mobile uses the separate portrait composition supplied for the small
  // viewport. The original framing is preserved here; CSS performs only the
  // slight responsive edge crop needed to fill each phone screen.
  mobileImage
    .clone()
    .resize({ width: 960, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDirectory, "magazine-hero-mobile.webp")),
  mobileImage
    .clone()
    .resize({ width: 960, withoutEnlargement: true })
    .avif({ quality: 60, effort: 7, chromaSubsampling: "4:2:0" })
    .toFile(path.join(outputDirectory, "magazine-hero-mobile.avif")),
]);

console.log(
  JSON.stringify({
    source: { width: metadata.width, height: metadata.height },
    mobileSource: {
      width: mobileMetadata.width,
      height: mobileMetadata.height,
    },
    outputs: [
      "magazine-hero-wide.webp",
      "magazine-hero-wide.avif",
      "magazine-hero-mobile.webp",
      "magazine-hero-mobile.avif",
    ],
  })
);
