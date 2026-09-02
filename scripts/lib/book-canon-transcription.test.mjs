import { describe, expect, it } from "vitest";

import { registryItemHash } from "./book-canon-registry.mjs";
import {
  canonInventoryTranscriptionProjection,
  canonItemTranscriptionProjection,
  canonSourceTranscriptionProjection,
  mergeExactCanonItemAdjudications,
  preserveCanonSourceEditorialFields,
  replaceCanonInventoryInSourceOrder,
  sameCanonTranscription,
} from "./book-canon-transcription.mjs";

const sourceId = "official-list";

function freshItem() {
  const item = {
    ordinal: 1,
    itemId: "official-001-work",
    itemUrl: "https://example.gov/item/1",
    titleExact: "Exact Work",
    contributorExact: "Exact Author",
    candidateKind: "unclassified",
    entityKind: "unresolved",
    adjudicationStatus: "pending-review",
    adjudicatedRecordKey: null,
  };
  item.itemHash = registryItemHash(sourceId, item);
  return item;
}

describe("canon source transcription projection", () => {
  it("ignores editorial source and item fields while retaining immutable transcription", () => {
    const fresh = freshItem();
    const reviewed = {
      ...fresh,
      candidateKind: "work",
      entityKind: "work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey: "country:writer:work",
      adjudicationReason: "Exact manual Work identity review.",
      itemHash: "changed-with-editorial-classification",
    };
    expect(canonItemTranscriptionProjection(reviewed)).toEqual(
      canonItemTranscriptionProjection(fresh)
    );
    expect(
      sameCanonTranscription(
        canonInventoryTranscriptionProjection({ sourceId, items: [reviewed] }),
        canonInventoryTranscriptionProjection({ sourceId, items: [fresh] })
      )
    ).toBe(true);

    const source = {
      id: sourceId,
      authorityId: "authority",
      class: "official-curriculum",
      scope: "global-curated-collection",
      url: "https://example.gov/list",
      snapshot: { contentSha256: "a".repeat(64) },
      declaredItemCount: 1,
      inventoryStatus: "transcribed",
      coverageStatus: "in-progress",
      notes: "Fresh transcription.",
    };
    expect(
      canonSourceTranscriptionProjection({
        ...source,
        inventoryStatus: "adjudicated",
        coverageStatus: "adjudicated",
        notes: "Manual review completed.",
      })
    ).toEqual(canonSourceTranscriptionProjection(source));
  });

  it("preserves adjudication only for an exact unchanged source row", () => {
    const fresh = freshItem();
    const reviewed = {
      ...fresh,
      candidateKind: "work",
      entityKind: "work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey: "country:writer:work",
      adjudicatedAt: "2026-09-02",
      adjudicatedBy: "Manual reviewer",
      adjudicationReason: "Exact manual Work identity review.",
      adjudicationEvidenceUrls: [
        "https://example.gov/item/1",
        "https://example.gov/list",
      ],
    };
    reviewed.itemHash = registryItemHash(sourceId, reviewed);

    const merged = mergeExactCanonItemAdjudications(
      sourceId,
      [fresh],
      { sourceId, items: [reviewed] }
    );
    expect(merged.preservedCount).toBe(1);
    expect(merged.allItemsPreserved).toBe(true);
    expect(merged.items[0]).toMatchObject({
      candidateKind: "work",
      entityKind: "work",
      adjudicationStatus: "accepted",
      adjudicatedRecordKey: "country:writer:work",
    });
    expect(merged.items[0].itemHash).toBe(
      registryItemHash(sourceId, merged.items[0])
    );

    const changed = { ...fresh, titleExact: "Changed upstream title" };
    changed.itemHash = registryItemHash(sourceId, changed);
    const reset = mergeExactCanonItemAdjudications(
      sourceId,
      [changed],
      { sourceId, items: [reviewed] }
    );
    expect(reset.preservedCount).toBe(0);
    expect(reset.allItemsPreserved).toBe(false);
    expect(reset.items[0]).toMatchObject({
      candidateKind: "unclassified",
      entityKind: "unresolved",
      adjudicationStatus: "pending-review",
      adjudicatedRecordKey: null,
    });
  });

  it("preserves source review status only when every row was preserved", () => {
    const fresh = {
      id: sourceId,
      inventoryStatus: "transcribed",
      coverageStatus: "in-progress",
      notes: "Fresh transcription.",
    };
    const reviewed = {
      ...fresh,
      inventoryStatus: "adjudicated",
      coverageStatus: "adjudicated",
      notes: "Manual review completed.",
    };
    expect(preserveCanonSourceEditorialFields(fresh, reviewed, true)).toEqual(
      reviewed
    );
    expect(preserveCanonSourceEditorialFields(fresh, reviewed, false)).toEqual(
      fresh
    );
  });

  it("replaces a refreshed inventory without changing authority source order", () => {
    const registry = {
      sources: [{ id: "neb" }, { id: "loc" }, { id: "bnf" }],
      inventories: [
        { sourceId: "neb", items: ["neb-old"] },
        { sourceId: "loc", items: ["loc-old"] },
        { sourceId: "bnf", items: ["bnf-old"] },
      ],
    };

    expect(replaceCanonInventoryInSourceOrder(registry, "loc", ["loc-new"])).toEqual([
      { sourceId: "neb", items: ["neb-old"] },
      { sourceId: "loc", items: ["loc-new"] },
      { sourceId: "bnf", items: ["bnf-old"] },
    ]);
    expect(() =>
      replaceCanonInventoryInSourceOrder(
        { ...registry, inventories: registry.inventories.slice(0, 2) },
        "loc",
        ["loc-new"]
      )
    ).toThrow("Canon inventory is missing for source bnf");
  });
});
