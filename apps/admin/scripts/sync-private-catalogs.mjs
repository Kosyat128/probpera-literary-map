import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const KV_BINDING = "ADMIN_CATALOGS";
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
  if (!quiet || result.status !== 0) {
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

function storageModeArguments() {
  return local
    ? ["--local", "--persist-to", localStateDirectory]
    : ["--remote"];
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
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

for (const catalog of CATALOG_OBJECTS) {
  const sourcePath = path.join(catalogDirectory, catalog.file);
  const source = await readFile(sourcePath);
  runWrangler([
    "kv",
    "key",
    "put",
    catalog.key,
    "--path",
    sourcePath,
    "--binding",
    KV_BINDING,
    ...storageModeArguments(),
    "--config",
    configPath,
  ]);

  const verification = runWrangler(
    [
      "kv",
      "key",
      "get",
      catalog.key,
      "--binding",
      KV_BINDING,
      ...storageModeArguments(),
      "--config",
      configPath,
    ],
    { quiet: true }
  );
  const sourceDigest = digest(source);
  const storedDigest = digest(Buffer.from(verification.stdout, "utf8"));
  if (sourceDigest !== storedDigest) {
    throw new Error(
      `Workers KV catalog verification failed for ${catalog.key}`
    );
  }
  console.log(
    `Verified private KV catalog ${catalog.key}: sha256 ${sourceDigest}`
  );
}
