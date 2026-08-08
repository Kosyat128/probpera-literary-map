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
];

const atlas = JSON.parse(await readFile(atlasPath, "utf8"));

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
  const [desktopMetadata, mobileMetadata, desktopFile, mobileFile] =
    await Promise.all([
      sharp(desktopPath).metadata(),
      sharp(mobilePath).metadata(),
      stat(desktopPath),
      stat(mobilePath),
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
  "modern: procedural surface and hit testing share countries.geojson; no raster alignment offset"
);
