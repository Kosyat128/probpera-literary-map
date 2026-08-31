import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildBookSceneThemeManifest,
  bookScenePaletteRightsStatuses,
  localCoverPath,
  serializeBookSceneThemeManifest,
} from "./book-scene-theme-manifest.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "../..");
const generatedPath = path.join(
  projectRoot,
  "src",
  "books",
  "bookCoverPalettes.generated.json"
);

describe("book scene palette manifest", () => {
  it("is deterministic, local-only and SHA-bound to rights-approved covers", async () => {
    const manifest = await buildBookSceneThemeManifest(projectRoot);
    const current = await readFile(generatedPath, "utf8");
    expect(serializeBookSceneThemeManifest(manifest)).toBe(
      current.replace(/\r\n?/gu, "\n")
    );
    expect(manifest.entries.length).toBeGreaterThan(100);
    expect(new Set(manifest.entries.map((entry) => entry.coverUrl)).size).toBe(
      manifest.entries.length
    );

    for (const entry of manifest.entries) {
      expect(entry.coverUrl).not.toMatch(/^(?:https?:|data:|blob:)/iu);
      expect(bookScenePaletteRightsStatuses.has(entry.rightsStatus)).toBe(true);
      expect(entry.coverSha256).toMatch(/^[a-f0-9]{64}$/u);
      const filePath = localCoverPath(projectRoot, entry.coverUrl);
      expect(filePath).not.toBeNull();
      const digest = createHash("sha256")
        .update(await readFile(filePath))
        .digest("hex");
      expect(entry.coverSha256).toBe(digest);
      for (const color of [
        entry.dominantColor,
        entry.darkColor,
        entry.lightColor,
        entry.accentColor,
        entry.warmColor,
      ]) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/u);
      }
    }
  }, 30_000);
});
