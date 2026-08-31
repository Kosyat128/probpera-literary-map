import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  checkCassiniRuntimeTextures,
  exportCassiniRuntimeTextures,
  parseMode,
  promoteCassiniRuntimeTextures,
  validateStagedPolarFixSidecar,
} from "../export-cassini-runtime-textures.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function repositoryRelative(filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

function reviewMetadata() {
  return {
    trackedRecord: true,
    status: "reviewed",
    review: {
      independent: true,
      reviewedBy: "Synthetic independent reviewer",
      reviewedAt: "2026-08-30",
    },
  };
}

async function syntheticAdaptedMaster(width, height) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      rgb[offset] = 70 + x * 7;
      rgb[offset + 1] = 55 + y * 13;
      rgb[offset + 2] = 30 + ((x + y) % 9) * 11;
    }
  }
  return sharp(rgb, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: false })
    .toBuffer();
}

describe("Cassini runtime texture export", () => {
  it("parses only explicit export, staged polar-fix, promotion, and check modes", () => {
    expect(parseMode([])).toBe("export");
    expect(parseMode(["--stage-polar-fix"])).toBe("stage-polar-fix");
    expect(parseMode(["--validate-polar-fix"])).toBe("validate-polar-fix");
    expect(parseMode(["--promote-polar-fix"])).toBe("promote-polar-fix");
    expect(parseMode(["--promote"])).toBe("promote");
    expect(parseMode(["--check"])).toBe("check");
    expect(() => parseMode(["--check", "unexpected"])).toThrow(
      "Usage: node scripts/export-cassini-runtime-textures.mjs [--stage-polar-fix|--validate-polar-fix|--promote-polar-fix|--promote|--check]"
    );
    expect(() => parseMode(["--unknown"])).toThrow(
      "Usage: node scripts/export-cassini-runtime-textures.mjs [--stage-polar-fix|--validate-polar-fix|--promote-polar-fix|--promote|--check]"
    );
  });

  it("accepts only the exact hash-pinned Cassini polar-fix predecessor", () => {
    const contract = {
      runtimeSidecarPath: path.join(
        repositoryRoot,
        "reports/globe-editions/cassini-1790-runtime-textures.json"
      ),
      profiles: [{ profile: "desktop" }, { profile: "mobile" }],
    };
    const staged = {
      schemaVersion: 1,
      editionId: "cassini-1790",
      stage: "runtime-texture-staged-candidate",
      artifactKind: "cassini-runtime-polar-fix-staged-export",
      trackedSidecar: true,
      productionReady: false,
      reviewState: "staged-awaiting-exact-4k-2k-review",
      deterministic: true,
      supersedes: {
        path: "reports/globe-editions/cassini-1790-runtime-textures.json",
        bytes: 3236,
        sha256:
          "C5E2360C88CE8E067F8D95EDF16D24FC964DFE2084AA0EDE30625A9ECF95247B",
        productionReady: true,
        outputs: [{ profile: "desktop" }, { profile: "mobile" }],
      },
      encoding: {
        format: "webp",
        lossless: false,
        effort: 6,
        smartSubsample: true,
        resizeKernel: "lanczos3",
        baseline: "current-rand-mcnally-1887-runtime-profile",
      },
      outputs: [{ profile: "desktop" }, { profile: "mobile" }],
      gates: {
        predecessorChecksum: "verified",
        adaptedMasterChecksum: "verified",
        independentAlignmentReview: "pass",
        fourKAndTwoKVisualReview: "pending",
        runtimeReview: "pending",
        productionReady: false,
      },
    };

    expect(validateStagedPolarFixSidecar(staged, contract)).toBe(staged);
    expect(() =>
      validateStagedPolarFixSidecar(
        {
          ...staged,
          supersedes: { ...staged.supersedes, sha256: "0".repeat(64) },
        },
        contract
      )
    ).toThrow("Cassini staged polar-fix predecessor reference is invalid.");
  });

  it("exports reviewed candidates fail-closed and promotes only their unchanged WebP bytes", async () => {
    const temporaryParent = path.join(repositoryRoot, ".tmp");
    await mkdir(temporaryParent, { recursive: true });
    const temporaryRoot = await mkdtemp(
      path.join(temporaryParent, "cassini-runtime-test-")
    );

    try {
      const reportsRoot = path.join(temporaryRoot, "reports");
      const mastersRoot = path.join(temporaryRoot, "masters");
      const outputRoot = path.join(temporaryRoot, "textures");
      await Promise.all([
        mkdir(reportsRoot, { recursive: true }),
        mkdir(mastersRoot, { recursive: true }),
        mkdir(outputRoot, { recursive: true }),
      ]);

      const width = 16;
      const height = 8;
      const adaptedBytes = await syntheticAdaptedMaster(width, height);
      const adaptedPath = path.join(
        mastersRoot,
        `cassini-1790-interactive-adapted-master-${width}x${height}.png`
      );
      await writeFile(adaptedPath, adaptedBytes);
      const adaptedSidecarPath = path.join(reportsRoot, "adapted.json");
      const adaptedSidecar = {
        schemaVersion: 1,
        editionId: "cassini-1790",
        stage: "interactive-adapted-master",
        artifactKind: "interactive-adapted-master",
        trackedSidecar: true,
        productionReady: false,
        reviewState: "generated-awaiting-independent-qa",
        algorithm: {
          deterministic: true,
          networkAccessUsed: false,
          nonlinearWarpApplied: false,
          randomTextureUsed: false,
          genericModernMapFillUsed: false,
          labelsOrInventedDetailsAdded: false,
        },
        output: {
          path: repositoryRelative(adaptedPath),
          width,
          height,
          format: "png",
          bytes: adaptedBytes.length,
          sha256: sha256(adaptedBytes),
          lossless: true,
          colorSpace: "srgb",
          depth: "uchar",
          bitsPerChannel: 8,
          channels: 3,
          hasAlpha: false,
          hasIccProfile: false,
        },
        gates: {
          historicalMaster: "verified",
          historicalSeamPaperRuns: "pass",
          canonicalAtlasChecksum: "verified",
          unionLandMask: "generated",
          identityTransform: "applied",
          independentAlignmentReview: "pending",
          fourKAndTwoKVisualReview: "pending",
          runtimeReview: "pending",
          productionReady: false,
        },
      };
      const adaptedSidecarBytes = Buffer.from(
        `${JSON.stringify(adaptedSidecar, null, 2)}\n`,
        "utf8"
      );
      await writeFile(adaptedSidecarPath, adaptedSidecarBytes);

      const alignmentReviewPath = path.join(
        reportsRoot,
        "alignment-review.json"
      );
      const alignmentReview = {
        schemaVersion: 1,
        editionId: "cassini-1790",
        artifactKind: "independent-adapted-master-alignment-review",
        ...reviewMetadata(),
        adaptedMaster: {
          sidecar: {
            path: repositoryRelative(adaptedSidecarPath),
            bytes: adaptedSidecarBytes.length,
            sha256: sha256(adaptedSidecarBytes),
          },
          output: {
            path: repositoryRelative(adaptedPath),
            bytes: adaptedBytes.length,
            sha256: sha256(adaptedBytes),
            width,
            height,
          },
        },
        gates: { independentAlignmentReview: "pending" },
      };
      await writeFile(
        alignmentReviewPath,
        `${JSON.stringify(alignmentReview, null, 2)}\n`,
        "utf8"
      );

      const runtimeSidecarPath = path.join(
        reportsRoot,
        "runtime-textures.json"
      );
      const finalReviewPath = path.join(reportsRoot, "final-review.json");
      const profiles = [
        {
          profile: "desktop",
          width: 8,
          height: 4,
          outputPath: path.join(outputRoot, "cassini-desktop.webp"),
        },
        {
          profile: "mobile",
          width: 4,
          height: 2,
          outputPath: path.join(outputRoot, "cassini-mobile.webp"),
        },
      ];
      const contract = {
        adaptedSidecarPath,
        alignmentReviewPath,
        finalReviewPath,
        reportsRoot,
        mastersRoot,
        outputRoot,
        runtimeSidecarPath,
        profiles,
      };

      await expect(exportCassiniRuntimeTextures(contract)).rejects.toThrow(
        "Independent alignment review gate has not passed."
      );
      await expect(readFile(runtimeSidecarPath)).rejects.toMatchObject({
        code: "ENOENT",
      });

      alignmentReview.gates.independentAlignmentReview = "pass";
      await writeFile(
        alignmentReviewPath,
        `${JSON.stringify(alignmentReview, null, 2)}\n`,
        "utf8"
      );
      const candidate = await exportCassiniRuntimeTextures(contract);
      expect(candidate).toMatchObject({
        productionReady: false,
        gates: {
          independentAlignmentReview: "pass",
          fourKAndTwoKVisualReview: "pending",
          runtimeReview: "pending",
          productionReady: false,
        },
      });
      expect(candidate.outputs).toHaveLength(2);
      expect(candidate.outputs.every(({ upscaled }) => upscaled === false)).toBe(
        true
      );

      const firstOutputBytes = await Promise.all(
        profiles.map(({ outputPath }) => readFile(outputPath))
      );
      const repeated = await exportCassiniRuntimeTextures(contract);
      const repeatedOutputBytes = await Promise.all(
        profiles.map(({ outputPath }) => readFile(outputPath))
      );
      expect(repeated.outputs).toEqual(candidate.outputs);
      expect(
        repeatedOutputBytes.every((bytes, index) =>
          bytes.equals(firstOutputBytes[index])
        )
      ).toBe(true);

      const candidateSidecarBytes = await readFile(runtimeSidecarPath);
      const candidateSidecar = JSON.parse(candidateSidecarBytes.toString("utf8"));
      const finalReview = {
        schemaVersion: 1,
        editionId: "cassini-1790",
        artifactKind: "cassini-runtime-final-review",
        ...reviewMetadata(),
        candidateRuntimeSidecar: {
          path: repositoryRelative(runtimeSidecarPath),
          bytes: candidateSidecarBytes.length,
          sha256: sha256(candidateSidecarBytes),
        },
        outputs: candidateSidecar.outputs.map(
          ({ profile, path: outputPath, bytes, sha256: outputSha, width, height }) => ({
            profile,
            path: outputPath,
            bytes,
            sha256: outputSha,
            width,
            height,
          })
        ),
        gates: {
          independentAlignmentReview: "pass",
          fourKAndTwoKVisualReview: "pass",
          runtimeReview: "pending",
        },
      };
      await writeFile(
        finalReviewPath,
        `${JSON.stringify(finalReview, null, 2)}\n`,
        "utf8"
      );
      await expect(promoteCassiniRuntimeTextures(contract)).rejects.toThrow(
        "Runtime final review gates have not all passed."
      );

      finalReview.gates.runtimeReview = "pass";
      await writeFile(
        finalReviewPath,
        `${JSON.stringify(finalReview, null, 2)}\n`,
        "utf8"
      );
      const beforePromotion = await Promise.all(
        profiles.map(({ outputPath }) => readFile(outputPath))
      );
      const promoted = await promoteCassiniRuntimeTextures(contract);
      const afterPromotion = await Promise.all(
        profiles.map(({ outputPath }) => readFile(outputPath))
      );
      expect(promoted).toMatchObject({
        stage: "runtime-texture-production",
        productionReady: true,
        gates: {
          independentAlignmentReview: "pass",
          fourKAndTwoKVisualReview: "pass",
          runtimeReview: "pass",
          productionReady: true,
        },
      });
      expect(
        afterPromotion.every((bytes, index) =>
          bytes.equals(beforePromotion[index])
        )
      ).toBe(true);
      expect(promoted.outputs.map(({ sha256: hash }) => hash)).toEqual(
        afterPromotion.map(sha256)
      );

      const checkedPaths = [
        runtimeSidecarPath,
        alignmentReviewPath,
        finalReviewPath,
        ...profiles.map(({ outputPath }) => outputPath),
      ];
      const beforeCheck = await Promise.all(checkedPaths.map((file) => readFile(file)));
      await rm(adaptedPath, { force: true });
      const checked = await checkCassiniRuntimeTextures(contract);
      const afterCheck = await Promise.all(checkedPaths.map((file) => readFile(file)));
      expect(checked).toMatchObject({
        editionId: "cassini-1790",
        productionReady: true,
        outputs: [
          { profile: "desktop", width: 8, height: 4 },
          { profile: "mobile", width: 4, height: 2 },
        ],
      });
      expect(
        afterCheck.every((bytes, index) => bytes.equals(beforeCheck[index]))
      ).toBe(true);

      await writeFile(
        alignmentReviewPath,
        Buffer.concat([beforeCheck[1], Buffer.from(" ")])
      );
      await expect(checkCassiniRuntimeTextures(contract)).rejects.toThrow(
        "Independent alignment review no longer matches the promoted runtime chain."
      );
      await writeFile(alignmentReviewPath, beforeCheck[1]);

      await writeFile(
        finalReviewPath,
        Buffer.concat([beforeCheck[2], Buffer.from(" ")])
      );
      await expect(checkCassiniRuntimeTextures(contract)).rejects.toThrow(
        "Runtime final review no longer matches the promoted runtime chain."
      );
      await writeFile(finalReviewPath, beforeCheck[2]);

      await writeFile(
        profiles[0].outputPath,
        Buffer.concat([beforeCheck[3], Buffer.from([0])])
      );
      await expect(checkCassiniRuntimeTextures(contract)).rejects.toThrow(
        "desktop runtime texture no longer matches its sidecar."
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
