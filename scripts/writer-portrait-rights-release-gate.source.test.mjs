import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
}

describe("writer portrait rights release gate", () => {
  it("keeps the fail-closed queue check in both release and country audit commands", async () => {
    const packageJson = await json("package.json");
    expect(packageJson.scripts["writers:portraits:rights:build"]).toContain(
      "build-writer-portrait-rights-queue.mjs --write"
    );
    expect(packageJson.scripts["writers:portraits:rights:check"]).toContain(
      "build-writer-portrait-rights-queue.mjs --check"
    );
    expect(packageJson.scripts["release:check"]).toContain(
      "writers:portraits:rights:check"
    );
    expect(packageJson.scripts["countries:audit"]).toContain(
      "build-writer-portrait-rights-queue.mjs --check"
    );
  });

  it("allows only real photographs and treats uncleared records as not published", async () => {
    const schema = await json("schemas/writer-portrait-rights-queue.schema.json");
    const policy = schema.properties.policy.properties;
    const candidate = schema.$defs.writer.properties.candidate.properties;
    expect(policy.aiGeneratedLikenessesAllowed.const).toBe(false);
    expect(policy.unlicensedPresentation.const).toBe("photo-not-published");
    expect(candidate.mediaKind.enum).toEqual(["", "photograph"]);
  });

  it("stores no staged/public asset for any uncleared queue row", async () => {
    const queue = await json("data/writer-portrait-rights-queue.json");
    expect(queue.policy).toMatchObject({
      aiGeneratedLikenessesAllowed: false,
      publicAssetReferencesAllowedBeforeClearance: false,
      unlicensedPresentation: "photo-not-published",
    });
    expect(queue.writers.length).toBeGreaterThan(0);
    for (const entry of queue.writers) {
      if (entry.status !== "licensed") {
        expect(entry.candidate.assetRef, entry.key).toBe("");
      }
    }
  });
});
