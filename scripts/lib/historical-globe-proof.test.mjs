import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const builderPath = fileURLToPath(
  new URL("../build-historical-globe-proof.mjs", import.meta.url)
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

async function pngFromRaw(data, width, height) {
  return sharp(data, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 9, palette: false, adaptiveFiltering: false })
    .toBuffer();
}

async function makeGoreSheet(redValues) {
  const width = 64;
  const height = 48;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      data[offset] = redValues[x < width / 2 ? 0 : 1];
      data[offset + 1] = x * 4;
      data[offset + 2] = y * 5;
    }
  }
  return pngFromRaw(data, width, height);
}

async function makePolarSheet() {
  const width = 32;
  const height = 32;
  const data = Buffer.alloc(width * height * 3, 10);
  const circles = [
    { centerX: 8, centerY: 8, red: 220, blue: 20 },
    { centerX: 24, centerY: 24, red: 20, blue: 220 },
  ];
  for (const circle of circles) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (Math.hypot(x - circle.centerX, y - circle.centerY) > 7) continue;
        const offset = (y * width + x) * 3;
        data[offset] = circle.red;
        data[offset + 1] = x * 6;
        data[offset + 2] = circle.blue;
      }
    }
  }
  return pngFromRaw(data, width, height);
}

function proofSource(id, filename, bytes, width, height) {
  return {
    id,
    proofDerivative: {
      filename,
      width,
      height,
      bytes: bytes.length,
      sha256: sha256(bytes),
      tracked: false,
      productionEligible: false,
    },
    productionSourceBinary: { status: "not_acquired" },
  };
}

function measuredGore(number, sourceId, centralLongitudeDeg, centerX) {
  return {
    number,
    sourceId,
    centralLongitudeDeg,
    rows: [
      {
        latitudeDeg: 80,
        y: 4,
        leftX: centerX - 2,
        centerX,
        rightX: centerX + 2,
      },
      {
        latitudeDeg: 0,
        y: 24,
        leftX: centerX - 12,
        centerX,
        rightX: centerX + 12,
      },
      {
        latitudeDeg: -80,
        y: 44,
        leftX: centerX - 2,
        centerX,
        rightX: centerX + 2,
      },
    ],
  };
}

function pixelAt(data, width, x, y) {
  const offset = (y * width + x) * 3;
  return [...data.subarray(offset, offset + 3)];
}

describe("historical globe proof projection", () => {
  it("maps configurable multi-sheet gores and polar caps without mirroring and emits byte-identical output", async () => {
    const temporaryParent = path.join(repositoryRoot, ".tmp");
    await mkdir(temporaryParent, { recursive: true });
    const temporaryRoot = await mkdtemp(
      path.join(temporaryParent, "historical-proof-test-")
    );

    try {
      const sourceDirectory = path.join(temporaryRoot, "sources");
      await mkdir(sourceDirectory, { recursive: true });
      const sheetA = await makeGoreSheet([40, 80]);
      const sheetB = await makeGoreSheet([120, 160]);
      const polarSheet = await makePolarSheet();
      await Promise.all([
        writeFile(path.join(sourceDirectory, "sheet-a.png"), sheetA),
        writeFile(path.join(sourceDirectory, "sheet-b.png"), sheetB),
        writeFile(path.join(sourceDirectory, "caps.png"), polarSheet),
      ]);

      const config = {
        schemaVersion: 1,
        editionId: "synthetic-four-gore",
        proofOnly: true,
        productionEligible: false,
        output: { width: 64, height: 32, format: "png" },
        sources: [
          proofSource("sheet-a", "sheet-a.png", sheetA, 64, 48),
          proofSource("sheet-b", "sheet-b.png", sheetB, 64, 48),
          proofSource("caps", "caps.png", polarSheet, 32, 32),
        ],
        surface: {
          joinLatitudeDeg: 80,
          goreAngularWidthDeg: 90,
          longitudeConvention: {
            status: "synthetic-verified",
          },
          gores: [
            measuredGore(1, "sheet-a", 0, 16),
            measuredGore(2, "sheet-a", 90, 48),
            measuredGore(3, "sheet-b", 180, 16),
            measuredGore(4, "sheet-b", -90, 48),
          ],
          caps: [
            {
              hemisphere: "north",
              sourceId: "caps",
              centerX: 8,
              centerY: 8,
              radiusPx: 6,
              zeroAngleDeg: 0,
              direction: 1,
              orientationStatus: "synthetic-verified",
            },
            {
              hemisphere: "south",
              sourceId: "caps",
              centerX: 24,
              centerY: 24,
              radiusPx: 6,
              zeroAngleDeg: 0,
              direction: 1,
              orientationStatus: "synthetic-verified",
            },
          ],
        },
      };
      const configPath = path.join(temporaryRoot, "config.json");
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
      const firstOutput = path.join(temporaryRoot, "first.png");
      const secondOutput = path.join(temporaryRoot, "second.png");
      const commonArguments = [
        builderPath,
        "--config",
        configPath,
        "--source-dir",
        sourceDirectory,
      ];
      await execFileAsync(process.execPath, [
        ...commonArguments,
        "--output",
        firstOutput,
      ]);
      await execFileAsync(process.execPath, [
        ...commonArguments,
        "--output",
        secondOutput,
      ]);

      const [firstBytes, secondBytes] = await Promise.all([
        readFile(firstOutput),
        readFile(secondOutput),
      ]);
      expect(firstBytes.equals(secondBytes)).toBe(true);

      const { data, info } = await sharp(firstBytes)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info).toMatchObject({ width: 64, height: 32, channels: 3 });

      expect(pixelAt(data, 64, 32, 16)[0]).toBe(40);
      expect(pixelAt(data, 64, 48, 16)[0]).toBe(80);
      expect(pixelAt(data, 64, 0, 16)[0]).toBe(120);
      expect(pixelAt(data, 64, 16, 16)[0]).toBe(160);
      expect(pixelAt(data, 64, 34, 16)[1]).toBeGreaterThan(
        pixelAt(data, 64, 29, 16)[1]
      );
      expect(pixelAt(data, 64, 32, 8)[2]).toBeLessThan(
        pixelAt(data, 64, 32, 23)[2]
      );
      expect(pixelAt(data, 64, 32, 0)[0]).toBeGreaterThan(180);
      expect(pixelAt(data, 64, 32, 31)[2]).toBeGreaterThan(180);

      const sidecar = JSON.parse(
        await readFile(firstOutput.replace(/\.png$/u, ".json"), "utf8")
      );
      expect(sidecar).toMatchObject({
        proofOnly: true,
        productionEligible: false,
        qa: {
          mappedPixelCoveragePercent: 100,
          seamPaperRuns: {
            maximumSolidContinuousPaperRunWidthPixels: 0,
            gate: {
              requiredMaximumSolidContinuousPaperRunWidthPixels: 0,
              passed: true,
            },
          },
        },
        gates: { productionReady: false },
      });
      expect(sidecar.qa.seamPaperRuns.perBoundary).toHaveLength(4);

      await expect(
        execFileAsync(process.execPath, [
          builderPath,
          "--stage",
          "historical-master",
          "--input-kind",
          "proof",
          "--config",
          configPath,
          "--source-dir",
          sourceDirectory,
        ])
      ).rejects.toThrow(
        "--stage historical-master requires --input-kind production."
      );
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
