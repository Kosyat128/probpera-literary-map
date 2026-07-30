import { mkdir, readFile } from "node:fs/promises";
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
const texturePath = path.join(
  repositoryRoot,
  "public",
  "textures",
  "antique-world-1887.webp"
);
const outputDirectory = path.join(repositoryRoot, "scripts", ".cache");
const outputPath = path.join(outputDirectory, "globe-alignment-qa.png");
const width = 3072;
const height = 1536;
const inspectedCodes = new Set(["BR", "FR", "JP", "AU", "RU"]);

const atlas = JSON.parse(await readFile(atlasPath, "utf8"));

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
await sharp(texturePath)
  .resize(width, height, { fit: "fill" })
  .composite([{ input: overlay, blend: "over" }])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(outputPath);
