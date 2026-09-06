const renditionPath = /^media\/optimized\/[a-f0-9]{24}-(?:[1-9][0-9]*w|original)\.(?:avif|jpe?g|png|webp|svg|gif)$/u;

// Only independently inventoried image files may leave the existing application
// budget. Unknown files, incomplete provenance and size mismatches fail closed.
export function measurePublishedImageCorpus({ files, report, budget }) {
  const errors = [];
  for (const field of ["totalBytes", "fileCount", "sourceCount"]) {
    if (!Number.isSafeInteger(budget?.[field]) || budget[field] <= 0) {
      errors.push(`publishedImageCorpus.${field} must be a positive safe integer`);
    }
  }
  if (report?.version !== 1 || report.completed !== true || !Array.isArray(report.images)) {
    errors.push("published image provenance must be a completed version 1 inventory");
    return { errors, bytes: 0, fileCount: 0, sourceCount: 0 };
  }

  const sources = new Set();
  const outputs = new Map();
  for (const image of report.images) {
    if (image?.status !== "ready" || typeof image.sourceUrl !== "string" || !image.sourceUrl ||
        sources.has(image.sourceUrl) || !Array.isArray(image.outputs) || !image.outputs.length) {
      errors.push("published image provenance contains an incomplete or duplicate source");
      continue;
    }
    sources.add(image.sourceUrl);
    for (const output of image.outputs) {
      if (!renditionPath.test(output?.src || "") || !Number.isSafeInteger(output.bytes) ||
          output.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(output.sha256 || "")) {
        errors.push(`invalid published image output: ${output?.src || "<missing>"}`);
        continue;
      }
      const previous = outputs.get(output.src);
      if (previous && (previous.bytes !== output.bytes || previous.sha256 !== output.sha256)) {
        errors.push(`conflicting published image provenance: ${output.src}`);
      }
      outputs.set(output.src, output);
    }
  }

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
  if (summary?.inventoriedSources !== sources.size || summary.processedSources !== sources.size ||
      summary.ready !== sources.size || summary.failed !== 0 || summary.allRenditionBytes !== bytes) {
    errors.push("published image summary differs from the delivered inventory");
  }
  return { errors, bytes, fileCount: measured.length, sourceCount: sources.size };
}
