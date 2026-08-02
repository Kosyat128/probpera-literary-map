import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { createServer } from "vite";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const factsPath = path.join(projectRoot, "reports", "generated-writer-facts.json");
const generatedWritersPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writers.generated.json"
);
const manifestPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerPortraits.generated.json"
);
const curatedQidsPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "curatedWriterQids.generated.json"
);
const outputDirectory = path.join(
  projectRoot,
  "public",
  "assets",
  "writer-portraits"
);
const reportPath = path.join(projectRoot, "reports", "writer-portraits.json");
const reportMarkdownPath = path.join(
  projectRoot,
  "reports",
  "writer-portraits.md"
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache", "writer-portraits");
const metadataCachePath = path.join(cacheDirectory, "commons-metadata.json");
const applyChanges = process.argv.includes("--apply");
const refresh = process.argv.includes("--refresh");
const checkedAt = new Date().toISOString().slice(0, 10);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedName(value) {
  return normalizeText(value).split(/\s+/u).filter(Boolean).sort().join(" ");
}

function year(value) {
  return String(value || "").match(/[+-]?(\d{3,4})/u)?.[1] || "";
}

function writerName(writer) {
  return writer.name || writer.fullName || "Автор";
}

function recordNames(record) {
  return [
    record.fullName,
    record.live?.fullName,
    record.live?.russianName,
    record.live?.englishName,
  ]
    .map(normalizedName)
    .filter(Boolean);
}

function writerNames(writer) {
  return [writer.name, writer.fullName].map(normalizedName).filter(Boolean);
}

function fileKey(filename) {
  return String(filename || "")
    .replace(/^File:/iu, "")
    .replace(/_/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function metadataValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value || "");
}

function licenseDecision(imageInfo) {
  const metadata = imageInfo?.extmetadata || {};
  const licenseName =
    metadataValue(metadata, "LicenseShortName") ||
    metadataValue(metadata, "UsageTerms");
  const licenseUrl = metadataValue(metadata, "LicenseUrl");
  const normalized = `${licenseName} ${licenseUrl}`.toLocaleLowerCase("en");
  const restricted = /\bby-nc\b|\bby-nd\b|non.?commercial|no.?derivatives|fair.?use/u.test(
    normalized
  );
  const publicDomain = /public.?domain|\bcc0\b|publicdomain/u.test(normalized);
  const licensed = /\bcc.?by(?:-sa)?\b|creative.?commons.?attribution/u.test(
    normalized
  );

  return {
    allowed: !restricted && (publicDomain || licensed),
    status: publicDomain ? "public-domain" : "licensed",
    licenseName,
    licenseUrl,
  };
}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch {
    return fallback;
  }
}

async function loadPublicCountries() {
  const vite = await createServer({
    root: projectRoot,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/data/countries/index.ts");
    return module.countries;
  } finally {
    await vite.close();
  }
}

function indexRecords(records) {
  const byCountryName = new Map();
  const byName = new Map();
  for (const record of records) {
    if (record.status !== "source-confirmed" || !record.live?.portraitFilename) {
      continue;
    }
    const birthYear = year(record.live.birthDate);
    for (const name of new Set(recordNames(record))) {
      const localKeys = [
        `${record.countryId}:${name}:${birthYear}`,
        `${record.countryId}:${name}:`,
      ];
      const globalKeys = [`${name}:${birthYear}`, `${name}:`];
      for (const key of localKeys) {
        const values = byCountryName.get(key) || [];
        values.push(record);
        byCountryName.set(key, values);
      }
      for (const key of globalKeys) {
        const values = byName.get(key) || [];
        values.push(record);
        byName.set(key, values);
      }
    }
  }
  return { byCountryName, byName };
}

function uniqueRecord(records) {
  const unique = new Map(
    (records || []).map((record) => [record.wikidataId, record])
  );
  return unique.size === 1 ? [...unique.values()][0] : null;
}

function matchPublicWriter(countryId, writer, indexes) {
  const birthYear = year(writer.birthDate || writer.birth || writer.years);
  for (const name of writerNames(writer)) {
    const local = uniqueRecord(
      indexes.byCountryName.get(`${countryId}:${name}:${birthYear}`)
    );
    if (local) return local;
  }
  for (const name of writerNames(writer)) {
    const global = uniqueRecord(indexes.byName.get(`${name}:${birthYear}`));
    if (global) return global;
  }
  return null;
}

async function fetchCommonsBatch(filenames, attempt = 1) {
  const parameters = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "480",
    titles: filenames.map((filename) => `File:${filename}`).join("|"),
  });
  try {
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${parameters.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "ProbPeraPortraitAudit/1.0 (probperasite@yandex.ru)",
        },
        signal: AbortSignal.timeout(45_000),
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    if (attempt >= 4) throw error;
    await sleep(attempt * 1_500);
    return fetchCommonsBatch(filenames, attempt + 1);
  }
}

async function loadCommonsMetadata(filenames) {
  const cached = refresh ? {} : await readJson(metadataCachePath, {});
  const missing = filenames.filter((filename) => !cached[fileKey(filename)]);
  const batches = chunks(missing, 40);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const payload = await fetchCommonsBatch(batch);
    const returned = new Set();
    for (const page of Object.values(payload.query?.pages || {})) {
      const imageInfo = page.imageinfo?.[0];
      const key = fileKey(page.title);
      returned.add(key);
      cached[key] = imageInfo
        ? {
            title: page.title,
            pageId: page.pageid,
            imageInfo,
          }
        : { title: page.title, error: "imageinfo-missing" };
    }
    for (const filename of batch) {
      const key = fileKey(filename);
      if (!returned.has(key)) cached[key] = { title: filename, error: "not-found" };
    }
    process.stdout.write(`\rCommons: ${index + 1}/${batches.length} пакетов`);
    if (index + 1 < batches.length) await sleep(250);
  }
  if (batches.length) process.stdout.write("\n");
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(metadataCachePath, `${JSON.stringify(cached)}\n`, "utf8");
  return cached;
}

function portraitMetadata(qid, filename, cached) {
  const record = cached[fileKey(filename)];
  const imageInfo = record?.imageInfo;
  if (!imageInfo) {
    return { qid, filename, allowed: false, reason: record?.error || "not-found" };
  }
  const license = licenseDecision(imageInfo);
  const mime = imageInfo.mime || "";
  if (!license.allowed) {
    return {
      qid,
      filename,
      allowed: false,
      reason: `license:${license.licenseName || "unknown"}`,
    };
  }
  if (!/^image\/(?:jpeg|png|webp|tiff)$/u.test(mime)) {
    return { qid, filename, allowed: false, reason: `mime:${mime || "unknown"}` };
  }

  const sourceUrl =
    imageInfo.descriptionurl ||
    `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replace(/ /gu, "_"))}`;
  return {
    qid,
    filename,
    allowed: true,
    downloadUrl: imageInfo.thumburl || imageInfo.url,
    sourceUrl,
    portrait: `assets/writer-portraits/${qid.toLocaleLowerCase("en")}.webp`,
    portraitRights: {
      status: license.status,
      licenseName: license.licenseName || undefined,
      licenseUrl: license.licenseUrl || undefined,
      creator:
        metadataValue(imageInfo.extmetadata, "Artist") ||
        metadataValue(imageInfo.extmetadata, "Credit") ||
        undefined,
      sourceUrl,
      checkedAt,
    },
  };
}

async function downloadPortrait(metadata, attempt = 1) {
  const target = path.join(
    outputDirectory,
    `${metadata.qid.toLocaleLowerCase("en")}.webp`
  );
  if (existsSync(target) && !refresh) return { ...metadata, downloaded: true };
  try {
    const response = await fetch(metadata.downloadUrl, {
      headers: {
        Accept: "image/*",
        "User-Agent": "ProbPeraPortraitAudit/1.0 (probperasite@yandex.ru)",
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.retryAfter = Number(response.headers.get("retry-after") || 0);
      throw error;
    }
    const source = Buffer.from(await response.arrayBuffer());
    await sharp(source)
      .rotate()
      .resize({ width: 384, height: 480, fit: "cover", position: "attention" })
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toFile(target);
    return { ...metadata, downloaded: true };
  } catch (error) {
    if (attempt < 6) {
      const retryAfter = Number(error.retryAfter || 0) * 1_000;
      const rateLimitPause = /HTTP 429/u.test(error.message) ? 10_000 : 0;
      await sleep(
        Math.max(retryAfter, rateLimitPause, 1_250 * 2 ** (attempt - 1))
      );
      return downloadPortrait(metadata, attempt + 1);
    }
    return { ...metadata, downloaded: false, reason: `download:${error.message}` };
  }
}

async function mapConcurrent(values, concurrency, mapper) {
  const result = new Array(values.length);
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index], index);
      await sleep(750);
      completed += 1;
      if (completed % 20 === 0 || completed === values.length) {
        process.stdout.write(`\rПортреты: ${completed}/${values.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (values.length) process.stdout.write("\n");
  return result;
}

function applyGeneratedPortraits(groups, usableByQid) {
  return Object.fromEntries(
    Object.entries(groups).map(([countryId, writers]) => [
      countryId,
      writers.map((writer) => {
        const portrait = usableByQid.get(writer.wikidataId);
        if (!portrait) return writer;
        return {
          ...writer,
          portrait: portrait.portrait,
          portraitAlt: `Портрет: ${writer.fullName}`,
          portraitSourceUrl: portrait.sourceUrl,
          portraitRights: portrait.portraitRights,
          portraitCandidateUrl: undefined,
          portraitRightsStatus: undefined,
        };
      }),
    ])
  );
}

function reportMarkdown(report) {
  const lines = [
    "# Портреты писателей",
    "",
    `Сформировано: ${report.generatedAt}`,
    "",
    `- Публичных карточек писателей: ${report.summary.publicWriterRecords}`,
    `- Уникальных публичных писателей: ${report.summary.uniquePublicWriters}`,
    `- Уже имели локальный портрет: ${report.summary.existingPublicPortraits}`,
    `- Надёжно связаны с Wikidata: ${report.summary.matchedPublicWriters}`,
    `- Получили свободный оптимизированный портрет: ${report.summary.publicRealPortraits}`,
    `- Используют фирменную заглушку: ${report.summary.publicPlaceholders}`,
    `- Кандидатов P18 в очереди из 2356 записей: ${report.summary.generatedPortraitCandidates}`,
    `- Свободных файлов после проверки лицензии: ${report.summary.allowedUniquePortraits}`,
    `- Файлов скачано и преобразовано в WebP: ${report.summary.downloadedUniquePortraits}`,
    "",
    "## Требуют ручной проверки",
    "",
    ...report.manualReview.slice(0, 500).map(
      (item) => `- ${item.countryId}:${item.writerId} — ${item.name} (${item.reason})`
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const [
    facts,
    generatedGroups,
    publicCountries,
    existingManifest,
    curatedQids,
  ] = await Promise.all([
    readJson(factsPath, null),
    readJson(generatedWritersPath, {}),
    loadPublicCountries(),
    readJson(manifestPath, { writers: {} }),
    readJson(curatedQidsPath, { writers: {} }),
  ]);
  if (!facts) throw new Error("Сначала выполните npm run writers:facts:audit");

  const indexes = indexRecords(facts.records);
  const publicMatches = [];
  const manualReview = [];
  const manifestWriters = { ...(existingManifest.writers || {}) };
  const publicPortraitKeys = new Set();
  let publicWriterRecords = 0;
  let existingPublicPortraits = 0;
  const uniquePublicWriterKeys = new Set();

  for (const country of publicCountries) {
    for (const writer of country.writers) {
      const manifestKey = `${country.id}:${writer.id}`;
      publicWriterRecords += 1;
      uniquePublicWriterKeys.add(
        `${normalizedName(writerName(writer))}:${year(
          writer.birthDate || writer.birth || writer.years
        )}`
      );
      const existingPortrait = manifestWriters[manifestKey];
      const existingPortraitPath = existingPortrait?.portrait
        ? path.join(projectRoot, "public", existingPortrait.portrait)
        : "";
      if (existingPortrait && existsSync(existingPortraitPath)) {
        existingPublicPortraits += 1;
        publicPortraitKeys.add(manifestKey);
        continue;
      }
      if (writer.portrait) {
        existingPublicPortraits += 1;
        publicPortraitKeys.add(manifestKey);
        continue;
      }
      const curated = curatedQids.writers?.[manifestKey];
      const record = curated
        ? {
            wikidataId: curated.wikidataId,
            live: { portraitFilename: curated.portraitFilename },
          }
        : matchPublicWriter(country.id, writer, indexes);
      if (record) {
        publicMatches.push({ countryId: country.id, writer, record });
      } else {
        manualReview.push({
          countryId: country.id,
          writerId: writer.id,
          name: writerName(writer),
          reason: "нет однозначного совпадения имени, года рождения и QID",
        });
      }
    }
  }

  const qidToFilename = new Map();
  for (const record of facts.records) {
    if (record.status === "source-confirmed" && record.live?.portraitFilename) {
      qidToFilename.set(record.wikidataId, record.live.portraitFilename);
    }
  }
  for (const writer of Object.values(curatedQids.writers || {})) {
    if (writer.wikidataId && writer.portraitFilename) {
      qidToFilename.set(writer.wikidataId, writer.portraitFilename);
    }
  }
  const filenames = [...new Set(qidToFilename.values())];
  const commonsCache = await loadCommonsMetadata(filenames);
  const checkedPortraits = [...qidToFilename.entries()].map(([qid, filename]) =>
    portraitMetadata(qid, filename, commonsCache)
  );
  const allowedPortraits = checkedPortraits.filter((portrait) => portrait.allowed);
  const publicQids = new Set(
    publicMatches.map((match) => match.record.wikidataId)
  );
  const publicPortraitCandidates = allowedPortraits.filter((portrait) =>
    publicQids.has(portrait.qid)
  );

  let processedPortraits = publicPortraitCandidates;
  if (applyChanges) {
    await mkdir(outputDirectory, { recursive: true });
    processedPortraits = await mapConcurrent(
      publicPortraitCandidates,
      1,
      downloadPortrait
    );
  }
  const usablePortraits = processedPortraits.filter(
    (portrait) => portrait.allowed && (!applyChanges || portrait.downloaded)
  );
  const usableByQid = new Map(
    usablePortraits.map((portrait) => [portrait.qid, portrait])
  );

  for (const match of publicMatches) {
    const portrait = usableByQid.get(match.record.wikidataId);
    if (!portrait) {
      manualReview.push({
        countryId: match.countryId,
        writerId: match.writer.id,
        name: writerName(match.writer),
        reason:
          checkedPortraits.find((item) => item.qid === match.record.wikidataId)
            ?.reason || "свободный портрет не подтверждён",
      });
      continue;
    }
    manifestWriters[`${match.countryId}:${match.writer.id}`] = {
      portrait: portrait.portrait,
      portraitAlt: `Портрет: ${writerName(match.writer)}`,
      portraitSourceUrl: portrait.sourceUrl,
      portraitRights: portrait.portraitRights,
    };
    publicPortraitKeys.add(`${match.countryId}:${match.writer.id}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      identity: "exact normalized name + birth year + unique Wikidata QID",
      licenses:
        "Public domain, CC0, CC BY and CC BY-SA from Wikimedia Commons only",
      output: "384x480 WebP, quality 82, attention crop",
    },
    summary: {
      publicWriterRecords,
      uniquePublicWriters: uniquePublicWriterKeys.size,
      existingPublicPortraits,
      matchedPublicWriters: publicMatches.length,
      publicRealPortraits: publicPortraitKeys.size,
      publicPlaceholders: publicWriterRecords - publicPortraitKeys.size,
      generatedPortraitCandidates: qidToFilename.size,
      allowedUniquePortraits: allowedPortraits.length,
      publicPortraitCandidates: publicPortraitCandidates.length,
      downloadedUniquePortraits: usablePortraits.length,
      rejectedByLicenseOrFormat: checkedPortraits.length - allowedPortraits.length,
      downloadFailures: processedPortraits.filter(
        (portrait) => portrait.allowed && !portrait.downloaded
      ).length,
    },
    manualReview,
    rejectedFiles: checkedPortraits
      .filter((portrait) => !portrait.allowed)
      .map(({ qid, filename, reason }) => ({ qid, filename, reason })),
    downloadFailures: processedPortraits
      .filter((portrait) => portrait.allowed && !portrait.downloaded)
      .map(({ qid, filename, reason }) => ({ qid, filename, reason })),
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportMarkdownPath, reportMarkdown(report), "utf8");

  if (applyChanges) {
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        { generatedAt: report.generatedAt, writers: manifestWriters },
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      generatedWritersPath,
      `${JSON.stringify(
        applyGeneratedPortraits(generatedGroups, usableByQid),
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  console.log(JSON.stringify(report.summary, null, 2));
}

await main();
