import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planPublicImageRenditions, publicRenditionPath } from "./lib/public-image-rendition-plan.mjs";

const readFlags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);

function sameBuildFile(entry, opened) {
  return entry.isFile() && opened.isFile() && entry.dev === opened.dev && entry.ino === opened.ino;
}

async function removeBuildRendition(filename, src, previous) {
  const file = await open(filename, readFlags);
  try {
    const opened = await file.stat({ bigint: true });
    if (!sameBuildFile(await lstat(filename, { bigint: true }), opened)) {
      throw new Error(`Image rendition is not a regular build file: ${src}`);
    }
    if (previous) {
      const bytes = opened.size === BigInt(previous.bytes) ? await file.readFile() : null;
      const current = await lstat(filename, { bigint: true });
      if (!bytes || bytes.length !== previous.bytes ||
        createHash("sha256").update(bytes).digest("hex") !== previous.sha256 ||
        !sameBuildFile(current, opened) || current.size !== opened.size ||
        current.mtimeNs !== opened.mtimeNs || current.ctimeNs !== opened.ctimeNs) {
        throw new Error(`Retired image rendition differs from its prior inventory: ${src}`);
      }
    }
    await unlink(filename);
  } finally {
    await file.close();
  }
}

export async function prunePublicImageRenditions() {
  const report = JSON.parse(await readFile(new URL("../reports/public-image-delivery.json", import.meta.url), "utf8"));
  if (report.version !== 1 || report.completed !== true) {
    throw new Error("Cannot prepare image delivery from an incomplete rendition inventory");
  }

  // Vite copies public/ wholesale. Remove these derived files only from that build copy.
  const { omitted, retired } = planPublicImageRenditions(report);
  if (!omitted.length && !retired.length) return;
  const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
  const dist = path.join(root, "dist");
  const outputDirectory = path.join(dist, "media", "optimized");
  if (await realpath(outputDirectory) !== outputDirectory || !(await lstat(path.join(dist, "index.html"))).isFile()) {
    throw new Error("The completed site build must have its own local media output directory");
  }
  const omittedPaths = new Set(omitted);
  const retiredByPath = new Map(retired.map((output) => [output.src, output]));
  let removedVariants = 0;
  let removedRetired = 0;
  // The report can select a generated file, but only a directory entry can supply its name.
  for (const entry of await readdir(outputDirectory, { withFileTypes: true })) {
    const basename = path.basename(entry.name);
    const src = `media/optimized/${basename}`;
    if (basename !== entry.name || !publicRenditionPath.test(src)) continue;
    const previous = retiredByPath.get(src);
    if (!previous && !omittedPaths.has(src)) continue;

    if (!entry.isFile()) {
      throw new Error(`Image rendition is not a regular build file: ${src}`);
    }
    await removeBuildRendition(path.join(outputDirectory, basename), src, previous);
    if (previous) removedRetired++;
    else removedVariants++;
  }
  console.log(`Omitted ${removedVariants} optional and ${removedRetired} retired image renditions from dist.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prunePublicImageRenditions();
}
