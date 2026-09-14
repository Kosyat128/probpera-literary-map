import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { selectPwaPortraitAssets, assertPwaPortraitCopy, selectPwaBookCoverAssets, assertPwaBookCoverCopy } from "./pwa-portrait-selection.mjs";

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

const coverBytes = Buffer.from("synthetic cover bytes for integrity tests");
const coverPin = {
  output: "brand/book-covers/fixture-editorial.webp",
  source: "public/brand/book-covers/fixture-editorial.webp",
  sourceSha256: createHash("sha256").update(coverBytes).digest("hex"),
  transformation: "none",
};
const thumbnail = { ...coverPin,
  output: "brand/book-covers/thumbs/fixture-editorial.webp",
  source: "public/brand/book-covers/thumbs/fixture-editorial.webp" };

describe("canonical PWA book-cover selection", () => {
  it("selects full covers and thumbnails from the shared manifest without changing pins or portrait selection", () => {
    const source = selection(thumbnail, pin, coverPin), before = JSON.stringify(source);
    const covers = selectPwaBookCoverAssets(source);
    expect(covers).toEqual([coverPin, thumbnail]);
    expect(covers[0]).not.toBe(coverPin);
    expect(covers[1]).not.toBe(thumbnail);
    expect(selectPwaPortraitAssets(source)).toEqual([pin]);
    expect(selectPwaBookCoverAssets(selection(pin))).toEqual([]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("refuses non-image, encoded, remote, reserved or out-of-scope cover paths", () => {
    for (const output of [
      "brand/book-covers/fixture.svg", "brand/book-covers/fixture.js", "brand/book-covers/fixture.webp.js",
      "brand/book-covers/fixture.webp?raw=1", "brand/book-covers/%66ixture.webp",
      "brand/book-covers/../fixture.webp", "brand/book-covers/subdir/fixture.webp",
      "brand/book-covers/.fixture.webp", "brand/book-covers/fixture.webp.", "brand/book-covers/CON.webp",
      "brand/book-covers/thumbs/NUL.webp", "BRAND/BOOK-COVERS/fixture.webp",
      "brand\\book-covers\\fixture.webp", "https://example.test/brand/book-covers/fixture.webp",
    ]) {
      expect(() => selectPwaBookCoverAssets(selection({ ...coverPin, output, source: "public/" + output })), output).toThrow();
    }
  });

  it("refuses cover source substitution, invalid hashes and unsupported metadata without creating approval", () => {
    for (const change of [
      { source: "public/brand/book-covers/another.webp" },
      { source: pin.source },
      { output: "brand/elsewhere.webp" },
      { sourceSha256: "a".repeat(63) },
      { sourceSha256: coverPin.sourceSha256.toUpperCase() },
      { transformation: "resize" },
      { rightsApproved: true },
    ]) expect(() => selectPwaBookCoverAssets(selection({ ...coverPin, ...change }))).toThrow();
    expect(() => assertPwaBookCoverCopy(pin, { sourceBytes: bytes })).toThrow(/pin/u);
    expect(() => assertPwaPortraitCopy(coverPin, { sourceBytes: coverBytes })).toThrow(/pin/u);
  });

  it("refuses duplicate cover outputs and Windows case collisions anywhere in the shared manifest", () => {
    for (const duplicate of [coverPin, { ...coverPin, output: coverPin.output.toUpperCase(), source: coverPin.source.toUpperCase() }]) {
      expect(() => selectPwaBookCoverAssets(selection(coverPin, duplicate))).toThrow(/Duplicate/u);
    }
    expect(() => selectPwaBookCoverAssets(selection(coverPin, pin, { ...pin }))).toThrow(/Duplicate/u);
  });

  it("checks current cover source bytes even when an earlier matching copy is present", () => {
    expect(() => assertPwaBookCoverCopy(coverPin, { sourceBytes: coverBytes })).not.toThrow();
    expect(() => assertPwaBookCoverCopy(coverPin, { sourceBytes: coverBytes, outputBytes: coverBytes, provenance: { ...coverPin } })).not.toThrow();
    expect(() => assertPwaBookCoverCopy(coverPin, { sourceBytes: Buffer.from("changed cover"), outputBytes: coverBytes, provenance: coverPin })).toThrow(/Stale/u);
    expect(() => assertPwaBookCoverCopy(coverPin, { outputBytes: coverBytes, provenance: coverPin })).toThrow(/Missing/u);
  });

  it("refuses corrupt covers, case-changing ownership, unowned copies and incomplete provenance", () => {
    for (const existing of [
      { outputBytes: bytes, provenance: coverPin },
      { outputBytes: coverBytes, provenance: { ...coverPin, sourceSha256: "0".repeat(64) } },
      { outputBytes: coverBytes, provenance: { ...coverPin, output: coverPin.output.toUpperCase() } },
      { outputBytes: coverBytes, provenance: { ...coverPin, reviewed: true } },
      { outputBytes: coverBytes },
      { provenance: coverPin },
    ]) expect(() => assertPwaBookCoverCopy(coverPin, { sourceBytes: coverBytes, ...existing })).toThrow(/collision/u);
  });
});
