import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { projectPublicationImageFix } from "./reviewed-publication-image-fix.mjs";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

describe("publication image fix historical source bindings", () => {
  it("restores the merged image preparation release through main history", () => {
    const path = "scripts/prepare-public-images.mjs";
    const priorMain = "51b5c255d9e2822c17dda4c69b47d66e9b7fb831";
    const mergedMain = "0ec07b46c1d7eef93b224c7034f9dfca765c4935";
    execFileSync("git", ["merge-base", "--is-ancestor", priorMain, mergedMain]);
    const previous = execFileSync("git", ["show", `${priorMain}:${path}`], { encoding: "utf8" });
    const merged = execFileSync("git", ["show", `${mergedMain}:${path}`], { encoding: "utf8" });
    expect(sha256(previous)).toBe("480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79");
    expect(sha256(merged)).toBe("33957008d25ef2c6f7f0aaf165ad249ab59b8ce549bc574a20bbc8f19f4867a8");
    expect(projectPublicationImageFix(path, merged)).toBe(projectPublicationImageFix(path, previous));
  });

  it.each([
    ["scripts/prepare-public-images.mjs", "d18e8f9310b03e0bc5324757034a92f4976c1edc4f8e3f16772588b5e076ee6d"],
    ["scripts/prepare-public-images.test.mjs", "dd7379a7a1eab09a2172a8207fb81a48c310b8e6f1908d10c8b877b41a2689c8"],
    ["scripts/lib/public-image-delivery.mjs", "e16ad45e2d2c4359ce20adb8d829d4abf5ee9f3a608d987e5c5998e51303879b"],
    ["scripts/lib/public-image-delivery.test.mjs", "074574c8df85fb29a3a88e09d6cb051171a47a5229ab577e7c00e9c698913bea"],
    ["scripts/lib/reviewed-cms-preview-webgl-followup.mjs", "37e60edabeacba4725fcd2f5f397926bd394bc50d31e176e6e6ac65f569e33dc"],
    [".github/workflows/deploy-pages.yml", "30f5568f71fb4dc8098d3a0ca9c8bfd9fb0fe456ad025915eccdc584bcc6abd7"],
    ["apps/admin/lib/publication.ts", "bc668f90abd99c3e449ce8e59165543011d7269aaa0d19fcc4c7707875ab433e"],
    ["apps/admin/app/(dashboard)/articles/atomic-standard-save-action.ts", "e28aad301592b976edc277775c56ef625aaa5dbe78a52881083daf9aef4ace33"],
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
