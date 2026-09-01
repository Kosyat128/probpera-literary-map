import { createHash } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptsRoot = path.resolve(repositoryRoot, "scripts");
const configRoot = path.resolve(scriptsRoot, "globe-editions");
const cacheRoot = path.resolve(scriptsRoot, ".cache");
const editionId = "cassini-1790";
const cacheDirectory = `scripts/.cache/globe-editions/${editionId}/production-inputs`;
const expectedRoles = new Map([
  ["a", "terrestrial_gores_1_3"],
  ["b", "terrestrial_gores_4_6"],
  ["c", "terrestrial_gores_7_9"],
  ["d", "terrestrial_gores_10_12"],
  ["e", "polar_caps_and_zodiac_assembly"],
]);

function parseArguments(argv) {
  const result = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== "--config") {
      throw new Error(`Unexpected argument: ${key}`);
    }
    if (result.has("config")) {
      throw new Error("--config may be supplied only once.");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --config.");
    }
    result.set("config", value);
    index += 1;
  }
  return result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function isInsideOrEqual(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function isStrictlyInside(parent, candidate) {
  return candidate !== parent && isInsideOrEqual(parent, candidate);
}

async function lstatIfExists(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertRealDirectory(entry, label) {
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new Error(`${label} must be a real directory, not a symlink, junction, or reparse target.`);
  }
}

function assertBasenameOnly(filename, sourceId) {
  if (
    typeof filename !== "string" ||
    filename.length === 0 ||
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    path.basename(filename) !== filename
  ) {
    throw new Error(`${sourceId}: source filename must be a basename only.`);
  }
}

async function assertNoLinkedSegments(root, candidate) {
  if (!isInsideOrEqual(root, candidate)) {
    throw new Error("Production-source path escaped its allowed root.");
  }

  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const entry = await lstatIfExists(current);
    if (!entry) break;
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Production-source path may not traverse a symlink, junction, or reparse point: ${current}`
      );
    }
  }
}

async function assertSafeLeaf({
  lexicalRoot,
  canonicalRoot,
  candidate,
  mustNotExist = false,
}) {
  if (!isStrictlyInside(lexicalRoot, candidate)) {
    throw new Error("Production-source file escaped its output directory.");
  }

  const parent = path.dirname(candidate);
  await assertNoLinkedSegments(lexicalRoot, parent);
  const canonicalParent = await realpath(parent);
  if (!isInsideOrEqual(canonicalRoot, canonicalParent)) {
    throw new Error("Production-source parent escaped the canonical cache directory.");
  }

  const entry = await lstatIfExists(candidate);
  if (!entry) return;
  if (entry.isSymbolicLink()) {
    throw new Error(
      `Production-source file may not be a symlink, junction, or reparse target: ${candidate}`
    );
  }
  if (!entry.isFile()) {
    throw new Error(`Production-source target must be a regular file: ${candidate}`);
  }
  const canonicalCandidate = await realpath(candidate);
  if (!isInsideOrEqual(canonicalRoot, canonicalCandidate)) {
    throw new Error("Production-source target escaped the canonical cache directory.");
  }
  if (mustNotExist) {
    throw new Error(`Temporary production-source file already exists: ${candidate}`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

function validateExactLocIiifUrl(urlValue, source) {
  if (typeof urlValue !== "string") {
    throw new Error(`${source.id}: production source URL must be a string.`);
  }
  if (!/^g3201b\.ct001065[a-e]$/u.test(source.resourceId)) {
    throw new Error(`${source.id}: invalid Cassini LOC resourceId.`);
  }

  const parsed = new URL(urlValue);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "tile.loc.gov" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error(
      `${source.id}: production source URL must use the approved LOC HTTPS origin without auth, query, or hash.`
    );
  }

  const expectedUrl =
    `https://tile.loc.gov/image-services/iiif/service:gmd:gmd3:g3201:` +
    `${source.resourceId.replaceAll(".", ":")}/full/full/0/default.jpg`;
  if (urlValue !== expectedUrl || parsed.href !== expectedUrl) {
    throw new Error(
      `${source.id}: production source URL must exactly match resourceId and the full/full IIIF request.`
    );
  }
  return expectedUrl;
}

function validateConfiguredSource(source, filenames, resourceIds) {
  if (!source || typeof source !== "object" || !expectedRoles.has(source.id)) {
    throw new Error("Cassini production sources must use unique ids a through e.");
  }

  const expectedResourceId = `g3201b.ct001065${source.id}`;
  if (source.resourceId !== expectedResourceId) {
    throw new Error(`${source.id}: resourceId must be ${expectedResourceId}.`);
  }
  if (resourceIds.has(source.resourceId)) {
    throw new Error(`${source.id}: duplicate resourceId ${source.resourceId}.`);
  }
  resourceIds.add(source.resourceId);

  if (source.role !== expectedRoles.get(source.id)) {
    throw new Error(`${source.id}: unexpected Cassini sheet role.`);
  }
  const expectedCatalogUrl = `https://www.loc.gov/resource/${source.resourceId}/`;
  if (source.catalogUrl !== expectedCatalogUrl) {
    throw new Error(`${source.id}: catalog URL must exactly match resourceId.`);
  }

  const input = source.productionSourceInput;
  if (!input || typeof input !== "object") {
    throw new Error(`${source.id}: missing productionSourceInput.`);
  }
  if (input.tracked !== false || input.masterArtifact !== false) {
    throw new Error(
      `${source.id}: production inputs must remain untracked source files and must not be marked as masters.`
    );
  }
  if (
    input.format !== "jpeg" ||
    input.colorSpace !== "srgb" ||
    input.depth !== "uchar" ||
    input.channels !== 3 ||
    input.hasIccProfile !== false
  ) {
    throw new Error(
      `${source.id}: expected pinned JPEG/sRGB/uchar/3-channel metadata without ICC.`
    );
  }

  assertPositiveInteger(input.width, `${source.id}: width`);
  assertPositiveInteger(input.height, `${source.id}: height`);
  assertPositiveInteger(input.bytes, `${source.id}: bytes`);
  if (typeof input.sha256 !== "string" || !/^[A-F0-9]{64}$/u.test(input.sha256)) {
    throw new Error(`${source.id}: SHA-256 must be a pinned uppercase digest.`);
  }

  const expectedFilename = `cassini-1790-${source.id}-full.jpg`;
  assertBasenameOnly(input.filename, source.id);
  if (input.filename !== expectedFilename) {
    throw new Error(`${source.id}: filename must be ${expectedFilename}.`);
  }
  const filenameKey = input.filename.toLowerCase();
  if (filenames.has(filenameKey)) {
    throw new Error(`${source.id}: duplicate filename ${input.filename}.`);
  }
  filenames.add(filenameKey);

  return {
    source,
    input,
    validatedUrl: validateExactLocIiifUrl(input.iiifUrl, source),
  };
}

async function readPinnedResponseBytes(response, expectedBytes, sourceId) {
  if (!response.body) {
    throw new Error(`${sourceId}: source response has no body.`);
  }

  const chunks = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > expectedBytes) {
      await reader.cancel("Pinned byte limit exceeded.");
      throw new Error(
        `${sourceId}: response exceeded the pinned ${expectedBytes}-byte limit.`
      );
    }
    chunks.push(Buffer.from(value));
  }
  if (totalBytes !== expectedBytes) {
    throw new Error(
      `${sourceId}: expected ${expectedBytes} response bytes, received ${totalBytes}.`
    );
  }
  return Buffer.concat(chunks, totalBytes);
}

async function validateProductionInput(bytes, configured) {
  const { source, input } = configured;
  if (bytes.length !== input.bytes) {
    throw new Error(
      `${source.id}: expected ${input.bytes} bytes, received ${bytes.length}.`
    );
  }
  const actualHash = sha256(bytes);
  if (actualHash !== input.sha256) {
    throw new Error(
      `${source.id}: SHA-256 mismatch; expected ${input.sha256}, received ${actualHash}.`
    );
  }

  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  if (metadata.width !== input.width || metadata.height !== input.height) {
    throw new Error(
      `${source.id}: expected ${input.width}x${input.height}, received ${metadata.width}x${metadata.height}.`
    );
  }
  if (
    metadata.format !== input.format ||
    metadata.space !== input.colorSpace ||
    metadata.depth !== input.depth ||
    metadata.channels !== input.channels ||
    metadata.hasProfile === true ||
    metadata.icc !== undefined
  ) {
    throw new Error(
      `${source.id}: decoded metadata must be JPEG/sRGB/uchar/3-channel without ICC.`
    );
  }
  if (metadata.orientation && metadata.orientation !== 1) {
    throw new Error(`${source.id}: unexpected EXIF orientation ${metadata.orientation}.`);
  }

  return {
    bytes: bytes.length,
    width: metadata.width,
    height: metadata.height,
    sha256: actualHash,
    format: metadata.format,
    colorSpace: metadata.space,
    depth: metadata.depth,
    channels: metadata.channels,
    hasIccProfile: false,
  };
}

const argumentsMap = parseArguments(process.argv.slice(2));
const configPath = path.resolve(
  repositoryRoot,
  argumentsMap.get("config") ??
    "scripts/globe-editions/cassini-1790-production-sources.json"
);
if (!isStrictlyInside(configRoot, configPath)) {
  throw new Error("Production-source config must be inside scripts/globe-editions/.");
}

const scriptsRootEntry = await lstat(scriptsRoot);
assertRealDirectory(scriptsRootEntry, "Scripts root");
const configRootEntry = await lstat(configRoot);
assertRealDirectory(configRootEntry, "Globe-edition config root");
await assertNoLinkedSegments(scriptsRoot, configPath);
const configEntry = await lstat(configPath);
if (configEntry.isSymbolicLink() || !configEntry.isFile()) {
  throw new Error("Production-source config must be a real regular file.");
}
const canonicalConfigRoot = await realpath(configRoot);
const canonicalConfigPath = await realpath(configPath);
if (!isStrictlyInside(canonicalConfigRoot, canonicalConfigPath)) {
  throw new Error("Production-source config escaped its canonical config root.");
}

const config = JSON.parse(await readFile(configPath, "utf8"));
if (
  config.schemaVersion !== 1 ||
  config.editionId !== editionId ||
  config.artifactKind !== "official-full-resolution-production-source-inputs" ||
  config.sourceInputsOnly !== true ||
  config.masterArtifact !== false ||
  config.runtimeEligible !== false ||
  config.tracked !== false
) {
  throw new Error(
    "Only schemaVersion 1 pinned Cassini production-source-input configs are accepted; inputs are not masters or runtime assets."
  );
}
if (
  typeof config.acquisitionDate !== "string" ||
  !/^\d{4}-\d{2}-\d{2}$/u.test(config.acquisitionDate)
) {
  throw new Error("Production-source config requires an ISO acquisitionDate.");
}
if (config.cacheDirectory !== cacheDirectory) {
  throw new Error(`Production-source cacheDirectory must be ${cacheDirectory}.`);
}
if (
  !config.rights ||
  config.rights.status !== "accepted_for_acquisition" ||
  typeof config.rights.credit !== "string" ||
  config.rights.credit.trim().length === 0
) {
  throw new Error("Production-source config requires the accepted rights status and credit.");
}
if (!Array.isArray(config.sources) || config.sources.length !== expectedRoles.size) {
  throw new Error("Cassini production acquisition requires exactly five pinned sources.");
}

const configuredFilenames = new Set();
const configuredResourceIds = new Set();
const configuredSources = config.sources.map((source) =>
  validateConfiguredSource(source, configuredFilenames, configuredResourceIds)
);
for (const expectedId of expectedRoles.keys()) {
  if (!configuredSources.some(({ source }) => source.id === expectedId)) {
    throw new Error(`Cassini production config is missing source ${expectedId}.`);
  }
}

const outputDirectory = path.resolve(repositoryRoot, config.cacheDirectory);
const requiredOutputDirectory = path.resolve(
  cacheRoot,
  "globe-editions",
  editionId,
  "production-inputs"
);
if (outputDirectory !== requiredOutputDirectory || !isStrictlyInside(cacheRoot, outputDirectory)) {
  throw new Error("Production acquisition may write only to the fixed production-inputs cache.");
}

await mkdir(cacheRoot, { recursive: true });
const cacheRootEntry = await lstat(cacheRoot);
assertRealDirectory(cacheRootEntry, "Production-source cache root");
const canonicalCacheRoot = await realpath(cacheRoot);
await assertNoLinkedSegments(cacheRoot, outputDirectory);
await mkdir(outputDirectory, { recursive: true });
await assertNoLinkedSegments(cacheRoot, outputDirectory);
const outputDirectoryEntry = await lstat(outputDirectory);
assertRealDirectory(outputDirectoryEntry, "Production-source output directory");
const canonicalOutputDirectory = await realpath(outputDirectory);
if (!isStrictlyInside(canonicalCacheRoot, canonicalOutputDirectory)) {
  throw new Error("Production-source output directory escaped the canonical cache root.");
}

const acquisitions = [];
for (const configured of configuredSources) {
  const { source, input, validatedUrl } = configured;
  const targetPath = path.resolve(outputDirectory, input.filename);
  await assertSafeLeaf({
    lexicalRoot: outputDirectory,
    canonicalRoot: canonicalOutputDirectory,
    candidate: targetPath,
  });

  let bytes;
  let cacheHit = false;
  let responseUrl = null;
  const existingEntry = await lstatIfExists(targetPath);
  if (existingEntry) {
    bytes = await readFile(targetPath);
    await validateProductionInput(bytes, configured);
    cacheHit = true;
  } else {
    const response = await fetch(validatedUrl, {
      headers: { "user-agent": "ProbPeraGlobeProductionSources/1.0" },
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(
        `${source.id}: source request failed with HTTP ${response.status}.`
      );
    }
    if (response.redirected || response.url !== validatedUrl) {
      throw new Error(`${source.id}: redirected or non-canonical response URL rejected.`);
    }
    if (!(response.headers.get("content-type") ?? "").startsWith("image/jpeg")) {
      throw new Error(`${source.id}: expected an image/jpeg response.`);
    }
    responseUrl = validateExactLocIiifUrl(response.url, source);
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && Number(declaredLength) !== input.bytes) {
      throw new Error(
        `${source.id}: Content-Length mismatch; expected ${input.bytes}, received ${declaredLength}.`
      );
    }

    bytes = await readPinnedResponseBytes(response, input.bytes, source.id);
    await validateProductionInput(bytes, configured);
    const temporaryPath = `${targetPath}.part`;
    await assertSafeLeaf({
      lexicalRoot: outputDirectory,
      canonicalRoot: canonicalOutputDirectory,
      candidate: temporaryPath,
      mustNotExist: true,
    });
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    try {
      await assertSafeLeaf({
        lexicalRoot: outputDirectory,
        canonicalRoot: canonicalOutputDirectory,
        candidate: temporaryPath,
      });
      const stagedBytes = await readFile(temporaryPath);
      await validateProductionInput(stagedBytes, configured);
      await link(temporaryPath, targetPath);
      bytes = stagedBytes;
    } finally {
      await unlink(temporaryPath);
    }
    await assertSafeLeaf({
      lexicalRoot: outputDirectory,
      canonicalRoot: canonicalOutputDirectory,
      candidate: targetPath,
    });
  }

  const validated = await validateProductionInput(bytes, configured);
  acquisitions.push({
    id: source.id,
    resourceId: source.resourceId,
    role: source.role,
    url: validatedUrl,
    responseUrl,
    localPath: path.relative(repositoryRoot, targetPath).replaceAll("\\", "/"),
    cacheHit,
    tracked: false,
    masterArtifact: false,
    ...validated,
  });
}

const acquisitionManifest = {
  schemaVersion: 1,
  editionId: config.editionId,
  artifactKind: config.artifactKind,
  sourceInputsOnly: true,
  masterArtifact: false,
  runtimeEligible: false,
  tracked: false,
  acquisitionDate: config.acquisitionDate,
  verifiedAt: new Date().toISOString(),
  configPath: path.relative(repositoryRoot, configPath).replaceAll("\\", "/"),
  rights: config.rights,
  sources: acquisitions,
};

const acquisitionManifestPath = path.resolve(outputDirectory, "acquisition.json");
await assertSafeLeaf({
  lexicalRoot: outputDirectory,
  canonicalRoot: canonicalOutputDirectory,
  candidate: acquisitionManifestPath,
});
const temporaryManifestPath = path.resolve(
  outputDirectory,
  ".acquisition.json.part"
);
await assertSafeLeaf({
  lexicalRoot: outputDirectory,
  canonicalRoot: canonicalOutputDirectory,
  candidate: temporaryManifestPath,
  mustNotExist: true,
});
await writeFile(
  temporaryManifestPath,
  `${JSON.stringify(acquisitionManifest, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" }
);
await rename(temporaryManifestPath, acquisitionManifestPath);

console.log(
  `Verified ${acquisitions.length} pinned full-resolution source inputs in ${config.cacheDirectory}.`
);
