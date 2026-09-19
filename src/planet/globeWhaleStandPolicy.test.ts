import { describe, expect, it } from "vitest";
import { baseEditionPolicy } from "./baseEditionPolicy";
import { GLOBE_STAND_IDS, INCLUDED_GLOBE_STANDS, isIncludedGlobeStandId } from "./globeStands";
import { DEFAULT_GLOBE_COMPOSITION_SELECTION, parseGlobeComposition, serializeGlobeComposition,
  validateGlobeCompositionSelection } from "./globeComposition";

const whales = "stand.base.three-whales" as const;

describe("the explicitly included canonical three-whale derivative", () => {
  it("binds the exact selectable ID to the existing canonical requirement without inventing a purchase or approval", () => {
    expect(GLOBE_STAND_IDS.filter(id => id === whales)).toHaveLength(1);
    expect(isIncludedGlobeStandId(whales)).toBe(true);
    const descriptor = INCLUDED_GLOBE_STANDS.find(item => item.id === whales);
    expect(descriptor).toMatchObject({ id: whales, sourceItemId: "canonical-globe",
      source: "src/components/globeWhaleStandGeometry.ts",
      canonicalSource: "src/components/LiteraryGlobe.tsx#MythicGlobeFrame",
      provenance: "canonical-site-derived", commercialAvailability: "included-in-base",
      supportedAccess: "adult", iapSkuAllowed: false, childReviewed: false, rightsReviewed: false,
      grantsEntitlement: false, releaseReady: false });
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(baseEditionPolicy.classify(whales)).toEqual({ included: true, canonicalId: "canonical-globe",
      reason: "included-in-base", iapSkuAllowed: false, grantsEntitlement: false });
    const starter = baseEditionPolicy.getSnapshot().starterItems;
    expect(starter).toHaveLength(29);
    expect(starter.filter(item => item.id === "canonical-globe")).toHaveLength(1);
    expect(starter.some(item => String(item.id) === whales)).toBe(false);
    for (const platform of ["web-pwa", "android-google", "android-rustore", "ios-ipados"]) {
      expect(baseEditionPolicy.validateOptionalSkuMapping({ itemId: whales, sku: "test.whale.stand", platform }))
        .toEqual({ allowed: false, canonicalId: "canonical-globe", reason: "included-in-base", grantsEntitlement: false });
    }
    for (const unknown of ["stand.base.three-whales-extra", "stand.base.three-whales ", "three-whales", "canonical-globe"]) {
      expect(isIncludedGlobeStandId(unknown), unknown).toBe(false);
    }
  });

  it("round-trips the explicit stand identity while keeping edition/background and rejecting child access", () => {
    const selection = { ...DEFAULT_GLOBE_COMPOSITION_SELECTION, editionId: "natural-earth-2026" as const,
      standId: whales, backgroundId: "background.base.library" as const };
    const record = { schemaVersion: 1, commitId: "whale-fixture:1", selection };
    const encoded = serializeGlobeComposition(record);
    expect(encoded).not.toBeNull();
    const decoded = parseGlobeComposition(encoded);
    expect(decoded).toEqual(record); expect(decoded?.selection.standId).toBe(whales);
    expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded?.selection)).toBe(true);
    for (const qualityTier of ["high", "balanced", "economy"]) {
      expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access: "adult" })).toBe(true);
      expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access: "child" })).toBe(false);
      expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access: "blocked" })).toBe(false);
    }
  });
});
