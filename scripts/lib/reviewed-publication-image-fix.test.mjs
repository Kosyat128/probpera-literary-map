import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectPublicationImageFix } from "./reviewed-publication-image-fix.mjs";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

describe("publication image fix historical source bindings", () => {
  it.each([
    ["scripts/prepare-public-images.mjs", "d18e8f9310b03e0bc5324757034a92f4976c1edc4f8e3f16772588b5e076ee6d"],
    ["scripts/lib/reviewed-cms-preview-webgl-followup.mjs", "37e60edabeacba4725fcd2f5f397926bd394bc50d31e176e6e6ac65f569e33dc"],
    [".github/workflows/deploy-pages.yml", "30f5568f71fb4dc8098d3a0ca9c8bfd9fb0fe456ad025915eccdc584bcc6abd7"],
    ["apps/admin/lib/publication.ts", "bc668f90abd99c3e449ce8e59165543011d7269aaa0d19fcc4c7707875ab433e"],
  ])("pins the current fix and the immutable prior release for %s", (path, previousSha) => {
    const source = readFileSync(path, "utf8").replace(/\r\n?/gu, "\n");
    const previous = projectPublicationImageFix(path, source);
    expect(previous).not.toBe(source);
    expect(sha256(previous)).toBe(previousSha);
    expect(projectPublicationImageFix(path, source.replaceAll("\n", "\r\n"))).toBe(previous);
    const altered = `${source}\n// A new change must be reviewed.\n`;
    expect(projectPublicationImageFix(path, altered)).toBe(altered);
    expect(projectPublicationImageFix("scripts/unrelated.mjs", source)).toBe(source);
  });
});
