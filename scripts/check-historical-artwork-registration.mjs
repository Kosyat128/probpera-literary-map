import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const acceptancePath = path.join(
  repositoryRoot,
  "scripts/globe-editions/historical-artwork-registration-acceptance.json"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
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

async function readJson(relativePath, label) {
  const resolved = repositoryPath(relativePath, label);
  const bytes = await readFile(resolved);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

function assertResidualImproves(candidate, baseline, label) {
  assert(
    candidate.medianResidualPixels < baseline.medianResidualPixels &&
      candidate.p95ResidualPixels < baseline.p95ResidualPixels &&
      candidate.maximumCappedResidualPixels <
        baseline.maximumCappedResidualPixels,
    `${label} does not improve all recorded residual summaries.`
  );
}

export async function checkHistoricalArtworkRegistration({
  requireProduction = false,
} = {}) {
  const acceptanceBytes = await readFile(acceptancePath);
  const acceptance = JSON.parse(acceptanceBytes.toString("utf8"));
  assert(
    acceptance.schemaVersion === 1 &&
      acceptance.artifactKind ===
        "historical-artwork-registration-acceptance" &&
      acceptance.productionEligible === false &&
      acceptance.overallStatus ===
        "blocked-no-historical-edition-passes-artwork-alignment-and-fidelity-together",
    "Historical artwork acceptance identity/readiness is invalid."
  );
  assert(
    acceptance.invariants?.historicalMasterRemainsImmutable === true &&
      acceptance.invariants?.canonicalGeoJsonCameraMarkersAndHitTestingRemainUnchanged ===
        true &&
      acceptance.invariants?.generativeOrInventedGeographyAllowed === false &&
      acceptance.invariants?.missingHistoricalGeographyMayBeSynthesized === false &&
      acceptance.invariants?.productionTextureMayChangeBeforeAllGatesPass ===
        false,
    "Historical fidelity invariants were weakened."
  );
  const gates = acceptance.acceptanceGates;
  assert(
    gates?.independentControlPoints?.minimumTotal >= 24 &&
      gates.independentControlPoints.minimumHoldout >= 8 &&
      gates.independentControlPoints.fitAndHoldoutMustBeDisjoint === true &&
      gates.holdoutLandmarkResidualPixelsAt2048x1024.medianMaximum === 1 &&
      gates.holdoutLandmarkResidualPixelsAt2048x1024.p95Maximum === 2 &&
      gates.historicalArtworkEdgeResidualPixelsAt2048x1024
        .requiresSourceSpecificReviewedLandMask === true &&
      gates.protectedHistoricalContent.foldoverAllowed === false &&
      gates.protectedHistoricalContent.independentVisualReviewRequired === true,
    "Historical artwork production gates are incomplete or weakened."
  );

  const [
    sourceConfig,
    canonicalAtlas,
    finalReview,
    pilotConfig,
    vectorPilotReport,
    vectorPilotScriptBytes,
  ] =
    await Promise.all([
      readJson(
        acceptance.evidence.historicalSourceConfigPath,
        "historical source config"
      ),
      readJson(acceptance.evidence.canonicalAtlasPath, "canonical atlas"),
      readJson(acceptance.evidence.productionReviewPath, "production review"),
      readJson(acceptance.evidence.pilotConfigPath, "pilot config"),
      readJson(
        acceptance.evidence.vectorPilotReportPath,
        "historical vector pilot report"
      ),
      readFile(
        repositoryPath(
          acceptance.evidence.vectorPilotScriptPath,
          "historical vector pilot script"
        )
      ),
    ]);
  assert(
    sha256(sourceConfig.bytes) ===
      acceptance.evidence.historicalSourceConfigSha256 &&
      sha256(canonicalAtlas.bytes) ===
        acceptance.evidence.canonicalAtlasSha256 &&
      sourceConfig.value.canonicalAtlas?.sha256 ===
        acceptance.evidence.canonicalAtlasSha256,
    "Acceptance evidence no longer pins the active source/canonical inputs."
  );
  assert(
    finalReview.value.status ===
      "runtime-assets-reviewed-artwork-alignment-not-passed" &&
      finalReview.value.gates?.historicalArtworkToCanonicalAlignment ===
        "not-passed" &&
      finalReview.value.gates?.historicalGeographyAccuracyClaimed === false,
    "Production review no longer records the artwork-alignment blocker."
  );
  assert(
    pilotConfig.value.editionId === "scherer-1700" &&
      pilotConfig.value.productionEligible === false &&
      pilotConfig.value.result?.historicalArtworkEdgeResidualPixels
        ?.thresholdResolution?.width === 1024 &&
      pilotConfig.value.result?.historicalArtworkEdgeResidualPixels
        ?.thresholdResolution?.height === 512 &&
      pilotConfig.value.result?.historicalArtworkEdgeResidualPixels
        ?.requiredForProduction?.medianMaximum === 0.5 &&
      pilotConfig.value.result?.historicalArtworkEdgeResidualPixels
        ?.requiredForProduction?.p95Maximum === 1 &&
      pilotConfig.value.result?.historicalArtworkEdgeResidualPixels
        ?.requiredForProduction?.maximumMaximum === 3 &&
      pilotConfig.value.result?.productionGate === "fail" &&
      pilotConfig.value.result?.productionDecision ===
        "Do not promote. Production 4K/2K textures remain unchanged.",
    "Scherer pilot result is missing or was incorrectly promoted."
  );
  assert(
    sha256(vectorPilotScriptBytes) ===
      acceptance.evidence.vectorPilotScriptSha256 &&
      sha256(vectorPilotReport.bytes) ===
        acceptance.evidence.vectorPilotReportSha256 &&
      vectorPilotReport.value.productionEligible === false &&
      vectorPilotReport.value.reviewState ===
        "rejected-offline-vector-pilot" &&
      vectorPilotReport.value.inputs?.pilotConfigSha256 ===
        sha256(pilotConfig.bytes) &&
      vectorPilotReport.value.inputs?.historicalProjectionConfigSha256 ===
        sha256(sourceConfig.bytes) &&
      vectorPilotReport.value.inputs?.canonicalAtlasSha256 ===
        sha256(canonicalAtlas.bytes),
    "The rejected historical-vector pilot is missing, stale, or unpinned."
  );

  const scherer = acceptance.schererPilotAt1024x512;
  assert(
    scherer.geographicCoverageVerified === false &&
      scherer.nonlinearV2.controlPointCount === 14 &&
      scherer.nonlinearV2.holdoutControlPointCount === 0 &&
      scherer.nonlinearV2.protectedFeatureReview === "not-performed" &&
      scherer.nonlinearV2.decision ===
        "rejected-visible-graticule-and-local-scale-deformation" &&
      scherer.rigidLongitudeCandidate.localShapeAndGraticuleDeformationPixels ===
        0 &&
      scherer.rigidLongitudeCandidate.sourcePixelRelationshipsChanged === false &&
      scherer.productionGate === "fail",
    "Scherer pilot limitations or rejection are no longer explicit."
  );
  assertResidualImproves(scherer.nonlinearV2, scherer.before, "Nonlinear v2");
  assertResidualImproves(
    scherer.rigidLongitudeCandidate,
    scherer.before,
    "Rigid longitude candidate"
  );
  assertResidualImproves(
    scherer.rigidLongitudeCandidate,
    scherer.nonlinearV2,
    "Rigid candidate versus nonlinear v2"
  );
  const gateScaleAt1024 = 1024 / 2048;
  assert(
    scherer.rigidLongitudeCandidate.medianResidualPixels >
        gates.historicalArtworkEdgeResidualPixelsAt2048x1024.medianMaximum *
          gateScaleAt1024 ||
      scherer.rigidLongitudeCandidate.p95ResidualPixels >
        gates.historicalArtworkEdgeResidualPixelsAt2048x1024.p95Maximum *
          gateScaleAt1024 ||
      scherer.rigidLongitudeCandidate.maximumCappedResidualPixels >
        gates.historicalArtworkEdgeResidualPixelsAt2048x1024.maximumMaximum *
          gateScaleAt1024,
    "The recorded Scherer blocker no longer follows from the metrics."
  );

  const vectorPilot = acceptance.schererVectorPilotAt1024x512;
  const vectorReport = vectorPilotReport.value;
  assert(
    vectorPilot.historicalRgbModified === false &&
      vectorPilot.runtimeHitTestingModified === false &&
      vectorPilot.holdoutControlPointCount === 0 &&
      vectorPilot.historicalFidelity === "pass-source-artwork-unchanged" &&
      vectorPilot.interactiveAlignment ===
        "fail-residual-coverage-and-hit-target-displacement" &&
      vectorPilot.productionGate === "fail" &&
      vectorReport.algorithm?.historicalRgbModified === false &&
      vectorReport.algorithm?.runtimeHitTestingModified === false &&
      vectorReport.edgeResidual?.inverseMappedHistoricalVector
        ?.maximumPixels >
        vectorReport.edgeResidual?.baselineUnwarpedCanonicalVector
          ?.maximumPixels &&
      vectorReport.edgeResidual?.inverseMappedCoverage
        ?.within1PixelsPercent < 95 &&
      vectorReport.canonicalHitTargetToDisplayedVectorDisplacement
        ?.p95Pixels > 1 &&
      vectorReport.acceptanceGate?.productionGate === "fail" &&
      vectorReport.decision?.warpedRuntimeFillAllowed === false &&
      vectorReport.decision?.warpedRuntimeOutlineAllowed === false,
    "The vector-only pilot rejection or historical-fidelity boundary was weakened."
  );

  const failSafe = acceptance.runtimeFailSafe;
  assert(
    failSafe.profileId === "source-only-centroid-selection-v2" &&
      failSafe.productionTextureModified === false &&
      failSafe.historicalRgbModified === false &&
      failSafe.canonicalHitTestingModified === false &&
      failSafe.permanentRuntimeCountryBorders === false &&
      failSafe.selectionRasterFill === false &&
      failSafe.selectionRasterOutline === false &&
      failSafe.selectionVectorOutline === false &&
      failSafe.selectionCentroidMarker === true &&
      failSafe.countryPanelRemainsAvailable === true &&
      failSafe.existingBakedReferenceCoastlineRemoved === false,
    "The source-only runtime selection fail-safe is incomplete or overstated."
  );

  const implementationSource = await readFile(
    repositoryPath(failSafe.implementationPath, "runtime fail-safe implementation"),
    "utf8"
  );
  const renderingSources = await Promise.all(
    failSafe.renderingPaths.map((relativePath, index) =>
      readFile(
        repositoryPath(relativePath, `runtime fail-safe rendering path ${index + 1}`),
        "utf8"
      )
    )
  );
  const semanticTestSource = await readFile(
    repositoryPath(failSafe.semanticTestPath, "runtime fail-safe semantic test"),
    "utf8"
  );
  assert(
    implementationSource.includes('profileId: "source-only-centroid-selection-v2"') &&
      renderingSources.every((source) => source.includes("overlayProfile")) &&
      semanticTestSource.includes("SOURCE_ONLY_CENTROID_OVERLAY_PROFILE"),
    "The recorded runtime fail-safe paths no longer implement or test the source-only profile."
  );

  const expectedIds = [
    "behaim-1492",
    "hondius-1615",
    "coronelli-1697",
    "scherer-1700",
    "cassini-1790",
  ];
  assert(
    acceptance.editions?.map(({ id }) => id).join("|") ===
      expectedIds.join("|") &&
      acceptance.editions.every(({ productionEligible }) =>
        productionEligible === false
      ),
    "Edition acceptance set or blocked production state changed."
  );
  assert(
    expectedIds.every(
      (id) => implementationSource.includes(`id: "${id}"`) && semanticTestSource.includes(`"${id}"`)
    ),
    "The source-only visitor edition set is not represented in both implementation and semantic test."
  );
  const behaim = acceptance.editions[0];
  assert(
    behaim.globalCanonicalArtworkWarpAllowed === false &&
      behaim.homologousGeography === "partial" &&
      behaim.knownNonHomologousOrAbsentGeography.length > 0,
    "Behaim's non-invention boundary is missing."
  );
  if (requireProduction) {
    throw new Error(
      "No historical edition passes artwork alignment and protected-fidelity gates."
    );
  }
  return {
    acceptanceSha256: sha256(acceptanceBytes),
    editionCount: acceptance.editions.length,
    productionEligibleCount: 0,
    schererBestSafeCandidate: "rigid-longitude-rotation",
    schererProductionGate: "fail",
  };
}

const directExecution =
  process.argv[1] !== undefined &&
  (await realpath(path.resolve(process.argv[1]))) ===
    (await realpath(fileURLToPath(import.meta.url)));

if (directExecution) {
  const result = await checkHistoricalArtworkRegistration({
    requireProduction: process.argv.includes("--require-production"),
  });
  console.log(
    `Verified blocked historical-artwork acceptance for ${result.editionCount} editions; Scherer best safe candidate remains ${result.schererProductionGate}. (${result.acceptanceSha256})`
  );
}
