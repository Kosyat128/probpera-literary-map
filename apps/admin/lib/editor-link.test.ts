import { describe, expect, it } from "vitest";

import { validateEditorLinkHref } from "./editor-link";

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

  it.each(["javascript:alert(1)", "//attacker.example/path", "http://example.com"])(
    "rejects unsafe href %s",
    (href) => expect(validateEditorLinkHref(href).ok).toBe(false)
  );
});
