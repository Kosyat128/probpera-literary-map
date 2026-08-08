import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const countriesDirectory = path.join(projectRoot, "src", "data", "countries");
const generatedDirectory = path.join(countriesDirectory, "generated");
const cacheDirectory = path.join(scriptDirectory, ".cache", "wikidata-writers");
const outputPath = path.join(generatedDirectory, "writers.candidates.json");
const metadataPath = path.join(
  generatedDirectory,
  "writers.candidates.metadata.json"
);
const apply = process.argv.includes("--apply");
const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
const maxCountriesArgument = process.argv.find((argument) =>
  argument.startsWith("--max-countries=")
);
const targetCount = Number(targetArgument?.split("=")[1] || 4000);
const maxCountries = maxCountriesArgument
  ? Number(maxCountriesArgument.split("=")[1])
  : Number.POSITIVE_INFINITY;
const requestLimit = 45;
const concurrency = 4;

const occupations = [
  "wd:Q36180",
  "wd:Q49757",
  "wd:Q6625963",
  "wd:Q214917",
  "wd:Q11774202",
  "wd:Q4853732",
  "wd:Q18814623",
  "wd:Q4263842",
];
const broadWriterOccupation = "Q36180";
const narrowLiteraryOccupations = new Set([
  "Q49757",
  "Q6625963",
  "Q214917",
  "Q11774202",
  "Q4853732",
  "Q18814623",
  "Q4263842",
]);
const literaryDescriptionPattern =
  /писател|поэт|поэтесс|прозаик|романист|драматург|эссеист|литератур|автор (?:детских книг|романов|рассказов)|writer|poet|novelist|playwright|essayist|literary|short story|science fiction|children.?s author/iu;
const nonLiteraryProfessionPattern =
  /певец|певица|музыкант|актёр|актер|режиссёр|режиссер|политик|шахмат|футбол|спорт|тяжелоатлет|лётч|летч|уфолог|учён|учен|профессор|юрист|врач|журналист|философ|историк|singer|musician|actor|director|politician|chess|football|sport|athlete|pilot|scientist|professor|lawyer|doctor|journalist|philosopher|historian/iu;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalizeName(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function firstString(source, key) {
  const match = source.match(new RegExp(`\\b${key}:\\s*["'\`]([^"'\`]+)["'\`]`, "u"));
  return match?.[1] || "";
}

function findMatching(source, start, openCharacter, closeCharacter) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === openCharacter) depth += 1;
    if (character === closeCharacter) depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function writerObjects(source) {
  const writersMarker = source.indexOf("writers:");
  if (writersMarker < 0) return [];
  const arrayStart = source.indexOf("[", writersMarker);
  if (arrayStart < 0) return [];
  const arrayEnd = findMatching(source, arrayStart, "[", "]");
  if (arrayEnd < 0) return [];

  const arraySource = source.slice(arrayStart + 1, arrayEnd);
  const objects = [];
  let squareDepth = 0;
  let curlyDepth = 0;
  let objectStart = -1;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < arraySource.length; index += 1) {
    const character = arraySource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") squareDepth += 1;
    if (character === "]") squareDepth -= 1;
    if (character === "{" && squareDepth === 0) {
      if (curlyDepth === 0) objectStart = index;
      curlyDepth += 1;
    } else if (character === "}" && squareDepth === 0) {
      curlyDepth -= 1;
      if (curlyDepth === 0 && objectStart >= 0) {
        objects.push(arraySource.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }
  return objects;
}

async function loadCountrySources() {
  const ignored = new Set([
    "index.ts",
    "types.ts",
    "metadata.ts",
    "convertWriter.ts",
    "getCountryMetadata.ts",
    "editorialAudit.ts",
    "writerRegistry.ts",
  ]);
  const files = (await readdir(countriesDirectory)).filter(
    (file) => file.endsWith(".ts") && !ignored.has(file)
  );
  const countries = [];

  for (const file of files) {
    const source = await readFile(path.join(countriesDirectory, file), "utf8");
    if (!source.includes("writers:")) continue;
    const beforeWriters = source.slice(0, source.indexOf("writers:"));
    const id = firstString(beforeWriters, "id");
    const name = firstString(beforeWriters, "name");
    const code = firstString(beforeWriters, "code").toUpperCase();
    if (!id || !name || code.length !== 2) continue;
    const writers = writerObjects(source);
    countries.push({
      id,
      name,
      code,
      curatedCount: writers.length,
      curatedNames: new Set(
        writers
          .map((writer) => firstString(writer, "fullName") || firstString(writer, "name"))
          .filter(Boolean)
          .map(normalizeName)
      ),
    });
  }

  return countries.sort(
    (first, second) =>
      second.curatedCount - first.curatedCount ||
      first.name.localeCompare(second.name, "ru")
  );
}

function queryForCountry(countryCode) {
  return `
SELECT DISTINCT ?person
WHERE {
  ?country wdt:P297 "${countryCode}".
  ?person wdt:P27 ?country;
          wdt:P106 ?occupation.
  VALUES ?occupation { ${occupations.join(" ")} }
}
LIMIT ${requestLimit}
`.trim();
}

async function fetchEntities(qids) {
  if (qids.length === 0) return [];
  const parameters = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "labels|descriptions|claims|sitelinks",
    languages: "ru|en",
    languagefallback: "1",
    format: "json",
    origin: "*",
  });
  const response = await fetch(
    `https://www.wikidata.org/w/api.php?${parameters.toString()}`,
    {
      headers: {
        "User-Agent": "ProbPeraLiteraryMap/1.0 (probperasite@yandex.ru)",
      },
      signal: AbortSignal.timeout(35_000),
    }
  );
  if (!response.ok) throw new Error(`Entity API HTTP ${response.status}`);
  const payload = await response.json();
  return Object.values(payload.entities || {});
}

async function fetchCountry(country, attempt = 1) {
  const cachePath = path.join(cacheDirectory, `${country.code}.json`);
  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    if (Array.isArray(cached)) return cached;
  } catch {
    // First request for this country.
  }

  const query = queryForCountry(country.code);
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": "ProbPeraLiteraryMap/1.0 (probperasite@yandex.ru)",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const qids = (payload.results?.bindings || [])
      .map((binding) => qidFromEntityUrl(binding.person?.value || ""))
      .filter(Boolean);
    const entities = await fetchEntities(qids);
    await writeFile(cachePath, `${JSON.stringify(entities, null, 2)}\n`, "utf8");
    return entities;
  } catch (error) {
    if (attempt >= 3) {
      console.warn(`Skip ${country.name} (${country.code}): ${error.message}`);
      return [];
    }
    await sleep(1_200 * attempt);
    return fetchCountry(country, attempt + 1);
  }
}

function qidFromEntityUrl(url) {
  return url.match(/\/(Q\d+)$/u)?.[1] || "";
}

function isoDate(value) {
  if (!value) return "";
  const match = value.match(/^([+-]?\d{4,})-(\d{2})-(\d{2})/u);
  if (!match) return value;
  const [, year, month, day] = match;
  if (month === "00") return year;
  if (day === "00") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function yearFromDate(value) {
  return isoDate(value).match(/-?\d{3,4}/u)?.[0] || "";
}

function yearsLabel(birth, death) {
  const birthYear = yearFromDate(birth);
  const deathYear = yearFromDate(death);
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (birthYear) return `род. ${birthYear}`;
  if (deathYear) return `ум. ${deathYear}`;
  return "";
}

function cleanDescription(description) {
  const normalized = description.trim().replace(/\s+/gu, " ").replace(/[.]+$/u, "");
  return normalized
    ? `${normalized.slice(0, 1).toLocaleUpperCase("ru")}${normalized.slice(1)}.`
    : "";
}

function normalizedFullName(label, countryId) {
  const name = label.trim().replace(/\s+/gu, " ");
  if (countryId !== "russia" || !name.includes(",")) return name;
  const [familyName, givenNames] = name.split(",", 2).map((part) => part.trim());
  return givenNames && familyName ? `${givenNames} ${familyName}` : name;
}

function claimValue(entity, property) {
  return entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
}

function claimEntityIds(entity, property) {
  return (entity.claims?.[property] || [])
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function claimTime(entity, property) {
  const value = claimValue(entity, property);
  return typeof value === "object" ? value.time || "" : "";
}

function labelValue(entity, property) {
  return entity[property]?.ru?.value || entity[property]?.en?.value || "";
}

function commonsImageUrl(filename) {
  if (!filename) return "";
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(
    filename.replace(/ /g, "_")
  )}`;
}

function russianWikipediaUrl(entity) {
  const title = entity.sitelinks?.ruwiki?.title;
  return title
    ? `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
    : "";
}

function writerFromEntity(entity, country) {
  const wikidataId = entity.id || "";
  const fullName = normalizedFullName(labelValue(entity, "labels"), country.id);
  const description = cleanDescription(labelValue(entity, "descriptions"));
  const birthDate = isoDate(claimTime(entity, "P569"));
  const deathDate = isoDate(claimTime(entity, "P570"));
  const candidatePortrait = commonsImageUrl(claimValue(entity, "P18"));
  const articleUrl = russianWikipediaUrl(entity);
  const occupationIds = claimEntityIds(entity, "P106");

  return {
    id: `wikidata-${wikidataId.toLocaleLowerCase("en")}`,
    fullName,
    years: yearsLabel(birthDate, deathDate),
    birthDate: birthDate || undefined,
    deathDate: deathDate || undefined,
    country: country.name,
    // A Wikidata description helps classify a candidate, but it is not a
    // biography and must never be copied into a visitor-facing prose field.
    sourceDescriptionCandidate: description || undefined,
    works: [],
    tags: ["Справочный каталог", "Редакционная очередь"],
    articleUrl: articleUrl || undefined,
    wikidataId,
    sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}`,
    portraitCandidateUrl: candidatePortrait || undefined,
    portraitRightsStatus: candidatePortrait ? "review-required" : undefined,
    candidateOnly: true,
    candidateStatus: "review-required",
    sitelinks: Object.keys(entity.sitelinks || {}).length,
    occupationIds,
    editorial: {
      status: "draft",
      sources: [
        {
          title: `Wikidata ${wikidataId}`,
          publisher: "Wikidata",
          url: `https://www.wikidata.org/wiki/${wikidataId}`,
        },
      ],
    },
  };
}

function removeUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

function isLiteraryCandidate(writer) {
  const hasNarrowLiteraryOccupation = writer.occupationIds.some((occupation) =>
    narrowLiteraryOccupations.has(occupation)
  );
  const hasBroadWriterOccupation = writer.occupationIds.includes(
    broadWriterOccupation
  );
  if (!hasNarrowLiteraryOccupation && !hasBroadWriterOccupation) return false;

  const sourceDescription = writer.sourceDescriptionCandidate || "";
  const literaryMatch = literaryDescriptionPattern.exec(sourceDescription);
  if (!literaryMatch) return false;
  const nonLiteraryMatch = nonLiteraryProfessionPattern.exec(sourceDescription);

  // A writer may also be a musician, historian or public figure. Keep the
  // record only when the source describes the literary identity first.
  return !nonLiteraryMatch || literaryMatch.index <= nonLiteraryMatch.index;
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
        if ((index + 1) % 16 === 0 || index === items.length - 1) {
          console.log(`Wikidata: ${index + 1}/${items.length} countries`);
        }
        await sleep(250);
      }
    }
  );
  await Promise.all(runners);
  return results;
}

async function main() {
  await mkdir(generatedDirectory, { recursive: true });
  await mkdir(cacheDirectory, { recursive: true });

  const allCountries = await loadCountrySources();
  const countries = allCountries.slice(0, maxCountries);
  const curatedCount = allCountries.reduce(
    (total, country) => total + country.curatedCount,
    0
  );
  const needed = Math.max(0, targetCount - curatedCount);

  console.log(
    `Curated country archive: ${curatedCount} writers in ${allCountries.length} countries.`
  );
  console.log(`Target: ${targetCount}; staging candidates needed: ${needed}.`);

  if (needed === 0) {
    if (apply) {
      await writeFile(outputPath, "{}\n", "utf8");
      await writeFile(
        metadataPath,
        `${JSON.stringify(
          {
            records: 0,
            candidateCount: 0,
            curatedCount,
            targetCount,
            publicRecordsAdded: 0,
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        )}\n`,
        "utf8"
      );
    }
    console.log(
      apply
        ? `Staging queue cleared at ${outputPath}.`
        : "Dry run: no staging files changed."
    );
    return;
  }

  const responses = await runPool(countries, fetchCountry);
  const candidatesByCountry = {};

  countries.forEach((country, countryIndex) => {
    const seenQids = new Set();
    candidatesByCountry[country.id] = (responses[countryIndex] || [])
      .map((entity) => writerFromEntity(entity, country))
      .filter((writer) => {
        if (!writer.wikidataId || !writer.fullName) return false;
        if (seenQids.has(writer.wikidataId)) return false;
        seenQids.add(writer.wikidataId);
        if (
          country.id === "russia" &&
          writer.fullName.split(/\s+/u).filter(Boolean).length < 3
        ) {
          return false;
        }
        if (!isLiteraryCandidate(writer)) return false;
        return !country.curatedNames.has(normalizeName(writer.fullName));
      })
      .sort(
        (first, second) =>
          second.sitelinks - first.sitelinks ||
          first.fullName.localeCompare(second.fullName, "ru")
      );
  });

  const selectedByCountry = Object.fromEntries(countries.map((country) => [country.id, []]));
  let selectedCount = 0;
  let round = 0;

  while (selectedCount < needed) {
    let addedThisRound = 0;
    for (const country of countries) {
      const candidate = candidatesByCountry[country.id]?.[round];
      if (!candidate) continue;
      selectedByCountry[country.id].push(candidate);
      selectedCount += 1;
      addedThisRound += 1;
      if (selectedCount >= needed) break;
    }
    if (addedThisRound === 0) break;
    round += 1;
  }

  const output = Object.fromEntries(
    Object.entries(selectedByCountry)
      .filter(([, writers]) => writers.length > 0)
      .map(([countryId, writers]) => [
        countryId,
        writers.map(
          ({
            sitelinks: _sitelinks,
            occupationIds: _occupationIds,
            ...writer
          }) => removeUndefined(writer)
        ),
      ])
  );

  if (selectedCount < needed) {
    throw new Error(
      `Only ${selectedCount} non-duplicate candidates found; ${needed} required. ` +
        "Increase requestLimit or add verified occupation identifiers."
    );
  }

  if (apply) {
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await writeFile(
      metadataPath,
      `${JSON.stringify(
        {
          records: selectedCount,
          candidateCount: selectedCount,
          curatedCount,
          targetCount,
          publicRecordsAdded: 0,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`Saved ${selectedCount} candidate-only records to ${outputPath}.`);
  } else {
    console.log(`Dry run found ${selectedCount} candidate-only records.`);
    console.log("No public or staging files changed; pass --apply to save the queue.");
  }
  console.log("Public archive records added: 0.");
}

await main();
