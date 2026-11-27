import { createHash, randomUUID } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import sharp from "sharp";
import ts from "typescript";
import performanceBudget from "../performance-budget.json" with { type: "json" };
import { compactImageDeliveryManifest, partitionImageDeliveryManifest } from "./lib/compact-image-delivery.mjs";
import { encodePublicRasterRendition } from "./lib/public-image-output-fit.mjs";
import { authoredPublicRenditions, planPublicImageRenditions, retiredPublicImageRenditions } from "./lib/public-image-rendition-plan.mjs";
import { publishedImageSourceLimit } from "./lib/published-image-performance.mjs";
import { createSerialWriteQueue, writeJsonAtomically } from "./lib/atomic-json-write.mjs";
import { hasSmallEditorialImageWidth } from "../src/utils/editorialImagePresentation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const absolute = value => path.resolve(root, value);
const portable = value => value.split(path.sep).join("/");
const digest = value => createHash("sha256").update(value).digest("hex");
const runtimePath = "src/data/imageDelivery.generated.json";
const initialRuntimePath = "src/data/imageDelivery.initial.generated.json";
const articleRuntimePath = "src/data/imageDelivery.articles.generated.json";
const reportPath = "reports/public-image-delivery.json";
const outputDirectory = "public/media/optimized";
const cacheDirectory = ".tmp/public-images";
const maxRenditionBytes = performanceBudget.individualImageBytes;
const imageFields = /^(?:image|imageUrl|dzenImageUrl|ogImageUrl|backgroundImageUrl|background_image_url|coverUrl|cover_external_url|portrait|poster|thumbnailUrl)$/iu;
const rasterOrVector = /\.(?:png|jpe?g|webp|avif|gif|svg|tiff?|bmp)(?:[?#].*)?$/iu;
const publicRenditionName = /^[a-f0-9]{24}-(?:original|[1-9]\d*w)\.(?:avif|gif|jpg|png|svg|webp)$/u;
const sourceContexts = new Map();
const smallInlineSources = new Set();
const authoredRenditions = new Set();
const argv = process.argv.slice(2);
const limitArgument = argv.find(value => value.startsWith("--limit="));
const limit = limitArgument ? Number(limitArgument.split("=")[1]) : Infinity;
const timeoutMs = 12_000;
const workerCount = 6;
const retries = 2;
const productionEditorialStorageOrigin = "https://sjqejjmwpzfsczxdghvw.supabase.co";
const productionEditorialStoragePath = "/storage/v1/object/public/editorial-media/";
let publishedRecords = new Map();
setDefaultResultOrder("ipv4first");
sharp.concurrency(1);

async function atomicJson(filename, value) {
  await writeJsonAtomically(absolute(filename), value);
}

// Only complete images reach the destination. The exclusive temporary file
// prevents partial writes and rename never follows a destination symlink.
async function writeImageAtomically(filename, bytes, mode, stagingDirectory = path.dirname(filename)) {
  const temporary = path.join(stagingDirectory, `image-${randomUUID()}.tmp`);
  const file = await open(temporary, "wx", mode);
  try {
    try {
      await file.writeFile(bytes);
    } finally {
      await file.close();
    }
    await rename(temporary, filename);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function normalizedImageSource(raw) {
  if (typeof raw !== "string") return "";
  const source = raw.trim();
  if (!source || /^(?:data:|blob:|#|staging:)/iu.test(source)) return "";
  if (/^https?:/iu.test(source)) {
    try { const url = new URL(source); if (url.username || url.password) return ""; } catch { return ""; }
  } else if (!rasterOrVector.test(source) || !/^(?:\/?(?:brand|assets|media|textures|images)\/)/u.test(source)) return "";
  return source;
}

function assertSourceImage(metadata, sourceUrl) {
  if (!metadata.format || !metadata.width || !metadata.height) {
    throw new Error("Image format or dimensions are unreadable");
  }
  if (metadata.format === "svg" && /^https?:/iu.test(sourceUrl)) {
    throw new Error("Remote SVG originals cannot be served as public images");
  }
}

function addSource(raw, context, smallInlineImage = false) {
  const source = normalizedImageSource(raw);
  if (!source) return;
  const contexts = sourceContexts.get(source) || new Set();
  contexts.add(context);
  sourceContexts.set(source, contexts);
  if (smallInlineImage) smallInlineSources.add(source);
}

function htmlSources(html, context, collect = addSource) {
  const $ = load(html, {}, false);
  $("img[src],video[poster],image[href]").each((_, node) => {
    const element = $(node);
    collect(element.attr("src") || element.attr("poster") || element.attr("href"), context,
      node.tagName === "img" && hasSmallEditorialImageWidth(element.attr()));
  });
  $("[style]").each((_, node) => backgroundSources($(node).attr("style") || "", context, collect));
}

function backgroundSources(css, context, collect = addSource) {
  for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gu)) {
    if (rasterOrVector.test(match[1])) collect(match[1], context);
  }
}

function jsonSources(value, context, collect = addSource) {
  if (!value || typeof value !== "object") return;
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === "string") {
      if (imageFields.test(key)) collect(field, `${context}:${key}`);
      if (/^(?:contentHtml|content_html|html)$/iu.test(key)) htmlSources(field, context, collect);
      if (/background|style/iu.test(key)) backgroundSources(field, context, collect);
    } else if (field && typeof field === "object") jsonSources(field, context, collect);
  }
}

export function extractPublicImageReferences(value) {
  const references = new Set();
  jsonSources(value, "document", raw => { const source = normalizedImageSource(raw); if (source) references.add(source); });
  return [...references];
}

export function extractSmallInlineImageReferences(value) {
  const references = new Set();
  jsonSources(value, "document", (raw, _context, small) => {
    const source = normalizedImageSource(raw);
    if (source && small) references.add(source);
  });
  return [...references];
}

async function walk(directory, accept) {
  const files = [];
  for (const item of await readdir(absolute(directory), { withFileTypes: true })) {
    const filename = portable(path.join(directory, item.name));
    if (item.isDirectory()) files.push(...await walk(filename, accept));
    else if (accept(filename)) files.push(filename);
  }
  return files;
}

function rememberAuthoredRenditions(text) {
  for (const rendition of authoredPublicRenditions(text)) authoredRenditions.add(rendition);
}

export async function collectPublicImageSources() {
  sourceContexts.clear();
  smallInlineSources.clear();
  authoredRenditions.clear();
  const articleFiles = [...await walk("public/articles", name => name.endsWith(".json")), ...await walk("public/cms", name => name.endsWith(".json"))];
  for (const filename of articleFiles) {
    const document = JSON.parse(await readFile(absolute(filename), "utf8"));
    rememberAuthoredRenditions(JSON.stringify(document));
    jsonSources(document, filename);
  }
  const typedFiles = ["src/App.tsx", "src/components/HeaderArticlesMenu.tsx", "src/data/cms/site.generated.ts"];
  for (const filename of typedFiles) {
    const source = await readFile(absolute(filename), "utf8");
    rememberAuthoredRenditions(source);
    const syntax = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = node => {
      if (ts.isPropertyAssignment(node) && imageFields.test(node.name.getText(syntax).replace(/^["']|["']$/gu, "")) && ts.isStringLiteralLike(node.initializer)) addSource(node.initializer.text, filename);
      ts.forEachChild(node, visit);
    };
    visit(syntax);
    backgroundSources(source, filename);
  }
  const styleFiles = ["src/index.css", ...await walk("src/styles", name => name.endsWith(".css"))];
  for (const filename of styleFiles) {
    const source = await readFile(absolute(filename), "utf8");
    rememberAuthoredRenditions(source);
    backgroundSources(source, filename);
  }
  const alreadyRead = new Set([...articleFiles, ...typedFiles, ...styleFiles, runtimePath, initialRuntimePath, articleRuntimePath]);
  const referenceFile = (name) => /\.(?:[cm]?jsx?|tsx?|css|html|json|xml|svg)$/iu.test(name) && !alreadyRead.has(name);
  for (const filename of [...await walk("src", referenceFile), ...await walk("public", referenceFile)]) {
    const text = await readFile(absolute(filename), "utf8");
    rememberAuthoredRenditions(filename.endsWith(".json") ? JSON.stringify(JSON.parse(text)) : text);
  }
  return [...sourceContexts].map(([sourceUrl, contexts]) => ({ sourceUrl, contexts: [...contexts].sort(), ...(smallInlineSources.has(sourceUrl) ? { smallInlineImage: true } : {}) })).sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
}

async function seedExistingOriginals() {
  const manifest = JSON.parse(await readFile(absolute("scripts/assets/article-previews.sources.json"), "utf8"));
  const files = await walk(".tmp/journal-preview-originals", () => true).catch(() => []);
  const available = new Map();
  for (const filename of files) {
    const bytes = await readFile(absolute(filename));
    available.set(digest(bytes), bytes);
  }
  for (const source of manifest.images) {
    const bytes = available.get(source.source.sha256);
    if (bytes) await writeImageAtomically(absolute(`${cacheDirectory}/originals/${digest(source.sourceUrl)}.bin`), bytes, 0o600);
  }
}

export function createRemoteImageOriginalReader({
  originalsDirectory = absolute(`${cacheDirectory}/originals`),
  refresh = false,
  fetchImpl = fetch,
  wait = sleep,
} = {}) {
  let productionStorageBlocked = false;
  return async function readRemoteImageOriginal(sourceUrl) {
    const filename = path.join(originalsDirectory, `${digest(sourceUrl)}.bin`);
    if (!refresh) {
      const cached = await readFile(filename).catch(() => null);
      if (cached) {
        assertSourceImage(await sharp(cached, { limitInputPixels: false }).metadata(), sourceUrl);
        return { bytes: cached, downloaded: false, attempts: 0 };
      }
    }
    const url = new URL(sourceUrl);
    const fromProductionStorage = url.origin === productionEditorialStorageOrigin &&
      url.pathname.startsWith(productionEditorialStoragePath);
    let failure;
    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
      if (fromProductionStorage && productionStorageBlocked) {
        throw new Error("HTTP 402 (production editorial Storage downloads skipped after project restriction)");
      }
      let bytes;
      try {
        const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok) {
          if (fromProductionStorage && response.status === 402 && !response.redirected) productionStorageBlocked = true;
          throw new Error(`HTTP ${response.status}`);
        }
        bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length) throw new Error("Empty response");
      } catch (error) {
        failure = error;
        if (/^HTTP (?:400|401|402|403|404|410)$/u.test(error.message)) break;
        if (attempt <= retries) await wait(250 * attempt);
        continue;
      }
      assertSourceImage(await sharp(bytes, { limitInputPixels: false }).metadata(), sourceUrl);
      await writeImageAtomically(filename, bytes, 0o600);
      return { bytes, downloaded: true, attempts: attempt };
    }
    throw failure;
  };
}

const readRemoteImageOriginal = createRemoteImageOriginalReader({ refresh: argv.includes("--refresh") });

async function sourceBytes(sourceUrl) {
  if (/^https?:/iu.test(sourceUrl)) return readRemoteImageOriginal(sourceUrl);
  const filename = absolute(`public/${sourceUrl.replace(/^\/+/, "")}`);
  if (!filename.startsWith(`${absolute("public")}${path.sep}`)) throw new Error("Local image path leaves public directory");
  return { bytes: await readFile(filename), downloaded: false, attempts: 0 };
}

const processing = new Map();
export function smallInlineRenditionWidths(source, metadata) {
  if (!source.smallInlineImage || metadata.format === "svg" || (metadata.pages || 1) > 1) return [];
  return [160, 320].filter(width => width <= metadata.width && width * metadata.height / metadata.width <= 8192);
}

export function missingSmallInlineRenditions(source, record) {
  if (record.flags?.includes("animation-preserved")) return [];
  return smallInlineRenditionWidths(source, record.source).filter(width =>
    !record.outputs.some(output => output.width === width || output.fittedFromWidths?.includes(width)));
}

async function encodeRasterRendition(bytes, width) {
  return encodePublicRasterRendition(bytes, width, maxRenditionBytes);
}

async function saveRendition(buffer, hash, width, height, extension, suffix = `${width}w`) {
  const filename = `${hash.slice(0, 24)}-${suffix}.${extension}`;
  if (!publicRenditionName.test(filename)) throw new Error("Invalid public image rendition filename");
  const src = `media/optimized/${filename}`;
  await writeImageAtomically(absolute(`public/${src}`), buffer, 0o644, absolute(cacheDirectory));
  return { src, width, height, bytes: buffer.length, sha256: digest(buffer) };
}

async function addRasterRendition(outputs, save, data, info, targetWidth) {
  // A measured downscale can land on an already-written width. Keep its bytes.
  const existing = outputs.findIndex(output => output.width === info.width);
  if (existing >= 0) {
    const output = outputs[existing];
    if (targetWidth !== info.width) outputs[existing] = {
      ...output, fittedFromWidths: [...(output.fittedFromWidths || []), targetWidth],
    };
    return;
  }
  const output = await save(data, info.width, info.height, "webp");
  outputs.push(info.width === targetWidth ? output : { ...output, fittedFromWidths: [targetWidth] });
}

/** Extend a ready checkpoint without rewriting its reviewed large renditions. */
export async function extendSmallInlineRenditions(source, record, bytes, save = saveRendition) {
  const widths = missingSmallInlineRenditions(source, record);
  if (!widths.length) return record;
  if (digest(bytes) !== record.source.sha256) throw new Error("Source differs from the ready image checkpoint");
  const outputs = [...record.outputs];
  for (const width of widths) {
    const { data, info } = await encodeRasterRendition(bytes, width);
    await addRasterRendition(outputs, (data, w, h, extension) => save(data, record.source.sha256, w, h, extension),
      data, info, width);
  }
  return { ...record, outputs: outputs.sort((left, right) => left.width - right.width) };
}

async function prepareRenditions(bytes, hash, source) {
  const processingKey = `${hash}:${Boolean(source.smallInlineImage)}`;
  if (processing.has(processingKey)) return processing.get(processingKey);
  const promise = (async () => {
    const metadata = await sharp(bytes, { limitInputPixels: false }).metadata();
    assertSourceImage(metadata, source.sourceUrl);
    const native = metadata.autoOrient || metadata;
    const width = native.width, height = native.height;
    const flags = [];
    const format = metadata.format === "jpeg" ? "jpg" : metadata.format === "heif" && metadata.compression === "av1" ? "avif" : metadata.format;
    const unchanged = metadata.format === "svg" || (metadata.pages || 1) > 1;
    const originalFits = bytes.length <= maxRenditionBytes && /^(?:avif|gif|jpg|png|svg|webp)$/u.test(format);
    const hasTransparency = Boolean(metadata.hasAlpha) && !(await sharp(bytes, { limitInputPixels: false }).stats()).isOpaque;
    const oversized = Math.max(width, height) > 8192;
    if (oversized && originalFits) flags.push("native-original-preserved-above-8192; responsive renditions capped");
    if (oversized && !originalFits) flags.push("native-rendition-fitted-to-production-budget");
    if (unchanged) flags.push(metadata.format === "svg" ? "vector-preserved" : "animation-preserved");
    const variants = [];
    async function save(buffer, targetWidth, targetHeight, extension, suffix = `${targetWidth}w`) {
      return saveRendition(buffer, hash, targetWidth, targetHeight, extension, suffix);
    }
    if (unchanged) {
      if (!originalFits) {
        throw new Error(`Cannot prepare ${format} without losing its vector or animated content (${bytes.length} bytes, limit ${maxRenditionBytes})`);
      }
      const nativeFile = await save(bytes, width, height, format, "original");
      return { width, height, format, hasAlpha: Boolean(metadata.hasAlpha), hasTransparency, flags, variants: [nativeFile], largest: nativeFile };
    }
    const fullTarget = oversized && originalFits ? [] : [Math.min(width, 8192)];
    const targets = [...new Set([...smallInlineRenditionWidths(source, { ...metadata, width, height }), 640, 1280, 1920, ...fullTarget].filter(size => size <= width))];
    if (!targets.length) targets.push(width);
    for (const target of targets.sort((a, b) => a - b)) {
      const { data, info } = await encodeRasterRendition(bytes, target);
      if (!oversized && target === width && originalFits &&
        (info.width < width || info.height < height || bytes.length <= data.length)) {
        variants.push(await save(bytes, width, height, format, "original"));
      } else {
        await addRasterRendition(variants, save, data, info, target);
      }
    }
    if (oversized && originalFits) variants.push(await save(bytes, width, height, format, "original"));
    const largest = variants.toSorted((a, b) => b.width * b.height - a.width * a.height)[0];
    return { width, height, format, hasAlpha: Boolean(metadata.hasAlpha), hasTransparency, flags, variants, largest };
  })();
  processing.set(processingKey, promise);
  return promise;
}

async function readyCheckpoint(source) {
  if (argv.includes("--refresh")) return null;
  const filename = `${cacheDirectory}/checkpoints/${digest(source.sourceUrl)}.json`;
  try {
    const checkpoint = await readFile(absolute(filename), "utf8").then(JSON.parse).catch(() => publishedRecords.get(source.sourceUrl));
    if (!checkpoint) return null;
    if (checkpoint.status !== "ready" || checkpoint.pipelineVersion !== 1 || checkpoint.source.format === "heif") return null;
    assertSourceImage(checkpoint.source, source.sourceUrl);
    if (checkpoint.outputs.some(output => output.bytes > maxRenditionBytes)) return null;
    if (!/^https?:/iu.test(source.sourceUrl)) {
      const local = await sourceBytes(source.sourceUrl);
      if (digest(local.bytes) !== checkpoint.source.sha256) return null;
    }
    if (typeof checkpoint.source.hasTransparency !== "boolean") {
      checkpoint.source.hasTransparency = checkpoint.source.hasAlpha && !(await sharp((await sourceBytes(source.sourceUrl)).bytes, { limitInputPixels: false }).stats()).isOpaque;
      await atomicJson(filename, checkpoint);
    }
    await Promise.all(checkpoint.outputs.map(output => stat(absolute(`public/${output.src}`))));
    return { ...checkpoint, contexts: source.contexts, cached: true };
  } catch { return null; }
}

export async function preparePublicImageRecord(source, {
  loadCheckpoint = readyCheckpoint,
  acquire = sourceBytes,
  storeCheckpoint = (source, record) => atomicJson(`${cacheDirectory}/checkpoints/${digest(source.sourceUrl)}.json`, record),
} = {}) {
  const sourceStarted = Date.now();
  const ready = await loadCheckpoint(source);
  if (ready && !missingSmallInlineRenditions(source, ready).length) return ready;
  let record;
  try {
    const acquired = await acquire(source.sourceUrl);
    const hash = digest(acquired.bytes);
    if (ready) {
      record = { ...await extendSmallInlineRenditions(source, ready, acquired.bytes), cached: false, downloaded: acquired.downloaded, attempts: acquired.attempts, elapsedMs: Date.now() - sourceStarted };
    } else {
      const prepared = await prepareRenditions(acquired.bytes, hash, source);
      record = { pipelineVersion: 1, sourceUrl: source.sourceUrl, contexts: source.contexts, status: "ready", source: { sha256: hash, bytes: acquired.bytes.length, width: prepared.width, height: prepared.height, format: prepared.format, hasAlpha: prepared.hasAlpha, hasTransparency: prepared.hasTransparency }, largest: prepared.largest, outputs: prepared.variants, flags: prepared.flags, downloaded: acquired.downloaded, attempts: acquired.attempts, elapsedMs: Date.now() - sourceStarted };
    }
  } catch (error) {
    // A thumbnail upgrade must not discard an already reviewed large-image map.
    // Stop before replacing its checkpoint or publishing a partial runtime.
    if (ready) throw error;
    record = { pipelineVersion: 1, sourceUrl: source.sourceUrl, contexts: source.contexts, status: "failed", error: error.message, cause: error.cause?.code, elapsedMs: Date.now() - sourceStarted };
  }
  await storeCheckpoint(source, record);
  return record;
}

function runtimeEntry(record) {
  const small = output => ({ src: output.src, width: output.width, height: output.height });
  return { ...small(record.largest), variants: record.outputs.map(small) };
}

async function publishRuntime(report) {
  const { records } = planPublicImageRenditions(report);
  const runtime = Object.fromEntries(records.filter(record => record.status === "ready").map(record => [record.sourceUrl, runtimeEntry(record)]));
  const { initial, articles } = partitionImageDeliveryManifest(runtime, records);
  await atomicJson(runtimePath, runtime);
  await atomicJson(initialRuntimePath, compactImageDeliveryManifest(initial));
  await atomicJson(articleRuntimePath, compactImageDeliveryManifest(articles));
}

function reportSummary(records, sourceCount, started) {
  const ready = records.filter(record => record.status === "ready");
  const unique = [...new Map(ready.map(record => [record.source.sha256, record])).values()];
  const uniqueOutputs = new Map(ready.flatMap(record => record.outputs.map(output => [output.src, output])));
  return { inventoriedSources: sourceCount, processedSources: records.length, ready: ready.length, failed: records.length - ready.length, uniqueSourceImages: unique.length, sourceBytes: unique.reduce((sum, record) => sum + record.source.bytes, 0), largestRenditionBytes: unique.reduce((sum, record) => sum + record.largest.bytes, 0), allRenditionBytes: [...uniqueOutputs.values()].reduce((sum, output) => sum + output.bytes, 0), elapsedSeconds: Math.round((Date.now() - started) / 1000) };
}

async function publishReport(records, inventory, started, completed, previous) {
  const ordered = records.toSorted((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  const report = { version: 1, completed, transform: { quality: 90, widths: [640, 1280, 1920], nativeResolution: "preserved", crop: false, autoOrient: true, alpha: "preserved", sourceTimeoutMs: timeoutMs, retryCount: retries, workers: workerCount }, summary: reportSummary(ordered, inventory.length, started), images: ordered };
  if (!completed) {
    await atomicJson(`${cacheDirectory}/progress.json`, report);
    return report;
  }
  report.delivery = {
    version: 1,
    authoredRenditions: [...authoredRenditions].sort(),
    retiredRenditions: retiredPublicImageRenditions(previous, ordered),
  };
  await atomicJson(reportPath, report);
  if (!argv.includes("--defer-runtime")) await publishRuntime(report);
  return report;
}

async function checkInventory(inventory) {
  const report = JSON.parse(await readFile(absolute(reportPath), "utf8"));
  const runtime = JSON.parse(await readFile(absolute(runtimePath), "utf8"));
  const initialRuntime = JSON.parse(await readFile(absolute(initialRuntimePath), "utf8"));
  const articleRuntime = JSON.parse(await readFile(absolute(articleRuntimePath), "utf8"));
  const known = new Map(report.images.map(record => [record.sourceUrl, record]));
  const plan = planPublicImageRenditions(report);
  const delivered = new Map(plan.records.map(record => [record.sourceUrl, record]));
  const errors = [];
  if ([...plan.omitted, ...plan.retired.map(({ src }) => src)].some(src => authoredRenditions.has(src))) {
    errors.push("Public image delivery would omit an authored rendition URL");
  }
  const partition = partitionImageDeliveryManifest(runtime, report.images);
  if (JSON.stringify(initialRuntime) !== JSON.stringify(compactImageDeliveryManifest(partition.initial))) errors.push("Initial runtime differs from the complete image delivery manifest");
  if (JSON.stringify(articleRuntime) !== JSON.stringify(compactImageDeliveryManifest(partition.articles))) errors.push("Article runtime differs from the complete image delivery manifest");
  for (const source of inventory) {
    const record = known.get(source.sourceUrl);
    if (!record) { errors.push(`Unaccounted source: ${source.sourceUrl}`); continue; }
    if (record.status !== "ready") {
      const sourceLabel = source.sourceUrl.split(/[?#]/u, 1)[0];
      errors.push(`Image preparation failed for ${sourceLabel} (${source.contexts.join(", ")}): ${record.error || "Unknown error"}`);
      continue;
    }
    assertSourceImage(record.source, source.sourceUrl);
    if (missingSmallInlineRenditions(source, record).length) errors.push(`Missing small inline renditions: ${source.sourceUrl}`);
    if (JSON.stringify(runtime[source.sourceUrl]) !== JSON.stringify(runtimeEntry(delivered.get(source.sourceUrl)))) errors.push(`Runtime entry differs: ${source.sourceUrl}`);
  }
  const outputs = new Map(report.images.filter(record => record.status === "ready").flatMap(record => record.outputs.map(output => [output.src, output])));
  const alpha = new Map(report.images.filter(record => record.status === "ready").flatMap(record => record.outputs.map(output => [output.src, record.source.hasTransparency])));
  for (const output of outputs.values()) {
    try {
      const bytes = await readFile(absolute(`public/${output.src}`));
      if (bytes.length !== output.bytes || digest(bytes) !== output.sha256) errors.push(`Output checksum differs: ${output.src}`);
      const metadata = await sharp(bytes, { limitInputPixels: false }).metadata();
      const dimensions = metadata.autoOrient || metadata;
      if (dimensions.width !== output.width || dimensions.height !== output.height) errors.push(`Output dimensions differ: ${output.src}`);
      const transparent = Boolean(metadata.hasAlpha) && !(await sharp(bytes, { limitInputPixels: false }).stats()).isOpaque;
      if (transparent !== alpha.get(output.src)) errors.push(`Output transparency differs: ${output.src}`);
    }
    catch { errors.push(`Output missing: ${output.src}`); }
  }
  for (const output of plan.preservedRetired) {
    try {
      const bytes = await readFile(absolute(`public/${output.src}`));
      if (bytes.length !== output.bytes || digest(bytes) !== output.sha256) {
        errors.push(`Authored rendition checksum differs: ${output.src}`);
      }
    } catch { errors.push(`Authored rendition missing: ${output.src}`); }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ status: "passed", sources: inventory.length, outputs: outputs.size, unavailable: report.images.filter(record => record.status !== "ready").length }));
}

async function main() {
  const started = Date.now();
  if (argv.includes("--publish-runtime")) {
    const report = JSON.parse(await readFile(absolute(reportPath), "utf8"));
    await publishRuntime(report);
    console.log(JSON.stringify({ status: "runtime-published", ready: report.summary.ready }));
    return;
  }
  const inventory = await collectPublicImageSources();
  const sourceLimit = publishedImageSourceLimit(performanceBudget.publishedImageCorpus);
  if (inventory.length > sourceLimit) {
    throw new Error(`Public image inventory contains ${inventory.length} sources, exceeding the limit of ${sourceLimit}.`);
  }
  if (argv.includes("--check")) return checkInventory(inventory);
  let previous;
  try {
    previous = JSON.parse(await readFile(absolute(reportPath), "utf8"));
    publishedRecords = new Map(previous.images.map(record => [record.sourceUrl, record]));
  } catch { /* A first preparation has no committed provenance to reuse. */ }
  for (const directory of [outputDirectory, `${cacheDirectory}/originals`, `${cacheDirectory}/checkpoints`]) await mkdir(absolute(directory), { recursive: true });
  await seedExistingOriginals();
  // Start with a representative mixture, then continue through the complete exact-URL inventory.
  const groups = new Map();
  for (const source of inventory) {
    const key = /^https?:/iu.test(source.sourceUrl) ? `${new URL(source.sourceUrl).hostname}:${path.extname(new URL(source.sourceUrl).pathname)}` : "local";
    const entries = groups.get(key) || []; entries.push(source); groups.set(key, entries);
  }
  const queue = [];
  while ([...groups.values()].some(group => group.length)) for (const group of groups.values()) { const source = group.shift(); if (source) queue.push(source); }
  const selected = queue.slice(0, limit);
  const records = [];
  let next = 0;
  const reportWrites = createSerialWriteQueue();
  async function worker() {
    while (next < selected.length) {
      const source = selected[next++];
      const record = await preparePublicImageRecord(source);
      records.push(record);
      if (records.length % 20 === 0) {
        if (!argv.includes("--quiet")) console.log(JSON.stringify(reportSummary(records, inventory.length, started)));
        const snapshot = [...records];
        reportWrites.enqueue(() => publishReport(snapshot, inventory, started, false));
      }
    }
  }
  console.log(JSON.stringify({ status: "started", inventory: inventory.length, selected: selected.length, workers: workerCount }));
  // A failed worker must not leave another worker enqueueing writes after drain.
  const workers = await Promise.allSettled(Array.from({ length: workerCount }, worker));
  await reportWrites.drain();
  const failedWorker = workers.find(result => result.status === "rejected");
  if (failedWorker) throw failedWorker.reason;
  const report = await publishReport(records, inventory, started, selected.length === inventory.length, previous);
  console.log(JSON.stringify(report.summary));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
