import { describe, expect, it } from "vitest";

import { safeCount } from "./format";

const readCount = (value: unknown) =>
  safeCount(value as Parameters<typeof safeCount>[0]);

describe("M02: confirmed counts versus unavailable data", () => {
  it.each([0, 1, 1234, Number.MAX_SAFE_INTEGER])(
    "preserves a successfully read count of %s",
    (count) => {
      expect(safeCount({ count, error: null })).toBe(count);
    },
  );

  it.each([
    ["no result", undefined],
    ["null result", null],
    ["no count", {}],
    ["null count", { count: null, error: null }],
    ["undefined count", { count: undefined, error: null }],
    ["negative count", { count: -1, error: null }],
    ["fractional count", { count: 1.5, error: null }],
    ["NaN count", { count: Number.NaN, error: null }],
    ["infinite count", { count: Number.POSITIVE_INFINITY, error: null }],
    ["unsafe integer count", { count: Number.MAX_SAFE_INTEGER + 1, error: null }],
    ["string count", { count: "0", error: null }],
    ["boolean count", { count: false, error: null }],
    ["null count with error", { count: null, error: { code: "57014" } }],
    ["zero with error", { count: 0, error: { code: "42501" } }],
    ["positive count with error", { count: 42, error: { code: "PGRST301" } }],
  ])("does not manufacture a successful count from %s", (_label, result) => {
    expect(readCount(result)).toBeNull();
  });
});
