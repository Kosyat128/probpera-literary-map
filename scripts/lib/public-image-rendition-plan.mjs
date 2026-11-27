import performanceBudget from "../../performance-budget.json" with { type: "json" };
import { usesOnlyArticleBodyImages } from "./compact-image-delivery.mjs";

const renditionDirectory = "media/optimized/";
const renditionFilename = /[a-f0-9]{24}-(?:[1-9][0-9]*w|original)\.(?:avif|jpe?g|png|webp|svg|gif)/u;
export const publicRenditionPath = new RegExp(`^${renditionDirectory}${renditionFilename.source}$`, "u");
const authoredRendition = new RegExp(`(?:^|[^a-z\\d_-])(${renditionDirectory}${renditionFilename.source})(?![a-z\\d_/-])`, "giu");

/** An authored link, source, srcset, or background can point straight to a rendition. */
export function authoredPublicRenditions(text) {
  const decoded = text
    .replace(/&#x([a-f\d]{1,2});|&#(\d{1,3});|%([a-f\d]{2})/giu, (_entity, hex, decimal, percent) =>
      String.fromCharCode(decimal === undefined ? Number.parseInt(hex || percent, 16) : Number(decimal)))
    .replace(/&sol;/gu, "/")
    .replace(/&period;/gu, ".");
  return [...decoded.matchAll(authoredRendition)].map((match) => match[1].toLowerCase());
}

function nearbyLargerRendition(output, next) {
  return next && next.width > output.width && next.height >= output.height &&
    next.width * 4 <= output.width * 5 && next.bytes * 4 <= output.bytes * 5;
}

function isGeneratedDesktopRendition(output) {
  return (output.width === 1280 || output.width === 1920) &&
    publicRenditionPath.test(output.src) && output.src.endsWith(`-${output.width}w.webp`);
}

function hasResponsiveReplacement({ outputs, index }, omitted, maxWidthPercent) {
  const replacement = outputs.slice(index + 1).find(({ src }) => !omitted.has(src));
  if (!replacement) return false;

  // An earlier omission may already depend on the current candidate as its next width.
  for (let i = index; i >= 0; i--) {
    const output = outputs[i];
    const limit = i === index ? maxWidthPercent : omitted.get(output.src);
    if (!limit) break;
    if (replacement.width <= output.width || replacement.height < output.height ||
      replacement.width * 100 > output.width * limit || replacement.bytes * 2 > output.bytes * 3) return false;
  }
  return true;
}

function fitPublishedRenditions(images, authored, preservedRetired, overlapping, budget) {
  const omitted = new Map(overlapping.map((src) => [src, 125]));
  const files = new Map(preservedRetired.map((output) => [output.src, output]));
  const candidateUses = new Map();
  const protectedPaths = new Set(authored);
  for (const record of images) {
    if (record.status !== "ready") continue;
    const outputs = record.outputs.toSorted((left, right) => left.width - right.width);
    const firstRetained = outputs.find(({ src }) => !omitted.has(src));
    const articleBodyOnly = usesOnlyArticleBodyImages(record.contexts);
    for (const [index, output] of outputs.entries()) {
      if (omitted.has(output.src)) continue;
      files.set(output.src, output);
      if (!articleBodyOnly || output === firstRetained || output.src === record.largest?.src ||
        !isGeneratedDesktopRendition(output)) {
        protectedPaths.add(output.src);
        continue;
      }
      const uses = candidateUses.get(output.src) ?? [];
      uses.push({ outputs, index });
      candidateUses.set(output.src, uses);
    }
  }

  let bytes = [...files.values()].reduce((total, output) => total + output.bytes, 0);
  const overBudget = () => files.size > budget.fileCount || bytes > budget.totalBytes;
  if (!overBudget()) return overlapping;

  const candidates = [...candidateUses.keys()].filter((src) => !protectedPaths.has(src))
    .sort((left, right) => files.get(right).bytes - files.get(left).bytes || left.localeCompare(right));
  for (const maxWidthPercent of [125, 150]) {
    for (const src of candidates) {
      if (!overBudget()) return [...omitted.keys()].sort();
      if (omitted.has(src) || !candidateUses.get(src).every((use) =>
        hasResponsiveReplacement(use, omitted, maxWidthPercent))) continue;
      bytes -= files.get(src).bytes;
      files.delete(src);
      omitted.set(src, maxWidthPercent);
    }
  }
  return [...omitted.keys()].sort();
}

export function verifiedRenditionMetadata(output) {
  return publicRenditionPath.test(output?.src || "") && Number.isSafeInteger(output.bytes) &&
    output.bytes > 0 && /^[a-f0-9]{64}$/u.test(output.sha256 || "");
}

export function retiredPublicImageRenditions(previous, current) {
  if (previous?.version !== 1 || previous.completed !== true || !Array.isArray(previous.images)) return [];
  const active = new Set(current.filter((record) => record.status === "ready")
    .flatMap((record) => record.outputs.map(({ src }) => src)));
  const historical = [
    ...(previous.delivery?.retiredRenditions || []),
    ...previous.images.filter((record) => record.status === "ready").flatMap((record) => record.outputs),
  ];
  return [...new Map(historical
    .filter((output) => verifiedRenditionMetadata(output) && !active.has(output.src))
    .map(({ src, bytes, sha256 }) => [src, { src, bytes, sha256 }])).values()]
    .sort((left, right) => left.src.localeCompare(right.src));
}

/** Keep archival checkpoints intact and fit the published responsive choices to the site budget. */
export function planPublicImageRenditions(report, budget = performanceBudget.publishedImageCorpus) {
  if (!report.delivery) return { records: report.images, omitted: [], retired: [], preservedRetired: [] };
  const retiredRenditions = report.delivery.retiredRenditions ?? [];
  if (report.delivery.version !== 1 || !Array.isArray(report.delivery.authoredRenditions) ||
    report.delivery.authoredRenditions.some((src) => !publicRenditionPath.test(src)) ||
    !Array.isArray(retiredRenditions) || retiredRenditions.some((output) => !verifiedRenditionMetadata(output))) {
    throw new Error("Invalid public image rendition delivery metadata");
  }

  const authored = new Set(report.delivery.authoredRenditions);
  const retained = new Set(authored);
  const candidates = new Set();
  const active = new Set();
  for (const record of report.images) {
    if (record.status !== "ready") continue;
    const outputs = record.outputs.toSorted((left, right) => left.width - right.width);
    const articleBodyOnly = usesOnlyArticleBodyImages(record.contexts);
    for (const [index, output] of outputs.entries()) {
      active.add(output.src);
      if (articleBodyOnly && isGeneratedDesktopRendition(output) && output.src !== record.largest?.src &&
        nearbyLargerRendition(output, outputs[index + 1])) {
        candidates.add(output.src);
      } else {
        retained.add(output.src);
      }
    }
  }
  const historical = new Set();
  for (const { src } of retiredRenditions) {
    if (historical.has(src) || active.has(src)) {
      throw new Error(`Conflicting retired image rendition: ${src}`);
    }
    historical.add(src);
  }
  const preservedRetired = retiredRenditions.filter(({ src }) => authored.has(src));
  const overlapping = [...candidates].filter((src) => !retained.has(src)).sort();
  const omitted = fitPublishedRenditions(report.images, authored, preservedRetired, overlapping, budget);
  const omittedPaths = new Set(omitted);
  return {
    records: report.images.map((record) => record.status !== "ready" ? record : {
      ...record,
      outputs: record.outputs.filter((output) => !omittedPaths.has(output.src)),
    }),
    omitted,
    retired: retiredRenditions.filter(({ src }) => !authored.has(src)),
    preservedRetired,
  };
}
