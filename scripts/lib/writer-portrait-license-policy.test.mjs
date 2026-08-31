import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { portraitRightsFromLicensedQueueEntry } from "./writer-portrait-rights-workflow.mjs";

import {
  applyKeyedPortraitFilenameOverrides,
  effectiveKeyedPortraitCandidate,
  licenseDecision,
  rejectionMatches,
} from "../sync-writer-portraits.mjs";

const syncSource = readFileSync(
  path.resolve(process.cwd(), "scripts/sync-writer-portraits.mjs"),
  "utf8"
).replace(/\r\n?/gu, "\n");

const metadataValue = (value) => ({ value });

function commonsImageInfo({
  licenseName = "CC BY 4.0",
  licenseUrl = "https://creativecommons.org/licenses/by/4.0/",
  categories = "Portrait photographs",
  creator,
} = {}) {
  return {
    extmetadata: {
      LicenseShortName: metadataValue(licenseName),
      LicenseUrl: metadataValue(licenseUrl),
      Categories: metadataValue(categories),
      ...(creator === undefined
        ? {}
        : { Artist: metadataValue(creator) }),
    },
  };
}

describe("writer portrait license policy", () => {
  it("lets a key-scoped reviewed override replace a stale Wikidata P18 filename", () => {
    const filenames = new Map([["Q1", "Painting.jpg"]]);

    applyKeyedPortraitFilenameOverrides(
      filenames,
      { "country:writer": { wikidataId: "Q1" } },
      { "country:writer": { filename: "Authenticated photograph.jpg" } }
    );

    expect(filenames.get("Q1")).toBe("Authenticated photograph.jpg");
  });

  it("checks Goncharov rejection against the effective override photograph", () => {
    const key = "russia:goncharov";
    const oldPainting = "Ivan Goncharov.jpg";
    const newPhotograph = "Ivan Goncharov (1880).jpg";
    const rejection = {
      filename: oldPainting,
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Ivan_Goncharov.jpg",
      reasonCode: "non-photographic-portrait",
    };
    const effective = effectiveKeyedPortraitCandidate(
      key,
      {
        wikidataId: "Q189665",
        live: { portraitFilename: oldPainting },
      },
      { [key]: { wikidataId: "Q189665" } },
      {
        [key]: {
          filename: newPhotograph,
          sourceUrl:
            "https://commons.wikimedia.org/wiki/File:Ivan_Goncharov_(1880).jpg",
        },
      }
    );

    expect(effective.filename).toBe(newPhotograph);
    expect(rejectionMatches(rejection, effective)).toBe(false);
    expect(rejectionMatches(rejection, { filename: oldPainting })).toBe(true);
    expect(
      rejectionMatches(
        {
          ...rejection,
          blockedSources: [{ filename: newPhotograph }],
        },
        effective
      )
    ).toBe(true);
  });

  it("computes the effective keyed filename before the public rejection gate", () => {
    const effectiveIndex = syncSource.indexOf(
      "const effectivePortrait = record"
    );
    const rejectionIndex = syncSource.indexOf(
      "rejectionMatches(rejection, {\n          filename: effectivePortrait.filename",
      effectiveIndex
    );

    expect(effectiveIndex).toBeGreaterThan(-1);
    expect(rejectionIndex).toBeGreaterThan(effectiveIndex);
    expect(syncSource).toContain(
      "for (const key of policyRejectedManifestEntries) delete manifestWriters[key];"
    );
  });

  it("rejects a Commons file categorized as copyrighted in the United States", () => {
    const decision = licenseDecision(
      commonsImageInfo({
        categories:
          "Portrait photographs|Works copyrighted in the U.S.|Photographs from Wikimedia Commons",
        creator: "Documented photographer",
      })
    );

    expect(decision).toMatchObject({
      allowed: false,
      reason: "territorial-or-use-restriction",
    });
  });

  it.each([
    "Items with disputed copyright information|Wrong license",
    "Deletion requests August 2026",
    "License review needed",
    "Files from YouTube needing license review",
  ])("rejects unresolved Commons rights state: %s", (categories) => {
    const decision = licenseDecision(
      commonsImageInfo({ categories, creator: "Documented photographer" })
    );

    expect(decision).toMatchObject({
      allowed: false,
      reason: "territorial-or-use-restriction",
    });
  });

  it("rejects a licensed Commons file without an attributable creator", () => {
    const decision = licenseDecision(commonsImageInfo());

    expect(decision).toMatchObject({
      allowed: false,
      status: "licensed",
      reason: "licensed-file-missing-attribution-creator",
    });
  });

  it("accepts a documented attribution override for otherwise missing creator metadata", () => {
    const decision = licenseDecision(
      commonsImageInfo(),
      "Creator verified in the source history"
    );

    expect(decision).toMatchObject({
      allowed: true,
      status: "licensed",
      creator: "Creator verified in the source history",
      reason: "",
    });
  });

  it("rejects a generic Wikimedia Attribution-only file without a scoped manual decision", () => {
    const decision = licenseDecision(
      commonsImageInfo({
        licenseName: "Attribution",
        licenseUrl: "",
        categories: "Attribution only license|Portrait photographs",
        creator: "Fringe Magazine",
      })
    );

    expect(decision.allowed).toBe(false);
  });

  it("accepts an exact Wikimedia Attribution-only file only with a scoped manual decision", () => {
    const decision = licenseDecision(
      commonsImageInfo({
        licenseName: "Attribution",
        licenseUrl: "",
        categories: "Attribution only license|Portrait photographs",
        creator: "Fringe Magazine",
      }),
      "Fringe Magazine",
      {
        kind: "wikimedia-attribution-only",
        licenseName: "Wikimedia Attribution-only license",
        licenseUrl: "https://commons.wikimedia.org/wiki/Template:Attribution",
      }
    );

    expect(decision).toMatchObject({
      allowed: true,
      status: "licensed",
      licenseName: "Wikimedia Attribution-only license",
      licenseUrl: "https://commons.wikimedia.org/wiki/Template:Attribution",
      creator: "Fringe Magazine",
    });
  });

  it("publishes the licensed queue bundle when Commons metadata is ambiguously public-domain", () => {
    const sourceUrl =
      "https://commons.wikimedia.org/wiki/File:Graham_Greene_angol_%C3%ADr%C3%B3,_1975_Fortepan_84697.jpg";
    const commonsDecision = licenseDecision(
      commonsImageInfo({
        licenseName: "Public domain",
        licenseUrl: "https://commons.wikimedia.org/wiki/Template:PD-US",
        categories: "Public domain photographs|Fortepan",
        creator: "FOTO:Fortepan",
      })
    );
    expect(commonsDecision.status).toBe("public-domain");

    const queueEntry = {
      key: "england:graham_greene",
      status: "licensed",
      candidate: {
        assetRef: `staging://writer-portraits/q128560.webp#sha256=${"b".repeat(64)}`,
        mediaKind: "photograph",
        subjectNameAtSource: "Graham Greene",
        identityEvidenceUrl: sourceUrl,
      },
      rights: {
        rightsHolder: "Fortepan / Magyar Hírek folyóirat",
        creator: "FOTO:Fortepan - ID 84697",
        basis: "license",
        licenseName: "Creative Commons Attribution-ShareAlike 3.0 Unported",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
        licenseOrPermissionArtifactRef:
          "https://commons.wikimedia.org/w/index.php?title=File:Graham_Greene_Fortepan.jpg&oldid=123456",
        territory: "worldwide",
        sourceUrl,
        checkedAt: "2026-08-31",
      },
    };
    const publishedRights = portraitRightsFromLicensedQueueEntry(queueEntry, {
      today: "2026-08-31",
      identityRegistry: {
        "england:graham_greene": { wikidataId: "Q128560" },
      },
    });

    expect(publishedRights).toEqual({
      status: "licensed",
      licenseName: "Creative Commons Attribution-ShareAlike 3.0 Unported",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      creator: "FOTO:Fortepan - ID 84697",
      sourceUrl,
      checkedAt: "2026-08-31",
    });
  });

  it("writes approved queue rights into the manifest block", () => {
    const manifestStart = syncSource.indexOf("manifestWriters[manifestKey] = {");
    const manifestEnd = syncSource.indexOf(
      "publicPortraitKeys.add(manifestKey);",
      manifestStart
    );
    const manifestBlock = syncSource.slice(manifestStart, manifestEnd);

    expect(manifestStart).toBeGreaterThan(-1);
    expect(manifestEnd).toBeGreaterThan(manifestStart);
    expect(manifestBlock).toContain(
      "portraitSourceUrl: approvedPortraitRights.sourceUrl"
    );
    expect(manifestBlock).toContain("portraitRights: approvedPortraitRights");
    expect(manifestBlock).not.toContain("portraitRights: portrait.portraitRights");
  });
});
