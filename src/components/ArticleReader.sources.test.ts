import { describe, expect, it } from "vitest";

import { articleReaderSourceItems } from "./ArticleReader";

describe("ArticleReader source presentation", () => {
  it("keeps the citation but removes a repeated raw URL from visible text", () => {
    const fullText =
      "ФЭБ: В. Я. Пропп. Русский героический эпос — https://feb-web.ru/feb/classics/critics/propp/rge/rge-001-.htm?cmd=p";

    expect(articleReaderSourceItems([fullText])).toEqual([
      {
        text: "ФЭБ: В. Я. Пропп. Русский героический эпос",
        fullText,
        url: "https://feb-web.ru/feb/classics/critics/propp/rge/rge-001-.htm?cmd=p",
        kind: "reference",
      },
    ]);
  });

  it("separates Wikimedia file credits from the main bibliography", () => {
    const fullText =
      "Wikimedia Commons: К. В. Лебедев. «Алёша Попович и Тугарин Змеевич», 1889 — https://commons.wikimedia.org/wiki/File:Alyosha_Popovich_and_Tugarin_Zmeyevich.jpg";
    const [item] = articleReaderSourceItems([fullText]);

    expect(item.kind).toBe("image-credit");
    expect(item.text).toBe(
      "Wikimedia Commons: К. В. Лебедев. «Алёша Попович и Тугарин Змеевич», 1889"
    );
    expect(item.text).not.toContain("https://");
    expect(item.fullText).toBe(fullText);
  });

  it("creates a compact label for a bare Wikimedia file URL", () => {
    const url =
      "https://commons.wikimedia.org/wiki/File:Alyosha_Popovich_%26_Tugarin.jpg";
    const [item] = articleReaderSourceItems([url]);

    expect(item).toMatchObject({
      text: "Wikimedia Commons — Alyosha Popovich & Tugarin.jpg",
      fullText: url,
      url,
      kind: "image-credit",
    });
  });

  it("preserves structured CMS labels while retaining the underlying link", () => {
    expect(
      articleReaderSourceItems([
        {
          label: "Президентская библиотека: древнерусские стихотворения",
          url: "https://www.prlib.ru/item/000001",
        },
      ])
    ).toEqual([
      {
        text: "Президентская библиотека: древнерусские стихотворения",
        fullText: "Президентская библиотека: древнерусские стихотворения",
        url: "https://www.prlib.ru/item/000001",
        kind: "reference",
      },
    ]);
  });
});
