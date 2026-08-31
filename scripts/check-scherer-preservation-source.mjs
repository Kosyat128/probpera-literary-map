import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const auditConfigPath = path.join(
  repositoryRoot,
  "scripts/globe-editions/scherer-preservation-source.json"
);
const runtimeSourceConfigPath = path.join(
  repositoryRoot,
  "scripts/globe-editions/historical-runtime-sources.json"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function resolveRepositoryPath(relativePath, label) {
  assert(
    typeof relativePath === "string" &&
      relativePath.length > 0 &&
      !path.isAbsolute(relativePath),
    `${label} must be a repository-relative path.`
  );
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, absolutePath);
  assert(
    relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative)),
    `${label} resolves outside the repository.`
  );
  return absolutePath;
}

async function readJson(absolutePath) {
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

async function verifyImage(record, label, required) {
  const absolutePath = resolveRepositoryPath(record.path ?? record.localPath, label);
  let bytes;
  try {
    const stat = await lstat(absolutePath);
    assert(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file.`);
    bytes = await readFile(absolutePath);
  } catch (error) {
    if (!required && error?.code === "ENOENT") return false;
    throw error;
  }
  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  assert(
    bytes.length === record.bytes &&
      sha256(bytes) === record.sha256 &&
      metadata.width === record.width &&
      metadata.height === record.height,
    `${label} no longer matches its pinned byte/hash/dimension contract.`
  );
  return true;
}

export async function checkSchererPreservationSource({ requireCache = false } = {}) {
  const [audit, runtimeConfig] = await Promise.all([
    readJson(auditConfigPath),
    readJson(runtimeSourceConfigPath),
  ]);
  const master = audit.preservationMaster;
  const access = audit.accessDerivative;
  const tiledCandidate = audit.acquisition?.tiledQaDerivative;

  assert(
    audit.schemaVersion === 1 &&
      audit.artifactKind === "scherer-authoritative-preservation-source-audit" &&
      audit.editionId === "scherer-1700" &&
      audit.sourceInputsOnly === true &&
      audit.runtimeEligible === false &&
      audit.productionTextureReplaced === false &&
      audit.decision?.authoritativeHigherResolutionFound === true &&
      audit.decision?.status === "pinned-candidate-blocked-on-geometry-registration" &&
      audit.decision?.commonsReferenceOnly === true,
    "Scherer preservation audit identity or fail-closed decision is invalid."
  );
  assert(
    audit.institution?.itemId ===
      "17c519d0-8bdc-0137-6dac-02d0d7bfd6e4-9" &&
      audit.institution?.mapId === "afm0003392" &&
      audit.institution?.rights?.publicDomain === true &&
      audit.institution?.rights?.label === "No Copyright - United States" &&
      audit.institution?.oai?.harvestEndpoint === null &&
      audit.institution?.oai?.status?.includes("not-confirmed"),
    "Scherer institutional identity, rights or OAI qualification changed."
  );
  assert(
    access.binaryId === "e0f792e0-8be8-0137-6dac-02d0d7bfd6e4-0" &&
      access.width === 3000 &&
      access.height === 2000 &&
      access.bytes === 1304625 &&
      access.sha256 ===
        "7F462DCE31DE5ED1B78AAFE3ECC7BEBF34152B520696E68D7B9881F57417BA64",
    "The pinned 3000 x 2000 UIUC access derivative changed."
  );
  assert(
    master.binaryId === "e14fe7f0-8be8-0137-6dac-02d0d7bfd6e4-8" &&
      master.masterType === "Preservation Master" &&
      master.mediaType === "image/tiff" &&
      master.byteSize === 448825264 &&
      master.width === 10147 &&
      master.height === 7371 &&
      master.pageCount === 2 &&
      master.bitsPerSample === 16 &&
      master.samplesPerPixel === 3 &&
      master.compression === "uncompressed" &&
      master.xResolutionDpi === 600 &&
      master.yResolutionDpi === 600 &&
      master.maxArea === 74793537 &&
      master.availableSizes?.some(
        ([width, height]) => width === 5074 && height === 3686
      ) &&
      master.originalSha256 === null &&
      master.originalChecksumStatus ===
        "not-exposed-by-public-binary-or-iiif-metadata",
    "The official UIUC preservation-master metadata contract changed."
  );
  assert(
    audit.acquisition?.originalTiff?.status === "not-downloaded-size-limit" &&
      audit.acquisition?.singleImageDerivativeAttempt?.httpStatus === 500 &&
      audit.acquisition?.singleImageDerivativeAttempt?.serverError ===
        "Java heap space" &&
      tiledCandidate?.status === "acquired" &&
      tiledCandidate?.tracked === false &&
      tiledCandidate?.runtimeEligible === false &&
      tiledCandidate?.tileCount === 20 &&
      tiledCandidate?.geometryRegistration === "not-run" &&
      audit.institutionRequest?.status === "prepared-not-sent" &&
      audit.requiredBeforeProduction?.length >= 5,
    "The acquisition record no longer fails closed before geometry QA."
  );

  const runtimeEdition = runtimeConfig.editions?.find(
    ({ id }) => id === "scherer-1700"
  );
  const runtimeSource = runtimeEdition?.sources?.find(({ id }) => id === "gores");
  assert(
    runtimeSource?.url === access.fullImageUrl &&
      runtimeSource?.width === access.width &&
      runtimeSource?.height === access.height &&
      runtimeSource?.bytes === access.bytes &&
      runtimeSource?.sha256 === access.sha256,
    "Production source config no longer points to the pinned 3000 x 2000 access derivative."
  );

  const verifiedTrackedTextures = await Promise.all([
    verifyImage(audit.productionSnapshot.desktop, "Scherer desktop texture", true),
    verifyImage(audit.productionSnapshot.mobile, "Scherer mobile texture", true),
  ]);
  const cacheRecords = [
    {
      path: audit.productionSnapshot.cachedAccessInputPath,
      width: access.width,
      height: access.height,
      bytes: access.bytes,
      sha256: access.sha256,
    },
    {
      path: tiledCandidate.localPath,
      width: tiledCandidate.targetWidth,
      height: tiledCandidate.targetHeight,
      bytes: tiledCandidate.bytes,
      sha256: tiledCandidate.sha256,
    },
    ...audit.secondaryReferences.map((reference) => reference),
  ];
  const verifiedCacheRecords = [];
  for (const [index, record] of cacheRecords.entries()) {
    verifiedCacheRecords.push(
      await verifyImage(record, `Scherer cache record ${index + 1}`, requireCache)
    );
  }

  return {
    preservationPixels: master.width * master.height,
    accessPixels: access.width * access.height,
    verifiedTextureCount: verifiedTrackedTextures.filter(Boolean).length,
    verifiedCacheCount: verifiedCacheRecords.filter(Boolean).length,
    configSha256: sha256(await readFile(auditConfigPath)),
  };
}

const directExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (directExecution) {
  const result = await checkSchererPreservationSource({
    requireCache: process.argv.includes("--require-cache"),
  });
  console.log(
    `Verified official Scherer preservation source (${result.preservationPixels} px vs ${result.accessPixels} access px), ${result.verifiedTextureCount} unchanged runtime textures and ${result.verifiedCacheCount} cached source/reference files (${result.configSha256}).`
  );
}
