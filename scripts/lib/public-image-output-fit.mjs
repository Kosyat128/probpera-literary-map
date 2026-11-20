import sharp from "sharp";

const maxHeight = 8192;
const maxRetries = 3;

function encode(bytes, bounds, quality) {
  return sharp(bytes, { limitInputPixels: false }).rotate()
    .resize({ ...bounds, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
}

function scaledBounds({ width, height }, scale) {
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

export async function encodePublicRasterRendition(bytes, width, maxFileBytes) {
  const originalBounds = { width, height: maxHeight };
  let quality = 90;
  let retries = maxRetries;
  let oversized = await encode(bytes, originalBounds, quality);
  if (oversized.data.length <= maxFileBytes) return oversized;

  // A modest reduction in quality can keep the full resolution of near-limit images.
  if (oversized.data.length <= maxFileBytes * 1.23) {
    quality = 85;
    retries--;
    oversized = await encode(bytes, originalBounds, quality);
    if (oversized.data.length <= maxFileBytes) return { ...oversized, fitted: true };
  }

  while (retries > 0) {
    retries--;
    const scale = Math.min(0.98, Math.sqrt(maxFileBytes / oversized.data.length) * (retries ? 0.99 : 0.90));
    const candidate = await encode(bytes, scaledBounds(oversized.info, scale), quality);
    if (candidate.data.length > maxFileBytes) {
      oversized = candidate;
      continue;
    }

    // Downsampling can cut more data than predicted. Use the remaining headroom to recover detail.
    const growth = 0.98 * Math.min(
      Math.sqrt(maxFileBytes / candidate.data.length),
      Math.max(oversized.info.width, oversized.info.height) / Math.max(candidate.info.width, candidate.info.height),
    );
    if (retries && growth >= 1.06) {
      const larger = await encode(bytes, scaledBounds(candidate.info, growth), quality);
      if (larger.data.length <= maxFileBytes) return { ...larger, fitted: true };
    }
    return { ...candidate, fitted: true };
  }

  throw new Error(`Could not fit the public image within ${maxFileBytes} bytes (last attempt: ${oversized.data.length} bytes)`);
}
