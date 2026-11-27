import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const beforeImagePreparationRelease = "ef750cbb90c4e07100253a4580e8b422dab05115";
const beforeEgressRecoveryRelease = "51b5c255d9e2822c17dda4c69b47d66e9b7fb831";
const beforeImageWriteHardening = "23f6ab03462d8a84a93e84c7942b26e46b908d2d";
const repository = fileURLToPath(new URL("../../", import.meta.url));
const files = new Map([
  ["scripts/prepare-public-images.mjs", [{
    release: beforeImageWriteHardening,
    before: "f6eca3ec9f514506f7d71a59bc3da9317bc42a6ab630a2523d5bf25c6f1763b8",
    after: "33957008d25ef2c6f7f0aaf165ad249ab59b8ce549bc574a20bbc8f19f4867a8",
  }, {
    release: beforeEgressRecoveryRelease,
    before: "480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79",
    after: "f6eca3ec9f514506f7d71a59bc3da9317bc42a6ab630a2523d5bf25c6f1763b8",
  }, {
    release: beforeImagePreparationRelease,
    before: "d18e8f9310b03e0bc5324757034a92f4976c1edc4f8e3f16772588b5e076ee6d",
    after: "480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79",
  }]],
  ["scripts/prepare-public-images.test.mjs", [{
    release: beforeEgressRecoveryRelease,
    before: "dd7379a7a1eab09a2172a8207fb81a48c310b8e6f1908d10c8b877b41a2689c8",
    after: "61e91401fe3b89226d9540fe713b28da0ad6c3b3188827abea37a0b39d228ffe",
  }]],
  ["scripts/lib/public-image-delivery.mjs", [{
    release: beforeEgressRecoveryRelease,
    before: "e16ad45e2d2c4359ce20adb8d829d4abf5ee9f3a608d987e5c5998e51303879b",
    after: "d60dc0a202f22babae678e566884efb8f3078450ac9b30e57fca1038d77dcd33",
  }]],
  ["scripts/lib/public-image-delivery.test.mjs", [{
    release: beforeEgressRecoveryRelease,
    before: "074574c8df85fb29a3a88e09d6cb051171a47a5229ab577e7c00e9c698913bea",
    after: "b88cd3a9947d3561f445c7bd68471c077fce9d07b60440da4f76f5f0acff4451",
  }]],
  ["scripts/lib/reviewed-cms-preview-webgl-followup.mjs", [{
    release: beforeImagePreparationRelease,
    before: "37e60edabeacba4725fcd2f5f397926bd394bc50d31e176e6e6ac65f569e33dc",
    after: "5f27cfb2a244d414efc261c4d794c10a99338e64a969bc08315dc6311d82e59f",
  }]],
  [".github/workflows/deploy-pages.yml", [{
    release: beforeEgressRecoveryRelease,
    before: "30f5568f71fb4dc8098d3a0ca9c8bfd9fb0fe456ad025915eccdc584bcc6abd7",
    after: "66247c832c92e789005ee2b028b0cd2ca32a1883d77d9bc0f706b3e9a103297b",
  }]],
  ["apps/admin/lib/publication.ts", [{
    release: beforeEgressRecoveryRelease,
    before: "bc668f90abd99c3e449ce8e59165543011d7269aaa0d19fcc4c7707875ab433e",
    after: "556703089fbf11efef99806c15e319602ad63fef2fc1802d597063adef0e04e8",
  }]],
]);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Read the pinned prior release only when an exact reviewed source matches. */
export function projectPublicationImageFix(relativePath, source) {
  let projected = source;
  for (const binding of files.get(relativePath) ?? []) {
    if (sha256(projected.replace(/\r\n?/gu, "\n")) !== binding.after) continue;
    const previous = execFileSync("git", ["show", `${binding.release}:${relativePath}`], {
      cwd: repository, encoding: "utf8",
    }).replace(/\r\n?/gu, "\n");
    if (sha256(previous) !== binding.before) {
      throw new Error(`Historical publication image source has changed: ${relativePath}`);
    }
    projected = previous;
  }
  return projected;
}
