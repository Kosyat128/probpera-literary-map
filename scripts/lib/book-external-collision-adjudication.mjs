import { createHash } from "node:crypto";

const EXCEPTION_TRIAGE = new Map([
  ["openlibrary:OL110951W", { classification: "joint-authored-work", expectedDisposition: "consolidate-with-explicit-authorship", note: "The imported cards name the same Borges/Bioy Casares collaboration; authorship still requires two independent records before consolidation." }],
  ["openlibrary:OL7910140W", { classification: "disputed-or-traditional-authorship", expectedDisposition: "consolidate-with-disputed-authorship", note: "Water Margin must not be assigned silently to either imported writer; the final relation must preserve the documented attribution dispute." }],
  ["openlibrary:OL26385W", { classification: "joint-authored-collection", expectedDisposition: "consolidate-with-explicit-authorship", note: "The collection contains work by Wordsworth and Coleridge and needs one work-level card with an ordered explicit byline." }],
  ["openlibrary:OL1095423W", { classification: "joint-authored-collection", expectedDisposition: "replace-with-complete-authorship", note: "The raw duplicate omits Charlotte Bronte from a collection published by Charlotte, Emily and Anne under their Bell pseudonyms." }],
  ["openlibrary:OL25758857W", { classification: "single-work-with-nonauthor-credit", expectedDisposition: "retain-proved-primary-author-only", note: "The provider record is for Andre Gide's Marshlands; the Dubravka Ugresic relation must remain quarantined until its credit is identified." }],
  ["openlibrary:OL59472W", { classification: "single-work-with-nonauthor-credit", expectedDisposition: "retain-proved-primary-author-only", note: "Eleven is a Patricia Highsmith collection; Graham Greene is not to be promoted as a co-author without a work-level authorship record." }],
  ["openlibrary:OL308575W", { classification: "single-work-with-nonauthor-credit", expectedDisposition: "retain-proved-primary-author-only", note: "Gitanjali is Tagore's work; Yeats's introductory contribution is not work-level authorship." }],
  ["openlibrary:OL55715W", { classification: "single-work-with-nonauthor-credit", expectedDisposition: "retain-proved-primary-author-only", note: "A Yankee in Canada is Thoreau's work; editorial participation by Emerson must not be represented as co-authorship." }],
  ["openlibrary:OL16538128W", { classification: "curated-anthology-imported-by-contents", expectedDisposition: "replace-contributor-links-with-editorial-credit", note: "The imported relations are authors of included texts, not the anthology's editorial byline; a clean work record must be built from authoritative edition data." }],
  ["openlibrary:OL141870W", { classification: "provider-work-aggregate-contamination", expectedDisposition: "replace-provider-identity", note: "The provider work merges I Malavoglia with unrelated author credits and editions; it cannot serve as the canonical external identity." }],
  ["openlibrary:OL85864W", { classification: "provider-work-aggregate-contamination", expectedDisposition: "replace-provider-identity", note: "The provider work contains Bram Stoker material but the surviving duplicate cards point to unrelated writers; all relations remain quarantined." }],
]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function collisionFingerprint(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function buildCollisionTriage({ audit, snapshot, reviewedAt }) {
  if (snapshot?.provider !== "Open Library") {
    throw new Error("Collision snapshot must come from Open Library");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(reviewedAt))) {
    throw new Error("reviewedAt must be an ISO calendar date");
  }
  const records = new Map(
    (snapshot.records || []).map((record) => [
      `openlibrary:${record.workId}`,
      record,
    ])
  );
  const groups = audit?.globalExternalIdDuplicates || [];
  if (groups.length !== snapshot.recordCount || records.size !== groups.length) {
    throw new Error("Collision audit and provider snapshot coverage differ");
  }

  const decisions = groups
    .map((group) => {
      const provider = records.get(group.externalId);
      if (!provider) {
        throw new Error(`Missing provider snapshot for ${group.externalId}`);
      }
      const triage = EXCEPTION_TRIAGE.get(group.externalId) || {
        classification: "composite-edition-or-contributor-import",
        expectedDisposition: "exclude-import-relations-after-source-review",
        note: "The provider identity is shared by cards for contributors to an anthology, textbook, omnibus or other composite publication; it is not evidence that every linked writer authored one work.",
      };
      const observedRelations = group.works.map((work) => ({
        identity: work.identity,
        writer: work.writer,
        title: work.title,
      }));
      return {
        externalId: group.externalId,
        providerTitle: provider.title,
        providerRecordSha256: provider.responseSha256,
        relationSetSha256: collisionFingerprint(observedRelations),
        relationCount: observedRelations.length,
        ...triage,
        reviewStatus: "independent-source-review-required",
        productionAction: "none",
      };
    })
    .sort((left, right) => left.externalId.localeCompare(right.externalId, "en"));

  return {
    schemaVersion: 1,
    purpose: "Exhaustive human triage of cross-writer Open Library Work collisions. Triage never mutates the public archive; a production action requires a separate two-source adjudication.",
    reviewedAt,
    sourceAudit: "reports/book-database-audit.json",
    sourceSnapshot: "data/book-collision-snapshots/openlibrary-work-metadata-2026-09-02.json",
    sourceSnapshotRecordsSha256: snapshot.recordsSha256,
    decisionCount: decisions.length,
    classifications: Object.fromEntries(
      [...new Set(decisions.map((decision) => decision.classification))]
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((classification) => [
          classification,
          decisions.filter((decision) => decision.classification === classification).length,
        ])
    ),
    productionActions: 0,
    decisionsSha256: collisionFingerprint(decisions),
    decisions,
  };
}

export function validateCollisionTriage({ audit, snapshot, triage }) {
  const expected = buildCollisionTriage({ audit, snapshot, reviewedAt: triage.reviewedAt });
  const issues = [];
  if (triage.schemaVersion !== 1) issues.push("unsupported-schema-version");
  if (triage.decisionCount !== 97) issues.push("expected-97-decisions");
  if (triage.productionActions !== 0) issues.push("triage-must-not-contain-production-actions");
  if (collisionFingerprint(triage) !== collisionFingerprint(expected)) {
    issues.push("triage-is-stale-or-was-edited-outside-generator");
  }
  return issues;
}

export const collisionExceptionIds = Object.freeze([...EXCEPTION_TRIAGE.keys()]);
