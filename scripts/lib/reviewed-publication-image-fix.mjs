import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const previousRelease = "ef750cbb90c4e07100253a4580e8b422dab05115";
const repository = fileURLToPath(new URL("../../", import.meta.url));
const files = new Map([
  ["scripts/prepare-public-images.mjs", {
    before: "d18e8f9310b03e0bc5324757034a92f4976c1edc4f8e3f16772588b5e076ee6d",
    after: "480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79",
  }],
  ["scripts/lib/reviewed-cms-preview-webgl-followup.mjs", {
    before: "37e60edabeacba4725fcd2f5f397926bd394bc50d31e176e6e6ac65f569e33dc",
    after: "5f27cfb2a244d414efc261c4d794c10a99338e64a969bc08315dc6311d82e59f",
  }],
]);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Read the prior release only for the two exact source files changed by this fix. */
export function projectPublicationImageFix(relativePath, source) {
  const binding = files.get(relativePath);
  if (!binding) return source;
  const normalized = source.replace(/\r\n?/gu, "\n");
  if (sha256(normalized) !== binding.after) return source;
  const previous = execFileSync("git", ["show", `${previousRelease}:${relativePath}`], {
    cwd: repository, encoding: "utf8",
  }).replace(/\r\n?/gu, "\n");
  if (sha256(previous) !== binding.before) {
    throw new Error(`Historical publication image source has changed: ${relativePath}`);
  }
  return previous;
}
