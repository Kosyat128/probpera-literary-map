import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const temporaryDirectory = path.join(projectRoot, ".tmp");
const temporaryBundle = path.join(
  temporaryDirectory,
  `admin-editorial-catalog-${process.pid}.mjs`
);
const outputDirectory = path.join(
  projectRoot,
  "apps",
  "admin",
  "catalog-assets"
);
const outputPath = path.join(outputDirectory, "editorial-catalog.json");
const checkOnly = process.argv.includes("--check");

const countryFields = [
  "name",
  "code",
  "flag",
  "coordinates",
  "region",
  "continent",
  "officialLanguage",
  "literaryPeriods",
  "literaryMovements",
  "periods",
  "capital",
  "description",
  "history",
  "historicalNote",
  "facts",
  "literaryPlaces",
  "timeline",
  "chronology",
  "nobel",
  "places",
  "influence",
];

const writerFields = [
  "name",
  "fullName",
  "birth",
  "death",
  "years",
  "birthDate",
  "deathDate",
  "birthPlace",
  "deathPlace",
  "portrait",
  "portraitAlt",
  "portraitSourceUrl",
  "country",
  "movement",
  "literaryEra",
  "genres",
  "languages",
  "language",
  "nationality",
  "tags",
  "category",
  "bio",
  "biography",
  "description",
  "works",
  "awards",
  "places",
  "relatedWriters",
  "articleUrl",
];

function selectedFields(source, fields) {
  return Object.fromEntries(
    fields.flatMap((field) =>
      source[field] === undefined ? [] : [[field, source[field]]]
    )
  );
}

await mkdir(temporaryDirectory, { recursive: true });
try {
  await build({
    absWorkingDir: projectRoot,
    entryPoints: [path.join(projectRoot, "scripts", "archive-source.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: temporaryBundle,
    logLevel: "silent",
  });
  const source = await import(
    `${pathToFileURL(temporaryBundle).href}?v=${Date.now()}`
  );
  const countries = source.archiveCountries.map((country) => ({
    id: country.id,
    label: country.name || country.id,
    fields: selectedFields(country, countryFields),
    writers: country.writers.map((writer) => ({
      id: writer.id,
      label: writer.name || writer.fullName || writer.id,
      fields: selectedFields(writer, writerFields),
    })),
  }));
  const output = `${JSON.stringify({ version: 1, countries }, null, 2)}\n`;

  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== output) {
      throw new Error(
        "Редакционный каталог устарел. Запустите npm run editorial:catalog."
      );
    }
  } else {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, output, "utf8");
    console.log(
      `Editorial catalog: ${countries.length} countries, ${countries.reduce(
        (total, country) => total + country.writers.length,
        0
      )} writers.`
    );
  }
} finally {
  await rm(temporaryBundle, { force: true });
}
