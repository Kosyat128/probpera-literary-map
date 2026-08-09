import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
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
const globeAtlasSourcePath = path.join(
  repositoryRoot,
  "src",
  "components",
  "globeAtlas.ts"
);
const modernRasterSourcePath = path.join(
  repositoryRoot,
  "scripts",
  "assets",
  "natural-earth-i-relief-source.webp"
);
const modernBuilderPath = path.join(
  repositoryRoot,
  "scripts",
  "build-modern-globe-texture.mjs"
);
const textureDirectory = path.join(repositoryRoot, "public", "textures");
const outputDirectory = path.join(repositoryRoot, "scripts", ".cache");
const width = 4096;
const height = 2048;
const inspectedCodes = new Set(["BR", "FR", "JP", "AU", "RU"]);
const textureFamilies = [
  {
    style: "antique",
    desktop: "antique-world-1887.webp",
    mobile: "antique-world-1887-mobile.webp",
    desktopBudget: 3_200_000,
    mobileBudget: 800_000,
    output: "globe-alignment-qa.png",
  },
  {
    style: "earth",
    desktop: "earth-blue-marble.webp",
    mobile: "earth-blue-marble-mobile.webp",
    desktopBudget: 700_000,
    mobileBudget: 250_000,
    output: "globe-alignment-qa-earth.png",
  },
  {
    style: "modern",
    locale: "ru",
    desktop: "modern-atlas-2026-ru.webp",
    mobile: "modern-atlas-2026-ru-mobile.webp",
    desktopBudget: 1_600_000,
    mobileBudget: 420_000,
    output: "globe-alignment-qa-modern-ru.png",
  },
  {
    style: "modern",
    locale: "en",
    desktop: "modern-atlas-2026-en.webp",
    mobile: "modern-atlas-2026-en-mobile.webp",
    desktopBudget: 1_600_000,
    mobileBudget: 420_000,
    output: "globe-alignment-qa-modern-en.png",
  },
];

const [atlasJson, atlasProvenance, globeAtlasSource, modernBuilderSource] =
  await Promise.all([
  readFile(atlasPath, "utf8"),
  readFile(atlasProvenancePath, "utf8").then(JSON.parse),
  readFile(globeAtlasSourcePath, "utf8"),
  readFile(modernBuilderPath, "utf8"),
  ]);
const atlas = JSON.parse(atlasJson);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function featureCode(feature) {
  return (
    feature.properties.ISO_A2 ||
    feature.properties.WB_A2 ||
    feature.properties.POSTAL
  );
}

assert(atlas.type === "FeatureCollection", "country atlas must be GeoJSON");
assert(
  atlas.features.length === 177,
  `country atlas must contain 177 features, found ${atlas.features.length}`
);
assert(
  atlasProvenance.repositoryVersion === "5.1.2",
  `country atlas must document repository v5.1.2, found ${atlasProvenance.repositoryVersion}`
);
assert(
  atlasProvenance.themeVersion === "5.1.1",
  `country atlas must distinguish theme v5.1.1, found ${atlasProvenance.themeVersion}`
);
assert(
  atlasProvenance.featureCount === atlas.features.length,
  "country atlas feature count must match its provenance record"
);
assert(
  atlasProvenance.rawSha256 ===
    "6866C877D39CBA9C357620878839B336D569F8C662D3CFAB4CB1DBE2D39C977F",
  "country atlas raw source checksum does not match the reviewed release"
);
const localAtlasSha256 = createHash("sha256")
  .update(atlasJson)
  .digest("hex")
  .toUpperCase();
assert(
  atlasProvenance.localSha256 === localAtlasSha256,
  `country atlas checksum mismatch: expected ${atlasProvenance.localSha256}, found ${localAtlasSha256}`
);
assert(
  atlasProvenance.sourceUrl ===
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson",
  "country atlas provenance must point to the reviewed Natural Earth release"
);
const [modernRasterSourceBytes, modernRasterSourceMetadata] = await Promise.all([
  readFile(modernRasterSourcePath),
  sharp(modernRasterSourcePath).metadata(),
]);
const modernRasterSourceSha256 = createHash("sha256")
  .update(modernRasterSourceBytes)
  .digest("hex")
  .toUpperCase();
assert(
  modernRasterSourceMetadata.format === "webp" &&
    modernRasterSourceMetadata.width === width &&
    modernRasterSourceMetadata.height === height,
  `modern physical source must be WebP ${width}x${height}`
);
assert(
  atlasProvenance.rasterBase?.preparedSourceSha256 ===
    modernRasterSourceSha256,
  "modern physical source does not match its provenance record"
);
assert(
  atlasProvenance.rasterBase?.downloadUrl ===
    "https://naturalearth.s3.amazonaws.com/10m_raster/NE1_LR_LC_SR_W.zip",
  "modern physical source must document the official Natural Earth archive"
);
const requiredAtlasProperties = [
  "NAME",
  "ISO_A2",
  "WB_A2",
  "POSTAL",
  "ADM0_A3",
  "MAPCOLOR13",
  "NE_ID",
  "TLC",
  "NAME_RU",
  "NAME_EN",
  "LABEL_X",
  "LABEL_Y",
  "LABELRANK",
  "scalerank",
  "FCLASS_TLC",
];
atlas.features.forEach((feature, index) => {
  assert(feature.type === "Feature", `country atlas feature ${index} is invalid`);
  assert(Boolean(feature.geometry), `country atlas feature ${index} has no geometry`);
  requiredAtlasProperties.forEach((property) => {
    assert(
      Object.hasOwn(feature.properties, property),
      `country atlas feature ${index} is missing ${property}`
    );
  });
});
assert(
  globeAtlasSource.includes(
    'import worldGeoJsonUrl from "../data/geo/countries.geojson?url"'
  ),
  "globe runtime must load the reviewed countries.geojson"
);
assert(
  globeAtlasSource.includes("drawMapCanvas(mapCanvas, worldGeoJson.features") &&
    globeAtlasSource.includes("worldGeoJson.features.forEach((feature)"),
  "globe drawing and hit testing must use the same country feature collection"
);
assert(
  atlasProvenance.labels?.sourceSha256 === atlasProvenance.rawSha256 &&
    atlasProvenance.labels?.featureCount === atlas.features.length &&
    ["NAME_RU", "NAME_EN", "LABEL_X", "LABEL_Y", "LABELRANK", "scalerank"].every(
      (field) => atlasProvenance.labels.fields.includes(field)
    ),
  "country atlas provenance must document the official localized label fields"
);
assert(
  modernBuilderSource.includes("natural-earth-i-relief-source.webp") &&
    !modernBuilderSource.includes("process.argv[2]") &&
    modernBuilderSource.includes("feature.properties.LABEL_X") &&
    modernBuilderSource.includes("feature.properties.LABEL_Y") &&
    modernBuilderSource.includes("feature.properties.LABELRANK") &&
    (modernBuilderSource.includes("feature.properties.scalerank") ||
      modernBuilderSource.includes("feature.properties?.scalerank")),
  "modern texture builder must use only the tracked relief and official label fields"
);
for (const locale of ["ru", "en"]) {
  for (const compact of [false, true]) {
    const suffix = compact ? "-mobile" : "";
    const expectedPath = `/textures/modern-atlas-2026-${locale}${suffix}.webp`;
    const asset = atlasProvenance.renderedAssets?.find(
      (candidate) => candidate.path === expectedPath
    );
    assert(
      asset?.locale === locale &&
        asset?.width === (compact ? width / 2 : width) &&
        asset?.height === (compact ? height / 2 : height) &&
        asset?.countryLabelCount >= (compact ? 25 : 60),
      `country atlas provenance must document localized labels in ${expectedPath}`
    );
  }
}

function ringPath(ring, horizontalShift = 0) {
  if (!ring.length) return "";

  const commands = [];
  let previousLongitude = ring[0][0];

  ring.forEach(([sourceLongitude, latitude], index) => {
    let longitude = sourceLongitude;
    while (longitude - previousLongitude > 180) longitude -= 360;
    while (longitude - previousLongitude < -180) longitude += 360;
    previousLongitude = longitude;

    const x = ((longitude + 180) / 360) * width + horizontalShift;
    const y = ((90 - latitude) / 180) * height;
    commands.push(`${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`);
  });

  return `${commands.join(" ")} Z`;
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

const paths = atlas.features
  .filter((feature) => inspectedCodes.has(featureCode(feature)))
  .map(
    (feature) =>
      `<path d="${geometryPath(feature)}" fill="none" stroke="#fff2a7" ` +
      `stroke-width="3.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
  )
  .join("");

const overlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
    viewBox="0 0 ${width} ${height}">
    ${paths}
  </svg>
`);

await mkdir(outputDirectory, { recursive: true });

for (const texture of textureFamilies) {
  const desktopPath = path.join(textureDirectory, texture.desktop);
  const mobilePath = path.join(textureDirectory, texture.mobile);
  const [
    desktopMetadata,
    mobileMetadata,
    desktopFile,
    mobileFile,
    desktopBytes,
    mobileBytes,
  ] =
    await Promise.all([
      sharp(desktopPath).metadata(),
      sharp(mobilePath).metadata(),
      stat(desktopPath),
      stat(mobilePath),
      readFile(desktopPath),
      readFile(mobilePath),
    ]);

  assert(
    desktopMetadata.format === "webp" &&
      desktopMetadata.width === width &&
      desktopMetadata.height === height,
    `${texture.style} desktop texture must be WebP ${width}x${height}`
  );
  assert(
    mobileMetadata.format === "webp" &&
      mobileMetadata.width === width / 2 &&
      mobileMetadata.height === height / 2,
    `${texture.style} mobile texture must be WebP ${width / 2}x${height / 2}`
  );
  assert(
    desktopFile.size <= texture.desktopBudget,
    `${texture.desktop} exceeds ${texture.desktopBudget} bytes`
  );
  assert(
    mobileFile.size <= texture.mobileBudget,
    `${texture.mobile} exceeds ${texture.mobileBudget} bytes`
  );

  if (texture.style === "modern") {
    const desktopProvenance = atlasProvenance.renderedAssets.find(
      (asset) => asset.path === `/textures/${texture.desktop}`
    );
    const mobileProvenance = atlasProvenance.renderedAssets.find(
      (asset) => asset.path === `/textures/${texture.mobile}`
    );
    const desktopSha256 = createHash("sha256")
      .update(desktopBytes)
      .digest("hex")
      .toUpperCase();
    const mobileSha256 = createHash("sha256")
      .update(mobileBytes)
      .digest("hex")
      .toUpperCase();

    assert(
      desktopProvenance?.sha256 === desktopSha256 &&
        desktopProvenance?.bytes === desktopFile.size,
      `${texture.desktop} does not match its provenance record`
    );
    assert(
      mobileProvenance?.sha256 === mobileSha256 &&
        mobileProvenance?.bytes === mobileFile.size,
      `${texture.mobile} does not match its provenance record`
    );
  }

  const outputPath = path.join(outputDirectory, texture.output);
  await sharp(desktopPath)
    .composite([{ input: overlay, blend: "over" }])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(
    `${texture.style}: ${desktopMetadata.width}x${desktopMetadata.height} ` +
      `(${desktopFile.size} bytes), mobile ${mobileMetadata.width}x${mobileMetadata.height} ` +
      `(${mobileFile.size} bytes) -> ${outputPath}`
  );
}

console.log(
  `modern: Natural Earth repository v${atlasProvenance.repositoryVersion} ` +
    `(theme v${atlasProvenance.themeVersion}), ${atlas.features.length} features; ` +
    "raster surface, procedural fallback, and hit testing share countries.geojson"
);
