import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planPublicImageRenditions, publicRenditionPath } from "./lib/public-image-rendition-plan.mjs";

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
  let removedOverlapping = 0;
  let removedRetired = 0;
  // The report can select a generated file, but only a directory entry can supply its name.
  for (const entry of await readdir(outputDirectory, { withFileTypes: true })) {
    const basename = path.basename(entry.name);
    const src = `media/optimized/${basename}`;
    if (basename !== entry.name || !publicRenditionPath.test(src)) continue;
    const previous = retiredByPath.get(src);
    if (!previous && !omittedPaths.has(src)) continue;

    const filename = path.join(outputDirectory, basename);
    const stat = await lstat(filename);
    if (!entry.isFile() || !stat.isFile()) {
      throw new Error(`Image rendition is not a regular build file: ${src}`);
    }
    if (previous) {
      const bytes = stat.size === previous.bytes ? await readFile(filename) : null;
      if (!bytes || bytes.length !== previous.bytes || createHash("sha256").update(bytes).digest("hex") !== previous.sha256) {
        throw new Error(`Retired image rendition differs from its prior inventory: ${src}`);
      }
      removedRetired++;
    } else {
      removedOverlapping++;
    }
    await unlink(filename);
  }
  console.log(`Omitted ${removedOverlapping} overlapping and ${removedRetired} retired image renditions from dist.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prunePublicImageRenditions();
}
