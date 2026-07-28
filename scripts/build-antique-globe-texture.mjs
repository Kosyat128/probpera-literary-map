import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath =
  process.argv[2] ??
  path.join(repositoryRoot, "scripts", "assets", "rand-mcnally-globe-gores-1887.jpg");
const outputDirectory = path.join(repositoryRoot, "public", "textures");
const outputWidth = 3072;
const outputHeight = 1536;

const { data: source, info } = await sharp(sourcePath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const output = Buffer.allocUnsafe(outputWidth * outputHeight * 3);
const referenceScaleX = info.width / 3076;
const referenceScaleY = info.height / 1503;
const firstGoreCenter = 260 * referenceScaleX;
const goreSpacing = 237.55 * referenceScaleX;
const equatorHalfWidth = 116.2 * referenceScaleX;
const northPoleY = 47 * referenceScaleY;
const southPoleY = 1457 * referenceScaleY;

function sourcePixel(x, y, channel) {
  const safeX = Math.max(0, Math.min(info.width - 1, x));
  const safeY = Math.max(0, Math.min(info.height - 1, y));
  return source[(safeY * info.width + safeX) * 3 + channel];
}

function sampleBilinear(x, y, channel) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(info.width - 1, x0 + 1);
  const y1 = Math.min(info.height - 1, y0 + 1);
  const xBlend = x - x0;
  const yBlend = y - y0;
  const top =
    sourcePixel(x0, y0, channel) * (1 - xBlend) +
    sourcePixel(x1, y0, channel) * xBlend;
  const bottom =
    sourcePixel(x0, y1, channel) * (1 - xBlend) +
    sourcePixel(x1, y1, channel) * xBlend;
  return Math.round(top * (1 - yBlend) + bottom * yBlend);
}

for (let y = 0; y < outputHeight; y += 1) {
  const latitude = 90 - ((y + 0.5) / outputHeight) * 180;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const sourceY =
    northPoleY + ((90 - latitude) / 180) * (southPoleY - northPoleY);
  const halfWidthAtLatitude = Math.max(
    0.28,
    equatorHalfWidth * Math.cos(latitudeRadians)
  );

  for (let x = 0; x < outputWidth; x += 1) {
    const longitude = ((x + 0.5) / outputWidth) * 360 - 180;
    const targetGore = Math.min(11, Math.floor((longitude + 180) / 30));
    const targetCenterLongitude = -165 + targetGore * 30;
    const relativeLongitude = longitude - targetCenterLongitude;

    // The scanned sheet starts at 15°E and continues eastward. The texture
    // starts at 180°W, so the first six scanned gores move to the second half.
    const sourceGore = (targetGore + 6) % 12;
    const sourceCenterX = firstGoreCenter + sourceGore * goreSpacing;
    const sourceX =
      sourceCenterX + (relativeLongitude / 15) * halfWidthAtLatitude;
    const outputIndex = (y * outputWidth + x) * 3;

    output[outputIndex] = sampleBilinear(sourceX, sourceY, 0);
    output[outputIndex + 1] = sampleBilinear(sourceX, sourceY, 1);
    output[outputIndex + 2] = sampleBilinear(sourceX, sourceY, 2);
  }
}

await mkdir(outputDirectory, { recursive: true });

const texture = sharp(output, {
  raw: {
    width: outputWidth,
    height: outputHeight,
    channels: 3,
  },
})
  .recomb([
    [1.04, 0.035, 0.0],
    [0.025, 0.96, 0.0],
    [0.025, 0.075, 0.79],
  ])
  .modulate({ brightness: 0.94, saturation: 0.9 });

await Promise.all([
  texture
    .clone()
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDirectory, "antique-world-1887.webp")),
  texture
    .clone()
    .resize(1536, 768, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 78, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDirectory, "antique-world-1887-mobile.webp")),
]);

console.log(
  `Built museum globe textures from ${path.relative(repositoryRoot, sourcePath)}.`
);
