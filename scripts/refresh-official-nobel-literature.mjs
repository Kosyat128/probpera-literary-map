import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const outputPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "nobelLiterature.official.json"
);
const endpoint =
  "https://api.nobelprize.org/2.1/laureates?nobelPrizeCategory=lit&nobelPrizeYearFrom=1901&nobelPrizeYearTo=2025&limit=200";
const expectedMissingAwardYears = [1914, 1918, 1935, 1940, 1941, 1942, 1943];
const writeSnapshot = process.argv.includes("--write");
const checkSnapshot = process.argv.includes("--check");

if (writeSnapshot && checkSnapshot) {
  throw new Error("Choose either --write or --check, not both");
}

const response = await fetch(endpoint, {
  headers: {
    Accept: "application/json",
    "User-Agent": "ProbPeraNobelLiteratureAudit/1.0 (probperasite@yandex.ru)",
  },
  signal: AbortSignal.timeout(45_000),
});
if (!response.ok) throw new Error(`Nobel Prize API returned HTTP ${response.status}`);

const payload = await response.json();
const laureates = (payload.laureates || [])
  .map((laureate) => {
    const prize = (laureate.nobelPrizes || []).find(
      (candidate) => candidate.category?.en === "Literature"
    );
    if (!prize) return null;
    const apiUrl = laureate.links?.find(
      (link) => link.rel === "laureate" && link.types === "application/json"
    )?.href;
    const htmlUrl = laureate.links?.find(
      (link) => link.types === "text/html"
    )?.href;
    return {
      id: Number(laureate.id),
      name: laureate.knownName?.en || laureate.fullName?.en,
      year: Number(prize.awardYear),
      portion: prize.portion,
      sortOrder: Number(prize.sortOrder || 1),
      apiUrl,
      htmlUrl,
    };
  })
  .filter(Boolean)
  .sort(
    (first, second) =>
      first.year - second.year ||
      first.sortOrder - second.sortOrder ||
      first.id - second.id
  );

const errors = [];
if (laureates.length !== 122) errors.push(`expected 122 laureates, got ${laureates.length}`);
if (new Set(laureates.map((laureate) => laureate.id)).size !== laureates.length) {
  errors.push("duplicate official laureate IDs");
}
if (laureates[0]?.year !== 1901 || laureates.at(-1)?.year !== 2025) {
  errors.push("unexpected official year range");
}
for (const laureate of laureates) {
  if (!laureate.name || !laureate.apiUrl || !laureate.htmlUrl) {
    errors.push(`incomplete official record ${laureate.id}`);
  }
  if (!/^https:\/\/(?:api\.)?nobelprize\.org\//u.test(laureate.apiUrl)) {
    errors.push(`non-official API URL ${laureate.id}`);
  }
  if (!/^https:\/\/www\.nobelprize\.org\//u.test(laureate.htmlUrl)) {
    errors.push(`non-official HTML URL ${laureate.id}`);
  }
}
const awardedYears = new Set(laureates.map((laureate) => laureate.year));
for (const year of expectedMissingAwardYears) {
  if (awardedYears.has(year)) errors.push(`unexpected literature award in ${year}`);
}
if (errors.length) throw new Error(errors.join("; "));

const snapshot = {
  version: 1,
  category: "Literature",
  throughYear: 2025,
  retrievedAt: "2026-08-09",
  officialApiUrl: endpoint,
  officialDeveloperDocumentation:
    "https://www.nobelprize.org/about/developer-zone/",
  laureates,
};

const snapshotContent = `${JSON.stringify(snapshot, null, 2)}\n`;

if (writeSnapshot) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, snapshotContent, "utf8");
}
if (checkSnapshot) {
  const current = await readFile(outputPath, "utf8");
  if (current !== snapshotContent) {
    throw new Error(
      `Official snapshot is stale: ${path.relative(projectRoot, outputPath)}`
    );
  }
}

console.log(
  JSON.stringify(
    {
      laureates: laureates.length,
      awardYears: awardedYears.size,
      firstYear: laureates[0]?.year,
      lastYear: laureates.at(-1)?.year,
      output:
        writeSnapshot || checkSnapshot
          ? path.relative(projectRoot, outputPath)
          : null,
      mode: writeSnapshot ? "write" : checkSnapshot ? "check" : "preview",
    },
    null,
    2
  )
);
