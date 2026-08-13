import { describe, expect, it } from "vitest";

import { isSafeRootRelativeHref, safePublicHref } from "./publicHref";

describe("public href safety", () => {
  it("accepts root-relative paths but rejects network paths and backslashes", () => {
    expect(isSafeRootRelativeHref("/stati/novosti/")).toBe(true);
    expect(isSafeRootRelativeHref("//attacker.example/path")).toBe(false);
    expect(isSafeRootRelativeHref("/\\attacker.example/path")).toBe(false);
    expect(isSafeRootRelativeHref("\\attacker.example/path")).toBe(false);
  });

  it("falls back for protocol-relative and backslash-based hrefs", () => {
    expect(safePublicHref("//attacker.example/path", "#safe")).toBe("#safe");
    expect(safePublicHref("/\\attacker.example/path", "#safe")).toBe("#safe");
    expect(safePublicHref("\\attacker.example/path", "#safe")).toBe("#safe");
    expect(safePublicHref("https://", "#safe")).toBe("#safe");
  });

  it("preserves the explicitly supported link schemes", () => {
    expect(safePublicHref(" /stati/ ", "#safe")).toBe("/stati/");
    expect(safePublicHref("https://example.com/path", "#safe")).toBe(
      "https://example.com/path"
    );
    expect(safePublicHref("mailto:editor@example.com", "#safe")).toBe(
      "mailto:editor@example.com"
    );
    expect(safePublicHref("#atlas", "#safe")).toBe("#atlas");
  });
});
