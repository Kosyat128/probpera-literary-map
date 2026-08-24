import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const BUCKET_NAME = "probpera-admin-catalogs";
const CATALOG_OBJECTS = [
  {
    key: "editorial-catalog.json",
    file: "editorial-catalog.json",
  },
  {
    key: "interface-copy-catalog.json",
    file: "interface-copy-catalog.json",
  },
];

const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const projectRoot = path.resolve(appRoot, "..", "..");
const wranglerPath = path.join(
  projectRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js"
);
const configPath = path.join(appRoot, "wrangler.jsonc");
const catalogDirectory = path.join(appRoot, "catalog-assets");
const local = process.argv.includes("--local");
const localStateDirectory = path.join(appRoot, ".wrangler", "state");

function runWrangler(args, { allowFailure = false, quiet = false } = {}) {
  const result = spawnSync(process.execPath, [wranglerPath, ...args], {
    cwd: appRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (!quiet) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `Wrangler command failed with exit code ${result.status}: ${args.join(" ")}`
    );
  }
  return result;
}

function objectModeArguments() {
  return local
    ? ["--local", "--persist-to", localStateDirectory]
    : ["--remote"];
}

async function digest(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

if (
  !local &&
  (!process.env.CLOUDFLARE_ACCOUNT_ID ||
    !process.env.CLOUDFLARE_API_TOKEN)
) {
  throw new Error(
    "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for remote catalog sync"
  );
}

if (!local) {
  const bucketInfo = runWrangler(
    ["r2", "bucket", "info", BUCKET_NAME, "--config", configPath],
    { allowFailure: true, quiet: true }
  );
  if (bucketInfo.status !== 0) {
    console.log(`Creating private R2 bucket ${BUCKET_NAME}.`);
    runWrangler([
      "r2",
      "bucket",
      "create",
      BUCKET_NAME,
      "--config",
      configPath,
    ]);
  }
}

const verificationDirectory = await mkdtemp(
  path.join(os.tmpdir(), "probpera-admin-catalogs-")
);
try {
  for (const catalog of CATALOG_OBJECTS) {
    const sourcePath = path.join(catalogDirectory, catalog.file);
    await readFile(sourcePath);
    runWrangler([
      "r2",
      "object",
      "put",
      `${BUCKET_NAME}/${catalog.key}`,
      ...objectModeArguments(),
      "--file",
      sourcePath,
      "--content-type",
      "application/json",
      "--force",
      "--config",
      configPath,
    ]);

    const verificationPath = path.join(
      verificationDirectory,
      catalog.file
    );
    runWrangler([
      "r2",
      "object",
      "get",
      `${BUCKET_NAME}/${catalog.key}`,
      ...objectModeArguments(),
      "--file",
      verificationPath,
      "--config",
      configPath,
    ]);
    const [sourceDigest, remoteDigest] = await Promise.all([
      digest(sourcePath),
      digest(verificationPath),
    ]);
    if (sourceDigest !== remoteDigest) {
      throw new Error(
        `R2 catalog verification failed for ${catalog.key}`
      );
    }
    console.log(
      `Verified private catalog ${catalog.key}: sha256 ${sourceDigest}`
    );
  }
} finally {
  await rm(verificationDirectory, { recursive: true, force: true });
}
