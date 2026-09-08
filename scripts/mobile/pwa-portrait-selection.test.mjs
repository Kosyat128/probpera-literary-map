import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { selectPwaPortraitAssets, assertPwaPortraitCopy } from "./pwa-portrait-selection.mjs";

const bytes = Buffer.from("synthetic portrait bytes for integrity tests");
const pin = {
  output: "assets/writer-portraits/q1.webp",
  source: "public/assets/writer-portraits/q1.webp",
  sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  transformation: "none",
};
const selection = (...files) => ({ schemaVersion: 1, files });

describe("canonical PWA portrait selection", () => {
  it("selects the canonical portrait pins without changing unrelated artwork or the source manifest", () => {
    const cover = { ...pin, output: "brand/book-covers/fixture.webp", source: "public/brand/book-covers/fixture.webp" };
    const source = selection(cover, pin);
    const before = JSON.stringify(source);
    expect(selectPwaPortraitAssets(source)).toEqual([pin]);
    expect(JSON.stringify(source)).toBe(before);
    expect(selectPwaPortraitAssets(source)[0]).not.toBe(pin);
  });

  it("refuses a missing or invalid selection", () => {
    for (const source of [undefined, {}, { schemaVersion: 2, files: [] }, { schemaVersion: 1, files: null }]) {
      expect(() => selectPwaPortraitAssets(source)).toThrow(/selection/u);
    }
  });

  it("refuses traversal, source substitution or invalid pin metadata", () => {
    for (const change of [
    { output: "assets/writer-portraits/../q1.webp" },
    { output: "assets/writer-portraits/%2e%2e/q1.webp" },
    { output: "assets\\writer-portraits\\q1.webp" },
    { output: "assets/writer-portraits/q1.webp." },
    { output: pin.output.toUpperCase(), source: pin.source.toUpperCase() },
    { source: "public/assets/writer-portraits/q2.webp" },
    { output: "brand/q1.webp" },
    { transformation: "resize" },
    { sourceSha256: "a".repeat(63) },
    ]) expect(() => selectPwaPortraitAssets(selection({ ...pin, ...change }))).toThrow();
  });

  it("refuses duplicate outputs, including Windows case collisions", () => {
    for (const duplicate of [pin, { ...pin, output: pin.output.toUpperCase(), source: pin.source.toUpperCase() }]) {
      expect(() => selectPwaPortraitAssets(selection(pin, duplicate))).toThrow(/Duplicate/u);
    }
  });

  it("checks pinned source bytes before accepting an already copied matching output", () => {
    expect(() => assertPwaPortraitCopy(pin, { sourceBytes: bytes })).not.toThrow();
    expect(() => assertPwaPortraitCopy(pin, { sourceBytes: bytes, outputBytes: bytes, provenance: { ...pin } })).not.toThrow();
    expect(() => assertPwaPortraitCopy(pin, { sourceBytes: Buffer.from("changed source"), outputBytes: bytes, provenance: pin })).toThrow(/Stale/u);
    expect(() => assertPwaPortraitCopy(pin, { outputBytes: bytes, provenance: pin })).toThrow(/Missing/u);
  });

  it("refuses corrupt, unowned or missing pre-existing output", () => {
    for (const existing of [
    { outputBytes: Buffer.from("wrong existing output"), provenance: pin },
    { outputBytes: bytes, provenance: { ...pin, sourceSha256: "0".repeat(64) } },
    { outputBytes: bytes },
    { provenance: pin },
    ]) expect(() => assertPwaPortraitCopy(pin, { sourceBytes: bytes, ...existing })).toThrow(/collision/u);
  });
});
