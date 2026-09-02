import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
const generatorPath = path.join(
  projectRoot,
  "scripts",
  "build-book-enrichment-manifest.mjs"
);
const outputPaths = [
  "data/book-enrichment-manifest.json",
  "reports/book-corpus-classification.json",
  "reports/book-corpus-classification.md",
  "src/data/countries/generated/books.reviewed.json",
  "src/data/countries/generated/books.enrichment-actions.json",
].map((relativePath) => path.join(projectRoot, relativePath));

const requiredStableMerges = {
  "england:j_r_r_tolkien:openlibrary-works-ol27482w":
    "england:j_r_r_tolkien:the-hobbit",
  "france:roger_martin_du_gard:openlibrary-works-ol32012067w":
    "france:roger_martin_du_gard:the-thibaults",
  "russia:nabrakov:openlibrary-works-ol627084w":
    "usa:vladimir_nabokov:lolita-editorial",
  "spain:miguel_de_cervantes:openlibrary-works-ol28166960w":
    "spain:miguel_de_cervantes:openlibrary-works-ol15272537w",
  "usa:herman_melville:openlibrary-works-ol102749w":
    "usa:herman_melville:moby-dick",
  "chile:pablo_neruda:openlibrary-works-ol979517w":
    "chile:pablo_neruda:twenty-love-poems",
  "egypt:naguib_mahfouz:openlibrary-works-ol1599682w":
    "egypt:naguib_mahfouz:the-thief-and-the-dogs",
  "egypt:naguib_mahfouz:openlibrary-works-ol1599712w":
    "egypt:naguib_mahfouz:midaq-alley",
};
const requiredCanonResolutionMerges = {
  "usa:benjamin_franklin:openlibrary-works-ol2514745w":
    "usa:benjamin_franklin:openlibrary-works-ol26610w",
  "usa:henry_david_thoreau:openlibrary-works-ol21138836w":
    "usa:henry_david_thoreau:openlibrary-works-ol55649w",
  "usa:jack_london:openlibrary-works-ol144705w":
    "usa:jack_london:openlibrary-works-ol14942956w",
  "usa:william_faulkner:openlibrary-works-ol82870w":
    "usa:william_faulkner:the-sound-and-the-fury-editorial",
  "usa:john_steinbeck:openlibrary-works-ol23205w":
    "usa:john_steinbeck:the-grapes-of-wrath-editorial",
  "usa:ernest_hemingway:openlibrary-works-ol63009w":
    "usa:ernest_hemingway:for-whom-the-bell-tolls-editorial",
  "france:maupassant:openlibrary-works-ol93822w":
    "france:maupassant:openlibrary-works-ol93840w",
  "france:emile_zola:openlibrary-works-ol3521623w":
    "france:emile_zola:openlibrary-works-ol7982341w",
  "england:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея":
    "ireland:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея",
  "england:oscar_wilde:openlibrary-works-ol8193416w":
    "ireland:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея",
};

function digestOutputs() {
  return outputPaths.map((outputPath) =>
    createHash("sha256").update(readFileSync(outputPath)).digest("hex")
  );
}

function runCheck() {
  return spawnSync(
    process.execPath,
    [generatorPath, "--check", "--date=2026-08-08"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: process.env,
    }
  );
}

describe("book enrichment generator", () => {
  it("is idempotent when a reviewed promotion output is loaded again", () => {
    const before = digestOutputs();
    const first = runCheck();
    const afterFirst = digestOutputs();
    const second = runCheck();
    const afterSecond = digestOutputs();

    expect(first.status, first.stderr || first.stdout).toBe(0);
    expect(second.status, second.stderr || second.stdout).toBe(0);
    expect(afterFirst).toEqual(before);
    expect(afterSecond).toEqual(before);

    const manifest = JSON.parse(readFileSync(outputPaths[0], "utf8"));
    const reviewed = JSON.parse(readFileSync(outputPaths[3], "utf8"));
    const actions = JSON.parse(readFileSync(outputPaths[4], "utf8"));
    const resolution = JSON.parse(
      readFileSync(
        path.join(
          projectRoot,
          "data/book-canon-duplicate-resolutions-batch01.json"
        ),
        "utf8"
      )
    );
    const promotedCount = Object.values(reviewed.works).flat().length;

    expect(reviewed.sourceManifestFingerprint).toBe(
      manifest.datasetFingerprint
    );
    expect(actions.sourceManifestFingerprint).toBe(
      manifest.datasetFingerprint
    );
    expect(actions.rejects).toEqual(manifest.safeActions.rejects);
    expect(actions.merges).toEqual(manifest.safeActions.merges);
    expect(actions.aliases).toEqual(manifest.safeActions.aliases);
    expect(actions.duplicateResolutionManifest).toEqual({
      manifestId: resolution.manifestId,
      fingerprint: resolution.manifestFingerprint,
    });
    expect(promotedCount).toBe(manifest.summary.curatedBaselineRecords);
    expect(promotedCount).toBe(20);
    expect(manifest.curatedBaseline).toEqual({
      records: 20,
      digest: manifest.summary.curatedBaselineDigest,
    });

    const mergeTargets = Object.fromEntries(
      actions.merges.map(({ from, into }) => [from, into])
    );
    for (const [from, into] of Object.entries(requiredStableMerges)) {
      expect(mergeTargets[from], from).toBe(into);
    }
    for (const [from, into] of Object.entries(requiredCanonResolutionMerges)) {
      expect(mergeTargets[from], from).toBe(into);
    }
    const safeMergeSources = new Set(actions.merges.map((action) => action.from));
    for (const action of actions.merges) {
      expect(
        safeMergeSources.has(action.into),
        `safe merge chain is forbidden: ${action.from} -> ${action.into}`
      ).toBe(false);
    }
    const reviewedCanonMerges = actions.merges.filter(
      (action) => action.basis === "canon-reviewed-work-identity-resolution"
    );
    expect(reviewedCanonMerges).toHaveLength(10);
    expect(
      reviewedCanonMerges.some(
        (action) =>
          action.from ===
          "usa:henry_david_thoreau:openlibrary-works-ol55661w"
      )
    ).toBe(false);
    expect(
      reviewedCanonMerges.find(
        (action) =>
          action.from ===
          "france:emile_zola:openlibrary-works-ol3521623w"
      )
    ).toMatchObject({
      workFirstPublishedStatus: "authority-backed",
      workFirstPublished: 1867,
    });
    expect(actions.aliases).toEqual([
      expect.objectContaining({
        recordKey: "usa:mark_twain:openlibrary-works-ol53908w",
        title:
          "The Adventures of Huckleberry Finn (Tom Sawyer’s Comrade).",
        basis: "canon-reviewed-exact-title-alias",
        resolutionId: "alias-loc-full-huckleberry-title-to-ol53908w",
        resolutionFingerprint: resolution.targets.find(
          (target) =>
            target.targetId === "mark-twain-huckleberry-finn-title-alias"
        ).reviewFingerprint,
        workFirstPublishedStatus: "withheld",
        workFirstPublished: null,
      }),
    ]);
    expect(
      manifest.records.find(
        (record) =>
          record.recordKey === "usa:mark_twain:openlibrary-works-ol53908w"
      )
    ).toMatchObject({
      status: "research",
      reasons: expect.arrayContaining([
        "canon-reviewed-publication-year-withheld",
        "resolution:alias-loc-full-huckleberry-title-to-ol53908w",
      ]),
    });
    expect(manifest.summary.archiveRecords).toBe(10_057);
    expect(manifest.summary.statuses.merge).toBe(57);
    expect(manifest.summary.statuses.research).toBe(9_719);
    expect(manifest.summary.archiveStatuses.merge).toBe(54);
    expect(manifest.summary.archiveStatuses.reject).toBe(242);
    expect(manifest.summary.canonReviewedIdentityMerges).toBe(10);
    expect(manifest.summary.canonReviewedTitleAliases).toBe(1);
    expect(manifest.summary.canonReviewedHeldManifestations).toBe(1);
  }, 30_000);
});
