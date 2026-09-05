import { mergeAttributes } from "@tiptap/core";
import { describe, expect, it } from "vitest";

describe("editorial attribute merging", () => {
  it("does not expose inherited DOM attributes from a JSON __proto__ key", () => {
    const imported = JSON.parse(
      '{"__proto__":{"src":"invalid-image","onerror":"untrusted()","data-inherited":"yes"},"alt":"Описание изображения"}'
    );

    const merged = mergeAttributes({ class: "editorial-image" }, imported);
    const domAttributes: Record<string, unknown> = {};
    // ProseMirror's serializer enumerates inherited keys as well as own keys.
    for (const key in merged) domAttributes[key] = merged[key];

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(domAttributes).toEqual({
      class: "editorial-image",
      alt: "Описание изображения",
    });
    expect("onerror" in merged).toBe(false);
    expect("src" in merged).toBe(false);
  });

  it("preserves ordinary image classes and presentation while merging", () => {
    const merged = mergeAttributes(
      { class: "editorial-image", style: "width: 50%", alt: "Черновик" },
      { class: "is-centered", style: "max-width: 100%", alt: "Автор и название" }
    );

    expect(merged.class).toBe("editorial-image is-centered");
    expect(merged.style).toContain("width: 50%");
    expect(merged.style).toContain("max-width: 100%");
    expect(merged.alt).toBe("Автор и название");
  });
});
