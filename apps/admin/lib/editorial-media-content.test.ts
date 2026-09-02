import { describe, expect, it } from "vitest";

import {
  editorialImageHtmlAttributes,
  editorialMediaAccessibilityIssues,
  normalizeEditorialImageAttributes,
  safeEditorialImageHtmlAttributes,
  sanitizeEditorialMediaJson,
} from "./editorial-media-content";

describe("editorial image attribute contract", () => {
  it("bounds custom dimensions and focal points without accepting unsafe URLs", () => {
    expect(
      normalizeEditorialImageAttributes({
        layout: "full",
        width: 4,
        maxWidth: 9_000,
        aspect: "16-9",
        fit: "cover",
        appearance: "shadow",
        reveal: "fade-up",
        focusX: -4,
        focusY: 8,
        link: "javascript:alert(1)",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      })
    ).toMatchObject({
      layout: "full",
      width: 20,
      maxWidth: 2_400,
      aspect: "16-9",
      fit: "cover",
      appearance: "shadow",
      reveal: "fade-up",
      focusX: 0,
      focusY: 1,
      link: "",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });
    expect(
      normalizeEditorialImageAttributes({ link: "//attacker.example/image" }).link
    ).toBe("");
  });

  it("serializes one canonical, responsive HTML contract", () => {
    expect(
      editorialImageHtmlAttributes({
        layout: "normal",
        width: 63,
        maxWidth: 960,
        aspect: "4-3",
        fit: "cover",
        appearance: "clean",
        reveal: "zoom",
        focusX: 0.25,
        focusY: 0.75,
        decorative: false,
      })
    ).toMatchObject({
      "data-image-layout": "normal",
      "data-image-width": "63",
      "data-image-max-width": "960",
      "data-image-aspect": "4-3",
      "data-image-fit": "cover",
      "data-image-appearance": "clean",
      "data-image-reveal": "zoom",
      "data-focus-x": "0.2500",
      "data-focus-y": "0.7500",
      "data-decorative": "false",
    });
  });

  it("canonicalizes submitted HTML attrs and empties decorative alt text", () => {
    const attributes = safeEditorialImageHtmlAttributes({
      src: "https://cdn.example/image.webp",
      alt: "Ignored for decoration",
      "data-image-width": "999",
      "data-focus-x": "NaN",
      "data-link": "data:text/html,bad",
      "data-image-appearance": "url(javascript:alert(1))",
      "data-image-reveal": "spin",
      "data-decorative": "true",
    });
    expect(attributes.alt).toBe("");
    expect(attributes.src).toBe("https://cdn.example/image.webp");
    expect(attributes["data-image-width"]).toBe("100");
    expect(attributes["data-focus-x"]).toBe("0.5000");
    expect(attributes["data-image-appearance"]).toBe("frame");
    expect(attributes["data-image-reveal"]).toBe("none");
    expect(attributes["data-link"]).toBeUndefined();
    expect(safeEditorialImageHtmlAttributes({ src: "#fragment" }).src).toBeUndefined();
  });
});

describe("editorial media JSON policy", () => {
  it("sanitizes image attrs recursively while preserving unknown nodes", () => {
    const value = sanitizeEditorialMediaJson({
      type: "doc",
      content: [
        {
          type: "futureEditorialNode",
          content: [
            {
              type: "image",
              attrs: {
                src: "javascript:alert(1)",
                alt: "  Подробное описание  ",
                width: 120,
                aspect: "unsafe",
                appearance: "unsafe-class",
                reveal: "unsafe-animation",
                decorative: false,
              },
            },
          ],
        },
      ],
    }) as Record<string, unknown>;
    const image = (
      ((value.content as Array<Record<string, unknown>>)[0].content as Array<
        Record<string, unknown>
      >)[0].attrs as Record<string, unknown>
    );
    expect((value.content as Array<Record<string, unknown>>)[0].type).toBe(
      "futureEditorialNode"
    );
    expect(image.src).toBe("");
    expect(image.alt).toBe("Подробное описание");
    expect(image.width).toBe(100);
    expect(image.aspect).toBe("auto");
    expect(image.appearance).toBe("frame");
    expect(image.reveal).toBe("none");
  });

  it("requires alt on publication unless the image is decorative", () => {
    expect(
      editorialMediaAccessibilityIssues({
        type: "doc",
        content: [
          { type: "image", attrs: { alt: "", decorative: false } },
          { type: "image", attrs: { alt: "", decorative: true } },
        ],
      })
    ).toEqual([
      "добавьте описание к изображению 1 или отметьте его декоративным",
    ]);
  });
});
