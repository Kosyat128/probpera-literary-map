import { createHash, randomUUID } from "node:crypto";
import {
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
const editionId = "cassini-1790";
const polarFixPredecessorSidecarSha256 =
  "C5E2360C88CE8E067F8D95EDF16D24FC964DFE2084AA0EDE30625A9ECF95247B";
const reviewedPolarFixCandidateSidecarSha256 =
  "C36DA98F7A642F7308C407B0256A2261178631904DA40454F65608776F75C73C";
const reviewedPolarFixFinalReviewSha256 =
  "451828865CC0DAE3D14B195716484459EAB134D032A92ED1712E58F23DA76D00";
const encoder = Object.freeze({
  format: "webp",
  lossless: false,
  effort: 6,
  smartSubsample: true,
  resizeKernel: "lanczos3",
  baseline: "current-rand-mcnally-1887-runtime-profile",
});
const fixedPaths = Object.freeze({
  adaptedSidecar:
    "reports/globe-editions/cassini-1790-interactive-adapted-master.json",
  alignmentReview:
    "reports/globe-editions/cassini-1790-independent-alignment-review.json",
  finalReview: "reports/globe-editions/cassini-1790-runtime-final-review.json",
  mastersRoot: "scripts/.cache/globe-editions/cassini-1790/masters",
  stagedRuntimeRoot:
    "scripts/.cache/globe-editions/cassini-1790/runtime-polar-fix-candidate",
  stagedRuntimeSidecar:
    "reports/globe-editions/cassini-1790-runtime-polar-fix-candidate.json",
  outputRoot: "public/textures",
  runtimeSidecar:
    "reports/globe-editions/cassini-1790-runtime-textures.json",
});
const fixedProfiles = Object.freeze([
  Object.freeze({
    profile: "desktop",
    width: 4096,
    height: 2048,
    quality: 92,
    path: "public/textures/cassini-globo-terrestre-1790.webp",
  }),
  Object.freeze({
    profile: "mobile",
    width: 2048,
    height: 1024,
    quality: 86,
    path: "public/textures/cassini-globo-terrestre-1790-mobile.webp",
  }),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9A-F]{64}$/u.test(value);
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

function relativeRepositoryPath(filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

function validIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

async function existingAncestor(candidate) {
  let current = candidate;
  while (true) {
    try {
      return await realpath(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function readContained(filePath, allowedRoot, label) {
  assert(isInside(allowedRoot, filePath), `${label} escaped its allowed root.`);
  const [stat, canonicalRoot, canonicalFile] = await Promise.all([
    lstat(filePath),
    realpath(allowedRoot),
    realpath(filePath),
  ]);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file.`);
  assert(isInside(canonicalRoot, canonicalFile), `${label} resolves outside its root.`);
  return readFile(filePath);
}

async function assertSafeTarget(filePath, allowedRoot, label) {
  assert(
    filePath !== allowedRoot && isInside(allowedRoot, filePath),
    `${label} escaped its output root.`
  );
  const [canonicalRepository, canonicalAncestor] = await Promise.all([
    realpath(repositoryRoot),
    existingAncestor(allowedRoot),
  ]);
  assert(
    isInside(canonicalRepository, canonicalAncestor),
    `${label} output root escaped the repository.`
  );
  await mkdir(allowedRoot, { recursive: true });
  const canonicalRoot = await realpath(allowedRoot);
  assert(
    isInside(canonicalRepository, canonicalRoot),
    `${label} output root escaped the repository.`
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  const canonicalParent = await realpath(path.dirname(filePath));
  assert(isInside(canonicalRoot, canonicalParent), `${label} parent escaped.`);
  try {
    const stat = await lstat(filePath);
    assert(
      stat.isFile() && !stat.isSymbolicLink(),
      `${label} target must be a regular file.`
    );
    assert(
      isInside(canonicalRoot, await realpath(filePath)),
      `${label} target resolves outside its root.`
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function removeIfPresent(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function atomicWriteSet(entries) {
  assert(entries.length > 0, "Atomic write set must not be empty.");
  assert(
    new Set(entries.map(({ targetPath }) => targetPath.toLowerCase())).size ===
      entries.length,
    "Atomic write targets must be unique."
  );
  await Promise.all(
    entries.map(({ targetPath, allowedRoot, label }) =>
      assertSafeTarget(targetPath, allowedRoot, label)
    )
  );

  const token = `${process.pid}-${randomUUID()}`;
  const staged = [];
  const backups = [];
  const committed = [];
  try {
    for (const entry of entries) {
      const stagePath = path.join(
        path.dirname(entry.targetPath),
        `.${path.basename(entry.targetPath)}.${token}.tmp`
      );
      await writeFile(stagePath, entry.bytes, { flag: "wx" });
      staged.push({ ...entry, stagePath });
    }

    for (const entry of entries) {
      try {
        await lstat(entry.targetPath);
        const backupPath = path.join(
          path.dirname(entry.targetPath),
          `.${path.basename(entry.targetPath)}.${token}.backup`
        );
        await rename(entry.targetPath, backupPath);
        backups.push({ targetPath: entry.targetPath, backupPath });
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }

    for (const entry of staged) {
      await rename(entry.stagePath, entry.targetPath);
      committed.push(entry.targetPath);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const targetPath of committed.toReversed()) {
      try {
        await removeIfPresent(targetPath);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const { targetPath, backupPath } of backups.toReversed()) {
      try {
        await rename(backupPath, targetPath);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const { stagePath } of staged) {
      try {
        await removeIfPresent(stagePath);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Atomic runtime export failed and rollback was incomplete."
      );
    }
    throw error;
  }

  await Promise.all(
    backups.map(({ backupPath }) => removeIfPresent(backupPath))
  );
}

function validateReviewMetadata(record, label) {
  assert(record.status === "reviewed", `${label} status must be reviewed.`);
  assert(record.trackedRecord === true, `${label} must be a tracked record.`);
  assert(
    record.review?.independent === true &&
      typeof record.review.reviewedBy === "string" &&
      record.review.reviewedBy.trim().length > 0 &&
      validIsoDate(record.review.reviewedAt),
    `${label} independent reviewer metadata is invalid.`
  );
}

export function validateAdaptedSidecar(sidecar) {
  assert(
    sidecar?.schemaVersion === 1 &&
      sidecar.editionId === editionId &&
      sidecar.stage === "interactive-adapted-master" &&
      sidecar.artifactKind === "interactive-adapted-master" &&
      sidecar.trackedSidecar === true,
    "Adapted Master sidecar identity is invalid."
  );
  assert(
    typeof sidecar.productionReady === "boolean" &&
      sidecar.gates?.historicalMaster === "verified" &&
      sidecar.gates?.historicalSeamPaperRuns === "pass" &&
      sidecar.gates?.canonicalAtlasChecksum === "verified" &&
      sidecar.gates?.unionLandMask === "generated" &&
      sidecar.gates?.identityTransform === "applied" &&
      sidecar.gates?.productionReady === sidecar.productionReady,
    "Adapted Master prerequisite gates are invalid."
  );
  assert(
    sidecar.algorithm?.deterministic === true &&
      sidecar.algorithm.networkAccessUsed === false &&
      sidecar.algorithm.nonlinearWarpApplied === false &&
      sidecar.algorithm.randomTextureUsed === false &&
      sidecar.algorithm.genericModernMapFillUsed === false &&
      sidecar.algorithm.labelsOrInventedDetailsAdded === false,
    "Adapted Master algorithm provenance is invalid."
  );
  const output = sidecar.output;
  assert(
    typeof output?.path === "string" &&
      Number.isInteger(output.width) &&
      Number.isInteger(output.height) &&
      output.width > 0 &&
      output.height > 0 &&
      output.width === output.height * 2 &&
      output.format === "png" &&
      Number.isInteger(output.bytes) &&
      output.bytes > 0 &&
      isSha256(output.sha256) &&
      output.lossless === true &&
      output.colorSpace === "srgb" &&
      output.depth === "uchar" &&
      output.bitsPerChannel === 8 &&
      output.channels === 3 &&
      output.hasAlpha === false &&
      output.hasIccProfile === false,
    "Adapted Master output contract is invalid."
  );
  return sidecar;
}

export function validateAlignmentReview(record, context) {
  assert(
    record?.schemaVersion === 1 &&
      record.editionId === editionId &&
      record.artifactKind === "independent-adapted-master-alignment-review",
    "Independent alignment review identity is invalid."
  );
  validateReviewMetadata(record, "Independent alignment review");
  assert(
    record.gates?.independentAlignmentReview === "pass",
    "Independent alignment review gate has not passed."
  );
  assert(
    record.adaptedMaster?.sidecar?.path === context.sidecarPath &&
      record.adaptedMaster.sidecar.bytes === context.sidecarBytes &&
      record.adaptedMaster.sidecar.sha256 === context.sidecarSha256 &&
      record.adaptedMaster.output?.path === context.outputPath &&
      record.adaptedMaster.output.bytes === context.outputBytes &&
      record.adaptedMaster.output.sha256 === context.outputSha256 &&
      record.adaptedMaster.output.width === context.outputWidth &&
      record.adaptedMaster.output.height === context.outputHeight,
    "Independent alignment review does not pin the exact Adapted Master."
  );
  return record;
}

export function validateFinalReview(record, context) {
  assert(
    record?.schemaVersion === 1 &&
      record.editionId === editionId &&
      record.artifactKind === "cassini-runtime-final-review",
    "Runtime final review identity is invalid."
  );
  validateReviewMetadata(record, "Runtime final review");
  assert(
    record.gates?.independentAlignmentReview === "pass" &&
      record.gates?.fourKAndTwoKVisualReview === "pass" &&
      record.gates?.runtimeReview === "pass",
    "Runtime final review gates have not all passed."
  );
  assert(
    record.candidateRuntimeSidecar?.path === context.sidecarPath &&
      record.candidateRuntimeSidecar.bytes === context.sidecarBytes &&
      record.candidateRuntimeSidecar.sha256 === context.sidecarSha256,
    "Runtime final review does not pin the exact candidate sidecar."
  );
  assert(
    Array.isArray(record.outputs) &&
      record.outputs.length === context.outputs.length,
    "Runtime final review output set is incomplete."
  );
  for (const expected of context.outputs) {
    const reviewed = record.outputs.find(
      ({ profile }) => profile === expected.profile
    );
    assert(
      reviewed?.path === expected.path &&
        reviewed.bytes === expected.bytes &&
        reviewed.sha256 === expected.sha256 &&
        reviewed.width === expected.width &&
        reviewed.height === expected.height,
      `Runtime final review does not pin the exact ${expected.profile} output.`
    );
  }
  return record;
}

function productionContract() {
  const reportsRoot = repositoryPath("reports/globe-editions", "reports root");
  const outputRoot = repositoryPath(fixedPaths.outputRoot, "runtime output root");
  return {
    adaptedSidecarPath: repositoryPath(
      fixedPaths.adaptedSidecar,
      "Adapted Master sidecar"
    ),
    alignmentReviewPath: repositoryPath(
      fixedPaths.alignmentReview,
      "independent alignment review"
    ),
    finalReviewPath: repositoryPath(fixedPaths.finalReview, "runtime final review"),
    reportsRoot,
    mastersRoot: repositoryPath(fixedPaths.mastersRoot, "Adapted Master root"),
    stagedRuntimeRoot: repositoryPath(
      fixedPaths.stagedRuntimeRoot,
      "staged runtime root"
    ),
    stagedRuntimeSidecarPath: repositoryPath(
      fixedPaths.stagedRuntimeSidecar,
      "staged runtime sidecar"
    ),
    outputRoot,
    runtimeSidecarPath: repositoryPath(
      fixedPaths.runtimeSidecar,
      "runtime sidecar"
    ),
    profiles: fixedProfiles.map((profile) => ({
      ...profile,
      outputPath: repositoryPath(profile.path, `${profile.profile} output`),
    })),
  };
}

async function loadAdaptedMaster(contract) {
  const sidecarBytes = await readContained(
    contract.adaptedSidecarPath,
    contract.reportsRoot,
    "Adapted Master sidecar"
  );
  const sidecar = validateAdaptedSidecar(
    JSON.parse(sidecarBytes.toString("utf8"))
  );
  const outputPath = repositoryPath(
    sidecar.output.path,
    "Adapted Master output.path"
  );
  assert(
    isInside(contract.mastersRoot, outputPath) &&
      path.basename(outputPath) ===
        `${editionId}-interactive-adapted-master-${sidecar.output.width}x${sidecar.output.height}.png`,
    "Adapted Master output is not the fixed ignored-cache artifact."
  );
  const outputBytes = await readContained(
    outputPath,
    contract.mastersRoot,
    "Adapted Master"
  );
  const metadata = await sharp(outputBytes, { failOn: "warning" }).metadata();
  const hasIccProfile =
    metadata.hasProfile === true || metadata.icc !== undefined;
  assert(
    outputBytes.length === sidecar.output.bytes &&
      sha256(outputBytes) === sidecar.output.sha256 &&
      metadata.format === "png" &&
      metadata.width === sidecar.output.width &&
      metadata.height === sidecar.output.height &&
      metadata.space === "srgb" &&
      metadata.depth === "uchar" &&
      metadata.channels === 3 &&
      metadata.hasAlpha !== true &&
      !hasIccProfile,
    "Adapted Master bytes/metadata do not match its sidecar."
  );
  return {
    sidecar,
    sidecarBytes,
    sidecarPath: contract.adaptedSidecarPath,
    outputBytes,
    outputPath,
    width: metadata.width,
    height: metadata.height,
  };
}

async function loadAlignmentReview(contract, adapted) {
  const reviewBytes = await readContained(
    contract.alignmentReviewPath,
    contract.reportsRoot,
    "Independent alignment review"
  );
  const review = validateAlignmentReview(
    JSON.parse(reviewBytes.toString("utf8")),
    {
      sidecarPath: relativeRepositoryPath(adapted.sidecarPath),
      sidecarBytes: adapted.sidecarBytes.length,
      sidecarSha256: sha256(adapted.sidecarBytes),
      outputPath: relativeRepositoryPath(adapted.outputPath),
      outputBytes: adapted.outputBytes.length,
      outputSha256: sha256(adapted.outputBytes),
      outputWidth: adapted.width,
      outputHeight: adapted.height,
    }
  );
  return { review, reviewBytes };
}

async function buildRuntimeProfile(adapted, profile) {
  assert(
    Number.isInteger(profile.width) &&
      Number.isInteger(profile.height) &&
      profile.width > 0 &&
      profile.height > 0 &&
      profile.width === profile.height * 2,
    `${profile.profile} runtime dimensions are invalid.`
  );
  const quality = profile.quality ?? (profile.profile === "desktop" ? 92 : 86);
  assert(
    Number.isInteger(quality) && quality >= 1 && quality <= 100,
    `${profile.profile} runtime quality is invalid.`
  );
  assert(
    profile.width <= adapted.width && profile.height <= adapted.height,
    `${profile.profile} runtime export would upscale the Adapted Master.`
  );
  const bytes = await sharp(adapted.outputBytes, {
    failOn: "warning",
    limitInputPixels: false,
  })
    .resize(profile.width, profile.height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    })
    .webp({
      lossless: encoder.lossless,
      quality,
      effort: encoder.effort,
      smartSubsample: encoder.smartSubsample,
    })
    .toBuffer();
  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  const hasIccProfile =
    metadata.hasProfile === true || metadata.icc !== undefined;
  assert(
    metadata.format === "webp" &&
      metadata.width === profile.width &&
      metadata.height === profile.height &&
      metadata.space === "srgb" &&
      metadata.depth === "uchar" &&
      metadata.channels === 3 &&
      metadata.hasAlpha !== true &&
      !hasIccProfile,
    `${profile.profile} runtime WebP metadata is invalid.`
  );
  return {
    profile: profile.profile,
    path: relativeRepositoryPath(profile.outputPath),
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    bytes: bytes.length,
    sha256: sha256(bytes),
    lossless: encoder.lossless,
    quality,
    effort: encoder.effort,
    resizeKernel: encoder.resizeKernel,
    upscaled: false,
    colorSpace: metadata.space,
    depth: metadata.depth,
    bitsPerChannel: 8,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha === true,
    hasIccProfile,
    encodedBytes: bytes,
  };
}

function publicOutputRecord(output) {
  const { encodedBytes: _encodedBytes, ...record } = output;
  return record;
}

async function readExistingRuntimeSidecar(contract) {
  try {
    return await readContained(
      contract.runtimeSidecarPath,
      contract.reportsRoot,
      "Cassini runtime sidecar"
    );
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function exportCassiniRuntimeTextures(contract) {
  const existingSidecarBytes = await readExistingRuntimeSidecar(contract);
  if (existingSidecarBytes) {
    const existing = JSON.parse(existingSidecarBytes.toString("utf8"));
    assert(
      existing.productionReady !== true,
      "Refusing to replace an already promoted Cassini runtime export."
    );
  }

  const adapted = await loadAdaptedMaster(contract);
  const alignment = await loadAlignmentReview(contract, adapted);
  const outputs = [];
  for (const profile of contract.profiles) {
    outputs.push(await buildRuntimeProfile(adapted, profile));
  }

  const manifest = {
    schemaVersion: 1,
    editionId,
    stage: "runtime-texture-candidate",
    artifactKind: "cassini-runtime-texture-export",
    trackedSidecar: true,
    productionReady: false,
    reviewState: "candidate-awaiting-4k-2k-and-runtime-review",
    deterministic: true,
    source: {
      adaptedMasterSidecar: {
        path: relativeRepositoryPath(adapted.sidecarPath),
        bytes: adapted.sidecarBytes.length,
        sha256: sha256(adapted.sidecarBytes),
      },
      adaptedMaster: {
        path: relativeRepositoryPath(adapted.outputPath),
        bytes: adapted.outputBytes.length,
        sha256: sha256(adapted.outputBytes),
        width: adapted.width,
        height: adapted.height,
      },
      modifiedInPlace: false,
    },
    alignmentReviewRecord: {
      path: relativeRepositoryPath(contract.alignmentReviewPath),
      bytes: alignment.reviewBytes.length,
      sha256: sha256(alignment.reviewBytes),
      status: alignment.review.status,
      reviewedBy: alignment.review.review.reviewedBy,
      reviewedAt: alignment.review.review.reviewedAt,
    },
    encoding: encoder,
    outputs: outputs.map(publicOutputRecord),
    gates: {
      adaptedMasterChecksum: "verified",
      independentAlignmentReview: "pass",
      fourKAndTwoKVisualReview: "pending",
      runtimeReview: "pending",
      productionReady: false,
    },
    runtime: {
      node: process.versions.node,
      sharp: sharp.versions.sharp,
      vips: sharp.versions.vips,
    },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await atomicWriteSet(
    [
      ...outputs.map((output, index) => ({
        targetPath: contract.profiles[index].outputPath,
        allowedRoot: contract.outputRoot,
        bytes: output.encodedBytes,
        label: `${output.profile} Cassini runtime texture`,
      })),
      {
        targetPath: contract.runtimeSidecarPath,
        allowedRoot: contract.reportsRoot,
        bytes: manifestBytes,
        label: "Cassini runtime sidecar",
      },
    ]
  );
  return manifest;
}

export async function stageCassiniPolarFix(contract) {
  const predecessorBytes = await readContained(
    contract.runtimeSidecarPath,
    contract.reportsRoot,
    "promoted Cassini runtime predecessor"
  );
  assert(
    sha256(predecessorBytes) === polarFixPredecessorSidecarSha256,
    "Polar-fix staging only accepts the exact audited promoted predecessor."
  );
  const predecessor = validatePromotedSidecar(
    JSON.parse(predecessorBytes.toString("utf8")),
    contract
  );
  for (const output of predecessor.outputs) {
    await validateRuntimeOutput(contract, output);
  }

  const adapted = await loadAdaptedMaster(contract);
  const alignment = await loadAlignmentReview(contract, adapted);
  assert(
    sha256(adapted.outputBytes) !== predecessor.source.adaptedMaster.sha256,
    "Polar-fix staging requires a new Adapted Master."
  );
  const outputs = [];
  for (const profile of contract.profiles) {
    outputs.push(await buildRuntimeProfile(adapted, profile));
  }
  const stagedOutputs = outputs.map((output, index) => {
    const stagedPath = path.join(
      contract.stagedRuntimeRoot,
      path.basename(contract.profiles[index].outputPath)
    );
    return {
      ...publicOutputRecord(output),
      path: relativeRepositoryPath(stagedPath),
      intendedProductionPath: output.path,
      stagedPath,
      encodedBytes: output.encodedBytes,
    };
  });
  const manifest = {
    schemaVersion: 1,
    editionId,
    stage: "runtime-texture-staged-candidate",
    artifactKind: "cassini-runtime-polar-fix-staged-export",
    trackedSidecar: true,
    productionReady: false,
    reviewState: "staged-awaiting-exact-4k-2k-review",
    deterministic: true,
    supersedes: {
      path: relativeRepositoryPath(contract.runtimeSidecarPath),
      bytes: predecessorBytes.length,
      sha256: sha256(predecessorBytes),
      productionReady: true,
      outputs: predecessor.outputs.map(
        ({ profile, path: outputPath, bytes, sha256: outputSha256 }) => ({
          profile,
          path: outputPath,
          bytes,
          sha256: outputSha256,
        })
      ),
      reason:
        "replace-synthetic-polar-artifacts-with-source-derived-longitude-neutral-treatment",
    },
    source: {
      adaptedMasterSidecar: {
        path: relativeRepositoryPath(adapted.sidecarPath),
        bytes: adapted.sidecarBytes.length,
        sha256: sha256(adapted.sidecarBytes),
      },
      adaptedMaster: {
        path: relativeRepositoryPath(adapted.outputPath),
        bytes: adapted.outputBytes.length,
        sha256: sha256(adapted.outputBytes),
        width: adapted.width,
        height: adapted.height,
      },
      modifiedInPlace: false,
    },
    alignmentReviewRecord: {
      path: relativeRepositoryPath(contract.alignmentReviewPath),
      bytes: alignment.reviewBytes.length,
      sha256: sha256(alignment.reviewBytes),
      status: alignment.review.status,
      reviewedBy: alignment.review.review.reviewedBy,
      reviewedAt: alignment.review.review.reviewedAt,
    },
    encoding: encoder,
    outputs: stagedOutputs.map(
      ({ stagedPath: _stagedPath, encodedBytes: _encodedBytes, ...record }) =>
        record
    ),
    gates: {
      predecessorChecksum: "verified",
      adaptedMasterChecksum: "verified",
      independentAlignmentReview: "pass",
      fourKAndTwoKVisualReview: "pending",
      runtimeReview: "pending",
      productionReady: false,
    },
    runtime: {
      node: process.versions.node,
      sharp: sharp.versions.sharp,
      vips: sharp.versions.vips,
    },
  };
  const manifestBytes = Buffer.from(
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await atomicWriteSet([
    ...stagedOutputs.map((output) => ({
      targetPath: output.stagedPath,
      allowedRoot: contract.stagedRuntimeRoot,
      bytes: output.encodedBytes,
      label: `${output.profile} staged Cassini polar-fix texture`,
    })),
    {
      targetPath: contract.stagedRuntimeSidecarPath,
      allowedRoot: contract.reportsRoot,
      bytes: manifestBytes,
      label: "Cassini polar-fix staged runtime sidecar",
    },
  ]);
  return manifest;
}

async function validateRuntimeOutput(contract, expected) {
  const profile = contract.profiles.find(
    ({ profile: candidate }) => candidate === expected.profile
  );
  assert(profile, `Unknown runtime profile: ${expected.profile}.`);
  assert(
    expected.path === relativeRepositoryPath(profile.outputPath) &&
      expected.width === profile.width &&
      expected.height === profile.height &&
      expected.format === encoder.format &&
      Number.isInteger(expected.bytes) &&
      expected.bytes > 0 &&
      isSha256(expected.sha256) &&
      expected.lossless === encoder.lossless &&
      expected.quality === (profile.quality ?? (profile.profile === "desktop" ? 92 : 86)) &&
      expected.effort === encoder.effort &&
      expected.resizeKernel === encoder.resizeKernel &&
      expected.upscaled === false &&
      expected.colorSpace === "srgb" &&
      expected.depth === "uchar" &&
      expected.bitsPerChannel === 8 &&
      expected.channels === 3 &&
      expected.hasAlpha === false &&
      expected.hasIccProfile === false,
    `${expected.profile} runtime sidecar output contract is invalid.`
  );
  const bytes = await readContained(
    profile.outputPath,
    contract.outputRoot,
    `${expected.profile} Cassini runtime texture`
  );
  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  assert(
    bytes.length === expected.bytes &&
      sha256(bytes) === expected.sha256 &&
      metadata.format === "webp" &&
      metadata.width === expected.width &&
      metadata.height === expected.height &&
      metadata.space === "srgb" &&
      metadata.depth === "uchar" &&
      metadata.channels === 3 &&
      metadata.hasAlpha !== true &&
      metadata.hasProfile !== true &&
      metadata.icc === undefined,
    `${expected.profile} runtime texture no longer matches its sidecar.`
  );
  return { ...expected, encodedBytes: bytes };
}

async function validateStagedPolarFixOutput(contract, expected) {
  const profile = contract.profiles.find(
    ({ profile: candidate }) => candidate === expected.profile
  );
  assert(profile, `Unknown staged runtime profile: ${expected.profile}.`);
  const stagedPath = path.join(
    contract.stagedRuntimeRoot,
    path.basename(profile.outputPath)
  );
  assert(
    expected.path === relativeRepositoryPath(stagedPath) &&
      expected.intendedProductionPath ===
        relativeRepositoryPath(profile.outputPath) &&
      expected.width === profile.width &&
      expected.height === profile.height &&
      expected.format === encoder.format &&
      Number.isInteger(expected.bytes) &&
      expected.bytes > 0 &&
      isSha256(expected.sha256) &&
      expected.lossless === encoder.lossless &&
      expected.quality ===
        (profile.quality ?? (profile.profile === "desktop" ? 92 : 86)) &&
      expected.effort === encoder.effort &&
      expected.resizeKernel === encoder.resizeKernel &&
      expected.upscaled === false &&
      expected.colorSpace === "srgb" &&
      expected.depth === "uchar" &&
      expected.bitsPerChannel === 8 &&
      expected.channels === 3 &&
      expected.hasAlpha === false &&
      expected.hasIccProfile === false,
    `${expected.profile} staged runtime output contract is invalid.`
  );
  const bytes = await readContained(
    stagedPath,
    contract.stagedRuntimeRoot,
    `${expected.profile} staged Cassini polar-fix texture`
  );
  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  assert(
    bytes.length === expected.bytes &&
      sha256(bytes) === expected.sha256 &&
      metadata.format === "webp" &&
      metadata.width === expected.width &&
      metadata.height === expected.height &&
      metadata.space === "srgb" &&
      metadata.depth === "uchar" &&
      metadata.channels === 3 &&
      metadata.hasAlpha !== true &&
      metadata.hasProfile !== true &&
      metadata.icc === undefined,
    `${expected.profile} staged runtime texture no longer matches its sidecar.`
  );
  const { intendedProductionPath, ...stagedRecord } = expected;
  return {
    ...stagedRecord,
    path: intendedProductionPath,
    encodedBytes: bytes,
  };
}

export function validateStagedPolarFixSidecar(sidecar, contract) {
  assert(
    sidecar?.schemaVersion === 1 &&
      sidecar.editionId === editionId &&
      sidecar.stage === "runtime-texture-staged-candidate" &&
      sidecar.artifactKind === "cassini-runtime-polar-fix-staged-export" &&
      sidecar.trackedSidecar === true &&
      sidecar.productionReady === false &&
      sidecar.reviewState === "staged-awaiting-exact-4k-2k-review" &&
      sidecar.deterministic === true &&
      sidecar.gates?.predecessorChecksum === "verified" &&
      sidecar.gates?.adaptedMasterChecksum === "verified" &&
      sidecar.gates?.independentAlignmentReview === "pass" &&
      sidecar.gates?.fourKAndTwoKVisualReview === "pending" &&
      sidecar.gates?.runtimeReview === "pending" &&
      sidecar.gates?.productionReady === false,
    "Cassini staged polar-fix sidecar gates are invalid."
  );
  assert(
    sidecar.supersedes?.path ===
        relativeRepositoryPath(contract.runtimeSidecarPath) &&
      sidecar.supersedes.bytes > 0 &&
      sidecar.supersedes.sha256 === polarFixPredecessorSidecarSha256 &&
      sidecar.supersedes.productionReady === true &&
      Array.isArray(sidecar.supersedes.outputs) &&
      sidecar.supersedes.outputs.length === contract.profiles.length,
    "Cassini staged polar-fix predecessor reference is invalid."
  );
  assert(
    Array.isArray(sidecar.outputs) &&
      sidecar.outputs.length === contract.profiles.length &&
      sidecar.encoding?.format === encoder.format &&
      sidecar.encoding.lossless === encoder.lossless &&
      sidecar.encoding.effort === encoder.effort &&
      sidecar.encoding.smartSubsample === encoder.smartSubsample &&
      sidecar.encoding.resizeKernel === encoder.resizeKernel &&
      sidecar.encoding.baseline === encoder.baseline,
    "Cassini staged polar-fix encoding/output set is invalid."
  );
  return sidecar;
}

function validateCandidateSidecar(sidecar, contract) {
  assert(
    sidecar?.schemaVersion === 1 &&
      sidecar.editionId === editionId &&
      sidecar.stage === "runtime-texture-candidate" &&
      sidecar.artifactKind === "cassini-runtime-texture-export" &&
      sidecar.trackedSidecar === true &&
      sidecar.productionReady === false &&
      sidecar.gates?.independentAlignmentReview === "pass" &&
      sidecar.gates?.fourKAndTwoKVisualReview === "pending" &&
      sidecar.gates?.runtimeReview === "pending" &&
      sidecar.gates?.productionReady === false,
    "Cassini runtime candidate sidecar gates are invalid."
  );
  assert(
    Array.isArray(sidecar.outputs) &&
      sidecar.outputs.length === contract.profiles.length &&
      sidecar.encoding?.format === encoder.format &&
      sidecar.encoding.lossless === encoder.lossless &&
      sidecar.encoding.effort === encoder.effort &&
      sidecar.encoding.smartSubsample === encoder.smartSubsample &&
      sidecar.encoding.baseline === encoder.baseline,
    "Cassini runtime candidate encoding/output set is invalid."
  );
  return sidecar;
}

export function validatePromotedSidecar(sidecar, contract) {
  assert(
    sidecar?.schemaVersion === 1 &&
      sidecar.editionId === editionId &&
      sidecar.stage === "runtime-texture-production" &&
      sidecar.artifactKind === "cassini-runtime-texture-export" &&
      sidecar.trackedSidecar === true &&
      sidecar.productionReady === true &&
      sidecar.reviewState === "reviewed-and-promoted" &&
      sidecar.deterministic === true,
    "Cassini promoted runtime sidecar identity is invalid."
  );
  assert(
    sidecar.gates?.adaptedMasterChecksum === "verified" &&
      sidecar.gates?.independentAlignmentReview === "pass" &&
      sidecar.gates?.fourKAndTwoKVisualReview === "pass" &&
      sidecar.gates?.runtimeReview === "pass" &&
      sidecar.gates?.productionReady === true,
    "Cassini promoted runtime gates have not all passed."
  );
  assert(
    sidecar.encoding?.format === encoder.format &&
      sidecar.encoding.lossless === encoder.lossless &&
      sidecar.encoding.effort === encoder.effort &&
      sidecar.encoding.smartSubsample === encoder.smartSubsample &&
      sidecar.encoding.resizeKernel === encoder.resizeKernel &&
      sidecar.encoding.baseline === encoder.baseline,
    "Cassini promoted runtime encoding contract is invalid."
  );
  assert(
    Array.isArray(sidecar.outputs) &&
      sidecar.outputs.length === contract.profiles.length &&
      new Set(sidecar.outputs.map(({ profile }) => profile)).size ===
        contract.profiles.length &&
      contract.profiles.every(({ profile }) =>
        sidecar.outputs.some((output) => output.profile === profile)
      ),
    "Cassini promoted runtime output set is incomplete or duplicated."
  );

  const adaptedSidecar = sidecar.source?.adaptedMasterSidecar;
  const adaptedMaster = sidecar.source?.adaptedMaster;
  assert(
    adaptedSidecar?.path ===
      relativeRepositoryPath(contract.adaptedSidecarPath) &&
      Number.isInteger(adaptedSidecar.bytes) &&
      adaptedSidecar.bytes > 0 &&
      isSha256(adaptedSidecar.sha256) &&
      typeof adaptedMaster?.path === "string" &&
      Number.isInteger(adaptedMaster.bytes) &&
      adaptedMaster.bytes > 0 &&
      isSha256(adaptedMaster.sha256) &&
      Number.isInteger(adaptedMaster.width) &&
      Number.isInteger(adaptedMaster.height) &&
      adaptedMaster.width === adaptedMaster.height * 2 &&
      sidecar.source.modifiedInPlace === false,
    "Cassini promoted Adapted Master references are invalid."
  );
  const adaptedMasterPath = repositoryPath(
    adaptedMaster.path,
    "promoted Adapted Master path"
  );
  assert(
    isInside(contract.mastersRoot, adaptedMasterPath) &&
      path.basename(adaptedMasterPath) ===
        `${editionId}-interactive-adapted-master-${adaptedMaster.width}x${adaptedMaster.height}.png`,
    "Cassini promoted Adapted Master path is not the fixed cache artifact."
  );

  assert(
    sidecar.alignmentReviewRecord?.path ===
      relativeRepositoryPath(contract.alignmentReviewPath) &&
      Number.isInteger(sidecar.alignmentReviewRecord.bytes) &&
      sidecar.alignmentReviewRecord.bytes > 0 &&
      isSha256(sidecar.alignmentReviewRecord.sha256) &&
      sidecar.alignmentReviewRecord.status === "reviewed" &&
      typeof sidecar.alignmentReviewRecord.reviewedBy === "string" &&
      sidecar.alignmentReviewRecord.reviewedBy.trim().length > 0 &&
      validIsoDate(sidecar.alignmentReviewRecord.reviewedAt),
    "Cassini promoted alignment-review reference is invalid."
  );
  assert(
    isSha256(sidecar.prePromotionSidecarSha256) &&
      (sidecar.prePromotionSidecarPath === undefined ||
        (sidecar.prePromotionSidecarPath ===
          relativeRepositoryPath(contract.stagedRuntimeSidecarPath) &&
          Number.isInteger(sidecar.prePromotionSidecarBytes) &&
          sidecar.prePromotionSidecarBytes > 0)) &&
      sidecar.finalReviewRecord?.path ===
        relativeRepositoryPath(contract.finalReviewPath) &&
      Number.isInteger(sidecar.finalReviewRecord.bytes) &&
      sidecar.finalReviewRecord.bytes > 0 &&
      isSha256(sidecar.finalReviewRecord.sha256) &&
      sidecar.finalReviewRecord.status === "reviewed" &&
      typeof sidecar.finalReviewRecord.reviewedBy === "string" &&
      sidecar.finalReviewRecord.reviewedBy.trim().length > 0 &&
      validIsoDate(sidecar.finalReviewRecord.reviewedAt),
    "Cassini promoted final-review reference is invalid."
  );
  return sidecar;
}

async function validatePromotedAlignmentChain(contract, promoted) {
  const adaptedSidecarBytes = await readContained(
    contract.adaptedSidecarPath,
    contract.reportsRoot,
    "Adapted Master sidecar for runtime check"
  );
  const adaptedSidecarReference = promoted.source.adaptedMasterSidecar;
  assert(
    adaptedSidecarBytes.length === adaptedSidecarReference.bytes &&
      sha256(adaptedSidecarBytes) === adaptedSidecarReference.sha256,
    "Adapted Master sidecar no longer matches the promoted runtime chain."
  );
  const adaptedSidecar = validateAdaptedSidecar(
    JSON.parse(adaptedSidecarBytes.toString("utf8"))
  );
  const adaptedMasterReference = promoted.source.adaptedMaster;
  assert(
    adaptedSidecar.output.path === adaptedMasterReference.path &&
      adaptedSidecar.output.bytes === adaptedMasterReference.bytes &&
      adaptedSidecar.output.sha256 === adaptedMasterReference.sha256 &&
      adaptedSidecar.output.width === adaptedMasterReference.width &&
      adaptedSidecar.output.height === adaptedMasterReference.height,
    "Adapted Master sidecar/output reference changed after runtime promotion."
  );

  const alignmentReviewBytes = await readContained(
    contract.alignmentReviewPath,
    contract.reportsRoot,
    "Independent alignment review for runtime check"
  );
  const alignmentReference = promoted.alignmentReviewRecord;
  assert(
    alignmentReviewBytes.length === alignmentReference.bytes &&
      sha256(alignmentReviewBytes) === alignmentReference.sha256,
    "Independent alignment review no longer matches the promoted runtime chain."
  );
  const alignmentReview = validateAlignmentReview(
    JSON.parse(alignmentReviewBytes.toString("utf8")),
    {
      sidecarPath: adaptedSidecarReference.path,
      sidecarBytes: adaptedSidecarReference.bytes,
      sidecarSha256: adaptedSidecarReference.sha256,
      outputPath: adaptedMasterReference.path,
      outputBytes: adaptedMasterReference.bytes,
      outputSha256: adaptedMasterReference.sha256,
      outputWidth: adaptedMasterReference.width,
      outputHeight: adaptedMasterReference.height,
    }
  );
  assert(
    alignmentReview.status === alignmentReference.status &&
      alignmentReview.review.reviewedBy === alignmentReference.reviewedBy &&
      alignmentReview.review.reviewedAt === alignmentReference.reviewedAt,
    "Independent alignment review summary changed after runtime promotion."
  );
}

async function validatePromotedFinalReviewChain(
  contract,
  promoted,
  outputs
) {
  const finalReviewBytes = await readContained(
    contract.finalReviewPath,
    contract.reportsRoot,
    "Cassini runtime final review for runtime check"
  );
  const finalReference = promoted.finalReviewRecord;
  assert(
    finalReviewBytes.length === finalReference.bytes &&
      sha256(finalReviewBytes) === finalReference.sha256,
    "Runtime final review no longer matches the promoted runtime chain."
  );
  const finalReviewJson = JSON.parse(finalReviewBytes.toString("utf8"));
  const candidateSidecarPath =
    promoted.prePromotionSidecarPath ??
    relativeRepositoryPath(contract.runtimeSidecarPath);
  let candidateSidecarBytes = finalReviewJson.candidateRuntimeSidecar?.bytes;
  if (promoted.prePromotionSidecarPath !== undefined) {
    const trackedCandidateBytes = await readContained(
      contract.stagedRuntimeSidecarPath,
      contract.reportsRoot,
      "tracked Cassini staged polar-fix sidecar"
    );
    assert(
      trackedCandidateBytes.length === promoted.prePromotionSidecarBytes &&
        sha256(trackedCandidateBytes) === promoted.prePromotionSidecarSha256,
      "Tracked staged polar-fix sidecar no longer matches the promoted chain."
    );
    candidateSidecarBytes = trackedCandidateBytes.length;
  }
  assert(
    Number.isInteger(candidateSidecarBytes) &&
      candidateSidecarBytes > 0 &&
      finalReviewJson.candidateRuntimeSidecar.sha256 ===
        promoted.prePromotionSidecarSha256,
    "Runtime final review does not match the promoted candidate hash."
  );
  const finalReview = validateFinalReview(finalReviewJson, {
    sidecarPath: candidateSidecarPath,
    sidecarBytes: candidateSidecarBytes,
    sidecarSha256: promoted.prePromotionSidecarSha256,
    outputs: outputs.map(publicOutputRecord),
  });
  assert(
    finalReview.status === finalReference.status &&
      finalReview.review.reviewedBy === finalReference.reviewedBy &&
      finalReview.review.reviewedAt === finalReference.reviewedAt,
    "Runtime final-review summary changed after promotion."
  );
}

export async function checkCassiniRuntimeTextures(contract) {
  const sidecarBytes = await readContained(
    contract.runtimeSidecarPath,
    contract.reportsRoot,
    "promoted Cassini runtime sidecar"
  );
  const promoted = validatePromotedSidecar(
    JSON.parse(sidecarBytes.toString("utf8")),
    contract
  );
  const outputs = [];
  for (const output of promoted.outputs) {
    outputs.push(await validateRuntimeOutput(contract, output));
  }
  await validatePromotedAlignmentChain(contract, promoted);
  await validatePromotedFinalReviewChain(contract, promoted, outputs);
  return {
    editionId,
    productionReady: true,
    runtimeSidecarSha256: sha256(sidecarBytes),
    outputs: outputs.map(publicOutputRecord),
    alignmentReviewSha256: promoted.alignmentReviewRecord.sha256,
    finalReviewSha256: promoted.finalReviewRecord.sha256,
  };
}

export async function validateCassiniPolarFixPromotion(contract) {
  const predecessorBytes = await readContained(
    contract.runtimeSidecarPath,
    contract.reportsRoot,
    "promoted Cassini runtime predecessor"
  );
  assert(
    sha256(predecessorBytes) === polarFixPredecessorSidecarSha256,
    "Polar-fix promotion only accepts the exact audited promoted predecessor."
  );
  const predecessor = validatePromotedSidecar(
    JSON.parse(predecessorBytes.toString("utf8")),
    contract
  );
  for (const output of predecessor.outputs) {
    await validateRuntimeOutput(contract, output);
  }

  const candidateBytes = await readContained(
    contract.stagedRuntimeSidecarPath,
    contract.reportsRoot,
    "Cassini staged polar-fix sidecar"
  );
  const candidate = validateStagedPolarFixSidecar(
    JSON.parse(candidateBytes.toString("utf8")),
    contract
  );
  assert(
    candidate.supersedes.bytes === predecessorBytes.length &&
      candidate.supersedes.sha256 === sha256(predecessorBytes),
    "Staged polar-fix candidate no longer matches its promoted predecessor."
  );
  await validatePromotedAlignmentChain(contract, candidate);

  const outputs = [];
  for (const output of candidate.outputs) {
    outputs.push(await validateStagedPolarFixOutput(contract, output));
  }
  const publicOutputs = outputs.map(publicOutputRecord);
  const finalReviewBytes = await readContained(
    contract.finalReviewPath,
    contract.reportsRoot,
    "Cassini polar-fix runtime final review"
  );
  const finalReview = validateFinalReview(
    JSON.parse(finalReviewBytes.toString("utf8")),
    {
      sidecarPath: relativeRepositoryPath(
        contract.stagedRuntimeSidecarPath
      ),
      sidecarBytes: candidateBytes.length,
      sidecarSha256: sha256(candidateBytes),
      outputs: publicOutputs,
    }
  );
  return {
    predecessorBytes,
    predecessor,
    candidateBytes,
    candidate,
    outputs,
    publicOutputs,
    finalReviewBytes,
    finalReview,
  };
}

export async function promoteCassiniPolarFix(contract) {
  const validation = await validateCassiniPolarFixPromotion(contract);
  assert(
    sha256(validation.candidateBytes) ===
        reviewedPolarFixCandidateSidecarSha256 &&
      sha256(validation.finalReviewBytes) === reviewedPolarFixFinalReviewSha256,
    "Polar-fix promotion accepts only the exact independently reviewed candidate and final-review record."
  );

  const { supersedes, ...candidate } = validation.candidate;
  const promoted = {
    ...candidate,
    stage: "runtime-texture-production",
    artifactKind: "cassini-runtime-texture-export",
    productionReady: true,
    reviewState: "reviewed-and-promoted",
    supersededProduction: supersedes,
    outputs: validation.publicOutputs,
    prePromotionSidecarPath: relativeRepositoryPath(
      contract.stagedRuntimeSidecarPath
    ),
    prePromotionSidecarBytes: validation.candidateBytes.length,
    prePromotionSidecarSha256: sha256(validation.candidateBytes),
    finalReviewRecord: {
      path: relativeRepositoryPath(contract.finalReviewPath),
      bytes: validation.finalReviewBytes.length,
      sha256: sha256(validation.finalReviewBytes),
      status: validation.finalReview.status,
      reviewedBy: validation.finalReview.review.reviewedBy,
      reviewedAt: validation.finalReview.review.reviewedAt,
    },
    gates: {
      ...validation.candidate.gates,
      independentAlignmentReview: "pass",
      fourKAndTwoKVisualReview: "pass",
      runtimeReview: "pass",
      productionReady: true,
    },
  };
  const promotedBytes = Buffer.from(
    `${JSON.stringify(promoted, null, 2)}\n`,
    "utf8"
  );

  await atomicWriteSet([
    ...validation.outputs.map((output) => {
      const profile = contract.profiles.find(
        ({ profile: id }) => id === output.profile
      );
      assert(profile, `Unknown promoted runtime profile: ${output.profile}.`);
      return {
        targetPath: profile.outputPath,
        allowedRoot: contract.outputRoot,
        bytes: output.encodedBytes,
        label: `${output.profile} promoted Cassini polar-fix texture`,
      };
    }),
    {
      targetPath: contract.runtimeSidecarPath,
      allowedRoot: contract.reportsRoot,
      bytes: promotedBytes,
      label: "promoted Cassini polar-fix runtime sidecar",
    },
  ]);
  return promoted;
}

export async function promoteCassiniRuntimeTextures(contract) {
  const sidecarBytes = await readContained(
    contract.runtimeSidecarPath,
    contract.reportsRoot,
    "Cassini runtime candidate sidecar"
  );
  const candidate = validateCandidateSidecar(
    JSON.parse(sidecarBytes.toString("utf8")),
    contract
  );
  const outputs = [];
  for (const output of candidate.outputs) {
    outputs.push(await validateRuntimeOutput(contract, output));
  }

  const finalReviewBytes = await readContained(
    contract.finalReviewPath,
    contract.reportsRoot,
    "Cassini runtime final review"
  );
  const finalReview = validateFinalReview(
    JSON.parse(finalReviewBytes.toString("utf8")),
    {
      sidecarPath: relativeRepositoryPath(contract.runtimeSidecarPath),
      sidecarBytes: sidecarBytes.length,
      sidecarSha256: sha256(sidecarBytes),
      outputs: outputs.map(publicOutputRecord),
    }
  );
  const promoted = {
    ...candidate,
    stage: "runtime-texture-production",
    productionReady: true,
    reviewState: "reviewed-and-promoted",
    prePromotionSidecarSha256: sha256(sidecarBytes),
    finalReviewRecord: {
      path: relativeRepositoryPath(contract.finalReviewPath),
      bytes: finalReviewBytes.length,
      sha256: sha256(finalReviewBytes),
      status: finalReview.status,
      reviewedBy: finalReview.review.reviewedBy,
      reviewedAt: finalReview.review.reviewedAt,
    },
    gates: {
      ...candidate.gates,
      independentAlignmentReview: "pass",
      fourKAndTwoKVisualReview: "pass",
      runtimeReview: "pass",
      productionReady: true,
    },
  };
  const promotedBytes = Buffer.from(
    `${JSON.stringify(promoted, null, 2)}\n`,
    "utf8"
  );
  await atomicWriteSet(
    [
      {
        targetPath: contract.runtimeSidecarPath,
        allowedRoot: contract.reportsRoot,
        bytes: promotedBytes,
        label: "promoted Cassini runtime sidecar",
      },
    ]
  );
  return promoted;
}

export function parseMode(argv) {
  if (argv.length === 0) return "export";
  if (argv.length === 1 && argv[0] === "--stage-polar-fix") {
    return "stage-polar-fix";
  }
  if (argv.length === 1 && argv[0] === "--validate-polar-fix") {
    return "validate-polar-fix";
  }
  if (argv.length === 1 && argv[0] === "--promote-polar-fix") {
    return "promote-polar-fix";
  }
  if (argv.length === 1 && argv[0] === "--promote") return "promote";
  if (argv.length === 1 && argv[0] === "--check") return "check";
  throw new Error(
    "Usage: node scripts/export-cassini-runtime-textures.mjs [--stage-polar-fix|--validate-polar-fix|--promote-polar-fix|--promote|--check]"
  );
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const contract = productionContract();
  if (mode === "stage-polar-fix") {
    const result = await stageCassiniPolarFix(contract);
    console.log(
      `Staged Cassini polar-fix candidates without changing promoted runtime assets: ${result.outputs
        .map(({ profile, sha256: outputSha256 }) => `${profile}=${outputSha256}`)
        .join(", ")}.`
    );
    return;
  }
  if (mode === "validate-polar-fix") {
    const result = await validateCassiniPolarFixPromotion(contract);
    console.log(
      `Validated reviewed Cassini polar-fix promotion bundle without writing production: ${result.publicOutputs
        .map(({ profile, sha256: outputSha256 }) => `${profile}=${outputSha256}`)
        .join(", ")}.`
    );
    return;
  }
  if (mode === "promote-polar-fix") {
    await promoteCassiniPolarFix(contract);
    console.log(
      "Atomically promoted the exact reviewed Cassini polar-fix candidate."
    );
    return;
  }
  if (mode === "check") {
    const result = await checkCassiniRuntimeTextures(contract);
    console.log(
      `Verified promoted Cassini runtime sidecar, ${result.outputs.length} committed WebP files, and both review chains without reading the 8K master or writing files.`
    );
    return;
  }
  if (mode === "promote") {
    await promoteCassiniRuntimeTextures(contract);
    console.log(
      `Promoted Cassini runtime sidecar after exact WebP/review verification; existing WebP bytes were not recompressed.`
    );
    return;
  }
  await exportCassiniRuntimeTextures(contract);
  console.log(
    `Exported Cassini 4096x2048 and 2048x1024 runtime candidates; productionReady remains false pending visual/runtime review.`
  );
}

const directExecution =
  process.argv[1] !== undefined &&
  (await realpath(path.resolve(process.argv[1]))) ===
    (await realpath(fileURLToPath(import.meta.url)));

if (directExecution) await main();
