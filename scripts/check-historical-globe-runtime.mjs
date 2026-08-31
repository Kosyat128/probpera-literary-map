import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repositoryRoot,
  "reports/globe-editions/historical-runtime-textures.json"
);
const finalReviewPath = path.join(
  repositoryRoot,
  "reports/globe-editions/historical-runtime-final-review.json"
);
const configPath = path.join(
  repositoryRoot,
  "scripts/globe-editions/historical-runtime-sources.json"
);
const requirementsPath = path.join(
  repositoryRoot,
  "scripts/globe-editions/historical-runtime-requirements.txt"
);
const sourceManifestPath = path.join(
  repositoryRoot,
  "reports/globe-editions/source-manifest.json"
);
const editionRegistryPath = path.join(
  repositoryRoot,
  "src/components/globeEditions.ts"
);
const canonicalAtlasPath = path.join(
  repositoryRoot,
  "src/data/geo/countries.geojson"
);
const textureRoot = path.join(repositoryRoot, "public/textures");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function textureContentVersion(outputs) {
  const hashes = outputs.map(({ sha256: outputSha256 }) =>
    outputSha256.toLowerCase()
  );
  return `sha256-${createHash("sha256")
    .update(hashes.join(":"))
    .digest("hex")
    .slice(0, 16)}`;
}

function editionRegistryBlock(registrySource, editionId) {
  const marker = `id: "${editionId}"`;
  const start = registrySource.indexOf(marker);
  assert(start >= 0, `Missing ${editionId} in the runtime edition registry.`);
  const next = registrySource.indexOf("\n    id: ", start + marker.length);
  return registrySource.slice(start, next >= 0 ? next : undefined);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function repositoryPath(relativePath, label) {
  assert(
    typeof relativePath === "string" &&
      relativePath.length > 0 &&
      !path.isAbsolute(relativePath),
    `${label} must be repository-relative.`
  );
  const resolved = path.resolve(repositoryRoot, relativePath);
  assert(isInside(repositoryRoot, resolved), `${label} escaped the repository.`);
  return resolved;
}

async function readRegularFile(filePath, allowedRoot, label) {
  assert(isInside(allowedRoot, filePath), `${label} escaped its allowed root.`);
  const [stat, canonicalRoot, canonicalFile] = await Promise.all([
    lstat(filePath),
    realpath(allowedRoot),
    realpath(filePath),
  ]);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file.`);
  assert(isInside(canonicalRoot, canonicalFile), `${label} resolves outside its root.`);
  return readFile(filePath);
}

function expectedOutputs(config, edition) {
  return [
    {
      kind: "desktop",
      path: `public/textures/${edition.outputBasename}.webp`,
      width: config.outputs.desktop.width,
      height: config.outputs.desktop.height,
      budgetBytes: config.outputs.desktopBudgetBytes,
    },
    {
      kind: "mobile",
      path: `public/textures/${edition.outputBasename}-mobile.webp`,
      width: config.outputs.mobile.width,
      height: config.outputs.mobile.height,
      budgetBytes: config.outputs.mobileBudgetBytes,
    },
  ];
}

async function validateOutput(output, expected) {
  assert(
    output.kind === expected.kind &&
      output.path === expected.path &&
      output.width === expected.width &&
      output.height === expected.height &&
      output.budgetBytes === expected.budgetBytes &&
      output.withinBudget === true &&
      Number.isInteger(output.bytes) &&
      output.bytes > 0 &&
      output.bytes <= expected.budgetBytes &&
      typeof output.sha256 === "string" &&
      /^[0-9A-F]{64}$/u.test(output.sha256),
    `${expected.path} report contract is invalid.`
  );
  const outputPath = repositoryPath(output.path, `${expected.kind} texture path`);
  assert(isInside(textureRoot, outputPath), `${expected.path} is outside public/textures.`);
  const bytes = await readRegularFile(
    outputPath,
    textureRoot,
    `${expected.kind} historical globe texture`
  );
  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  assert(
    bytes.length === output.bytes &&
      sha256(bytes) === output.sha256 &&
      metadata.format === "webp" &&
      metadata.width === expected.width &&
      metadata.height === expected.height &&
      metadata.space === "srgb" &&
      metadata.hasAlpha !== true,
    `${expected.path} bytes or image metadata do not match the reviewed report.`
  );
}

export async function checkHistoricalGlobeRuntime() {
  const [
    reportBytes,
    finalReviewBytes,
    configBytes,
    requirementsBytes,
    canonicalAtlasBytes,
    sourceManifestBytes,
    editionRegistryBytes,
  ] = await Promise.all([
    readRegularFile(
      reportPath,
      path.dirname(reportPath),
      "historical runtime report"
    ),
    readRegularFile(
      finalReviewPath,
      path.dirname(finalReviewPath),
      "historical runtime final review"
    ),
    readRegularFile(
      configPath,
      path.dirname(configPath),
      "historical source config"
    ),
    readRegularFile(
      requirementsPath,
      path.dirname(requirementsPath),
      "historical build requirements"
    ),
    readRegularFile(
      canonicalAtlasPath,
      path.dirname(canonicalAtlasPath),
      "canonical country atlas"
    ),
    readRegularFile(
      sourceManifestPath,
      path.dirname(sourceManifestPath),
      "current globe source manifest"
    ),
    readRegularFile(
      editionRegistryPath,
      path.dirname(editionRegistryPath),
      "runtime globe edition registry"
    ),
  ]);
  const report = JSON.parse(reportBytes.toString("utf8"));
  const finalReview = JSON.parse(finalReviewBytes.toString("utf8"));
  const config = JSON.parse(configBytes.toString("utf8"));
  const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));
  const editionRegistrySource = editionRegistryBytes.toString("utf8");
  const canonicalAtlasSha256 = sha256(canonicalAtlasBytes);

  assert(
    report.schemaVersion === 1 &&
      report.artifactKind === "historical-globe-runtime-textures" &&
      report.productionReady === true &&
      report.sourceConfigPath ===
        "scripts/globe-editions/historical-runtime-sources.json" &&
      report.sourceConfigSha256 === sha256(configBytes) &&
      report.builderPath === "scripts/build-historical-globe-textures.py" &&
      report.requirementsPath ===
        "scripts/globe-editions/historical-runtime-requirements.txt" &&
      report.requirementsSha256 === sha256(requirementsBytes) &&
      report.buildRuntime?.python === "3.12.13" &&
      report.buildRuntime?.numpy === "2.3.5" &&
      report.buildRuntime?.pillow === "12.3.0" &&
      report.buildRuntime?.webp === "1.6.0" &&
      report.buildRuntime?.littlecms2 === "2.19",
    "Historical runtime report identity or source chain is invalid."
  );
  assert(
    config.schemaVersion === 1 &&
      config.artifactKind === "historical-globe-runtime-production-sources" &&
      config.canonicalAtlas?.path === "src/data/geo/countries.geojson" &&
      config.canonicalAtlas.sha256 === canonicalAtlasSha256 &&
      config.canonicalAtlas.featureCount === 177,
    "Historical source config no longer matches the canonical atlas."
  );
  assert(
    Array.isArray(report.editions) &&
      Array.isArray(config.editions) &&
      report.editions.length === config.editions.length &&
      report.editions.map(({ id }) => id).join("|") ===
        config.editions.map(({ id }) => id).join("|"),
    "Historical report/config edition sets differ."
  );
  assert(
    sourceManifest.schemaVersion === 1 &&
      sourceManifest.artifactKind === "current-globe-edition-source-manifest" &&
      sourceManifest.editionCount === 9 &&
      sourceManifest.visitorVisibleEditionCount === 9 &&
      Array.isArray(sourceManifest.editions),
    "Current globe source manifest identity is invalid."
  );
  assert(
    finalReview.schemaVersion === 1 &&
      finalReview.artifactKind === "historical-runtime-final-review" &&
      finalReview.trackedRecord === true &&
      finalReview.status ===
        "runtime-assets-reviewed-artwork-alignment-not-passed" &&
      finalReview.evidence?.productionSidecarPath ===
        "reports/globe-editions/historical-runtime-textures.json" &&
      finalReview.evidence?.sourceConfigSha256 === sha256(configBytes) &&
      finalReview.sharedQa?.canonicalRegistrationGate?.pass === true &&
      finalReview.sharedQa?.canonicalRegistrationGate?.maximumResidualPixels === 0 &&
      finalReview.sharedQa?.historicalArtworkAlignmentGate?.pass === false &&
      finalReview.sharedQa?.historicalArtworkAlignmentGate
        ?.schererPilotAt1024?.productionEligible === false &&
      finalReview.gates?.exactProductionAssetIdentity === "pass" &&
      finalReview.gates?.canonicalRegistrationPlacement === "pass" &&
      finalReview.gates?.historicalArtworkToCanonicalAlignment ===
        "not-passed" &&
      finalReview.gates?.historicalGeographyAccuracyClaimed === false &&
      finalReview.gates?.runtimeAssetReview === "pass" &&
      finalReview.review?.scope?.join("|") ===
        config.editions.map(({ id }) => id).join("|") &&
      finalReview.editions?.map(({ id }) => id).join("|") ===
        config.editions.map(({ id }) => id).join("|"),
    "Historical final review identity or semantic gates are invalid."
  );

  for (const configuredEdition of config.editions) {
    const edition = report.editions.find(({ id }) => id === configuredEdition.id);
    assert(edition, `Missing reviewed historical edition ${configuredEdition.id}.`);
    assert(
      edition.rights?.status === configuredEdition.rights?.status &&
        edition.canonicalRegistration?.path === config.canonicalAtlas.path &&
        edition.canonicalRegistration.sha256 === canonicalAtlasSha256 &&
        edition.canonicalRegistration.canonicalUnionCoastlineRegistered === true &&
        edition.canonicalRegistration.internalBorders === false &&
        edition.qa?.canonicalRegistrationGate?.pass === true &&
        edition.qa.canonicalRegistrationGate.maximumResidualPixels === 0 &&
        edition.qa.desktopMobileNormalizedRegistrationDriftPixelsAtMobile === 0,
      `${configuredEdition.id} source, rights, or registration gate is invalid.`
    );
    assert(
      Array.isArray(edition.outputs) && edition.outputs.length === 2,
      `${configuredEdition.id} must provide desktop and mobile outputs.`
    );
    for (const expected of expectedOutputs(config, configuredEdition)) {
      const output = edition.outputs.find(({ kind }) => kind === expected.kind);
      assert(output, `${configuredEdition.id} is missing ${expected.kind}.`);
      await validateOutput(output, expected);
      const reviewedEdition = finalReview.editions.find(
        ({ id }) => id === configuredEdition.id
      );
      const reviewedOutput = reviewedEdition?.outputs?.find(
        ({ profile }) => profile === expected.kind
      );
      assert(
        reviewedEdition?.visualReview?.result ===
          "pass-with-declared-historical-differences" &&
          reviewedOutput?.path === output.path &&
          reviewedOutput?.width === output.width &&
          reviewedOutput?.height === output.height &&
          reviewedOutput?.bytes === output.bytes &&
          reviewedOutput?.sha256 === output.sha256,
        `${configuredEdition.id} ${expected.kind} final review is stale.`
      );
      const manifestEdition = sourceManifest.editions.find(
        ({ id }) => id === configuredEdition.id
      );
      const manifestOutput = manifestEdition?.outputs?.find(
        ({ profile }) => profile === expected.kind
      );
      assert(
        manifestOutput?.path === output.path &&
          manifestOutput?.width === output.width &&
          manifestOutput?.height === output.height &&
          manifestOutput?.bytes === output.bytes &&
          manifestOutput?.sha256 === output.sha256,
        `${configuredEdition.id} ${expected.kind} source manifest is stale.`
      );
    }
    const expectedVersion = textureContentVersion(edition.outputs);
    assert(
      editionRegistryBlock(editionRegistrySource, configuredEdition.id).includes(
        `textureContentVersion: "${expectedVersion}"`
      ),
      `${configuredEdition.id} runtime textureContentVersion is stale.`
    );
  }

  return {
    editionCount: report.editions.length,
    outputCount: report.editions.length * 2,
    reportSha256: sha256(reportBytes),
    finalReviewSha256: sha256(finalReviewBytes),
  };
}

const directExecution =
  process.argv[1] !== undefined &&
  (await realpath(path.resolve(process.argv[1]))) ===
    (await realpath(fileURLToPath(import.meta.url)));

if (directExecution) {
  const result = await checkHistoricalGlobeRuntime();
  console.log(
    `Verified ${result.editionCount} historical globe editions and ${result.outputCount} committed WebP files against the checksum-pinned report (${result.reportSha256}).`
  );
}
