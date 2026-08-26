import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX_GZIP_KIB = 2_900;
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const adminRoot = path.join(projectRoot, "apps", "admin");
const outputDirectory = path.join(
  projectRoot,
  ".tmp",
  `admin-worker-size-${process.pid}`
);
const metafilePath = path.join(outputDirectory, "bundle-meta.json");
const wranglerPath = path.join(
  projectRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
);

await mkdir(outputDirectory, { recursive: true });
try {
  const result = spawnSync(
    process.execPath,
    [
      wranglerPath,
      "deploy",
      "--dry-run",
      "--outdir",
      outputDirectory,
      "--metafile",
      metafilePath,
      "--config",
      "wrangler.jsonc",
    ],
    {
      cwd: adminRoot,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  process.stdout.write(output);
  if (result.status !== 0) {
    throw new Error(`Wrangler dry-run failed with exit code ${result.status}`);
  }

  const sizeMatch = output.match(
    /Total Upload:\s+[\d.]+ KiB\s+\/ gzip:\s+([\d.]+) KiB/u
  );
  if (!sizeMatch) {
    throw new Error("Wrangler did not report the compressed Worker size");
  }
  const gzipKib = Number(sizeMatch[1]);
  if (!Number.isFinite(gzipKib) || gzipKib > MAX_GZIP_KIB) {
    throw new Error(
      `Admin Worker is ${gzipKib.toFixed(2)} KiB gzip; ` +
        `the release gate is ${MAX_GZIP_KIB} KiB`
    );
  }

  const metafile = JSON.parse(await readFile(metafilePath, "utf8"));
  const forbiddenInputs = Object.keys(metafile.inputs || {}).filter((input) =>
    /(?:catalog-assets|catalog\.generated\.json)/u.test(input)
  );
  if (forbiddenInputs.length) {
    throw new Error(
      `Private admin catalogs leaked into the Worker bundle: ${forbiddenInputs.join(
        ", "
      )}`
    );
  }
  console.log(
    `Admin Worker size gate passed: ${gzipKib.toFixed(2)} / ${MAX_GZIP_KIB} KiB gzip.`
  );
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
