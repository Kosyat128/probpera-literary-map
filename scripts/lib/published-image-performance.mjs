import { planPublicImageRenditions, verifiedRenditionMetadata } from "./public-image-rendition-plan.mjs";

// Each original needs a delivered file. Extra exact URLs for byte-identical
// originals may share those files within the separate alias reserve.
export function publishedImageSourceLimit(budget) {
  const { fileCount, sourceAliasCount } = budget ?? {};
  if (!Number.isSafeInteger(fileCount) || fileCount <= 0) {
    throw new Error("publishedImageCorpus.fileCount must be a positive safe integer");
  }
  if (!Number.isSafeInteger(sourceAliasCount) || sourceAliasCount < 0) {
    throw new Error("publishedImageCorpus.sourceAliasCount must be a non-negative safe integer");
  }
  const limit = fileCount + sourceAliasCount;
  if (!Number.isSafeInteger(limit)) throw new Error("published image source limit must be a safe integer");
  return limit;
}

// Only independently inventoried image files may leave the existing application
// budget. Unknown files, incomplete provenance and size mismatches fail closed.
export function measurePublishedImageCorpus({ files, report, budget }) {
  const errors = [];
  const invalid = { errors, bytes: 0, fileCount: 0, sourceCount: 0, sourceAliasCount: 0 };
  if (!Number.isSafeInteger(budget?.totalBytes) || budget.totalBytes <= 0) {
    errors.push("publishedImageCorpus.totalBytes must be a positive safe integer");
  }
  try {
    publishedImageSourceLimit(budget);
  } catch (error) {
    errors.push(error.message);
  }
  if (report?.version !== 1 || report.completed !== true || !Array.isArray(report.images)) {
    errors.push("published image provenance must be a completed version 1 inventory");
    return invalid;
  }

  const sources = new Set();
  const originals = new Map();
  const prefixes = new Map();
  const outputs = new Map();
  const largestPaths = new Set();
  for (const image of report.images) {
    if (image?.status !== "ready" || typeof image.sourceUrl !== "string" || !image.sourceUrl ||
        sources.has(image.sourceUrl) || !Array.isArray(image.outputs) || !image.outputs.length) {
      errors.push("published image provenance contains an incomplete or duplicate source");
      continue;
    }
    sources.add(image.sourceUrl);
    const { sha256, bytes } = image.source ?? {};
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(sha256) ||
        !Number.isSafeInteger(bytes) || bytes <= 0) {
      errors.push("published image provenance contains invalid original checksum or size");
      continue;
    }
    const prefix = `media/optimized/${sha256.slice(0, 24)}-`;
    if ((originals.has(sha256) && originals.get(sha256) !== bytes) ||
        (prefixes.has(prefix) && prefixes.get(prefix) !== sha256)) {
      errors.push("published image provenance contains conflicting original identities");
      continue;
    }
    originals.set(sha256, bytes);
    prefixes.set(prefix, sha256);
    const largest = image.outputs.find((output) => output?.src === image.largest?.src);
    if (!verifiedRenditionMetadata(image.largest) || !largest ||
        largest.bytes !== image.largest.bytes || largest.sha256 !== image.largest.sha256) {
      errors.push("published image provenance lacks a matching largest rendition");
    } else {
      largestPaths.add(largest.src);
    }
    for (const output of image.outputs) {
      if (!verifiedRenditionMetadata(output)) {
        errors.push(`invalid published image output: ${output?.src || "<missing>"}`);
        continue;
      }
      if (!output.src.startsWith(prefix)) {
        errors.push(`published image output does not belong to its original: ${output.src}`);
        continue;
      }
      const previous = outputs.get(output.src);
      if (previous && (previous.bytes !== output.bytes || previous.sha256 !== output.sha256)) {
        errors.push(`conflicting published image provenance: ${output.src}`);
      }
      outputs.set(output.src, output);
    }
  }

  if (errors.length) return invalid;
  let plan;
  try {
    plan = planPublicImageRenditions(report, budget);
  } catch (error) {
    errors.push(error.message);
    return invalid;
  }
  const archiveBytes = [...outputs.values()].reduce((sum, output) => sum + output.bytes, 0);
  for (const src of plan.omitted) {
    if (largestPaths.has(src)) errors.push(`published image plan omits a required largest rendition: ${src}`);
    outputs.delete(src);
  }
  for (const output of plan.preservedRetired) outputs.set(output.src, output);

  const measured = files.filter((file) => file.relative.startsWith("media/optimized/"));
  const delivered = new Set();
  for (const file of measured) {
    delivered.add(file.relative);
    const output = outputs.get(file.relative);
    if (!output) errors.push(`unlisted published image file: ${file.relative}`);
    else if (file.bytes !== output.bytes) errors.push(`published image size differs from provenance: ${file.relative}`);
  }
  for (const relative of outputs.keys()) {
    if (!delivered.has(relative)) errors.push(`missing published image file: ${relative}`);
  }

  const bytes = measured.reduce((sum, file) => sum + file.bytes, 0);
  const summary = report.summary;
  const sourceBytes = [...originals.values()].reduce((sum, size) => sum + size, 0);
  if (summary?.inventoriedSources !== sources.size || summary.processedSources !== sources.size ||
      summary.ready !== sources.size || summary.failed !== 0 || summary.allRenditionBytes !== archiveBytes ||
      summary.uniqueSourceImages !== originals.size || !Number.isSafeInteger(sourceBytes) || summary.sourceBytes !== sourceBytes) {
    errors.push("published image summary differs from the prepared inventory");
  }
  return { errors, bytes, fileCount: measured.length, sourceCount: sources.size, sourceAliasCount: sources.size - originals.size };
}
