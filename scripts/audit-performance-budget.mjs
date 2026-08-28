import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { articleIdSet } from "./lib/cms-publication-state.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const budget = JSON.parse(
  await readFile(path.join(root, "performance-budget.json"), "utf8")
);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(target) : Promise.resolve([target]);
    })
  );
  return nested.flat();
}

const files = await filesIn(dist);
const measured = await Promise.all(
  files.map(async (file) => ({
    file,
    relative: path.relative(dist, file).replaceAll("\\", "/"),
    bytes: (await stat(file)).size,
  }))
);
const failures = [];
const total = measured.reduce((sum, item) => sum + item.bytes, 0);
const scripts = measured.filter((item) => item.relative.endsWith(".js"));
const images = measured.filter((item) => /\.(?:avif|jpe?g|png|webp)$/iu.test(item.relative));
const writerPortraits = images.filter((item) =>
  item.relative.startsWith("assets/writer-portraits/")
);
const bookCovers = images.filter((item) =>
  item.relative.startsWith("brand/book-covers/")
);
const largestScript = scripts.toSorted((a, b) => b.bytes - a.bytes)[0];
const mainScript = scripts
  .filter((item) => /^assets\/index-/u.test(item.relative))
  .toSorted((a, b) => b.bytes - a.bytes)[0];
const globeTexture = measured.find((item) =>
  item.relative.endsWith("textures/antique-world-1887.webp")
);
const oversizedImages = images.filter(
  (item) =>
    item.relative !== globeTexture?.relative &&
    item.bytes > budget.individualImageBytes
);

async function compressedBytes(item) {
  if (!item) return 0;
  return gzipSync(await readFile(item.file), { level: 9 }).byteLength;
}

const writerPortraitTotal = writerPortraits.reduce(
  (sum, item) => sum + item.bytes,
  0
);
const writerPortraitAverage = writerPortraits.length
  ? Math.ceil(writerPortraitTotal / writerPortraits.length)
  : 0;
const writerPortraitMaximum = writerPortraits.reduce(
  (maximum, item) => Math.max(maximum, item.bytes),
  0
);
const bookCoverTotal = bookCovers.reduce((sum, item) => sum + item.bytes, 0);
const bookCoverAverage = bookCovers.length
  ? Math.ceil(bookCoverTotal / bookCovers.length)
  : 0;
const bookCoverMaximum = bookCovers.reduce(
  (maximum, item) => Math.max(maximum, item.bytes),
  0
);
const distExcludingBookCovers = total - bookCoverTotal;
const largestScriptGzip = await compressedBytes(largestScript);
const mainScriptGzip = await compressedBytes(mainScript);

function parseTagAttributes(tag) {
  const attributes = new Map();
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
  let match;
  while ((match = attributePattern.exec(tag))) {
    const name = match[1].toLowerCase();
    if (name === "script" || name === "link") continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function initialAssetReferences(html) {
  const references = [];
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/giu)) {
    const tagName = match[1].toLowerCase();
    const attributes = parseTagAttributes(match[0]);
    if (tagName === "script") {
      const source = attributes.get("src")?.trim();
      const type = attributes.get("type")?.trim().toLowerCase();
      if (type === "module") {
        references.push({
          kind: "module script",
          source,
          counted: true,
        });
      }
      continue;
    }

    const relation = new Set(
      (attributes.get("rel") || "")
        .toLowerCase()
        .split(/\s+/u)
        .filter(Boolean)
    );
    const source = attributes.get("href")?.trim();
    if (relation.has("modulepreload")) {
      references.push({ kind: "modulepreload", source, counted: true });
    } else if (relation.has("stylesheet")) {
      references.push({ kind: "stylesheet", source, counted: true });
    } else if (relation.has("preload")) {
      // Other explicit preloads are checked for existence and forbidden payloads,
      // but the Stage 5F gzip ceiling is intentionally JS/modulepreload/CSS only.
      references.push({ kind: "preload", source, counted: false });
    }
  }
  return references;
}

function normalizeSiteBasePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "performance-budget.json requires siteBasePath" };
  }
  const raw = value.trim();
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(raw)) {
    return { error: "siteBasePath must be a root-relative path" };
  }
  if (raw.includes("\\") || raw.includes("?") || raw.includes("#")) {
    return { error: "siteBasePath contains invalid URL characters" };
  }
  const segments = raw.split("/");
  if (segments.includes("..")) return { error: "siteBasePath escapes the site root" };
  const normalized = `/${raw.replace(/^\/+|\/+$/gu, "")}`;
  return { base: normalized === "/" ? "/" : `${normalized}/` };
}

async function resolveActiveSiteBasePath() {
  const cname = measured.find((item) => item.relative === "CNAME");
  if (!cname) return normalizeSiteBasePath(budget.siteBasePath);

  const expectedDomain = String(budget.domainCname || "")
    .trim()
    .toLowerCase();
  if (!expectedDomain) {
    return { error: "performance-budget.json requires domainCname for a domain release" };
  }
  const actualDomain = (await readFile(cname.file, "utf8")).trim().toLowerCase();
  if (actualDomain !== expectedDomain) {
    return {
      error: `dist/CNAME ${actualDomain || "<empty>"} does not match ${expectedDomain}`,
    };
  }
  return normalizeSiteBasePath(budget.domainSiteBasePath);
}

function normalizeDistAssetReference(source, siteBasePath) {
  if (!source) return { error: "missing URL" };
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(source)) {
    return { error: "external URLs cannot be measured fail-closed" };
  }
  if (source.includes("\\")) return { error: "backslashes are not valid asset URLs" };

  const pathOnly = source.split(/[?#]/u, 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    return { error: "invalid URL encoding" };
  }
  if (decoded.startsWith("/")) {
    if (!siteBasePath) return { error: "configured site base is unavailable" };
    if (
      siteBasePath !== "/" &&
      !decoded.startsWith(siteBasePath)
    ) {
      return {
        error: `URL is outside configured site base ${siteBasePath}`,
      };
    }
    decoded =
      siteBasePath === "/"
        ? decoded.replace(/^\/+/, "")
        : decoded.slice(siteBasePath.length);
  } else {
    decoded = decoded.replace(/^\.\//u, "");
  }
  const relative = path.posix.normalize(decoded);
  if (!relative || relative === "." || relative === ".." || relative.startsWith("../")) {
    return { error: "asset URL escapes dist" };
  }
  return { relative };
}

function resolveMeasuredInitialAsset(relative, measuredByRelative) {
  const exact = measuredByRelative.get(relative);
  const suffixMatches = [...measuredByRelative.values()].filter((item) =>
    item.relative !== relative && relative.endsWith(`/${item.relative}`)
  );
  if (exact && suffixMatches.length === 0) return { item: exact };
  if (suffixMatches.length > 0) {
    return {
      error: `ambiguous suffix matches ${[
        ...(exact ? [exact] : []),
        ...suffixMatches,
      ]
        .map((item) => item.relative)
        .toSorted()
        .join(", ")}`,
    };
  }
  return { error: "not found in dist" };
}

const forbiddenInitialAssets = [
  {
    label: "Three",
    test: (value) =>
      /(?:^|[./_-])three(?:[./_-]|$)/iu.test(value) ||
      /three(?:js|module|fiber|drei)/iu.test(value),
  },
  {
    label: "BookArchive",
    test: (value) => value.toLowerCase().replaceAll(/[^a-z\d]/gu, "").includes("bookarchive"),
  },
  {
    label: "book-catalog",
    test: (value) => value.toLowerCase().replaceAll(/[^a-z\d]/gu, "").includes("bookcatalog"),
  },
  {
    label: "full search catalog",
    test: (value) => {
      const compact = value.toLowerCase().replaceAll(/[^a-z\d]/gu, "");
      return [
        "searchcatalog",
        "fullsearchcatalog",
        "searchcatalogfull",
        "globalsearchcatalog",
        "globalsearchindex",
      ].some((token) => compact.includes(token));
    },
  },
];

function githubCommandValue(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function annotateFailure(label, actual, limit, unit) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const detail = githubCommandValue(`${label}: ${actual} / ${limit} ${unit}`);
  console.error(`::error title=Performance budget exceeded::${detail}`);
}

function enforce(label, actual, limit, unit = "bytes") {
  const ok = actual <= limit;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual} / ${limit} ${unit}`);
  if (!ok) {
    failures.push(label);
    annotateFailure(label, actual, limit, unit);
  }
}

function recordFailure(label, detail) {
  failures.push(label);
  console.error(`FAIL ${label}: ${detail}`);
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(
      `::error title=Performance budget exceeded::${githubCommandValue(`${label}: ${detail}`)}`
    );
  }
}

function configuredSnapshotRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { error: "cmsArticleGrowthAllowance.snapshotPath is missing" };
  }
  const raw = value.trim();
  if (
    path.posix.isAbsolute(raw) ||
    path.win32.isAbsolute(raw) ||
    raw.includes("\\") ||
    raw.includes("?") ||
    raw.includes("#")
  ) {
    return { error: "cmsArticleGrowthAllowance.snapshotPath must be dist-relative" };
  }
  const relative = path.posix.normalize(raw.replace(/^\.\//u, ""));
  if (!relative || relative === "." || relative === ".." || relative.startsWith("../")) {
    return { error: "cmsArticleGrowthAllowance.snapshotPath escapes dist" };
  }
  return { relative };
}

async function resolveCmsArticleGrowthAllowance() {
  const configuration = budget.cmsArticleGrowthAllowance;
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return { error: "performance-budget.json requires cmsArticleGrowthAllowance" };
  }
  const baselineCount = Number(configuration.baselineCount);
  const bytesPerAdditionalArticle = Number(configuration.bytesPerAdditionalArticle);
  if (!Number.isSafeInteger(baselineCount) || baselineCount < 0) {
    return { error: "cmsArticleGrowthAllowance.baselineCount must be a non-negative safe integer" };
  }
  if (!Number.isSafeInteger(bytesPerAdditionalArticle) || bytesPerAdditionalArticle <= 0) {
    return {
      error:
        "cmsArticleGrowthAllowance.bytesPerAdditionalArticle must be a positive safe integer",
    };
  }

  const configuredPath = configuredSnapshotRelativePath(configuration.snapshotPath);
  if (configuredPath.error) return configuredPath;
  const snapshotPath = path.join(dist, ...configuredPath.relative.split("/"));
  let snapshotText;
  try {
    snapshotText = await readFile(snapshotPath, "utf8");
  } catch (error) {
    return {
      error:
        error?.code === "ENOENT"
          ? `configured snapshot ${configuredPath.relative} is missing`
          : `configured snapshot ${configuredPath.relative} is unreadable: ${error.message}`,
    };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(snapshotText);
  } catch {
    return { error: `configured snapshot ${configuredPath.relative} is not valid JSON` };
  }

  let articleCount;
  try {
    articleCount = articleIdSet(
      snapshot?.articles,
      `configured snapshot ${configuredPath.relative}`
    ).size;
  } catch (error) {
    return { error: error.message };
  }
  const additionalArticleCount = Math.max(0, articleCount - baselineCount);
  const allowanceBytes = additionalArticleCount * bytesPerAdditionalArticle;
  if (!Number.isSafeInteger(allowanceBytes)) {
    return { error: "CMS article growth allowance exceeds the safe integer range" };
  }
  return {
    additionalArticleCount,
    allowanceBytes,
    articleCount,
    baselineCount,
    bytesPerAdditionalArticle,
    snapshotPath: configuredPath.relative,
  };
}

async function auditInitialEntry() {
  const index = measured.find((item) => item.relative === "index.html");
  if (!index) {
    recordFailure("dist/index.html", "missing; initial graph cannot be measured");
    return;
  }

  let html;
  try {
    html = await readFile(index.file, "utf8");
  } catch (error) {
    recordFailure("dist/index.html", `unreadable: ${error.message}`);
    return;
  }

  const references = initialAssetReferences(html);
  const moduleScripts = references.filter((reference) => reference.kind === "module script");
  if (!moduleScripts.length) {
    recordFailure("initial module script", "dist/index.html has no module entry");
  }

  const measuredByRelative = new Map(measured.map((item) => [item.relative, item]));
  const configuredBase = await resolveActiveSiteBasePath();
  if (configuredBase.error) {
    recordFailure("configured site base", configuredBase.error);
  }
  const resolved = new Map();
  let invalidReferences = 0;
  for (const reference of references) {
    const normalized = normalizeDistAssetReference(
      reference.source,
      configuredBase.base
    );
    if (normalized.error) {
      invalidReferences += 1;
      recordFailure(
        `initial ${reference.kind} reference`,
        `${reference.source || "<empty>"}: ${normalized.error}`
      );
      continue;
    }

    const forbidden = forbiddenInitialAssets.find((candidate) =>
      candidate.test(normalized.relative)
    );
    if (forbidden) {
      invalidReferences += 1;
      recordFailure(
        `forbidden initial asset ${forbidden.label}`,
        normalized.relative
      );
    }

    const resolvedAsset = resolveMeasuredInitialAsset(
      normalized.relative,
      measuredByRelative
    );
    if (resolvedAsset.error) {
      invalidReferences += 1;
      const label = resolvedAsset.error.startsWith("ambiguous")
        ? `ambiguous initial asset ${normalized.relative}`
        : `missing initial asset ${normalized.relative}`;
      recordFailure(label, `${resolvedAsset.error}; referenced as ${reference.kind}`);
      continue;
    }

    const item = resolvedAsset.item;
    const current = resolved.get(item.relative);
    resolved.set(item.relative, {
      item,
      counted: Boolean(current?.counted || reference.counted),
    });
  }

  if (!invalidReferences) {
    console.log(
      `PASS initial asset references: ${resolved.size} / ${resolved.size} files`
    );
  }

  const counted = [...resolved.values()].filter((reference) => reference.counted);
  const initialAssetGzip = (
    await Promise.all(counted.map((reference) => compressedBytes(reference.item)))
  ).reduce((sum, bytes) => sum + bytes, 0);
  const initialAssetGzipLimit = Number(budget.initialAssetGzipBytes);
  if (!Number.isFinite(initialAssetGzipLimit) || initialAssetGzipLimit <= 0) {
    recordFailure(
      "initial asset gzip budget",
      "performance-budget.json requires a positive initialAssetGzipBytes"
    );
  } else {
    enforce(
      "initial module script/modulepreload/CSS gzip",
      initialAssetGzip,
      initialAssetGzipLimit
    );
  }
}

await auditInitialEntry();

const cmsArticleGrowth = await resolveCmsArticleGrowthAllowance();
if (cmsArticleGrowth.error) {
  recordFailure("CMS article growth allowance", cmsArticleGrowth.error);
} else {
  console.log(
    `PASS CMS article growth allowance: ${cmsArticleGrowth.articleCount} / ` +
      `${cmsArticleGrowth.baselineCount} baseline articles; ` +
      `${cmsArticleGrowth.allowanceBytes} bytes ` +
      `(${cmsArticleGrowth.bytesPerAdditionalArticle} per additional article)`
  );
}
const cmsArticleAllowanceBytes = cmsArticleGrowth.allowanceBytes || 0;
enforce("dist total", total, budget.distTotalBytes + cmsArticleAllowanceBytes);
enforce(
  "dist excluding book covers",
  distExcludingBookCovers,
  budget.distExcludingBookCoversBytes + cmsArticleAllowanceBytes
);
if (largestScript) enforce(`largest JS (${largestScript.relative})`, largestScript.bytes, budget.largestJavaScriptBytes);
if (largestScript) enforce(`largest JS gzip (${largestScript.relative})`, largestScriptGzip, budget.largestJavaScriptGzipBytes);
if (mainScript) enforce(`main JS (${mainScript.relative})`, mainScript.bytes, budget.mainJavaScriptBytes);
if (mainScript) enforce(`main JS gzip (${mainScript.relative})`, mainScriptGzip, budget.mainJavaScriptGzipBytes);
if (globeTexture) enforce("antique globe texture", globeTexture.bytes, budget.globeTextureBytes);
enforce("writer portraits total", writerPortraitTotal, budget.writerPortraitTotalBytes);
enforce("writer portrait average", writerPortraitAverage, budget.writerPortraitAverageBytes);
enforce("writer portrait maximum", writerPortraitMaximum, budget.writerPortraitMaximumBytes);
enforce("book cover count", bookCovers.length, budget.bookCoverCount, "files");
enforce("book covers total", bookCoverTotal, budget.bookCoverTotalBytes);
enforce("book cover average", bookCoverAverage, budget.bookCoverAverageBytes);
enforce("book cover maximum", bookCoverMaximum, budget.bookCoverMaximumBytes);
for (const image of oversizedImages) {
  const label = `oversized image ${image.relative}`;
  failures.push(label);
  console.error(`FAIL ${label}: ${image.bytes} bytes`);
  annotateFailure(label, image.bytes, budget.individualImageBytes, "bytes");
}

if (failures.length) {
  throw new Error(`Performance budget exceeded: ${failures.join(", ")}`);
}

console.log(`Performance budget passed for ${measured.length} production files.`);
