import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const beforeImagePreparationRelease = "ef750cbb90c4e07100253a4580e8b422dab05115";
const beforeEgressRecoveryRelease = "51b5c255d9e2822c17dda4c69b47d66e9b7fb831";
const beforeEditorialPublicationReliability = "0ec07b46c1d7eef93b224c7034f9dfca765c4935";
const beforePublicationDefenseRelease = "67b486d8970403c5037007c49dd3455c24783fa3";
const repository = fileURLToPath(new URL("../../", import.meta.url));
const files = new Map([
  ["scripts/prepare-public-images.mjs", [{
    release: beforePublicationDefenseRelease,
    before: "33957008d25ef2c6f7f0aaf165ad249ab59b8ce549bc574a20bbc8f19f4867a8",
    after: "ffc6fe1287e63a7750c492db4b46141fb438073ed53dc25029e2302399e5aeaf",
  }, {
    release: beforeEgressRecoveryRelease,
    before: "480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79",
    after: "33957008d25ef2c6f7f0aaf165ad249ab59b8ce549bc574a20bbc8f19f4867a8",
  }, {
    release: beforeImagePreparationRelease,
    before: "d18e8f9310b03e0bc5324757034a92f4976c1edc4f8e3f16772588b5e076ee6d",
    after: "480b6b7e1d3c70bb0c2a64f1ffb95e0d17dcea2aa560c09de298d70fedd1ed79",
  }]],
  ["scripts/prepare-public-images.test.mjs", [{
    release: beforePublicationDefenseRelease,
    before: "61e91401fe3b89226d9540fe713b28da0ad6c3b3188827abea37a0b39d228ffe",
    after: "a64eee53f7aae651901bfe788e2f55b8cacf11f9f7973e7413dbe8a1afa7b593",
  }, {
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
    release: beforePublicationDefenseRelease,
    before: "4f51ee1be6a052c69be261a95d54d6d872ba24a1e98aaf71119da13d8d509057",
    after: "6596db35cd763eb310dd6cec66de450f4cf62df212c270d9355c4d68949bf9bd",
  }, {
    release: beforeEditorialPublicationReliability,
    before: "66247c832c92e789005ee2b028b0cd2ca32a1883d77d9bc0f706b3e9a103297b",
    after: "4f51ee1be6a052c69be261a95d54d6d872ba24a1e98aaf71119da13d8d509057",
  }, {
    release: beforeEgressRecoveryRelease,
    before: "30f5568f71fb4dc8098d3a0ca9c8bfd9fb0fe456ad025915eccdc584bcc6abd7",
    after: "66247c832c92e789005ee2b028b0cd2ca32a1883d77d9bc0f706b3e9a103297b",
  }]],
  ["apps/admin/lib/publication.ts", [{
    release: beforeEgressRecoveryRelease,
    before: "bc668f90abd99c3e449ce8e59165543011d7269aaa0d19fcc4c7707875ab433e",
    after: "556703089fbf11efef99806c15e319602ad63fef2fc1802d597063adef0e04e8",
  }]],
  ["apps/admin/app/(dashboard)/articles/atomic-standard-save-action.ts", [{
    release: beforePublicationDefenseRelease,
    before: "56c1459ee6a13135b9c6490306804f127546adaa9e1cd9af8e17159c346a7b8a",
    after: "522de8aa78a7c6ef84d2eab9a2ca6415307bc16a8bd87146d6149e43c2701be2",
  }, {
    release: beforeEditorialPublicationReliability,
    before: "e28aad301592b976edc277775c56ef625aaa5dbe78a52881083daf9aef4ace33",
    after: "56c1459ee6a13135b9c6490306804f127546adaa9e1cd9af8e17159c346a7b8a",
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
