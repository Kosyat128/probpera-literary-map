import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildDuplicateResolutionApplication,
  duplicateResolutionApplicationIssues,
  duplicateResolutionIssues,
  duplicateResolutionManifestFingerprint,
  openLibraryIdentityFromUrl,
  targetResolutionFingerprint,
} from "./book-canon-duplicate-resolutions.mjs";
import { archiveRawBooks } from "../archive-source.ts";

async function fixture(relativePath) {
  return JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8")
  );
}

async function checkedInFixtures() {
  const [manifest, canonRegistry, enrichmentManifest] = await Promise.all([
    fixture("../../data/book-canon-duplicate-resolutions-batch01.json"),
    fixture("../../data/book-canon-source-registry.json"),
    fixture("../../data/book-enrichment-manifest.json"),
  ]);
  return { manifest, canonRegistry, enrichmentManifest };
}

function clone(value) {
  return structuredClone(value);
}

function liveApplicationRecords() {
  return archiveRawBooks.map((record) => ({
    ...record,
    recordKey: `${record.countryId}:${record.writerId}:${record.id}`,
  }));
}

describe("reviewed canon duplicate resolutions batch 01", () => {
  it("passes the source, hold-reference, observed-input and fingerprint contract", async () => {
    const fixtures = await checkedInFixtures();

    expect(
      duplicateResolutionIssues(fixtures.manifest, fixtures)
    ).toEqual([]);
    expect(fixtures.manifest.applicationStatus).toBe("generator-approved");
    expect(fixtures.manifest.manifestFingerprint).toBe(
      duplicateResolutionManifestFingerprint(fixtures.manifest)
    );
    expect(
      fixtures.manifest.targets.every(
        (target) =>
          target.reviewFingerprint === targetResolutionFingerprint(target)
      )
    ).toBe(true);
  });

  it("fails closed when the canon registry fixture is unavailable", async () => {
    const fixtures = await checkedInFixtures();
    const records = liveApplicationRecords();

    expect(
      duplicateResolutionIssues(fixtures.manifest, {
        canonRegistry: null,
        enrichmentManifest: fixtures.enrichmentManifest,
      })
    ).toContain("canon-registry-required");
    expect(
      duplicateResolutionApplicationIssues(fixtures.manifest, {
        canonRegistry: null,
        enrichmentManifest: fixtures.enrichmentManifest,
        records,
      })
    ).toContain("canon-registry-required");
    expect(() =>
      buildDuplicateResolutionApplication(fixtures.manifest, {
        canonRegistry: null,
        enrichmentManifest: fixtures.enrichmentManifest,
        records,
      })
    ).toThrow(/canon-registry-required/u);
  });

  it("cannot approve or execute a decision owned by a held target", async () => {
    const fixtures = await checkedInFixtures();
    const held = clone(fixtures.manifest);
    const heldTarget = held.targets[0];
    const approvedDecisionId = heldTarget.decisions[0].decisionId;

    heldTarget.reviewStatus = "held";
    heldTarget.reviewFingerprint = targetResolutionFingerprint(heldTarget);
    held.summary.acceptedTargetCount -= 1;
    held.summary.heldTargetCount += 1;
    held.summary.potentiallyUnblockedCanonHoldCount -= 1;
    held.manifestFingerprint = duplicateResolutionManifestFingerprint(held);

    const expectedIssue =
      `activation cannot approve decision from non-accepted target ${approvedDecisionId}`;
    expect(duplicateResolutionIssues(held, fixtures)).toContain(expectedIssue);
    expect(
      duplicateResolutionApplicationIssues(held, {
        ...fixtures,
        records: liveApplicationRecords(),
      })
    ).toContain(expectedIssue);
    expect(() =>
      buildDuplicateResolutionApplication(held, {
        ...fixtures,
        records: liveApplicationRecords(),
      })
    ).toThrow(/cannot approve decision from non-accepted target/u);
  });

  it("records ten accepted blockers, eleven positive decisions and one preserved manifestation hold", async () => {
    const { manifest } = await checkedInFixtures();
    const decisions = manifest.targets.flatMap((target) => target.decisions);

    expect(manifest.targets).toHaveLength(10);
    expect(manifest.summary).toMatchObject({
      targetCount: 10,
      acceptedTargetCount: 10,
      heldTargetCount: 0,
      potentiallyUnblockedCanonHoldCount: 10,
      decisionCounts: { merge: 10, alias: 1, hold: 1 },
    });
    expect(decisions.filter((decision) => decision.status !== "hold")).toHaveLength(
      11
    );
    expect(decisions.filter((decision) => decision.status === "hold")).toEqual([
      expect.objectContaining({
        decisionId: "hold-thoreau-ol55661w-as-multiwork-manifestation",
        entityKind: "manifestation",
        to: null,
      }),
    ]);
    expect(manifest.activation.approvedDecisionIds).toHaveLength(11);
    expect(manifest.activation.excludedDecisionIds).toEqual([
      "hold-thoreau-ol55661w-as-multiwork-manifestation",
    ]);
  });

  it("pins the production-safe survivors and the exact Huckleberry Finn alias", async () => {
    const { manifest } = await checkedInFixtures();
    const decisions = new Map(
      manifest.targets
        .flatMap((target) => target.decisions)
        .map((decision) => [decision.decisionId, decision])
    );

    expect(
      decisions.get("merge-franklin-ol2514745w-into-ol26610w").to.value
    ).toBe("usa:benjamin_franklin:openlibrary-works-ol26610w");
    expect(
      decisions.get("merge-thoreau-ol21138836w-into-ol55649w").to.value
    ).toBe("usa:henry_david_thoreau:openlibrary-works-ol55649w");
    expect(
      decisions.get("merge-london-ol144705w-into-ol14942956w").to.value
    ).toBe("usa:jack_london:openlibrary-works-ol14942956w");
    expect(decisions.get("merge-maupassant-ol93822w-into-ol93840w").to.value).toBe(
      "france:maupassant:openlibrary-works-ol93840w"
    );
    expect(decisions.get("merge-zola-ol3521623w-into-ol7982341w").to.value).toBe(
      "france:emile_zola:openlibrary-works-ol7982341w"
    );
    expect(decisions.get("alias-loc-full-huckleberry-title-to-ol53908w")).toMatchObject({
      status: "alias",
      from: {
        kind: "source-title",
        value: "The Adventures of Huckleberry Finn (Tom Sawyer’s Comrade).",
      },
      to: {
        kind: "record",
        value: "usa:mark_twain:openlibrary-works-ol53908w",
      },
    });
  });

  it("backs the Zola correction and withholds the imported Twain year", async () => {
    const { manifest } = await checkedInFixtures();
    const targetById = new Map(
      manifest.targets.map((target) => [target.targetId, target])
    );

    expect(targetById.get("emile-zola-therese-raquin").workYearResolution).toEqual({
      status: "authority-backed",
      value: 1867,
      sourceIds: ["bnf-zola-therese-raquin-work"],
      reason: expect.any(String),
    });
    expect(
      targetById.get("mark-twain-huckleberry-finn-title-alias")
        .workYearResolution
    ).toMatchObject({ status: "withheld", value: null });
  });

  it("builds only the activated plan and fails on a full endpoint projection change", async () => {
    const fixtures = await checkedInFixtures();
    const records = liveApplicationRecords();
    const plan = buildDuplicateResolutionApplication(fixtures.manifest, {
      ...fixtures,
      records,
    });

    expect(plan.merges).toHaveLength(10);
    expect(plan.aliases).toHaveLength(1);
    expect(plan.heldDecisions).toEqual([
      expect.objectContaining({
        decisionId: "hold-thoreau-ol55661w-as-multiwork-manifestation",
      }),
    ]);
    const changedRecords = clone(records);
    changedRecords.find(
      (record) =>
        record.recordKey ===
        "usa:william_faulkner:the-sound-and-the-fury-editorial"
    ).coverUrl = "/changed-reviewed-cover.webp";
    expect(
      duplicateResolutionApplicationIssues(fixtures.manifest, {
        ...fixtures,
        records: changedRecords,
      })
    ).toContain("targets[3].decisions[0] survivor merge projection is stale");
  });

  it("keeps project-owned editorial cards as lossless merge survivors", async () => {
    const { manifest } = await checkedInFixtures();
    const decisions = manifest.targets.flatMap((target) => target.decisions);
    const targetById = new Map(
      manifest.targets.map((target) => [target.targetId, target])
    );
    const survivorBySource = new Map(
      decisions
        .filter((decision) => decision.status === "merge")
        .map((decision) => [decision.from.value, decision.to.value])
    );

    expect(
      survivorBySource.get("usa:william_faulkner:openlibrary-works-ol82870w")
    ).toBe("usa:william_faulkner:the-sound-and-the-fury-editorial");
    expect(
      survivorBySource.get("usa:john_steinbeck:openlibrary-works-ol23205w")
    ).toBe("usa:john_steinbeck:the-grapes-of-wrath-editorial");
    expect(
      survivorBySource.get("usa:ernest_hemingway:openlibrary-works-ol63009w")
    ).toBe("usa:ernest_hemingway:for-whom-the-bell-tolls-editorial");
    expect(targetById.get("william-faulkner-sound-and-fury").sourceIds).toContain(
      "rsl-faulkner-shum-i-yarost"
    );
    expect(targetById.get("john-steinbeck-grapes-of-wrath").sourceIds).toContain(
      "rsl-steinbeck-grozdya-gneva"
    );
    expect(
      targetById.get("ernest-hemingway-for-whom-the-bell-tolls").sourceIds
    ).toContain("rsl-hemingway-po-kom-zvonit-kolokol");
  });

  it("converges both England Dorian Gray records on the Ireland Work", async () => {
    const { manifest } = await checkedInFixtures();
    const target = manifest.targets.find(
      (entry) => entry.targetId === "oscar-wilde-dorian-gray-cross-country"
    );

    expect(target.sourceIds).toEqual([
      "neb-wilde-dorian-gray-ru",
      "nli-wilde-dorian-gray-1891",
      "tcd-wilde-author-identity",
    ]);
    expect(target.decisions).toHaveLength(2);
    expect(new Set(target.decisions.map((decision) => decision.to.value))).toEqual(
      new Set([
        "ireland:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея",
      ])
    );
  });

  it("fails closed when evidence is not independent or uses Open Library as authority", async () => {
    const fixtures = await checkedInFixtures();
    const sameGroup = clone(fixtures.manifest);
    sameGroup.sourceAuthorities.find(
      (source) => source.sourceId === "nara-franklin-poor-richard-1758"
    ).independenceGroup = "united-states-library-of-congress";

    expect(duplicateResolutionIssues(sameGroup, fixtures)).toContain(
      "targets[0] lacks two independent official evidence groups"
    );

    const openLibraryEvidence = clone(fixtures.manifest);
    openLibraryEvidence.sourceAuthorities[0].url =
      "https://openlibrary.org/works/OL26610W";
    expect(duplicateResolutionIssues(openLibraryEvidence, fixtures)).toContain(
      "sourceAuthorities[0].url cannot use Open Library as evidence"
    );
  });

  it("recognizes only an exact HTTPS Open Library Work URL as an identity", () => {
    expect(
      openLibraryIdentityFromUrl("https://openlibrary.org/works/OL26610W")
    ).toBe("openlibrary:OL26610W");

    for (const value of [
      "http://openlibrary.org/works/OL26610W",
      "https://www.openlibrary.org/works/OL26610W",
      "https://openlibrary.org.example/works/OL26610W",
      "https://example.org/openlibrary.org/works/OL26610W",
      "https://openlibrary.org/authors/OL26610W",
      "https://openlibrary.org/works/OL26610W.json",
      "https://openlibrary.org/works/OL26610W/edition",
      "https://user:password@openlibrary.org/works/OL26610W",
      "not-a-url",
    ]) {
      expect(openLibraryIdentityFromUrl(value), value).toBe("");
    }
  });

  it("fails closed on a stale local-record or canon-item fingerprint", async () => {
    const fixtures = await checkedInFixtures();
    const staleInput = clone(fixtures.manifest);
    staleInput.targets[0].decisions[0].from.observedInputFingerprint = "0".repeat(64);
    staleInput.targets[0].reviewFingerprint = targetResolutionFingerprint(
      staleInput.targets[0]
    );
    staleInput.manifestFingerprint = duplicateResolutionManifestFingerprint(staleInput);

    expect(duplicateResolutionIssues(staleInput, fixtures)).toContain(
      "targets[0].decisions[0].from observed fingerprint is stale"
    );

    const staleCanon = clone(fixtures.manifest);
    staleCanon.targets[0].canonHoldRef.itemHash = "0".repeat(64);
    staleCanon.targets[0].reviewFingerprint = targetResolutionFingerprint(
      staleCanon.targets[0]
    );
    staleCanon.manifestFingerprint = duplicateResolutionManifestFingerprint(staleCanon);
    expect(duplicateResolutionIssues(staleCanon, fixtures)).toContain(
      "targets[0].canonHoldRef.itemHash is stale"
    );
  });

  it("detects a semantic edit even when JSON formatting changes are irrelevant", async () => {
    const { manifest } = await checkedInFixtures();
    const changed = clone(manifest);
    changed.targets[0].reviewReason += " Altered.";

    expect(targetResolutionFingerprint(changed.targets[0])).not.toBe(
      changed.targets[0].reviewFingerprint
    );
    expect(duplicateResolutionManifestFingerprint(changed)).not.toBe(
      changed.manifestFingerprint
    );
  });
});
