import { describe, expect, it } from "vitest";

import {
  advanceBackfillCursor,
  circularBackfillIndex,
  normalizeBackfillCursor,
  translationBackfillCursorParams,
} from "./translation-backfill-cursor";

describe("translation backfill cursors", () => {
  it("normalizes malformed and out-of-range cursors to zero", () => {
    expect(normalizeBackfillCursor(undefined, 100)).toBe(0);
    expect(normalizeBackfillCursor("not-a-number", 100)).toBe(0);
    expect(normalizeBackfillCursor("-1", 100)).toBe(0);
    expect(normalizeBackfillCursor("100", 100)).toBe(0);
    expect(normalizeBackfillCursor("42", 100)).toBe(42);
  });

  it("preserves only bounded non-negative cursor tokens across actions", () => {
    const formData = new FormData();
    formData.set("libraryCursor", "42");
    formData.set("writerCursor", "7");
    formData.set("countryCursor", "999999999999999999999");
    expect(translationBackfillCursorParams(formData)).toEqual({
      libraryCursor: 42,
      writerCursor: 7,
      countryCursor: 0,
    });
  });

  it("advances by the number of candidates actually processed", () => {
    expect(advanceBackfillCursor(20, 7, 100)).toBe(27);
    expect(advanceBackfillCursor(98, 5, 100)).toBe(3);
    expect(advanceBackfillCursor(20, 0, 100)).toBe(20);
  });

  it("wraps circular candidate lookup without leaving the archive", () => {
    expect(circularBackfillIndex(98, 0, 100)).toBe(98);
    expect(circularBackfillIndex(98, 1, 100)).toBe(99);
    expect(circularBackfillIndex(98, 2, 100)).toBe(0);
  });

  it("fails safely for an empty archive", () => {
    expect(normalizeBackfillCursor(5, 0)).toBe(0);
    expect(advanceBackfillCursor(5, 2, 0)).toBe(0);
    expect(circularBackfillIndex(5, 2, 0)).toBe(0);
  });
});
