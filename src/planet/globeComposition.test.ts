import { describe, expect, it } from "vitest";
import { GLOBE_EDITIONS } from "./editions";
import { GLOBE_STAND_IDS } from "./globeStands";
import { GLOBE_BACKGROUND_IDS } from "./globeBackgrounds";
import {
  DEFAULT_GLOBE_COMPOSITION_SELECTION, GLOBE_COMPOSITION_MAX_LENGTH,
  isGlobeCompositionRecord, isGlobeCompositionSelection, parseGlobeComposition,
  serializeGlobeComposition, validateGlobeCompositionSelection,
} from "./globeComposition";

const record = () => ({ schemaVersion: 1, commitId: "fixture:1", selection: { ...DEFAULT_GLOBE_COMPOSITION_SELECTION } });
describe("bounded composition preference model", () => {
  it("validates the actual bundled catalog across supported qualities, never child authority", () => {
    for (const edition of GLOBE_EDITIONS.filter(item => item.visitorAvailable && item.status === "available")) {
      for (const standId of GLOBE_STAND_IDS) for (const backgroundId of GLOBE_BACKGROUND_IDS) {
        const selection = { editionId: edition.id, standId, backgroundId };
        for (const qualityTier of ["high", "balanced", "economy"]) {
          expect(validateGlobeCompositionSelection(selection, { qualityTier, access: "adult" })).toBe(true);
        }
        expect(validateGlobeCompositionSelection(selection, { qualityTier: "high", access: "child" })).toBe(false);
      }
    }
    expect(validateGlobeCompositionSelection(record().selection, { qualityTier: "ultra", access: "adult" })).toBe(false);
  });

  it("accepts JSON whitespace/order and returns a detached deeply frozen record", () => {
    const input = record();
    const reordered = JSON.stringify({ selection: input.selection, commitId: input.commitId, schemaVersion: 1 }, null, 2);
    const parsed = parseGlobeComposition(reordered)!;
    expect(parsed).toEqual(input);
    expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed.selection)).toBe(true);
    input.selection.standId = "stand.base.wood";
    expect(parsed.selection.standId).toBe("canonical");
    expect(serializeGlobeComposition(parsed)).toBe(JSON.stringify(record()));
  });

  it("rejects unknown IDs, legacy aliases and schema additions without normalizing authority", () => {
    for (const invalid of [
      { ...record(), schemaVersion: 2 }, { ...record(), approval: true },
      { ...record(), selection: { ...record().selection, editionId: "antique" } },
      { ...record(), selection: { ...record().selection, standId: "premium.unknown" } },
      { ...record(), selection: { ...record().selection, backgroundId: "grand-library-3d" } },
      { ...record(), selection: { ...record().selection, qualityTier: "high" } },
    ]) {
      expect(isGlobeCompositionRecord(invalid)).toBe(false);
      expect(parseGlobeComposition(JSON.stringify(invalid))).toBeNull();
      expect(serializeGlobeComposition(invalid)).toBeNull();
    }
  });

  it("rejects oversized, malformed and unsafe commit identifiers", () => {
    for (const value of [null, [], "{", " ".repeat(GLOBE_COMPOSITION_MAX_LENGTH + 1)]) expect(parseGlobeComposition(value)).toBeNull();
    for (const commitId of ["", "a".repeat(97), "../path", "raw prose text", "история", 4]) {
      expect(parseGlobeComposition(JSON.stringify({ ...record(), commitId }))).toBeNull();
    }
    expect(parseGlobeComposition(JSON.stringify({ ...record(), commitId: "a".repeat(96) }))).not.toBeNull();
  });

  it("does not invoke accessors or accept inherited/symbol mapping fields", () => {
    let accessed = false;
    const accessor = { ...record().selection };
    Object.defineProperty(accessor, "editionId", { enumerable: true, get() { accessed = true; throw new Error("secret"); } });
    expect(isGlobeCompositionSelection(accessor)).toBe(false); expect(accessed).toBe(false);
    expect(isGlobeCompositionSelection(Object.create(record().selection))).toBe(false);
    expect(isGlobeCompositionSelection({ ...record().selection, [Symbol("unknown")]: true })).toBe(false);
    expect(isGlobeCompositionRecord(new Proxy({}, { ownKeys() { throw new Error("unavailable"); } }))).toBe(false);
  });
});
