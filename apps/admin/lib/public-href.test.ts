import { describe, expect, it } from "vitest";

import { isSafePublicHref, isSafeRootRelativePath } from "./public-href";

describe("server-side public href policy", () => {
  it("only accepts unambiguous root-relative paths", () => {
    expect(isSafeRootRelativePath("/")).toBe(true);
    expect(isSafeRootRelativePath("/stati/novosti/")).toBe(true);
    expect(isSafeRootRelativePath("//attacker.example/path")).toBe(false);
    expect(isSafeRootRelativePath("/\\attacker.example/path")).toBe(false);
    expect(isSafeRootRelativePath("\\attacker.example/path")).toBe(false);
  });

  it("applies explicit hash, mailto and empty-value options", () => {
    expect(isSafePublicHref("https://example.com/path")).toBe(true);
    expect(isSafePublicHref("#atlas", { allowHash: true })).toBe(true);
    expect(isSafePublicHref("mailto:editor@example.com", { allowMailto: true })).toBe(
      true
    );
    expect(isSafePublicHref("", { allowEmpty: true })).toBe(true);
    expect(isSafePublicHref("//attacker.example/path", { allowHash: true })).toBe(
      false
    );
    expect(isSafePublicHref("/\\attacker.example/path", { allowHash: true })).toBe(
      false
    );
    expect(isSafePublicHref("https://")).toBe(false);
  });
});
