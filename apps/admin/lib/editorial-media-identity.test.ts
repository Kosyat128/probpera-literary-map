import { describe, expect, it } from "vitest";

import {
  assertEditorialMediaIdentityParity,
  authoritativeMediaIdsFromHtml,
  authoritativeMediaIdsFromJson,
  authoritativeMediaReferencesFromHtml,
  editorialMediaHtmlAccessibilityIssues,
  parseEditorialContentJson,
} from "./editorial-media-identity";

const FIRST_ID = "5f21359e-097b-46f0-b838-7ce948fd3cd1";
const SECOND_ID = "a1604bed-cafb-43ee-9c1a-65a0bcced59f";

const image = (mediaId: string, src: string, alt = "Описание") => ({
  type: "image",
  attrs: { mediaId, src, alt, decorative: false },
});

describe("editorial media identity guard", () => {
  it("normalizes ID lists while preserving reference multiplicity", () => {
    const document = {
      type: "doc",
      content: [
        image(FIRST_ID.toUpperCase(), "/first.webp", "Первое"),
        {
          type: "editorialBlock",
          content: [image(SECOND_ID, "/second.webp", "Второе")],
        },
        image(FIRST_ID, "/first.webp", "Первое"),
      ],
    };
    const html = `<figure><img src="/second.webp" alt="Второе" data-decorative="false" data-media-id="${SECOND_ID}"></figure><img src='/first.webp' alt="Первое" data-decorative="false" data-media-id='${FIRST_ID}'><img src="/first.webp" alt="Первое" data-decorative="false" data-media-id="${FIRST_ID}">`;

    expect(authoritativeMediaIdsFromJson(document)).toEqual([FIRST_ID, SECOND_ID].sort());
    expect(authoritativeMediaIdsFromHtml(html)).toEqual([FIRST_ID, SECOND_ID].sort());
    expect(authoritativeMediaReferencesFromHtml(html)).toHaveLength(3);
    expect(assertEditorialMediaIdentityParity(document, html)).toEqual(
      [FIRST_ID, SECOND_ID].sort()
    );
  });

  it("rejects parse failures and malformed TipTap roots instead of returning an empty document", () => {
    expect(() => parseEditorialContentJson("{", "Статья")).toThrow(
      "JSON редактора повреждён"
    );
    expect(() => parseEditorialContentJson("{}", "Статья")).toThrow(
      "некорректный документ редактора"
    );
  });

  it("rejects malformed media IDs and media attributes outside img tags", () => {
    expect(() =>
      authoritativeMediaIdsFromJson({
        type: "doc",
        content: [image("../../unsafe", "/unsafe.webp")],
      })
    ).toThrow("некорректный UUID");
    expect(() =>
      authoritativeMediaIdsFromHtml('<img src="/x" data-media-id="not-a-uuid">')
    ).toThrow("некорректный UUID");
    expect(() =>
      authoritativeMediaIdsFromHtml('<img data-media-id="unterminated>')
    ).toThrow();
    expect(() =>
      authoritativeMediaIdsFromHtml(`<figure data-media-id="${FIRST_ID}"></figure>`)
    ).toThrow("разрешён только у изображения");
    expect(() =>
      authoritativeMediaIdsFromJson({
        type: "doc",
        content: [{ type: "image", attrs: { mediaId: FIRST_ID, alt: "Описание" } }],
      })
    ).toThrow("отсутствует адрес файла");
  });

  it("does not treat literal attribute text outside an img start tag as media", () => {
    expect(
      authoritativeMediaIdsFromHtml(
        `<p>Пример: data-media-id="${FIRST_ID}"</p><script>"<img data-media-id='${SECOND_ID}'>"</script>`
      )
    ).toEqual([]);
  });

  it("checks accessibility for every canonical image, including URL-only legacy images", () => {
    expect(
      editorialMediaHtmlAccessibilityIssues(
        '<img src="/legacy.webp"><img src="/decor.webp" alt="" data-decorative="true"><img src="/ok.webp" alt="Подробное описание">'
      )
    ).toEqual([
      "добавьте описание к изображению 1 или отметьте его декоративным",
    ]);
  });

  it("fails closed on different IDs, duplicate counts, sources or accessibility metadata", () => {
    const document = {
      type: "doc",
      content: [image(FIRST_ID, "/first.webp", "Первое")],
    };
    expect(() =>
      assertEditorialMediaIdentityParity(
        document,
        `<img src="/second.webp" alt="Второе" data-media-id="${SECOND_ID}">`,
        "Русская версия статьи"
      )
    ).toThrow("данные изображений в JSON и HTML расходятся");
    expect(() =>
      assertEditorialMediaIdentityParity(
        document,
        `<img src="/first.webp" alt="Первое" data-media-id="${FIRST_ID}"><img src="/first.webp" alt="Первое" data-media-id="${FIRST_ID}">`
      )
    ).toThrow("расходятся");
    expect(() =>
      assertEditorialMediaIdentityParity(
        document,
        `<img src="/changed.webp" alt="Первое" data-media-id="${FIRST_ID}">`
      )
    ).toThrow("расходятся");
    expect(() =>
      assertEditorialMediaIdentityParity(
        document,
        `<img src="/first.webp" alt="Другое" data-media-id="${FIRST_ID}">`
      )
    ).toThrow("расходятся");
  });
});
