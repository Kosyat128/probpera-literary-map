import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  projectRoot,
  "src",
  "assets",
  "brand",
  "brush-paper-corners.webp"
);
const outputDirectory = path.join(projectRoot, "public", "brand");

const { data, info } = await sharp(sourcePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = Buffer.alloc(data.length);
for (let offset = 0; offset < data.length; offset += 4) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const saturation = maximum ? (maximum - minimum) / maximum : 0;
  const isViolet = blue > red * 1.04 && blue > green * 1.12 && saturation > 0.18;
  const isOrange = red > blue * 1.35 && red > green * 1.04 && saturation > 0.22;

  if (!isViolet && !isOrange) continue;

  const strength = Math.max(
    0,
    Math.min(1, (saturation - (isViolet ? 0.14 : 0.18)) / 0.42)
  );
  if (isViolet) {
    pixels[offset] = 255;
    pixels[offset + 1] = 252;
    pixels[offset + 2] = 246;
  } else {
    pixels[offset] = 255;
    pixels[offset + 1] = 113;
    pixels[offset + 2] = 18;
  }
  pixels[offset + 3] = Math.round(235 * strength);
}

await fs.mkdir(outputDirectory, { recursive: true });
const layer = sharp(pixels, {
  raw: { width: info.width, height: info.height, channels: 4 },
});
await layer
  .clone()
  .webp({ quality: 88, alphaQuality: 92, effort: 5 })
  .toFile(path.join(outputDirectory, "atlas-side-brushes.webp"));

const whiteBrushWide = await layer
  .clone()
  .extract({ left: 0, top: 0, width: 950, height: 480 })
  .resize({ width: 520 })
  .png()
  .toBuffer();
const orangeBrushWide = await layer
  .clone()
  .extract({ left: 900, top: 250, width: info.width - 900, height: info.height - 250 })
  .resize({ width: 560 })
  .png()
  .toBuffer();
const whiteBrush = await sharp(whiteBrushWide)
  .extract({ left: 155, top: 0, width: 365, height: 263 })
  .png()
  .toBuffer();
const orangeBrush = await sharp(orangeBrushWide)
  .extract({ left: 0, top: 0, width: 355, height: 312 })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 390,
    height: 760,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([
    { input: whiteBrush, left: 0, top: 5 },
    { input: orangeBrush, left: 35, top: 390 },
  ])
  .webp({ quality: 88, alphaQuality: 92, effort: 5 })
  .toFile(path.join(outputDirectory, "atlas-side-brushes-mobile.webp"));

console.log(`Prepared atlas brush overlays from ${info.width}x${info.height} source.`);
