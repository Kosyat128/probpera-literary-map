import { describe, expect, it, vi } from "vitest";
import { childPayloadBytes, decodeChildEntityPayload } from "./childPackage";
import { decodeChildReadingAnchors, decodeChildReadingPosition, decodeChildNativeReadingPosition,
  resolveChildReadingPosition, sameChildReadingPosition } from "./childReadingPosition";
const hash = "a".repeat(64), reference = { kind: "activity" as const, id: "Chapter-A", contentChecksum: hash };
const position = { schemaVersion: 1 as const, entity: { kind: reference.kind, id: reference.id }, anchorVersion: 3, anchorId: "Opening" };
function alignment(text = "Hello\nWorld") { return { schemaVersion: 1, anchorVersion: 3,
  segments: [{ anchorId: "Opening", text: text.slice(0, 6) }, { anchorId: "End", text: text.slice(6) }], narration: null }; }
describe("S16 BIL009 canonical reading position codec", () => {
  it("keeps canonical entity and anchor identity across explicitly aligned RU and EN without localized offsets", () => {
    const ru = decodeChildReadingAnchors(alignment("ПриветМир"), "ПриветМир")!;
    const en = decodeChildReadingAnchors(alignment(), "Hello\nWorld")!;
    expect(resolveChildReadingPosition(position, ru, reference)?.anchorId).toBe("Opening");
    expect(resolveChildReadingPosition(position, en, reference)?.anchorId).toBe("Opening");
    expect(decodeChildReadingPosition(position)).toEqual(position);
    expect(Object.keys(decodeChildReadingPosition(position)!)).toEqual(["schemaVersion", "entity", "anchorVersion", "anchorId"]);
  });
  it("preserves legacy four-field payload bytes and includes only explicitly owned valid anchors", () => {
    const legacy = { title: "Original", text: "Hello\nWorld", terms: [], references: [] };
    expect(new TextDecoder().decode(childPayloadBytes(legacy))).toBe(JSON.stringify(legacy));
    expect(decodeChildEntityPayload(legacy)).not.toHaveProperty("readingAnchors");
    const authored = { ...legacy, readingAnchors: alignment() };
    expect(new TextDecoder().decode(childPayloadBytes(decodeChildEntityPayload(authored)!))).toBe(JSON.stringify(authored));
    expect(decodeChildEntityPayload({ ...legacy, readingAnchors: undefined })).toBeNull();
    expect(() => childPayloadBytes({ ...legacy, readingAnchors: undefined } as unknown as Parameters<typeof childPayloadBytes>[0])).toThrow();
  });
  it("refuses unknown schemas duplicate IDs holes inconsistent text and inferred empty segments", () => {
    const valid = alignment();
    for (const malformed of [
      { ...valid, schemaVersion: 2 }, { ...valid, anchorVersion: 0 }, { ...valid, anchorVersion: -0 },
      { ...valid, segments: [] }, { ...valid, segments: [valid.segments[0], valid.segments[0]] },
      { ...valid, segments: [valid.segments[0], { anchorId: "End", text: "" }] },
      { ...valid, segments: [, valid.segments[1]] }, { ...valid, extra: true },
    ]) expect(decodeChildReadingAnchors(malformed, "Hello\nWorld")).toBeNull();
    expect(decodeChildReadingAnchors(valid, "Translated differently")).toBeNull();
  });
  it("refuses accessors and hostile reflection traps without evaluating content getters", () => {
    const getter = vi.fn(() => { throw new Error("No getter authority"); });
    const raw = alignment(); Object.defineProperty(raw, "segments", { enumerable: true, get: getter });
    expect(decodeChildReadingAnchors(raw, "Hello\nWorld")).toBeNull();
    for (const handler of [{ ownKeys() { throw new Error("Hostile keys"); } },
      { getOwnPropertyDescriptor() { throw new Error("Hostile descriptor"); } },
      { getPrototypeOf() { throw new Error("Hostile prototype"); } }]) {
      expect(decodeChildReadingAnchors(new Proxy(raw, handler), "Hello\nWorld")).toBeNull();
      expect(decodeChildReadingPosition(new Proxy(position, handler))).toBeNull();
    }
    const legacy = { title: "Original", text: "Hello\nWorld", terms: [], references: [] };
    Object.defineProperty(legacy, "readingAnchors", { enumerable: true, get: getter });
    expect(decodeChildEntityPayload(legacy)).toBeNull();
    expect(() => childPayloadBytes(legacy)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it("refuses locale seconds checksum completion wrapper entities and invalid stable IDs in bookmarks", () => {
    for (const field of ["locale", "seconds", "contentChecksum", "completed"]) expect(decodeChildReadingPosition({ ...position, [field]: 1 })).toBeNull();
    for (const kind of ["search-result", "recommendation", "recent", "favorite", "offline-package", "deep-link"])
      expect(decodeChildReadingPosition({ ...position, entity: { kind, id: reference.id } })).toBeNull();
    for (const anchorId of ["", "space id", "a".repeat(97)]) expect(decodeChildReadingPosition({ ...position, anchorId })).toBeNull();
    expect(decodeChildReadingPosition({ ...position, anchorVersion: Number.MAX_SAFE_INTEGER })).toBeNull();
  });
  it("returns deeply frozen copied graphs and preserves case-sensitive canonical IDs", () => {
    const raw = alignment(), decoded = decodeChildReadingAnchors(raw, "Hello\nWorld")!;
    raw.segments[0].anchorId = "Changed";
    expect(decoded.segments[0].anchorId).toBe("Opening");
    expect(Object.isFrozen(decoded)).toBe(true); expect(Object.isFrozen(decoded.segments)).toBe(true);
    expect(Object.isFrozen(decoded.segments[0])).toBe(true);
    const saved = decodeChildReadingPosition(position)!;
    expect(Object.isFrozen(saved.entity)).toBe(true); expect(sameChildReadingPosition(saved, { ...position, anchorId: "opening" })).toBe(false);
  });
  it("retains unknown saved anchors but refuses their resume without guessing version or entity mappings", () => {
    const unknown = { ...position, anchorId: "Retained-old-anchor" };
    expect(decodeChildNativeReadingPosition({ profileId: "Reader-A", revision: 5, position: unknown }, "Reader-A", reference)?.position).toEqual(unknown);
    expect(resolveChildReadingPosition(unknown, alignment(), reference)).toBeNull();
    expect(resolveChildReadingPosition({ ...position, anchorVersion: 2 }, alignment(), reference)).toBeNull();
    expect(resolveChildReadingPosition(position, alignment(), { ...reference, id: "Other" })).toBeNull();
  });
  it("distinguishes authentic absence from transport failure and requires owner-matched revision-incremented ACK", () => {
    expect(decodeChildNativeReadingPosition({ profileId: "Reader-A", revision: 0, position: null }, "Reader-A", reference)).toEqual({
      profileId: "Reader-A", revision: 0, position: null });
    expect(decodeChildNativeReadingPosition(null, "Reader-A", reference)).toBeNull();
    for (const raw of [
      { profileId: "Sibling", revision: 1, position }, { profileId: "Reader-A", revision: 0, position },
      { profileId: "Reader-A", revision: 1, position: { ...position, entity: { kind: "activity", id: "Other" } } },
      { profileId: "Reader-A", revision: 2, position }, { profileId: "Reader-A", revision: 1, position: { ...position, anchorId: "End" } },
    ]) expect(decodeChildNativeReadingPosition(raw, "Reader-A", reference, 0, position)).toBeNull();
    expect(decodeChildNativeReadingPosition({ profileId: "Reader-A", revision: 1, position }, "Reader-A", reference, 0, position)?.position).toEqual(position);
  });
  it("binds explicit narration cues to complete ordered frames while keeping frames out of the bookmark", () => {
    const raw = { ...alignment(), narration: { assetId: "Narration-A", sha256: hash, sampleRate: 8000, frameCount: 16000,
      cues: [{ anchorId: "Opening", startFrame: 0, endFrame: 8000 }, { anchorId: "End", startFrame: 8000, endFrame: 16000 }] } };
    expect(decodeChildReadingAnchors(raw, "Hello\nWorld")?.narration?.frameCount).toBe(16000);
    for (const narration of [
      { ...raw.narration, sampleRate: 7999 }, { ...raw.narration, frameCount: 480001 },
      { ...raw.narration, cues: [...raw.narration.cues].reverse() },
      { ...raw.narration, cues: [raw.narration.cues[0], { ...raw.narration.cues[1], startFrame: 8001 }] },
      { ...raw.narration, cues: [raw.narration.cues[0], { ...raw.narration.cues[1], endFrame: 15999 }] },
    ]) expect(decodeChildReadingAnchors({ ...raw, narration }, "Hello\nWorld")).toBeNull();
    expect(decodeChildReadingPosition({ ...position, startFrame: 0 })).toBeNull();
  });
});
