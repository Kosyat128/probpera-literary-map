import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export const BOOK_SCENE_PALETTE_SCHEMA_VERSION = 1;
export const bookScenePaletteRightsStatuses = new Set([
  "public-domain",
  "licensed",
  "permission",
  "editorial-original",
]);

const imageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function rgbToHsl({ r, g, b }) {
  const channels = [r, g, b].map((value) => value / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (!delta) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (maximum === channels[0]) hue = ((channels[1] - channels[2]) / delta) % 6;
  else if (maximum === channels[1]) hue = (channels[2] - channels[0]) / delta + 2;
  else hue = (channels[0] - channels[1]) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hue = (((h % 360) + 360) % 360) / 60;
  const segment = chroma * (1 - Math.abs((hue % 2) - 1));
  const [red, green, blue] =
    hue < 1
      ? [chroma, segment, 0]
      : hue < 2
        ? [segment, chroma, 0]
        : hue < 3
          ? [0, chroma, segment]
          : hue < 4
            ? [0, segment, chroma]
            : hue < 5
              ? [segment, 0, chroma]
              : [chroma, 0, segment];
  const match = l - chroma / 2;
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 };
}

function boundedColor(color, bounds) {
  const hsl = rgbToHsl(color);
  return hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s, bounds.minS ?? 0, bounds.maxS ?? 1),
    l: clamp(hsl.l, bounds.minL ?? 0, bounds.maxL ?? 1),
  });
}

function normalizeLocalCoverUrl(value) {
  const normalized = String(value || "").trim().replace(/^\/+/, "");
  if (
    !normalized ||
    /^(?:https?:|data:|blob:)/iu.test(normalized) ||
    normalized.includes("\\") ||
    normalized.split("/").includes("..") ||
    !imageExtensions.has(path.extname(normalized).toLocaleLowerCase("en"))
  ) {
    return "";
  }
  return normalized;
}

export function localCoverPath(projectRoot, coverUrl) {
  const normalized = normalizeLocalCoverUrl(coverUrl);
  if (!normalized) return null;
  const publicRoot = path.resolve(projectRoot, "public");
  const resolved = path.resolve(publicRoot, ...normalized.split("/"));
  return resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null;
}

function bucketPixels(data, channels) {
  const buckets = new Map();
  for (let offset = 0; offset < data.length; offset += channels) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const key = `${r >> 4}:${g >> 4}:${b >> 4}`;
    const current = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    current.count += 1;
    current.r += r;
    current.g += g;
    current.b += b;
    buckets.set(key, current);
  }
  return [...buckets.values()].map((bucket) => {
    const color = {
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count,
    };
    return { ...bucket, color, hsl: rgbToHsl(color) };
  });
}

function bestBucket(buckets, score, predicate = () => true) {
  const candidates = buckets.filter(predicate);
  return (candidates.length ? candidates : buckets).sort(
    (left, right) => score(right) - score(left)
  )[0];
}

export async function extractBookCoverPalette(filePath) {
  const { data, info } = await sharp(filePath, { failOn: "warning" })
    .rotate()
    .resize({ width: 96, height: 144, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels < 3 || !data.length) {
    throw new Error(`Cover palette source has no RGB pixels: ${filePath}`);
  }
  const buckets = bucketPixels(data, info.channels);
  const dominant = bestBucket(buckets, (bucket) => bucket.count * (1 + bucket.hsl.s * 0.2));
  const dark = bestBucket(
    buckets,
    (bucket) => bucket.count * (1.4 - bucket.hsl.l),
    (bucket) => bucket.hsl.l >= 0.04 && bucket.hsl.l <= 0.38
  );
  const light = bestBucket(
    buckets,
    (bucket) => bucket.count * (0.8 + bucket.hsl.l),
    (bucket) => bucket.hsl.l >= 0.62 && bucket.hsl.l <= 0.98
  );
  const accent = bestBucket(
    buckets,
    (bucket) => bucket.count * (0.5 + bucket.hsl.s * 3) * (1 - Math.abs(0.52 - bucket.hsl.l)),
    (bucket) => bucket.hsl.s >= 0.25 && bucket.hsl.l >= 0.2 && bucket.hsl.l <= 0.8
  );
  const warm = bestBucket(
    buckets,
    (bucket) => bucket.count * (0.5 + bucket.hsl.s * 2.5),
    (bucket) =>
      (bucket.hsl.h <= 75 || bucket.hsl.h >= 345) &&
      bucket.hsl.s >= 0.2 &&
      bucket.hsl.l >= 0.22 &&
      bucket.hsl.l <= 0.82
  );
  return {
    dominantColor: rgbToHex(dominant.color),
    darkColor: rgbToHex(
      boundedColor(dark.color, { minS: 0.06, maxS: 0.76, minL: 0.06, maxL: 0.3 })
    ),
    lightColor: rgbToHex(
      boundedColor(light.color, { minS: 0.04, maxS: 0.58, minL: 0.72, maxL: 0.94 })
    ),
    accentColor: rgbToHex(
      boundedColor(accent.color, { minS: 0.42, maxS: 0.9, minL: 0.38, maxL: 0.68 })
    ),
    warmColor: rgbToHex(
      boundedColor(warm.color, { minS: 0.32, maxS: 0.82, minL: 0.42, maxL: 0.72 })
    ),
  };
}

export async function buildBookSceneThemeManifest(projectRoot) {
  const auditPath = path.join(projectRoot, "reports", "cover-rights-audit.json");
  const auditBytes = await readFile(auditPath);
  const audit = JSON.parse(auditBytes.toString("utf8"));
  if (!Array.isArray(audit.covers) || typeof audit.generatedAt !== "string") {
    throw new Error("Cover-rights audit is missing or malformed.");
  }

  const eligibleByUrl = new Map();
  for (const cover of audit.covers) {
    const coverUrl = normalizeLocalCoverUrl(cover.coverUrl);
    if (
      !coverUrl ||
      cover.displayAllowed !== true ||
      !Array.isArray(cover.issues) ||
      cover.issues.length > 0 ||
      !bookScenePaletteRightsStatuses.has(cover.status)
    ) {
      continue;
    }
    const existing = eligibleByUrl.get(coverUrl);
    if (existing && existing.status !== cover.status) {
      throw new Error(`Conflicting rights status for ${coverUrl}.`);
    }
    eligibleByUrl.set(coverUrl, { coverUrl, status: cover.status });
  }

  const entries = [];
  for (const source of [...eligibleByUrl.values()].sort((left, right) =>
    left.coverUrl.localeCompare(right.coverUrl, "en")
  )) {
    const filePath = localCoverPath(projectRoot, source.coverUrl);
    if (!filePath) continue;
    let bytes;
    try {
      bytes = await readFile(filePath);
    } catch {
      throw new Error(`Rights-approved local cover is missing: ${source.coverUrl}`);
    }
    entries.push({
      coverUrl: source.coverUrl,
      coverSha256: sha256(bytes),
      rightsStatus: source.status,
      ...(await extractBookCoverPalette(filePath)),
    });
  }

  return {
    schemaVersion: BOOK_SCENE_PALETTE_SCHEMA_VERSION,
    generatedAt: audit.generatedAt,
    source: {
      audit: "reports/cover-rights-audit.json",
      auditSha256: sha256(auditBytes),
    },
    entries,
  };
}

export function serializeBookSceneThemeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
