import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseEditionPolicy, createBaseEditionPolicy, OWNER_ADDED_BASE_ITEMS } from "./baseEditionPolicy";
import { GLOBE_STAND_IDS, INCLUDED_GLOBE_STANDS, isIncludedGlobeStandId } from "./globeStands";
import { parseGlobeComposition, serializeGlobeComposition, validateGlobeCompositionSelection } from "./globeComposition";

const ids = ["stand.base.portrait-pushkin", "stand.base.portrait-hemingway", "stand.base.portrait-tolstoy"] as const;

describe("explicit owner-added ceramic portrait stands", () => {
  it("keeps three self-canonical additions separate from the immutable starter requirements and purchase authority", () => {
    const snapshot = baseEditionPolicy.getSnapshot();
    // The existing base policy suite pins this file's checksum. Read its real
    // identities here to detect an accidental 30th requirement or reassignment.
    const required = readFileSync(new URL("../../docs/mobile/requirements/v12/37_BASE_EDITION_STARTER_SET.csv", import.meta.url), "utf8")
      .trim().split(/\r?\n/u).slice(1).map(line => line.split(",", 3)[2]);
    expect(required).toHaveLength(29);
    expect(snapshot.starterItems.map(item => item.id)).toEqual(required);
    expect(snapshot.ownerAdditions).toBe(OWNER_ADDED_BASE_ITEMS);
    expect(snapshot.ownerAdditions.map(item => item.id)).toEqual(ids);
    expect(createBaseEditionPolicy().getSnapshot().ownerAdditions).toEqual(snapshot.ownerAdditions);
    expect(Object.isFrozen(snapshot)).toBe(true); expect(Object.isFrozen(snapshot.ownerAdditions)).toBe(true);
    for (const id of ids) {
      expect(required).not.toContain(id);
      expect(GLOBE_STAND_IDS.filter(value => value === id)).toHaveLength(1);
      expect(isIncludedGlobeStandId(id)).toBe(true);
      const addition = snapshot.ownerAdditions.find(item => item.id === id)!;
      expect(addition).toEqual({ id, category: "stand", inclusionBasis: "explicit-owner-request",
        commercialAvailability: "included-in-base", iapSkuAllowed: false });
      expect(Object.isFrozen(addition)).toBe(true);
      expect(() => Object.assign(addition, { id: "canonical-globe" })).toThrow();
      const descriptor = INCLUDED_GLOBE_STANDS.find(item => item.id === id);
      expect(descriptor).toMatchObject({ id, sourceItemId: id, source: "src/components/globeCeramicPortraitStandGeometry.ts",
        canonicalSource: null, contentVersion: 1, provenance: "authored-in-project", commercialAvailability: "included-in-base",
        supportedAccess: "adult", iapSkuAllowed: false, childReviewed: false, rightsReviewed: false, artReviewed: false,
        grantsEntitlement: false, releaseReady: false });
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(baseEditionPolicy.classify(id)).toEqual({ included: true, canonicalId: id,
        reason: "included-in-base", iapSkuAllowed: false, grantsEntitlement: false });
      expect(() => createBaseEditionPolicy([{ alias: id, includedItemId: "canonical-globe" }]))
        .toThrow("conflicting-base-edition-alias");
      for (const platform of ["web-pwa", "android-google", "android-rustore", "ios-ipados"]) {
        expect(baseEditionPolicy.validateOptionalSkuMapping({ itemId: id, sku: "test.portrait", platform }))
          .toEqual({ allowed: false, canonicalId: id, reason: "included-in-base", grantsEntitlement: false });
      }
    }
    for (const unknown of ["stand.base.portrait", "stand.base.portrait-other", "stand.base.portrait-pushkin-extra",
      "stand.base.portrait-pushkin ", "portrait-pushkin", "base.stand.portrait-pushkin"]) {
      expect(isIncludedGlobeStandId(unknown), unknown).toBe(false);
      expect(baseEditionPolicy.classify(unknown), unknown).toMatchObject({ included: false, canonicalId: null, grantsEntitlement: false });
    }
    expect(snapshot).toMatchObject({ grantsEntitlement: false, releaseReady: false });
  });

  it("round-trips each complete composition with its own portrait ID and preserves adult-only access at every tier", () => {
    for (const standId of ids) {
      const record = { schemaVersion: 1, commitId: "portrait-fixture:1", selection: {
        editionId: "natural-earth-2026", standId, backgroundId: "background.base.library",
      } };
      const encoded = serializeGlobeComposition(record);
      expect(encoded).not.toBeNull();
      const decoded = parseGlobeComposition(encoded);
      expect(decoded).toEqual(record);
      expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded?.selection)).toBe(true);
      record.selection.editionId = "behaim-1492";
      expect(decoded?.selection.editionId).toBe("natural-earth-2026");
      expect(decoded?.selection.backgroundId).toBe("background.base.library");
      for (const qualityTier of ["high", "balanced", "economy"]) {
        expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access: "adult" })).toBe(true);
        for (const access of ["child", "blocked"]) {
          expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access })).toBe(false);
        }
      }
      expect(serializeGlobeComposition({ ...record, selection: { ...record.selection, standId: `${standId}-extra` } })).toBeNull();
    }
  });
});
