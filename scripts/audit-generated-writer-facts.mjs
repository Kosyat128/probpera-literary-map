import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const generatedPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writers.generated.json"
);
const reportDirectory = path.join(projectRoot, "reports");
const cacheDirectory = path.join(
  projectRoot,
  "scripts",
  ".cache",
  "writer-fact-verification"
);
const cachePath = path.join(cacheDirectory, "wikidata-entities.json");
const applyChanges = process.argv.includes("--apply");
const refreshCache = process.argv.includes("--refresh");
const checkedAt = new Date().toISOString().slice(0, 10);

const literaryOccupationIds = new Set([
  "Q36180", // writer
  "Q49757", // poet
  "Q6625963", // novelist
  "Q214917", // playwright
  "Q11774202", // essayist
  "Q4853732", // children's writer
  "Q18814623", // autobiographer
  "Q4263842", // science-fiction writer
]);

const authorityProperties = {
  viaf: "P214",
  isni: "P213",
  lccn: "P244",
  bnf: "P268",
  nla: "P409",
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function claimValues(entity, property) {
  return (entity.claims?.[property] || [])
    .filter((claim) => claim.rank !== "deprecated")
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value) => value !== undefined && value !== null);
}

function entityIds(entity, property) {
  return claimValues(entity, property)
    .map((value) => (typeof value === "object" ? value.id : ""))
    .filter(Boolean);
}

function firstString(entity, property) {
  return claimValues(entity, property).find((value) => typeof value === "string") || "";
}

function firstTime(entity, property) {
  const value = claimValues(entity, property).find(
    (candidate) => typeof candidate === "object" && candidate.time
  );
  return value?.time || "";
}

function normalizeDate(value) {
  if (!value) return "";
  const source = String(value).trim().replace(/T\d{2}:\d{2}:\d{2}Z$/u, "");
  const match = source.match(
    /^([+-]?\d{1,16})(?:-(\d{2}))?(?:-(\d{2}))?$/u
  );
  if (!match) return source;
  const [, rawYear, month, day] = match;
  const year = rawYear.replace(/^\+/, "").replace(/^(-?)0+(?=\d)/u, "$1");
  if (!month || month === "00") return year;
  if (!day || day === "00") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function dateYear(value) {
  return normalizeDate(value).match(/^-?\d{1,16}/u)?.[0] || "";
}

function yearsLabel(birthDate, deathDate) {
  const birthYear = dateYear(birthDate);
  const deathYear = dateYear(deathDate);
  if (birthYear && deathYear) return `${birthYear}-${deathYear}`;
  if (birthYear) return `род. ${birthYear}`;
  if (deathYear) return `ум. ${deathYear}`;
  return "";
}

function normalizedName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function sameName(stored, live) {
  const left = normalizedName(stored);
  const right = normalizedName(live);
  if (!left || !right) return true;
  if (left === right) return true;
  const sorted = (value) => value.split(/\s+/u).filter(Boolean).sort().join(" ");
  return sorted(left) === sorted(right);
}

function label(entity, language) {
  return entity.labels?.[language]?.value || "";
}

function description(entity, language) {
  return entity.descriptions?.[language]?.value || "";
}

function sentence(value) {
  const normalized = String(value || "").trim().replace(/\s+/gu, " ");
  if (!normalized) return "";
  const capitalized = `${normalized.slice(0, 1).toLocaleUpperCase("ru")}${normalized.slice(1)}`;
  return /[.!?…]$/u.test(capitalized) ? capitalized : `${capitalized}.`;
}

function russianWikipediaUrl(entity) {
  const title = entity.sitelinks?.ruwiki?.title;
  return title
    ? `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
    : "";
}

function commonsFileUrl(filename) {
  return filename
    ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(
        filename.replace(/ /g, "_")
      )}`
    : "";
}

function authorityIds(entity) {
  return Object.fromEntries(
    Object.entries(authorityProperties)
      .map(([key, property]) => [key, firstString(entity, property)])
      .filter(([, value]) => Boolean(value))
  );
}

function fieldMismatch(stored, live) {
  if (!stored || !live) return false;
  return normalizeDate(stored) !== normalizeDate(live);
}

async function fetchBatch(qids, attempt = 1) {
  const parameters = new URLSearchParams({
    action: "wbgetentities",
    ids: qids.join("|"),
    props: "labels|descriptions|claims|sitelinks",
    languages: "ru|en",
    languagefallback: "0",
    format: "json",
    origin: "*",
  });
  try {
    const response = await fetch(
      `https://www.wikidata.org/w/api.php?${parameters.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ProbPeraEditorialAudit/1.0 (probperasite@yandex.ru)",
        },
        signal: AbortSignal.timeout(40_000),
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return payload.entities || {};
  } catch (error) {
    if (attempt >= 4) throw error;
    await sleep(1_500 * attempt);
    return fetchBatch(qids, attempt + 1);
  }
}

async function loadEntities(qids) {
  if (!refreshCache) {
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      if (qids.every((qid) => cached[qid])) return cached;
    } catch {
      // A complete cache is optional.
    }
  }

  const entities = {};
  const batches = chunks(qids, 50);
  for (let index = 0; index < batches.length; index += 3) {
    const slice = batches.slice(index, index + 3);
    const payloads = await Promise.all(slice.map((batch) => fetchBatch(batch)));
    for (const payload of payloads) Object.assign(entities, payload);
    process.stdout.write(
      `\rWikidata: ${Math.min(index + slice.length, batches.length)}/${batches.length} пакетов`
    );
    if (index + slice.length < batches.length) await sleep(350);
  }
  process.stdout.write("\n");
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(entities)}\n`, "utf8");
  return entities;
}

function verifyRecord(countryId, writer, entity) {
  const issues = [];
  const warnings = [];
  if (!entity || entity.missing !== undefined) {
    return {
      countryId,
      id: writer.id,
      wikidataId: writer.wikidataId,
      fullName: writer.fullName,
      status: "rejected",
      issues: ["Карточка Wikidata отсутствует или была удалена"],
      warnings,
    };
  }

  const russianName = label(entity, "ru");
  const englishName = label(entity, "en");
  const liveName = russianName || englishName;
  const birthDate = normalizeDate(firstTime(entity, "P569"));
  const deathDate = normalizeDate(firstTime(entity, "P570"));
  const occupationIds = entityIds(entity, "P106");
  const citizenshipIds = entityIds(entity, "P27");
  const instanceIds = entityIds(entity, "P31");
  const authorities = authorityIds(entity);
  const portraitFilename = firstString(entity, "P18");
  const portraitCandidateUrl = commonsFileUrl(portraitFilename);
  const hasLiteraryOccupation = occupationIds.some((id) => literaryOccupationIds.has(id));
  const isHuman = instanceIds.length === 0 || instanceIds.includes("Q5");

  if (!isHuman) issues.push("Объект Wikidata не подтверждён как человек (P31≠Q5)");
  if (!hasLiteraryOccupation) {
    issues.push("В актуальных профессиях Wikidata нет литературной специализации");
  }
  if (!russianName) issues.push("В Wikidata отсутствует русская метка имени");
  if (
    writer.fullName &&
    liveName &&
    !sameName(writer.fullName, liveName)
  ) {
    issues.push(`Имя изменилось: «${writer.fullName}» → «${liveName}»`);
  }
  if (fieldMismatch(writer.birthDate, birthDate)) {
    issues.push(`Дата рождения расходится: ${writer.birthDate} → ${birthDate}`);
  }
  if (fieldMismatch(writer.deathDate, deathDate)) {
    issues.push(`Дата смерти расходится: ${writer.deathDate} → ${deathDate}`);
  }
  if (Object.keys(authorities).length === 0) {
    warnings.push("Нет внешнего библиотечного идентификатора VIAF/ISNI/LCCN/BnF/NLA");
  }

  const rejected = !isHuman || !hasLiteraryOccupation;
  const status = rejected
    ? "rejected"
    : issues.length === 0
      ? "source-confirmed"
      : "review-required";

  return {
    countryId,
    id: writer.id,
    wikidataId: writer.wikidataId,
    fullName: writer.fullName,
    status,
    issues,
    warnings,
    live: {
      fullName: liveName,
      russianName,
      englishName,
      biography: sentence(description(entity, "ru") || description(entity, "en")),
      birthDate,
      deathDate,
      years: yearsLabel(birthDate, deathDate),
      articleUrl: russianWikipediaUrl(entity),
      portraitFilename,
      portraitCandidateUrl,
      occupationIds,
      citizenshipIds,
      authorityIds: authorities,
      notableWorkIds: entityIds(entity, "P800"),
    },
  };
}

function ensureSource(sources, source) {
  return sources.some((item) => item.url === source.url) ? sources : [...sources, source];
}

function authoritySources(authorities, name) {
  const sources = [];
  if (authorities.viaf) {
    sources.push({
      title: `VIAF: ${name}`,
      url: `https://viaf.org/viaf/${encodeURIComponent(authorities.viaf)}/`,
      publisher: "VIAF",
    });
  }
  if (authorities.lccn) {
    sources.push({
      title: `Library of Congress Name Authority: ${name}`,
      url: `https://id.loc.gov/authorities/names/${encodeURIComponent(authorities.lccn)}.html`,
      publisher: "Library of Congress",
    });
  }
  if (authorities.bnf) {
    sources.push({
      title: `Catalogue général BnF: ${name}`,
      url: `https://catalogue.bnf.fr/ark:/12148/cb${encodeURIComponent(authorities.bnf)}`,
      publisher: "Bibliothèque nationale de France",
    });
  }
  return sources;
}

function applyVerifiedFields(writer, record) {
  if (!record?.live || record.status !== "source-confirmed") {
    return {
      ...writer,
      verification: record
        ? {
            status: record.status,
            checkedAt,
            source: `https://www.wikidata.org/wiki/${writer.wikidataId}`,
            issues: record.issues,
            warnings: record.warnings,
          }
        : writer.verification,
      editorial: {
        ...writer.editorial,
        status: "draft",
      },
    };
  }
  const live = record.live;
  let sources = ensureSource(writer.editorial?.sources || [], {
    title: `Wikidata: ${live.fullName || writer.fullName}`,
    url: `https://www.wikidata.org/wiki/${writer.wikidataId}`,
    publisher: "Wikidata",
  });
  const articleUrl = live.articleUrl || writer.articleUrl;
  for (const source of authoritySources(
    live.authorityIds,
    live.fullName || writer.fullName
  )) {
    sources = ensureSource(sources, source);
  }

  return {
    ...writer,
    fullName: live.russianName || writer.fullName || live.fullName,
    birthDate: live.birthDate || writer.birthDate,
    deathDate: live.deathDate || writer.deathDate,
    years: live.years || writer.years,
    biography: writer.biography,
    articleUrl,
    portraitCandidateUrl: live.portraitCandidateUrl || undefined,
    portraitRightsStatus: live.portraitCandidateUrl ? "review-required" : undefined,
    occupationIds: live.occupationIds,
    citizenshipIds: live.citizenshipIds,
    authorityIds: live.authorityIds,
    notableWorkIds: live.notableWorkIds,
    verification: {
      status: record.status,
      checkedAt,
      source: `https://www.wikidata.org/wiki/${writer.wikidataId}`,
      issues: record.issues,
      warnings: record.warnings,
    },
    editorial: {
      ...writer.editorial,
      status: "draft",
      sources,
    },
  };
}

function reportMarkdown(report) {
  const lines = [
    "# Сверка автоматически импортированных писателей",
    "",
    `Сформировано: ${report.generatedAt}`,
    "",
    `- Записей: ${report.summary.records}`,
    `- Уникальных персон Wikidata: ${report.summary.uniqueQids}`,
    `- Источник подтверждён без замечаний: ${report.summary.sourceConfirmed}`,
    `- Требуют редакционной проверки: ${report.summary.reviewRequired}`,
    `- Отклонены автоматической проверкой: ${report.summary.rejected}`,
    `- С предупреждениями без фактического расхождения: ${report.summary.withWarnings}`,
    `- С кандидатами на свободный портрет: ${report.summary.withPortraitCandidate}`,
    `- Без русской метки имени: ${report.summary.withoutRussianName}`,
    `- Без внешнего библиотечного идентификатора: ${report.summary.withoutAuthorityId}`,
    "",
    "## Первые случаи для ручной проверки",
    "",
  ];

  for (const record of report.records.filter((item) => item.issues.length).slice(0, 300)) {
    lines.push(
      `### ${record.fullName || record.id}`,
      "",
      `${record.countryId} · [${record.wikidataId}](https://www.wikidata.org/wiki/${record.wikidataId}) · ${record.status}`,
      "",
      ...record.issues.map((issue) => `- ${issue}`),
      ""
    );
  }
  lines.push("## Предупреждения о полноте источников", "");
  for (const record of report.records.filter((item) => item.warnings.length).slice(0, 300)) {
    lines.push(
      `### ${record.fullName || record.id}`,
      "",
      `${record.countryId} · [${record.wikidataId}](https://www.wikidata.org/wiki/${record.wikidataId})`,
      "",
      ...record.warnings.map((warning) => `- ${warning}`),
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const groups = JSON.parse(await readFile(generatedPath, "utf8"));
  const rows = Object.entries(groups).flatMap(([countryId, writers]) =>
    writers.map((writer) => ({ countryId, writer }))
  );
  const qids = [...new Set(rows.map(({ writer }) => writer.wikidataId).filter(Boolean))];
  const entities = await loadEntities(qids);
  const records = rows.map(({ countryId, writer }) =>
    verifyRecord(countryId, writer, entities[writer.wikidataId])
  );
  const report = {
    generatedAt: new Date().toISOString(),
    source: "https://www.wikidata.org/w/api.php",
    summary: {
      records: records.length,
      uniqueQids: qids.length,
      sourceConfirmed: records.filter((record) => record.status === "source-confirmed").length,
      reviewRequired: records.filter((record) => record.status === "review-required").length,
      rejected: records.filter((record) => record.status === "rejected").length,
      withWarnings: records.filter((record) => record.warnings.length).length,
      withPortraitCandidate: records.filter((record) => record.live?.portraitCandidateUrl).length,
      withoutRussianName: records.filter((record) => !record.live?.russianName).length,
      withoutAuthorityId: records.filter(
        (record) => Object.keys(record.live?.authorityIds || {}).length === 0
      ).length,
    },
    records,
  };

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, "generated-writer-facts.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(reportDirectory, "generated-writer-facts.md"),
    reportMarkdown(report),
    "utf8"
  );

  if (applyChanges) {
    const recordByKey = new Map(
      records.map((record) => [`${record.countryId}:${record.id}`, record])
    );
    const updatedGroups = Object.fromEntries(
      Object.entries(groups).map(([countryId, writers]) => [
        countryId,
        writers.map((writer) =>
          applyVerifiedFields(writer, recordByKey.get(`${countryId}:${writer.id}`))
        ),
      ])
    );
    await writeFile(generatedPath, `${JSON.stringify(updatedGroups, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report.summary, null, 2));
  if (applyChanges) console.log("Однозначные поля обновлены; все записи остаются draft.");
}

await main();
