import { describe, expect, it } from "vitest";

import {
  nearestEditorHeading,
  resolveEditorImageCaption,
  resolveEditorImageAltText,
  suggestEditorImageCaption,
  suggestEditorImageAltText,
  type EditorHeadingDocument,
} from "./editor-image-naming";

function documentWith(
  nodes: Array<{
    position: number;
    type: string;
    level?: number;
    text?: string;
  }>
): EditorHeadingDocument {
  return {
    descendants(visitor) {
      nodes.forEach((node) => {
        visitor(
          {
            type: { name: node.type },
            attrs: { level: node.level },
            textContent: node.text,
          },
          node.position
        );
      });
    },
  };
}

describe("editor image naming", () => {
  const document = documentWith([
    { position: 2, type: "heading", level: 2, text: "История книги" },
    { position: 20, type: "paragraph", text: "Текст" },
    { position: 30, type: "heading", level: 3, text: "  Главные   герои  " },
    { position: 60, type: "heading", level: 1, text: "Не учитывать" },
    { position: 65, type: "heading", level: 6, text: "Деталь главы" },
    { position: 80, type: "heading", level: 2, text: "Следующий раздел" },
  ]);

  it("finds the closest H2-H6 before the insertion point", () => {
    expect(nearestEditorHeading(document, 70)).toBe("Деталь главы");
    expect(nearestEditorHeading(document, 25)).toBe("История книги");
    expect(nearestEditorHeading(document, 2)).toBe("");
  });

  it("builds Russian alt text from the closest heading and article title", () => {
    expect(
      suggestEditorImageAltText({
        document,
        position: 70,
        title: "Мастер и Маргарита",
        fileName: "IMG_0042.JPG",
        kind: "article",
      })
    ).toBe("Иллюстрация к разделу «Деталь главы» статьи «Мастер и Маргарита»");
  });

  it("falls back to the Russian page title and then a cleaned file name", () => {
    expect(
      suggestEditorImageAltText({
        title: "О редакции",
        fileName: "scan_01.png",
        kind: "page",
      })
    ).toBe("Иллюстрация к странице «О редакции»");
    expect(
      suggestEditorImageAltText({
        title: "",
        fileName: "архивное-фото_01.png",
        kind: "article",
      })
    ).toBe("архивное фото 01");
    expect(
      suggestEditorImageAltText({
        title: "",
        fileName: "IMG_0042.JPG",
        kind: "article",
      })
    ).toBe("Иллюстрация к статье");
  });

  it("bounds generated metadata to the accepted API length", () => {
    const value = suggestEditorImageAltText({
      document: documentWith([
        { position: 1, type: "heading", level: 2, text: "Г".repeat(600) },
      ]),
      position: 20,
      title: "К".repeat(600),
      kind: "article",
    });
    expect(value.length).toBeLessThanOrEqual(500);
  });

  it("builds a visible Russian caption from the closest chapter and article title", () => {
    expect(
      suggestEditorImageCaption({
        document,
        position: 70,
        title: "Мастер и Маргарита",
        fileName: "IMG_0042.JPG",
        kind: "article",
      })
    ).toBe(
      "Деталь главы - иллюстрация к статье «Мастер и Маргарита»"
    );
  });

  it("bounds generated captions to the editor caption limit", () => {
    const value = suggestEditorImageCaption({
      document: documentWith([
        { position: 1, type: "heading", level: 2, text: "Г".repeat(800) },
      ]),
      position: 20,
      title: "К".repeat(800),
      kind: "article",
    });
    expect(value.length).toBeLessThanOrEqual(600);
  });

  it("keeps English editor metadata free from accidental Cyrillic fallbacks", () => {
    expect(
      suggestEditorImageAltText({
        document: documentWith([
          { position: 2, type: "heading", level: 2, text: "Book history" },
        ]),
        position: 20,
        title: "The Master and Margarita",
        kind: "article",
        locale: "en",
      })
    ).toBe(
      'Illustration for the section "Book history" in the article "The Master and Margarita"'
    );
  });

  it("keeps a manual alt, otherwise uses asset metadata and then the suggestion", () => {
    expect(
      resolveEditorImageAltText({
        currentAlt: "  Ручное описание  ",
        fallbackAlt: "Описание из медиатеки",
        suggestedAlt: "Автоматическое описание",
      })
    ).toBe("Ручное описание");
    expect(
      resolveEditorImageAltText({
        currentAlt: "",
        fallbackAlt: "Описание из медиатеки",
        suggestedAlt: "Автоматическое описание",
      })
    ).toBe("Описание из медиатеки");
    expect(
      resolveEditorImageAltText({
        currentAlt: "",
        fallbackAlt: "",
        suggestedAlt: "Автоматическое описание",
      })
    ).toBe("Автоматическое описание");
    expect(
      resolveEditorImageAltText({
        currentAlt: "Ручное описание",
        suggestedAlt: "Автоматическое описание",
        decorative: true,
      })
    ).toBe("");
  });

  it("keeps a manual caption, otherwise uses the media title and contextual caption", () => {
    expect(
      resolveEditorImageCaption({
        currentCaption: "  Ручная подпись  ",
        fallbackCaption: "Название из медиатеки",
        suggestedCaption: "Автоматическая подпись",
      })
    ).toBe("Ручная подпись");
    expect(
      resolveEditorImageCaption({
        currentCaption: "",
        fallbackCaption: "Название из медиатеки",
        suggestedCaption: "Автоматическая подпись",
      })
    ).toBe("Название из медиатеки");
    expect(
      resolveEditorImageCaption({
        currentCaption: "",
        fallbackCaption: "",
        suggestedCaption: "Автоматическая подпись",
      })
    ).toBe("Автоматическая подпись");
    expect(
      resolveEditorImageCaption({
        currentCaption: "Подпись декоративного изображения",
        fallbackCaption: "",
        suggestedCaption: "Автоматическая подпись",
        decorative: true,
      })
    ).toBe("Подпись декоративного изображения");
    expect(
      resolveEditorImageCaption({
        currentCaption: "",
        fallbackCaption: "Название из медиатеки",
        suggestedCaption: "Автоматическая подпись",
        decorative: true,
      })
    ).toBe("");
  });
});
