import { describe, expect, it } from "vitest";

import {
  assertPortraitCandidatePublishable,
  emptyPortraitRightsQueueEntry,
  isPortraitRightsBundleComplete,
  mergePortraitRightsQueue,
  portraitRightsBundleIssues,
  validatePortraitRightsQueue,
} from "./writer-portrait-rights-workflow.mjs";

const today = "2026-08-31";
const digest = "a".repeat(64);
const identityRegistry = {
  "russia:writer": { wikidataId: "Q100" },
  "france:published": { wikidataId: "Q200" },
};
const identityOptions = { today, identityRegistry };

function rosterRecord(overrides = {}) {
  return {
    key: "russia:writer",
    countryId: "russia",
    countryName: "Россия",
    writerId: "writer",
    writerName: "Писатель",
    ...overrides,
  };
}

function queueFor(entry) {
  return {
    schemaVersion: 1,
    updatedAt: today,
    policy: {
      worldwidePublicationRequired: true,
      aiGeneratedLikenessesAllowed: false,
      publicAssetReferencesAllowedBeforeClearance: false,
      publishableStatus: "licensed",
      unlicensedPresentation: "photo-not-published",
    },
    writers: [entry],
  };
}

function licensedEntry(overrides = {}) {
  const base = {
    ...emptyPortraitRightsQueueEntry(rosterRecord()),
    status: "licensed",
    candidate: {
      assetRef: `staging://writer-portraits/q100.webp#sha256=${digest}`,
      mediaKind: "photograph",
      subjectNameAtSource: "Writer",
      identityEvidenceUrl: "https://authority.example/writers/writer",
    },
    rights: {
      rightsHolder: "Documented photographer",
      creator: "Documented photographer",
      basis: "license",
      licenseName: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      licenseOrPermissionArtifactRef:
        "https://commons.wikimedia.org/w/index.php?title=File:Writer.jpg&oldid=123456",
      territory: "worldwide",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Writer.jpg",
      checkedAt: today,
    },
  };
  return {
    ...base,
    ...overrides,
    candidate: { ...base.candidate, ...(overrides.candidate || {}) },
    rights: { ...base.rights, ...(overrides.rights || {}) },
  };
}

describe("writer portrait rights workflow", () => {
  it("accepts a complete worldwide licensed portrait with identity and immutable evidence", () => {
    const entry = licensedEntry();
    expect(isPortraitRightsBundleComplete(entry, identityOptions)).toBe(true);
    expect(assertPortraitCandidatePublishable(entry, identityOptions)).toBe(true);
    expect(validatePortraitRightsQueue(queueFor(entry), [rosterRecord()], identityOptions)).toMatchObject({
      issues: [],
      summary: { readyForPublication: 1, completeRightsBundles: 1 },
    });
  });

  it("rejects a licensed asset whose QID belongs to another registry key", () => {
    const entry = licensedEntry({
      candidate: {
        assetRef: `staging://writer-portraits/q318473.webp#sha256=${digest}`,
      },
    });
    const issues = portraitRightsBundleIssues(entry, identityOptions);

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "staged-asset-writer-mismatch" })
    );
    expect(isPortraitRightsBundleComplete(entry, identityOptions)).toBe(false);
    expect(() => assertPortraitCandidatePublishable(entry, identityOptions)).toThrow(
      /staged-asset-writer-mismatch/u
    );
    expect(
      validatePortraitRightsQueue(
        queueFor(entry),
        [rosterRecord()],
        identityOptions
      ).summary.readyForPublication
    ).toBe(0);
  });

  it("rejects a licensed asset when no trusted identity binding is supplied", () => {
    expect(
      portraitRightsBundleIssues(licensedEntry(), { today }).map(
        (item) => item.code
      )
    ).toContain("writer-identity-binding-required");
  });

  it("accepts a documented historical likeness only for a subject who died before photography", () => {
    const entry = licensedEntry({
      candidate: {
        mediaKind: "historical-likeness",
        subjectDeathYear: 1682,
        historicalLikenessType: "icon",
      },
      rights: {
        rightsHolder: "Public domain under PD-old-100 and PD-Art",
        creator: "Anonymous icon painter documented by the museum",
        basis: "public-domain",
        licenseName: "PD-old-100 plus PD-Art",
        licenseUrl: "https://commons.wikimedia.org/wiki/Template:PD-Art",
      },
    });
    expect(portraitRightsBundleIssues(entry, identityOptions)).toEqual([]);
    expect(assertPortraitCandidatePublishable(entry, identityOptions)).toBe(true);
  });

  it("rejects a non-photographic likeness for a subject from the photography era", () => {
    const issues = portraitRightsBundleIssues(
      licensedEntry({
        candidate: {
          mediaKind: "historical-likeness",
          subjectDeathYear: 1900,
          historicalLikenessType: "painting",
        },
      }),
      identityOptions
    );
    expect(issues.map((item) => item.code)).toContain(
      "historical-likeness-era-invalid"
    );
  });

  it("accepts permission only when its closed evidence reference is SHA-bound", () => {
    const entry = licensedEntry({
      rights: {
        basis: "permission",
        licenseName: "Worldwide portrait publication permission",
        licenseUrl: "",
        licenseOrPermissionArtifactRef: `vault://legal/portrait-permissions/russia-writer.pdf#sha256=${digest}`,
      },
    });
    expect(portraitRightsBundleIssues(entry, identityOptions)).toEqual([]);
  });

  it.each([
    ["rightsHolder", "", "rights-holder-required"],
    ["creator", "Unknown author", "creator-required"],
    ["licenseName", "", "license-name-required"],
    ["licenseUrl", "http://example.org/license", "license-url-required"],
    ["licenseOrPermissionArtifactRef", "https://example.org/changeable", "immutable-rights-evidence-required"],
    ["territory", "Russia only", "worldwide-rights-required"],
    ["sourceUrl", "https://user:secret@example.org/file", "source-url-required"],
    ["checkedAt", "2025-01-01", "rights-check-date-invalid"],
  ])("fails closed when rights.%s is unsafe or incomplete", (field, value, code) => {
    const issues = portraitRightsBundleIssues(
      licensedEntry({ rights: { [field]: value } }),
      identityOptions
    );
    expect(issues.map((item) => item.code)).toContain(code);
  });

  it("rejects undocumented identity, AI-like media and a mutable asset reference", () => {
    const issues = portraitRightsBundleIssues(
      licensedEntry({
        candidate: {
          assetRef: "/assets/writer-portraits/writer.webp",
          mediaKind: "verified-historical-portrait",
          subjectNameAtSource: "",
          identityEvidenceUrl: "",
        },
      }),
      identityOptions
    );
    expect(issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "staged-asset-required",
        "real-photograph-required",
        "source-subject-name-required",
        "identity-evidence-required",
      ])
    );
  });

  it("allows an empty Commons research row but forbids staging before clearance", () => {
    const entry = emptyPortraitRightsQueueEntry(rosterRecord());
    expect(validatePortraitRightsQueue(queueFor(entry), [rosterRecord()], identityOptions).issues).toEqual([]);

    entry.candidate.assetRef = `staging://writer-portraits/russia/writer.webp#sha256=${digest}`;
    expect(
      validatePortraitRightsQueue(queueFor(entry), [rosterRecord()], identityOptions).issues.map(
        (item) => item.code
      )
    ).toContain("uncleared-asset-forbidden");
  });

  it("requires contact provenance before permission-needed", () => {
    const entry = {
      ...emptyPortraitRightsQueueEntry(rosterRecord()),
      status: "permission-needed",
    };
    const codes = validatePortraitRightsQueue(queueFor(entry), [rosterRecord()], identityOptions).issues.map(
      (item) => item.code
    );
    expect(codes).toContain("permission-contact-field-required");
    expect(codes).toContain("permission-basis-required");
    expect(codes).toContain("permission-worldwide-scope-required");
    expect(codes).toContain("permission-real-photograph-required");
    expect(codes).toContain("permission-identity-evidence-required");
  });

  it("keeps permission-received non-publishable until legal promotion and staging", () => {
    const entry = licensedEntry({
      status: "permission-received",
      candidate: { assetRef: "" },
      rights: {
        basis: "permission",
        licenseName: "Worldwide portrait publication permission",
        licenseUrl: "",
        licenseOrPermissionArtifactRef: `dms://legal/portrait-permissions/russia-writer.eml#sha256=${digest}`,
      },
    });
    const result = validatePortraitRightsQueue(queueFor(entry), [rosterRecord()], identityOptions);
    expect(result.issues).toEqual([]);
    expect(result.summary.readyForPublication).toBe(0);
    expect(() => assertPortraitCandidatePublishable(entry, { today })).toThrow(/not in licensed state/u);
  });

  it("rejects roster omissions, resolved extras, duplicate keys and mutable policy", () => {
    const expected = [rosterRecord(), rosterRecord({
      key: "france:second",
      countryId: "france",
      countryName: "Франция",
      writerId: "second",
      writerName: "Second",
    })];
    const duplicate = emptyPortraitRightsQueueEntry(rosterRecord());
    const queue = queueFor(duplicate);
    queue.policy.aiGeneratedLikenessesAllowed = true;
    queue.writers.push({ ...duplicate });
    const codes = validatePortraitRightsQueue(queue, expected, identityOptions).issues.map(
      (item) => item.code
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        "fail-closed-policy-invalid",
        "writer-key-duplicate",
        "missing-writer",
      ])
    );
  });

  it("preserves editorial progress while refreshing the exact no-portrait roster", () => {
    const first = rosterRecord();
    const second = rosterRecord({
      key: "france:second",
      countryId: "france",
      countryName: "France",
      writerId: "second",
      writerName: "Second",
    });
    const existing = queueFor({
      ...emptyPortraitRightsQueueEntry(first),
      status: "permission-needed",
      notes: "Contact established.",
      rights: {
        ...emptyPortraitRightsQueueEntry(first).rights,
        rightsHolder: "Agency",
        creator: "Photographer",
        basis: "permission",
        territory: "worldwide",
        sourceUrl: "https://example.org/writer",
      },
    });
    existing.writers.push(emptyPortraitRightsQueueEntry({
      ...first,
      key: "obsolete:writer",
      countryId: "obsolete",
    }));
    const merged = mergePortraitRightsQueue(existing, [first, second], today);
    expect(merged.writers.map((entry) => entry.key)).toEqual(["france:second", "russia:writer"]);
    expect(merged.writers.find((entry) => entry.key === first.key)).toMatchObject({
      status: "permission-needed",
      notes: "Contact established.",
    });
    expect(merged.writers.find((entry) => entry.key === second.key)?.status).toBe("commons-search");
  });

  it("retains a complete licensed row as the approval ledger after publication", () => {
    const missing = rosterRecord();
    const published = rosterRecord({
      key: "france:published",
      countryId: "france",
      countryName: "Франция",
      writerId: "published",
      writerName: "Published Writer",
    });
    const approval = licensedEntry({
      ...published,
      candidate: {
        assetRef: `staging://writer-portraits/q200.webp#sha256=${digest}`,
        subjectNameAtSource: "Published Writer",
      },
    });
    const existing = queueFor(approval);
    const merged = mergePortraitRightsQueue(existing, [missing], today, [missing, published]);
    expect(merged.writers.map((entry) => entry.key)).toEqual([
      "france:published",
      "russia:writer",
    ]);
    const validation = validatePortraitRightsQueue(merged, [missing], {
      ...identityOptions,
      publicRecords: [missing, published],
    });
    expect(validation.issues).toEqual([]);
    expect(validation.summary.approvalLedgerEntries).toBe(1);
  });
});
