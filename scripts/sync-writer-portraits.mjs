import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { createServer } from "vite";

import { portraitRightsFromLicensedQueueEntry } from "./lib/writer-portrait-rights-workflow.mjs";

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
const identityRemediationsPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerIdentityRemediations.generated.json"
);
const portraitRejectionsPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerPortraitRejections.json"
);
const portraitAttributionOverridesPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "writerPortraitAttributionOverrides.json"
);
const portraitRightsQueuePath = path.join(
  projectRoot,
  "data",
  "writer-portrait-rights-queue.json"
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
const stagingDirectory = path.join(cacheDirectory, "staging");
const applyChanges = process.argv.includes("--apply");
const stageOnly = process.argv.includes("--stage-only");
const processCandidates = applyChanges || stageOnly;
const refresh = process.argv.includes("--refresh");
const forceKeys = new Set(
  process.argv
    .filter((argument) => argument.startsWith("--force-key="))
    .flatMap((argument) => argument.slice("--force-key=".length).split(","))
    .map((key) => key.trim())
    .filter(Boolean)
);
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

function portraitQid(value) {
  const qid = String(value || "").match(/(?:^|\/)q(\d+)\.webp$/iu)?.[1];
  return qid ? `Q${qid}` : "";
}

function stalePortraitQids(remediations) {
  return new Map(
    [
      ...(remediations?.repairedMappings || []),
      ...(remediations?.removedMappings || []),
    ]
      .filter((item) => item?.key && item?.oldQid)
      .map((item) => [item.key, item.oldQid])
  );
}

function rejectionSources(rejection) {
  if (!rejection) return [];
  return [rejection, ...(rejection.blockedSources || [])];
}

export function rejectionMatches(rejection, { filename = "", sourceUrl = "" }) {
  return rejectionSources(rejection).some(
    (source) =>
      (filename && source.filename && fileKey(filename) === fileKey(source.filename)) ||
      (sourceUrl && source.sourceUrl && sourceUrl === source.sourceUrl)
  );
}

export function effectiveKeyedPortraitCandidate(
  key,
  record,
  curatedWriters,
  overrides
) {
  const fallback = {
    filename: record?.live?.portraitFilename || "",
    sourceUrl: record?.live?.portraitSourceUrl || "",
  };
  const override = overrides?.[key];
  const curatedQid = curatedWriters?.[key]?.wikidataId;
  if (
    !override?.filename ||
    !curatedQid ||
    curatedQid !== record?.wikidataId
  ) {
    return fallback;
  }
  return {
    filename: override.filename,
    sourceUrl: override.sourceUrl || fallback.sourceUrl,
  };
}

export function applyKeyedPortraitFilenameOverrides(
  qidToFilename,
  curatedWriters,
  overrides
) {
  for (const [key, override] of Object.entries(overrides || {})) {
    const qid = curatedWriters?.[key]?.wikidataId;
    if (!qid || !override?.filename) continue;
    qidToFilename.set(qid, override.filename);
  }
  return qidToFilename;
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

export function licenseDecision(
  imageInfo,
  creatorOverride = "",
  manualLicense = null
) {
  const metadata = imageInfo?.extmetadata || {};
  const licenseName =
    metadataValue(metadata, "LicenseShortName") ||
    metadataValue(metadata, "UsageTerms");
  const licenseUrl = metadataValue(metadata, "LicenseUrl");
  const categories = metadataValue(metadata, "Categories");
  const creator =
    creatorOverride ||
    metadataValue(metadata, "Artist") ||
    metadataValue(metadata, "Credit") ||
    "";
  const normalized = `${licenseName} ${licenseUrl} ${categories}`.toLocaleLowerCase(
    "en"
  );
  const restricted =
    /\bby-nc\b|\bby-nd\b|non.?commercial|no.?derivatives|fair.?use|works copyrighted in the u\.?s\.?|wrong.?license|disputed copyright|deletion requests?|license review needed|need(?:s|ing)? license review|youtube[^|]*review needed|review needed[^|]*youtube/u.test(
      normalized
    );
  const publicDomain = /public.?domain|\bcc0\b|publicdomain/u.test(normalized);
  const attributionOnly =
    manualLicense?.kind === "wikimedia-attribution-only" &&
    licenseName.toLocaleLowerCase("en") === "attribution" &&
    /(?:^|\|)attribution only license(?:\||$)/u.test(
      categories.toLocaleLowerCase("en")
    );
  const licensed =
    /\bcc.?by(?:-sa)?\b|creative.?commons.?attribution/u.test(normalized) ||
    attributionOnly;
  const missingLicensedCreator =
    licensed && (!creator || /\bunknown(?: author)?\b/iu.test(creator));

  return {
    allowed:
      !restricted && !missingLicensedCreator && (publicDomain || licensed),
    status: publicDomain ? "public-domain" : "licensed",
    licenseName: attributionOnly
      ? manualLicense.licenseName || licenseName
      : licenseName,
    licenseUrl: attributionOnly
      ? manualLicense.licenseUrl || licenseUrl
      : licenseUrl,
    creator,
    reason: restricted
      ? "territorial-or-use-restriction"
      : missingLicensedCreator
        ? "licensed-file-missing-attribution-creator"
        : "",
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

function portraitMetadata(qid, filename, cached, attributionOverride) {
  const record = cached[fileKey(filename)];
  const imageInfo = record?.imageInfo;
  if (!imageInfo) {
    return { qid, filename, allowed: false, reason: record?.error || "not-found" };
  }
  const license = licenseDecision(
    imageInfo,
    attributionOverride?.creator,
    attributionOverride?.manualLicense
  );
  const mime = imageInfo.mime || "";
  if (!license.allowed) {
    return {
      qid,
      filename,
      allowed: false,
      reason:
        license.reason || `license:${license.licenseName || "unknown"}`,
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
    downloadUrl: attributionOverride?.useOriginal
      ? imageInfo.url
      : imageInfo.thumburl || imageInfo.url,
    sourceUrl,
    portrait: `assets/writer-portraits/${qid.toLocaleLowerCase("en")}.webp`,
    portraitRights: {
      status: license.status,
      licenseName: license.licenseName || undefined,
      licenseUrl: license.licenseUrl || undefined,
      creator: license.creator || undefined,
      sourceUrl,
      checkedAt,
    },
    sourceWidth: Number(imageInfo.width || 0),
    sourceHeight: Number(imageInfo.height || 0),
    crop: attributionOverride?.crop,
  };
}

async function downloadPortrait(
  metadata,
  attempt = 1,
  forceDownload = false,
  targetDirectory = outputDirectory
) {
  const target = path.join(
    targetDirectory,
    `${metadata.qid.toLocaleLowerCase("en")}.webp`
  );
  if (existsSync(target) && !refresh && !forceDownload) {
    const targetBytes = await readFile(target);
    return {
      ...metadata,
      downloaded: true,
      targetPath: target,
      assetSha256: createHash("sha256").update(targetBytes).digest("hex"),
    };
  }
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
    let pipeline = sharp(source).rotate();
    if (metadata.crop) {
      pipeline = pipeline.extract(metadata.crop);
    }
    await pipeline
      .resize({ width: 384, height: 480, fit: "cover", position: "attention" })
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toFile(target);
    const targetBytes = await readFile(target);
    return {
      ...metadata,
      downloaded: true,
      targetPath: target,
      assetSha256: createHash("sha256").update(targetBytes).digest("hex"),
    };
  } catch (error) {
    if (attempt < 6) {
      const retryAfter = Number(error.retryAfter || 0) * 1_000;
      const rateLimitPause = /HTTP 429/u.test(error.message) ? 10_000 : 0;
      await sleep(
        Math.max(retryAfter, rateLimitPause, 1_250 * 2 ** (attempt - 1))
      );
      return downloadPortrait(
        metadata,
        attempt + 1,
        forceDownload,
        targetDirectory
      );
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

function applyGeneratedPortraits(
  groups,
  usableByQid,
  portraitRejections,
  manifestWriters
) {
  const rejectedSourcesByQid = new Map();
  for (const rejection of Object.values(portraitRejections.rejections || {})) {
    if (!rejection?.wikidataId) continue;
    const sourceUrls = rejectedSourcesByQid.get(rejection.wikidataId) || new Set();
    for (const source of rejectionSources(rejection)) {
      if (source?.sourceUrl) sourceUrls.add(source.sourceUrl);
    }
    rejectedSourcesByQid.set(rejection.wikidataId, sourceUrls);
  }
  const canonicalPortraitsByQid = new Map();
  for (const portrait of Object.values(manifestWriters || {})) {
    const qid = portraitQid(portrait?.portrait);
    if (!qid) continue;
    const existing = canonicalPortraitsByQid.get(qid);
    if (!existing) {
      canonicalPortraitsByQid.set(qid, portrait);
      continue;
    }
    if (
      existing.portrait !== portrait.portrait ||
      existing.portraitSourceUrl !== portrait.portraitSourceUrl
    ) {
      canonicalPortraitsByQid.set(qid, null);
    }
  }

  return Object.fromEntries(
    Object.entries(groups).map(([countryId, writers]) => [
      countryId,
      writers.map((writer) => {
        const manifestKey = `${countryId}:${writer.id}`;
        const exactCanonicalPortrait = manifestWriters?.[manifestKey];
        const canonicalPortrait =
          exactCanonicalPortrait || canonicalPortraitsByQid.get(writer.wikidataId);
        if (
          canonicalPortrait &&
          portraitQid(canonicalPortrait.portrait) === writer.wikidataId
        ) {
          return {
            ...writer,
            ...canonicalPortrait,
            portraitCandidateUrl: undefined,
            portraitRightsStatus: undefined,
          };
        }
        if (rejectedSourcesByQid.get(writer.wikidataId)?.has(writer.portraitSourceUrl)) {
          const {
            portrait: _portrait,
            portraitAlt: _portraitAlt,
            portraitSourceUrl: _portraitSourceUrl,
            portraitRights: _portraitRights,
            ...cleanWriter
          } = writer;
          return cleanWriter;
        }
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
    `- Публичные карточки без портрета: ${report.summary.publicMissingPortraits}`,
    `- Новых портретов готовы к применению: ${report.summary.readyNewPublicPortraits}`,
    `- Удалено устаревших записей manifest: ${report.summary.removedStaleManifestEntries}`,
    `- Удалено осиротевших записей manifest: ${report.summary.removedOrphanManifestEntries}`,
    `- Удалено записей, отклонённых правовой/визуальной проверкой: ${report.summary.removedPolicyRejectedManifestEntries}`,
    `- Исправлено записей атрибуции: ${report.summary.normalizedAttributionEntries}`,
    `- Обновлена дата онлайн-проверки прав: ${report.summary.refreshedRightsEntries}`,
    `- Низкое разрешение исходника (ручная очередь): ${report.summary.lowResolutionPortraits}`,
    `- Кандидатов P18 в очереди из 2356 записей: ${report.summary.generatedPortraitCandidates}`,
    `- Свободных файлов после проверки лицензии: ${report.summary.allowedUniquePortraits}`,
    `- Файлов скачано и преобразовано в WebP: ${report.summary.downloadedUniquePortraits}`,
    "",
    "## Требуют ручной проверки",
    "",
    ...report.manualReview.slice(0, 500).map(
      (item) => `- ${item.countryId}:${item.writerId} - ${item.name} (${item.reason})`
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
    identityRemediations,
    portraitRejections,
    portraitAttributionOverrides,
    portraitRightsQueue,
  ] = await Promise.all([
    readJson(factsPath, null),
    readJson(generatedWritersPath, {}),
    loadPublicCountries(),
    readJson(manifestPath, { writers: {} }),
    readJson(curatedQidsPath, { writers: {} }),
    readJson(identityRemediationsPath, {
      repairedMappings: [],
      removedMappings: [],
    }),
    readJson(portraitRejectionsPath, { rejections: {} }),
    readJson(portraitAttributionOverridesPath, { overrides: {} }),
    readJson(portraitRightsQueuePath, { writers: [] }),
  ]);
  if (!facts) throw new Error("Сначала выполните npm run writers:facts:audit");

  const indexes = indexRecords(facts.records);
  const portraitRightsQueueByKey = new Map(
    (portraitRightsQueue.writers || []).map((entry) => [entry.key, entry])
  );
  const publicMatches = [];
  const manualReview = [];
  const manifestWriters = { ...(existingManifest.writers || {}) };
  const publicWriterKeys = new Set(
    publicCountries.flatMap((country) =>
      country.writers.map((writer) => `${country.id}:${writer.id}`)
    )
  );
  const orphanManifestEntries = Object.keys(manifestWriters).filter(
    (key) => !publicWriterKeys.has(key)
  );
  for (const key of orphanManifestEntries) delete manifestWriters[key];

  const staleQids = stalePortraitQids(identityRemediations);
  const staleManifestEntries = Object.entries(manifestWriters)
    .filter(([key, portrait]) => staleQids.get(key) === portraitQid(portrait?.portrait))
    .map(([key]) => key);
  for (const key of staleManifestEntries) delete manifestWriters[key];

  const policyRejectedManifestEntries = Object.entries(manifestWriters)
    .filter(([key, portrait]) => {
      const rejection = portraitRejections.rejections?.[key];
      return rejectionMatches(rejection, {
        sourceUrl: portrait?.portraitSourceUrl,
      });
    })
    .map(([key]) => key);
  for (const key of policyRejectedManifestEntries) delete manifestWriters[key];

  const normalizedAttributionEntries = [];
  for (const [key, override] of Object.entries(
    portraitAttributionOverrides.overrides || {}
  )) {
    const portrait = manifestWriters[key];
    if (
      !portrait ||
      portrait.portraitSourceUrl !== override.sourceUrl ||
      !override.creator ||
      portrait.portraitRights?.creator === override.creator
    ) {
      continue;
    }
    manifestWriters[key] = {
      ...portrait,
      portraitRights: {
        ...(portrait.portraitRights || {}),
        creator: override.creator,
      },
    };
    normalizedAttributionEntries.push(key);
  }

  const publicPortraitKeys = new Set();
  let publicWriterRecords = 0;
  let existingPublicPortraits = 0;
  const uniquePublicWriterKeys = new Set();

  for (const country of publicCountries) {
    for (const writer of country.writers) {
      const manifestKey = `${country.id}:${writer.id}`;
      const forcePortrait = forceKeys.has(manifestKey);
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
      if (!forcePortrait && existingPortrait && existsSync(existingPortraitPath)) {
        existingPublicPortraits += 1;
        publicPortraitKeys.add(manifestKey);
        continue;
      }
      const directPortraitPath = writer.portrait
        ? path.join(projectRoot, "public", writer.portrait)
        : "";
      if (!forcePortrait && writer.portrait && existsSync(directPortraitPath)) {
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
      const rejection = portraitRejections.rejections?.[manifestKey];
      const effectivePortrait = record
        ? effectiveKeyedPortraitCandidate(
            manifestKey,
            record,
            curatedQids.writers || {},
            portraitAttributionOverrides.overrides || {}
          )
        : { filename: "", sourceUrl: "" };
      if (
        record &&
        rejectionMatches(rejection, {
          filename: effectivePortrait.filename,
          sourceUrl: effectivePortrait.sourceUrl,
        })
      ) {
        manualReview.push({
          countryId: country.id,
          writerId: writer.id,
          name: writerName(writer),
          reason: rejection.reasonCode,
        });
        continue;
      }
      if (record) {
        publicMatches.push({
          countryId: country.id,
          writer,
          record: {
            ...record,
            live: {
              ...(record.live || {}),
              portraitFilename: effectivePortrait.filename,
              portraitSourceUrl: effectivePortrait.sourceUrl,
            },
          },
        });
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
  applyKeyedPortraitFilenameOverrides(
    qidToFilename,
    curatedQids.writers || {},
    portraitAttributionOverrides.overrides || {}
  );
  const filenames = [...new Set(qidToFilename.values())];
  const commonsCache = await loadCommonsMetadata(filenames);
  const attributionByFilename = new Map(
    Object.values(portraitAttributionOverrides.overrides || {})
      .filter((override) => override?.filename && override?.creator)
      .map((override) => [fileKey(override.filename), override])
  );
  const checkedPortraits = [...qidToFilename.entries()].map(([qid, filename]) =>
    portraitMetadata(
      qid,
      filename,
      commonsCache,
      attributionByFilename.get(fileKey(filename))
    )
  );
  const checkedPortraitsByQid = new Map(
    checkedPortraits.map((portrait) => [portrait.qid, portrait])
  );
  const refreshedRightsEntries = [];
  for (const [key, portrait] of Object.entries(manifestWriters)) {
    const checkedPortrait = checkedPortraitsByQid.get(
      portraitQid(portrait?.portrait)
    );
    if (
      !checkedPortrait?.allowed ||
      checkedPortrait.sourceUrl !== portrait.portraitSourceUrl ||
      portrait.portraitRights?.checkedAt === checkedAt
    ) {
      continue;
    }
    manifestWriters[key] = {
      ...portrait,
      portraitRights: {
        ...portrait.portraitRights,
        checkedAt,
      },
    };
    refreshedRightsEntries.push(key);
  }
  const allowedPortraits = checkedPortraits.filter((portrait) => portrait.allowed);
  const publishedPortraitQids = new Set(
    publicCountries
      .flatMap((country) => country.writers)
      .map((writer) => portraitQid(writer.portrait))
      .filter(Boolean)
  );
  const publicQids = new Set(
    publicMatches.map((match) => match.record.wikidataId)
  );
  const publicPortraitCandidates = allowedPortraits.filter((portrait) =>
    publicQids.has(portrait.qid)
  );
  const appliedOrPublishedQids = new Set([
    ...publishedPortraitQids,
    ...publicPortraitCandidates.map((portrait) => portrait.qid),
  ]);
  const lowResolutionPortraits = allowedPortraits.filter(
    (portrait) =>
      appliedOrPublishedQids.has(portrait.qid) &&
      (portrait.sourceWidth < 200 || portrait.sourceHeight < 250)
  );
  const forcedDownloadQids = new Set(
    publicMatches
      .filter((match) => {
        const key = `${match.countryId}:${match.writer.id}`;
        return forceKeys.has(key) || portraitRejections.rejections?.[key];
      })
      .map((match) => match.record.wikidataId)
  );

  const selectedPortraitCandidates = forceKeys.size
    ? publicPortraitCandidates.filter((portrait) =>
        forcedDownloadQids.has(portrait.qid)
      )
    : publicPortraitCandidates;
  let processedPortraits = selectedPortraitCandidates;
  if (processCandidates) {
    await mkdir(stagingDirectory, { recursive: true });
    processedPortraits = await mapConcurrent(
      selectedPortraitCandidates,
      1,
      (portrait) =>
        downloadPortrait(
          portrait,
          1,
          true,
          stagingDirectory
        )
    );
  }
  const usablePortraits = processedPortraits.filter(
    (portrait) => portrait.allowed && (!processCandidates || portrait.downloaded)
  );
  const usableByQid = new Map(
    usablePortraits.map((portrait) => [portrait.qid, portrait])
  );
  const readyCandidates = [];

  if (applyChanges) {
    await mkdir(outputDirectory, { recursive: true });
  }

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
    let approvedPortraitRights = null;
    if (applyChanges) {
      const manifestKey = `${match.countryId}:${match.writer.id}`;
      const queueEntry = portraitRightsQueueByKey.get(manifestKey);
      approvedPortraitRights = portraitRightsFromLicensedQueueEntry(queueEntry, {
        today: checkedAt,
        identityRegistry: curatedQids.writers,
      });
      const expectedAssetRef = `staging://writer-portraits/${portrait.qid.toLocaleLowerCase("en")}.webp#sha256=${portrait.assetSha256}`;
      if (queueEntry.candidate.assetRef !== expectedAssetRef) {
        throw new Error(
          `Portrait ${manifestKey} staged asset digest does not match the licensed queue entry.`
        );
      }
      if (queueEntry.rights.sourceUrl !== portrait.sourceUrl) {
        throw new Error(
          `Portrait ${manifestKey} Commons source does not match the licensed queue entry.`
        );
      }
      await copyFile(
        portrait.targetPath,
        path.join(
          outputDirectory,
          `${portrait.qid.toLocaleLowerCase("en")}.webp`
        )
      );
      manifestWriters[manifestKey] = {
        portrait: portrait.portrait,
        portraitAlt: `Портрет: ${writerName(match.writer)}`,
        portraitSourceUrl: approvedPortraitRights.sourceUrl,
        portraitRights: approvedPortraitRights,
      };
      publicPortraitKeys.add(manifestKey);
    }
    readyCandidates.push({
      countryId: match.countryId,
      writerId: match.writer.id,
      name: writerName(match.writer),
      wikidataId: portrait.qid,
      filename: portrait.filename,
      sourceUrl: approvedPortraitRights?.sourceUrl || portrait.sourceUrl,
      portrait: portrait.portrait,
      portraitRights: approvedPortraitRights || portrait.portraitRights,
      stagingAssetRef: portrait.assetSha256
        ? `staging://writer-portraits/${portrait.qid.toLocaleLowerCase("en")}.webp#sha256=${portrait.assetSha256}`
        : undefined,
    });
  }

  const readyPublicPortraits = processCandidates
    ? usablePortraits.length
    : publicPortraitCandidates.length;
  const downloadFailures = processCandidates
    ? processedPortraits.filter(
        (portrait) => portrait.allowed && !portrait.downloaded
      )
    : [];

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
      publicMissingPortraits: publicWriterRecords - publicPortraitKeys.size,
      readyNewPublicPortraits: readyPublicPortraits,
      removedStaleManifestEntries: staleManifestEntries.length,
      removedOrphanManifestEntries: orphanManifestEntries.length,
      removedPolicyRejectedManifestEntries:
        policyRejectedManifestEntries.length,
      normalizedAttributionEntries: normalizedAttributionEntries.length,
      refreshedRightsEntries: refreshedRightsEntries.length,
      lowResolutionPortraits: lowResolutionPortraits.length,
      generatedPortraitCandidates: qidToFilename.size,
      allowedUniquePortraits: allowedPortraits.length,
      publicPortraitCandidates: publicPortraitCandidates.length,
      downloadedUniquePortraits: processCandidates ? usablePortraits.length : 0,
      rejectedByLicenseOrFormat: checkedPortraits.length - allowedPortraits.length,
      downloadFailures: downloadFailures.length,
    },
    manualReview,
    readyCandidates,
    lowResolutionPortraits: lowResolutionPortraits.map(
      ({ qid, filename, sourceWidth, sourceHeight, sourceUrl }) => ({
        qid,
        filename,
        sourceWidth,
        sourceHeight,
        sourceUrl,
      })
    ),
    rejectedFiles: checkedPortraits
      .filter((portrait) => !portrait.allowed)
      .map(({ qid, filename, reason }) => ({ qid, filename, reason })),
    downloadFailures: downloadFailures
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
        applyGeneratedPortraits(
          generatedGroups,
          usableByQid,
          portraitRejections,
          manifestWriters
        ),
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  console.log(JSON.stringify(report.summary, null, 2));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
