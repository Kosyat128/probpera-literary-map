import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const beforeImagePreparationRelease = "ef750cbb90c4e07100253a4580e8b422dab05115";
const beforeEgressRecoveryRelease = "51b5c255d9e2822c17dda4c69b47d66e9b7fb831";
const repository = fileURLToPath(new URL("../../", import.meta.url));
const files = new Map([
  ["scripts/prepare-public-images.mjs", {
    release: beforeImagePreparationRelease,
    before: "d18e8f9310b03e0bc5324757034a92f4976c1edc4f8e3f16772588b5e076ee6d",
    after: "480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79",
  }],
  ["scripts/lib/reviewed-cms-preview-webgl-followup.mjs", {
    release: beforeImagePreparationRelease,
    before: "37e60edabeacba4725fcd2f5f397926bd394bc50d31e176e6e6ac65f569e33dc",
    after: "5f27cfb2a244d414efc261c4d794c10a99338e64a969bc08315dc6311d82e59f",
  }],
  [".github/workflows/deploy-pages.yml", {
    release: beforeEgressRecoveryRelease,
    before: "30f5568f71fb4dc8098d3a0ca9c8bfd9fb0fe456ad025915eccdc584bcc6abd7",
    after: "66247c832c92e789005ee2b028b0cd2ca32a1883d77d9bc0f706b3e9a103297b",
  }],
  ["apps/admin/lib/publication.ts", {
    release: beforeEgressRecoveryRelease,
    before: "bc668f90abd99c3e449ce8e59165543011d7269aaa0d19fcc4c7707875ab433e",
    after: "556703089fbf11efef99806c15e319602ad63fef2fc1802d597063adef0e04e8",
  }],
]);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Read the pinned prior release only when an exact reviewed source matches. */
export function projectPublicationImageFix(relativePath, source) {
  const binding = files.get(relativePath);
  if (!binding) return source;
  const normalized = source.replace(/\r\n?/gu, "\n");
  if (sha256(normalized) !== binding.after) return source;
  const previous = execFileSync("git", ["show", `${binding.release}:${relativePath}`], {
    cwd: repository, encoding: "utf8",
  }).replace(/\r\n?/gu, "\n");
  if (sha256(previous) !== binding.before) {
    throw new Error(`Historical publication image source has changed: ${relativePath}`);
  }
  return previous;
}
