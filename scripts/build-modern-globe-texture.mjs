import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const atlasPath = path.join(
  repositoryRoot,
  "src",
  "data",
  "geo",
  "countries.geojson"
);
const atlasProvenancePath = path.join(
  repositoryRoot,
  "src",
  "data",
  "geo",
  "countries.provenance.json"
);
const terrainSourcePath = path.join(
  repositoryRoot,
  "scripts",
  "assets",
  "natural-earth-i-relief-source.webp"
);
const outputDirectory = path.join(repositoryRoot, "public", "textures");
const width = 4096;
const height = 2048;
const mobileWidth = 2048;
const mobileHeight = 1024;
const locales = ["ru", "en"];
const labelProfiles = {
  desktop: {
    width,
    height,
    maxRank: 3,
    fontSizes: { 2: 34, 3: 28 },
    strokeWidth: 2.5,
    oceanFontSize: 29,
    oceanStrokeWidth: 2.1,
  },
  mobile: {
    width: mobileWidth,
    height: mobileHeight,
    maxRank: 2,
    fontSizes: { 2: 18 },
    strokeWidth: 1.45,
    oceanFontSize: 15,
    oceanStrokeWidth: 1.2,
  },
};
const oceanLabels = [
  { longitude: -145, latitude: -8, ru: "Тихий океан", en: "Pacific Ocean" },
  { longitude: -32, latitude: 5, ru: "Атлантический океан", en: "Atlantic Ocean" },
  { longitude: 79, latitude: -26, ru: "Индийский океан", en: "Indian Ocean" },
  { longitude: 5, latitude: 77, ru: "Северный Ледовитый океан", en: "Arctic Ocean" },
  { longitude: 8, latitude: -61, ru: "Южный океан", en: "Southern Ocean" },
];
const countryLabelOverrides = {
  CHN: { ru: "Китай", en: "China" },
  COD: { ru: "ДР Конго", en: "DR Congo" },
  USA: { ru: "США", en: "United States" },
};
const palette = [
  "#d4df86",
  "#9fd08d",
  "#e7c36f",
  "#d7976b",
  "#84c5aa",
  "#b7acd0",
  "#b6d27e",
  "#7fb9c5",
  "#e3b36c",
  "#a8c68b",
  "#c49fc1",
  "#8fc4a0",
  "#d5cc7b",
];

const [atlas, provenance, terrainSourceBytes] = await Promise.all([
  readFile(atlasPath, "utf8").then(JSON.parse),
  readFile(atlasProvenancePath, "utf8").then(JSON.parse),
  readFile(terrainSourcePath),
]);
const terrainSourceSha256 = createHash("sha256")
  .update(terrainSourceBytes)
  .digest("hex")
  .toUpperCase();
if (terrainSourceSha256 !== provenance.rasterBase?.preparedSourceSha256) {
  throw new Error(
    "Tracked Natural Earth relief does not match its provenance checksum."
  );
}
for (const [index, feature] of atlas.features.entries()) {
  for (const field of [
    "NAME_RU",
    "NAME_EN",
    "LABEL_X",
    "LABEL_Y",
    "LABELRANK",
    "scalerank",
  ]) {
    if (!Object.hasOwn(feature.properties ?? {}, field)) {
      throw new Error(`Atlas feature ${index} is missing ${field}.`);
    }
  }
}

function unwrapRing(ring) {
  if (ring.length < 2) return ring;
  const result = [[ring[0][0], ring[0][1]]];
  let previous = ring[0][0];

  for (let index = 1; index < ring.length; index += 1) {
    let [longitude, latitude] = ring[index];
    while (longitude - previous > 180) longitude -= 360;
    while (longitude - previous < -180) longitude += 360;
    result.push([longitude, latitude]);
    previous = longitude;
  }

  return result;
}

function ringPath(ring, horizontalShift = 0) {
  return unwrapRing(ring)
    .map(([longitude, latitude], index) => {
      const x = ((longitude + 180) / 360) * width + horizontalShift;
      const y = ((90 - latitude) / 180) * height;
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function geometryPath(feature) {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  return polygons
    .flatMap((polygon) =>
      [-width, 0, width].flatMap((shift) =>
        polygon.map((ring) => ringPath(ring, shift))
      )
    )
    .join(" ");
}

function longitudeX(longitude) {
  return ((longitude + 180) / 360) * width;
}

function latitudeY(latitude) {
  return ((90 - latitude) / 180) * height;
}

function textureX(longitude, textureWidth) {
  return ((longitude + 180) / 360) * textureWidth;
}

function textureY(latitude, textureHeight) {
  return ((90 - latitude) / 180) * textureHeight;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function approximateFeatureArea(feature) {
  const [west, south, east, north] = feature.bbox ?? [0, 0, 0, 0];
  let longitudeSpan = Math.abs(east - west);
  if (longitudeSpan > 180) longitudeSpan = 360 - longitudeSpan;
  const latitudeSpan = Math.abs(north - south);
  const midLatitude = ((north + south) / 2) * (Math.PI / 180);
  return longitudeSpan * latitudeSpan * Math.max(0.2, Math.cos(midLatitude));
}

function wrapLabel(value, maxCharacters) {
  if (value.length <= maxCharacters || !value.includes(" ")) return [value];
  const words = value.split(/\s+/u);
  let bestIndex = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const first = words.slice(0, index).join(" ").length;
    const second = words.slice(index).join(" ").length;
    const difference = Math.abs(first - second);
    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  }
  return [words.slice(0, bestIndex).join(" "), words.slice(bestIndex).join(" ")];
}

function characterWidth(character) {
  if (character === " ") return 0.34;
  if (/[MWЖШЩЮФ]/u.test(character)) return 0.82;
  if (/[ilI1.,'’]/u.test(character)) return 0.3;
  return 0.59;
}

function estimatedLineWidth(value, fontSize) {
  return [...value].reduce(
    (total, character) => total + characterWidth(character) * fontSize,
    0
  );
}

function boxesOverlap(first, second) {
  return !(
    first.right <= second.left ||
    first.left >= second.right ||
    first.bottom <= second.top ||
    first.top >= second.bottom
  );
}

function countryLabelPlacements(locale, profile) {
  const occupied = [];
  const placements = [];
  const candidates = atlas.features
    .filter((feature) => {
      const rank = Number(feature.properties?.LABELRANK);
      const scaleRank = Number(feature.properties?.scalerank);
      return rank <= profile.maxRank && scaleRank <= 1;
    })
    .sort((first, second) => {
      const rankDifference =
        Number(first.properties.LABELRANK) - Number(second.properties.LABELRANK);
      return rankDifference || approximateFeatureArea(second) - approximateFeatureArea(first);
    });

  for (const feature of candidates) {
    const rank = Number(feature.properties.LABELRANK);
    const rawText = String(
      countryLabelOverrides[feature.properties.ADM0_A3]?.[locale] ??
        (locale === "ru" ? feature.properties.NAME_RU : feature.properties.NAME_EN)
    ).trim();
    if (!rawText) continue;
    const fontSize = profile.fontSizes[rank];
    const lines = wrapLabel(rawText, locale === "ru" ? 19 : 21);
    const lineHeight = fontSize * 1.02;
    const textWidth = Math.max(
      ...lines.map((line) => estimatedLineWidth(line, fontSize))
    );
    const textHeight = lineHeight * lines.length;
    const horizontalMargin = textWidth / 2 + fontSize * 0.32;
    const x = Math.max(
      horizontalMargin,
      Math.min(
        profile.width - horizontalMargin,
        textureX(Number(feature.properties.LABEL_X), profile.width)
      )
    );
    const y = textureY(Number(feature.properties.LABEL_Y), profile.height);
    const box = {
      left: x - textWidth / 2 - fontSize * 0.32,
      right: x + textWidth / 2 + fontSize * 0.32,
      top: y - textHeight / 2 - fontSize * 0.22,
      bottom: y + textHeight / 2 + fontSize * 0.22,
    };
    if (occupied.some((accepted) => boxesOverlap(box, accepted))) {
      continue;
    }
    occupied.push(box);
    placements.push({ x, y, lines, fontSize, lineHeight, rank });
  }

  return placements;
}

function textElement({
  x,
  y,
  lines,
  fontSize,
  lineHeight,
  fill,
  stroke,
  strokeOpacity,
  strokeWidth,
  fontWeight,
  letterSpacing = 0,
  fontStyle = "normal",
}) {
  const firstOffset = -((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${x.toFixed(2)}" dy="${index ? lineHeight.toFixed(2) : firstOffset.toFixed(2)}">` +
        `${escapeXml(line)}</tspan>`
    )
    .join("");
  return (
    `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" ` +
    `dominant-baseline="central" font-family="Arial, DejaVu Sans, sans-serif" ` +
    `font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}" ` +
    `letter-spacing="${letterSpacing}" fill="${fill}" stroke="${stroke}" ` +
    `stroke-opacity="${strokeOpacity}" stroke-width="${strokeWidth}" ` +
    `stroke-linejoin="round" paint-order="stroke fill">${tspans}</text>`
  );
}

function labelSvg(locale, profile) {
  const countries = countryLabelPlacements(locale, profile);
  const oceans = oceanLabels.map((label) =>
    textElement({
      x: textureX(label.longitude, profile.width),
      y: textureY(label.latitude, profile.height),
      lines: [label[locale].toLocaleUpperCase(locale)],
      fontSize: profile.oceanFontSize,
      lineHeight: profile.oceanFontSize,
      fill: "#d8f0f4",
      stroke: "#07506f",
      strokeOpacity: 0.72,
      strokeWidth: profile.oceanStrokeWidth,
      fontWeight: 600,
      letterSpacing: profile.oceanFontSize * 0.075,
      fontStyle: "italic",
    })
  );
  const countryText = countries.map((label) =>
    textElement({
      ...label,
      fill: label.rank === 2 ? "#082f3d" : "#123b48",
      stroke: "#f2f7ee",
      strokeOpacity: 0.86,
      strokeWidth: profile.strokeWidth,
      fontWeight: 700,
    })
  );

  return {
    count: countries.length,
    svg: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${profile.width}" ` +
        `height="${profile.height}" viewBox="0 0 ${profile.width} ${profile.height}">` +
        `<g opacity="0.62">${oceans.join("")}</g>` +
        `<g>${countryText.join("")}</g></svg>`
    ),
  };
}

const graticule = [];
for (let longitude = -150; longitude <= 150; longitude += 30) {
  const major = longitude % 90 === 0;
  graticule.push(
    `<line x1="${longitudeX(longitude)}" y1="0" x2="${longitudeX(longitude)}" y2="${height}" ` +
      `stroke="${major ? "#315c78" : "#2f607e"}" stroke-opacity="${major ? 0.26 : 0.14}" ` +
      `stroke-width="${major ? 1.16 : 0.82}"/>`
  );
}
for (let latitude = -60; latitude <= 60; latitude += 30) {
  const major = latitude % 90 === 0;
  graticule.push(
    `<line x1="0" y1="${latitudeY(latitude)}" x2="${width}" y2="${latitudeY(latitude)}" ` +
      `stroke="${major ? "#315c78" : "#2f607e"}" stroke-opacity="${major ? 0.26 : 0.14}" ` +
      `stroke-width="${major ? 1.16 : 0.82}"/>`
  );
}

const latitudeGuides = [-66.562, -23.436, 23.436, 66.562]
  .map(
    (latitude) =>
      `<line x1="0" y1="${latitudeY(latitude)}" x2="${width}" y2="${latitudeY(latitude)}" ` +
      'stroke="#456f83" stroke-opacity="0.18" stroke-width="0.82" stroke-dasharray="10 9"/>'
  )
  .join("");

const countries = atlas.features
  .map((feature, index) => {
    const mapColor = Number(feature.properties?.MAPCOLOR13);
    const paletteIndex = Number.isFinite(mapColor) && mapColor > 0
      ? Math.floor(mapColor) - 1
      : index;
    const fill = palette[((paletteIndex % palette.length) + palette.length) % palette.length];
    return (
      `<path d="${geometryPath(feature)}" fill="${fill}" fill-opacity="0.13" fill-rule="evenodd" ` +
      'stroke="#294c64" stroke-opacity="0.78" stroke-width="1.55" ' +
      'stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
    );
  })
  .join("");

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
  viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="finish" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#082d46" stop-opacity="0.04"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#06273d" stop-opacity="0.08"/>
    </linearGradient>
    <radialGradient id="light" cx="44%" cy="34%" r="72%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.055"/>
      <stop offset="0.62" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#05263b" stop-opacity="0.12"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#finish)"/>
  <g>${graticule.join("")}</g>
  <line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}"
    stroke="#b5483e" stroke-opacity="0.54" stroke-width="1.4"/>
  <line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}"
    stroke="#365a70" stroke-opacity="0.34" stroke-width="1.05"/>
  <g>${latitudeGuides}</g>
  <g>${countries}</g>
  <rect width="${width}" height="${height}" fill="url(#light)"/>
</svg>`);

await mkdir(outputDirectory, { recursive: true });

const terrainSource = await sharp(terrainSourceBytes, {
  failOn: "warning",
  limitInputPixels: false,
})
  .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .modulate({ brightness: 0.86, saturation: 1.5 })
  .linear(1.08, -8)
  .toBuffer();

const desktopBase = await sharp(terrainSource, { limitInputPixels: false })
  .composite([{ input: svg, blend: "over" }])
  .removeAlpha()
  .sharpen({ sigma: 0.42, m1: 0.35, m2: 0.8 })
  .png({ compressionLevel: 6 })
  .toBuffer();

const mobileBase = await sharp(desktopBase, { limitInputPixels: false })
  .resize(mobileWidth, mobileHeight, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  })
  .sharpen({ sigma: 0.35, m1: 0.3, m2: 0.72 })
  .png({ compressionLevel: 6 })
  .toBuffer();

const renderedTextures = await Promise.all(
  locales.flatMap((locale) =>
    Object.entries(labelProfiles).map(async ([variant, profile]) => {
      const labels = labelSvg(locale, profile);
      const mobile = variant === "mobile";
      const filename = `modern-atlas-2026-${locale}${mobile ? "-mobile" : ""}.webp`;
      const result = await sharp(mobile ? mobileBase : desktopBase, {
        limitInputPixels: false,
      })
        .composite([{ input: labels.svg, blend: "over" }])
        .removeAlpha()
        .webp({
          quality: mobile ? 90 : 93,
          effort: 6,
          smartSubsample: true,
        })
        .toFile(path.join(outputDirectory, filename));
      return {
        path: `/textures/${filename}`,
        width: profile.width,
        height: profile.height,
        bytes: result.size,
        locale,
        density: variant,
        countryLabelCount: labels.count,
      };
    })
  )
);

const assetRecords = await Promise.all(
  renderedTextures.map(async (asset) => {
    const bytes = await readFile(
      path.join(outputDirectory, asset.path.replace("/textures/", ""))
    );
    return {
      ...asset,
      sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    };
  })
);

provenance.renderedAssets = assetRecords;
provenance.labels = {
  ...provenance.labels,
  densityPolicy: {
    desktop: {
      maxLabelRank: labelProfiles.desktop.maxRank,
      countryLabelCounts: Object.fromEntries(
        assetRecords
          .filter((asset) => asset.density === "desktop")
          .map((asset) => [asset.locale, asset.countryLabelCount])
      ),
    },
    mobile: {
      maxLabelRank: labelProfiles.mobile.maxRank,
      countryLabelCounts: Object.fromEntries(
        assetRecords
          .filter((asset) => asset.density === "mobile")
          .map((asset) => [asset.locale, asset.countryLabelCount])
      ),
    },
  },
  shortLabelOverrides: countryLabelOverrides,
  oceanLabels,
};
await writeFile(
  atlasProvenancePath,
  `${JSON.stringify(provenance, null, 2)}\n`,
  "utf8"
);

console.log(
  `Built modern atlas textures from ${path.relative(repositoryRoot, terrainSourcePath)} ` +
    `and ${path.relative(repositoryRoot, atlasPath)}: ` +
    assetRecords
      .map(
        (asset) =>
          `${path.basename(asset.path)} ${asset.width}x${asset.height}, ` +
          `${asset.countryLabelCount} country labels (${asset.bytes} bytes)`
      )
      .join("; ") +
    "."
);
