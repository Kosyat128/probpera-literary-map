import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error(
    "Pass the official Natural Earth Admin-0 GeoJSON as the first argument."
  );
}

const atlasPath = path.join(
  repositoryRoot,
  "src",
  "data",
  "geo",
  "countries.geojson"
);
const provenancePath = path.join(
  repositoryRoot,
  "src",
  "data",
  "geo",
  "countries.provenance.json"
);
const expectedSourceSha256 =
  "6866C877D39CBA9C357620878839B336D569F8C662D3CFAB4CB1DBE2D39C977F";
const labelFields = ["LABEL_X", "LABEL_Y", "LABELRANK", "scalerank"];

const [sourceBytes, atlasJson, provenanceJson] = await Promise.all([
  readFile(sourcePath),
  readFile(atlasPath, "utf8"),
  readFile(provenancePath, "utf8"),
]);
const sourceSha256 = createHash("sha256")
  .update(sourceBytes)
  .digest("hex")
  .toUpperCase();
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(
    `Admin-0 source checksum mismatch: expected ${expectedSourceSha256}, found ${sourceSha256}.`
  );
}

const source = JSON.parse(sourceBytes.toString("utf8"));
const atlas = JSON.parse(atlasJson);
const provenance = JSON.parse(provenanceJson);
if (
  source.type !== "FeatureCollection" ||
  atlas.type !== "FeatureCollection" ||
  source.features.length !== atlas.features.length
) {
  throw new Error("Admin-0 source and compact atlas feature collections differ.");
}

const sourceByNaturalEarthId = new Map(
  source.features.map((feature) => [feature.properties?.NE_ID, feature])
);
atlas.features = atlas.features.map((feature, index) => {
  const matching = sourceByNaturalEarthId.get(feature.properties?.NE_ID);
  if (!matching) {
    throw new Error(`No source feature for compact atlas entry ${index}.`);
  }

  const labels = Object.fromEntries(
    labelFields.map((field) => {
      const value = Number(matching.properties?.[field]);
      if (!Number.isFinite(value)) {
        throw new Error(
          `Natural Earth feature ${matching.properties?.NAME ?? index} has invalid ${field}.`
        );
      }
      return [field, value];
    })
  );

  return {
    ...feature,
    properties: {
      ...feature.properties,
      ...labels,
    },
  };
});

const nextAtlasJson = `${JSON.stringify(atlas)}\n`;
const localSha256 = createHash("sha256")
  .update(nextAtlasJson)
  .digest("hex")
  .toUpperCase();
provenance.localSha256 = localSha256;
provenance.labels = {
  source: "Natural Earth Admin 0 – Countries",
  sourceSha256,
  fields: ["NAME_RU", "NAME_EN", ...labelFields],
  featureCount: atlas.features.length,
  locales: ["ru", "en"],
  placement:
    "Official LABEL_X/LABEL_Y positions; LABELRANK and scalerank control responsive density.",
};

await Promise.all([
  writeFile(atlasPath, nextAtlasJson, "utf8"),
  writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8"),
]);

console.log(
  `Merged ${labelFields.join(", ")} for ${atlas.features.length} Admin-0 features; ` +
    `compact atlas SHA-256 ${localSha256}.`
);
