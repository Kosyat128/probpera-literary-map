import { createHash } from "node:crypto";
import { readFile, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planPublicImageRenditions } from "./lib/public-image-rendition-plan.mjs";

export async function prunePublicImageRenditions(projectRoot, { allowMissingReport = false } = {}) {
  const report = await readFile(path.join(projectRoot, "reports/public-image-delivery.json"), "utf8")
    .then(JSON.parse).catch((error) => {
      if (allowMissingReport && error.code === "ENOENT") return null;
      throw error;
    });
  if (!report) return;
  if (report.version !== 1 || report.completed !== true) {
    throw new Error("Cannot prepare image delivery from an incomplete rendition inventory");
  }

  // Vite copies public/ wholesale. Remove these derived files only from that build copy.
  const { omitted, retired } = planPublicImageRenditions(report);
  if (!omitted.length && !retired.length) return;
  const root = await realpath(projectRoot);
  const dist = path.join(root, "dist");
  const outputDirectory = path.join(dist, "media", "optimized");
  if (await realpath(outputDirectory) !== outputDirectory || !(await stat(path.join(dist, "index.html"))).isFile()) {
    throw new Error("The completed site build must have its own local media output directory");
  }
  let removedRetired = 0;
  for (const src of omitted) await rm(path.join(dist, src), { force: true });
  for (const output of retired) {
    const filename = path.join(dist, output.src);
    const bytes = await readFile(filename).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!bytes) continue;
    if (bytes.length !== output.bytes || createHash("sha256").update(bytes).digest("hex") !== output.sha256) {
      throw new Error(`Retired image rendition differs from its prior inventory: ${output.src}`);
    }
    await rm(filename);
    removedRetired++;
  }
  console.log(`Omitted ${omitted.length} overlapping and ${removedRetired} retired image renditions from dist.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prunePublicImageRenditions(fileURLToPath(new URL("../", import.meta.url)));
}
