import { describe, expect, it } from "vitest";
import { createIncludedGlobeBackground } from "../components/globeBackgroundGeometry";
import { baseEditionPolicy } from "./baseEditionPolicy";
import { GLOBE_BACKGROUNDS, GLOBE_BACKGROUND_IDS, isGlobeBackgroundId } from "./globeBackgrounds";
import { parseGlobeComposition, serializeGlobeComposition, validateGlobeCompositionSelection } from "./globeComposition";

const study = "background.base.writer-study" as const;

describe("the mandatory included writer study", () => {
  it("binds STARTER-012 to the real background and preserves the whole adult composition without purchase or child authority", () => {
    const snapshot = baseEditionPolicy.getSnapshot();
    expect(snapshot.starterItems).toHaveLength(29);
    expect(snapshot.starterItems.filter(item => item.id === study)).toEqual([
      { requirementId: "STARTER-012", id: study, category: "background", commercialAvailability: "included-in-base", iapSkuAllowed: false },
    ]);
    expect(snapshot.ownerAdditions.some(item => String(item.id) === study)).toBe(false);
    expect(baseEditionPolicy.classify(study)).toEqual({ included: true, canonicalId: study,
      reason: "included-in-base", iapSkuAllowed: false, grantsEntitlement: false });
    expect(GLOBE_BACKGROUND_IDS.filter(id => id === study)).toHaveLength(1);
    expect(isGlobeBackgroundId(study)).toBe(true);
    const descriptor = GLOBE_BACKGROUNDS.find(item => item.id === study);
    expect(descriptor).toMatchObject({ source: "src/components/globeWriterStudyGeometry.ts", sceneId: "probpera-writer-study-3d",
      commercialAvailability: "included-in-base", provenance: "authored-in-project", supportedAccess: "adult",
      childReviewed: false, rightsReviewed: false, grantsEntitlement: false, releaseReady: false });
    expect(Object.isFrozen(descriptor)).toBe(true);
    for (const platform of ["web-pwa", "android-google", "android-rustore", "ios-ipados"]) {
      expect(baseEditionPolicy.validateOptionalSkuMapping({ itemId: study, sku: "test.writer.study", platform }))
        .toEqual({ allowed: false, canonicalId: study, reason: "included-in-base", grantsEntitlement: false });
    }
    const record = { schemaVersion: 1, commitId: "writer-study-fixture:1", selection: {
      editionId: "natural-earth-2026", standId: "stand.base.portrait-tolstoy", backgroundId: study,
    } };
    const encoded = serializeGlobeComposition(record);
    expect(encoded).not.toBeNull();
    const decoded = parseGlobeComposition(encoded);
    expect(decoded).toEqual(record);
    expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded?.selection)).toBe(true);
    record.selection.editionId = "behaim-1492";
    expect(decoded?.selection.editionId).toBe("natural-earth-2026");
    expect(decoded?.selection.standId).toBe("stand.base.portrait-tolstoy");
    for (const qualityTier of ["high", "balanced", "economy"]) {
      expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access: "adult" })).toBe(true);
      for (const access of ["child", "blocked"]) expect(validateGlobeCompositionSelection(decoded?.selection, { qualityTier, access })).toBe(false);
    }
    for (const unknown of ["writer-study", "background.base.writer-study-extra", "background.base.writer-study ", "background.base.child-room"]) {
      expect(isGlobeBackgroundId(unknown), unknown).toBe(false);
      expect(serializeGlobeComposition({ ...record, selection: { ...record.selection, backgroundId: unknown } })).toBeNull();
      expect(() => createIncludedGlobeBackground(unknown as never, "high")).toThrow("Invalid included globe background");
    }
    expect(() => createIncludedGlobeBackground("background.base.site-starfield", "high"))
      .toThrow("The canonical background is owned by the existing scene");
  });
});
