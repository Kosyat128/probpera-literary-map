import { describe, expect, it } from "vitest";

import {
  editorInternalLinkSearchPattern,
  editorLinkDraftFromAttributes,
  normalizeEditorLinkAttributes,
  normalizeEditorInternalLinkSearch,
  sanitizeEditorAnchorAttributes,
  validateEditorLinkHref,
} from "./editor-link";

describe("internal editor link search", () => {
  it("normalizes and bounds a staff search term", () => {
    expect(normalizeEditorInternalLinkSearch("  Война   и мир  ")).toBe(
      "Война и мир"
    );
    expect(normalizeEditorInternalLinkSearch("я".repeat(200))).toHaveLength(120);
  });

  it("requires two characters and escapes ILIKE wildcards", () => {
    expect(editorInternalLinkSearchPattern("я")).toBeNull();
    expect(editorInternalLinkSearchPattern("100%_книга")).toBe(
      "%100\\%\\_книга%"
    );
  });
});

describe("validateEditorLinkHref", () => {
  it.each([
    "https://probpera.ru/stati/",
    "/stati/",
    "#istochniki",
    "mailto:editor@probpera.ru",
  ])("accepts safe editorial href %s", (href) => {
    expect(validateEditorLinkHref(href)).toEqual({ ok: true, href });
  });

  it("uses an empty value to remove a link", () => {
    expect(validateEditorLinkHref("   ")).toEqual({ ok: true, href: "" });
  });

  it.each([
    "javascript:alert(1)",
    "//attacker.example/path",
    "http://example.com",
    "mailto:not-an-email",
    "mailto:editor@example.com?subject=Injected",
  ])(
    "rejects unsafe href %s",
    (href) => expect(validateEditorLinkHref(href).ok).toBe(false)
  );
});

describe("editor link attributes", () => {
  it("normalizes target and selected editorial rel flags", () => {
    expect(
      normalizeEditorLinkAttributes({
        href: "https://example.com/source",
        openInNewTab: true,
        relFlags: ["ugc", "nofollow"],
      })
    ).toEqual({
      ok: true,
      attributes: {
        href: "https://example.com/source",
        target: "_blank",
        rel: "noopener noreferrer nofollow ugc",
      },
    });
  });

  it("reads only supported flags from persisted link marks", () => {
    expect(
      editorLinkDraftFromAttributes({
        href: "/stati/",
        target: "_blank",
        rel: "noopener sponsored custom ugc",
      })
    ).toEqual({
      href: "/stati/",
      openInNewTab: true,
      relFlags: ["sponsored", "ugc"],
    });
  });

  it("preserves safe flags during server sanitization", () => {
    expect(
      sanitizeEditorAnchorAttributes({
        href: "https://example.com/source",
        target: "_blank",
        rel: "ugc sponsored attacker-token",
        name: "source",
      })
    ).toEqual({
      href: "https://example.com/source",
      target: "_blank",
      rel: "noopener noreferrer sponsored ugc",
      name: "source",
    });
  });

  it("removes unsafe navigation attributes without deleting a named anchor", () => {
    expect(
      sanitizeEditorAnchorAttributes({
        href: "//attacker.example/path",
        target: "_blank",
        rel: "nofollow",
        name: "safe-anchor",
      })
    ).toEqual({ name: "safe-anchor" });
  });
});
