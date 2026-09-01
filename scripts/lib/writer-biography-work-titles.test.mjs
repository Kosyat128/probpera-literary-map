import { describe, expect, it } from "vitest";

import {
  claimSupportsExplicitWorkTitle,
  curatedAliasSupportsExplicitWorkTitle,
  curatedWorkTitleEvidenceAliases,
  equivalentWorkTitle,
  extractExplicitWorkTitles,
  reviewSupportedWorkTitles,
} from "./writer-biography-work-titles.mjs";

describe("explicit biography work titles", () => {
  it("extracts titles only when prose explicitly identifies a literary work", () => {
    expect(
      extractExplicitWorkTitles(
        "Автор романа «Факундо», пьесы «Дом» и поэтического сборника «Голоса». Авторка «Зимней книги»."
      )
    ).toEqual(["Голоса", "Дом", "Зимней книги", "Факундо"]);
  });

  it("does not promote quoted awards, organisations or festivals to works", () => {
    expect(
      extractExplicitWorkTitles(
        "Лауреат премии «Большая книга», член организации «ПЕН-клуб» и участник фестиваля «Белые ночи»."
      )
    ).toEqual([]);
  });

  it("deduplicates repeated explicit titles deterministically", () => {
    expect(
      extractExplicitWorkTitles(
        "Роман «Герта» был опубликован. Автор романа «Герта»."
      )
    ).toEqual(["Герта"]);
  });

  it("extracts every title in a coordinated literary-work list", () => {
    expect(
      extractExplicitWorkTitles(
        "Он написал «Первый роман», «Второй роман» и «Третий роман». Среди произведений - «Четвёртый роман». Автор книги «Пятый роман», лауреат премии «Не произведение»."
      )
    ).toEqual([
      "Второй роман",
      "Первый роман",
      "Пятый роман",
      "Третий роман",
      "Четвёртый роман",
    ]);
  });

  it.each([
    ["Солнце независимости", "Солнца независимости"],
    ["Дороги Фландрии", "Дорога Фландрии"],
    ["Опыты", "Опытов"],
    ["Манхэттенский трансфер", "Манхэттенского трансфера"],
    ["Факундо, или Цивилизация и варварство", "Факундо"],
    ["Парфюмер", "Парфюмер. История одного убийцы"],
    ["Esanzo", "Esanzo: chants pour mon pays"],
    ["Truyện Kiều (Повесть о Киеу)", "Truyện Kiều"],
    ["«Язык немого» (The Tongue of the Dumb)", "The Tongue of the Dumb"],
    ["Pacific Tsunami", "Pacific Tsunami “Galu Afi”"],
    ["9 июля 1821 года", "9 июля 1821 года в Никосии на Кипре"],
  ])("recognizes an already structured title variant: %s", (structured, prose) => {
    expect(equivalentWorkTitle(structured, prose)).toBe(true);
  });

  it.each([
    ["Дом", "Дом у дороги"],
    ["Война", "Война и мир"],
    ["Красные цветы", "Красное и чёрное"],
  ])("does not merge unrelated short titles: %s / %s", (left, right) => {
    expect(equivalentWorkTitle(left, right)).toBe(false);
  });

  it("requires title-specific evidence and rejects an unrelated evidenced claim", () => {
    const unrelatedClaim = {
      verdict: "supported",
      textRu: "Автор романа «Другой роман».",
      evidence: [
        {
          findingRu: "Источник подтверждает «Другой роман».",
        },
      ],
    };
    expect(claimSupportsExplicitWorkTitle(unrelatedClaim, "Искомый роман")).toBe(
      false
    );
    expect(
      reviewSupportedWorkTitles(
        { claims: [unrelatedClaim] },
        ["Другой роман", "Искомый роман"]
      )
    ).toEqual({
      supported: ["Другой роман"],
      unsupported: ["Искомый роман"],
      curatedEvidenceAliases: [],
    });
  });

  it("accepts title mentions in either legacy claims or evidence findings", () => {
    expect(
      claimSupportsExplicitWorkTitle(
        {
          verdict: "corrected",
          claimRu: "Биографическое утверждение.",
          evidence: [
            {
              findingRu: "Каталог атрибутирует автору роман «Герта».",
            },
          ],
        },
        "Герта"
      )
    ).toBe(true);
  });

  it("accepts only an exact title-specific curated evidence alias", () => {
    const record = {
      key: "test:writer",
      claims: [
        {
          verdict: "supported",
          textRu: "Авторство подтверждено.",
          evidence: [
            {
              url: "https://example.test/catalogue",
              checkedAt: "2026-08-09",
              findingRu: "Каталог атрибутирует автору Original Title.",
            },
          ],
        },
      ],
    };
    const alias = {
      key: "test:writer",
      russianTitle: "Русское название",
      evidenceTitle: "Original Title",
      evidenceUrl: "https://example.test/catalogue",
      checkedAt: "2026-08-09",
    };

    expect(
      curatedAliasSupportsExplicitWorkTitle(
        record,
        "Русское название",
        alias
      )
    ).toBe(true);
    expect(
      reviewSupportedWorkTitles(
        record,
        ["Русское название"],
        [alias]
      )
    ).toEqual({
      supported: ["Русское название"],
      unsupported: [],
      curatedEvidenceAliases: [alias],
    });
  });

  it.each([
    ["writer key", { key: "test:other" }],
    ["Russian title", { russianTitle: "Другое название" }],
    ["evidence URL", { evidenceUrl: "https://example.test/other" }],
    ["checkedAt", { checkedAt: "2026-08-10" }],
    ["literal evidence title", { evidenceTitle: "Absent Original Title" }],
  ])("rejects an alias with a wrong %s", (_label, override) => {
    const record = {
      key: "test:writer",
      claims: [
        {
          verdict: "corrected",
          textRu: "Исправленное утверждение.",
          evidence: [
            {
              url: "https://example.test/catalogue",
              checkedAt: "2026-08-09",
              findingRu: "Каталог перечисляет Original Title.",
            },
          ],
        },
      ],
    };
    const alias = {
      key: "test:writer",
      russianTitle: "Русское название",
      evidenceTitle: "Original Title",
      evidenceUrl: "https://example.test/catalogue",
      checkedAt: "2026-08-09",
      ...override,
    };

    expect(
      curatedAliasSupportsExplicitWorkTitle(
        record,
        "Русское название",
        alias
      )
    ).toBe(false);
  });

  it("keeps the curated registry unique and fully title-specific", () => {
    expect(curatedWorkTitleEvidenceAliases).toHaveLength(19);
    expect(
      new Set(
        curatedWorkTitleEvidenceAliases.map(
          (alias) => `${alias.key}\u0000${alias.russianTitle}`
        )
      ).size
    ).toBe(curatedWorkTitleEvidenceAliases.length);
    for (const alias of curatedWorkTitleEvidenceAliases) {
      expect(alias.evidenceUrl).toMatch(/^https:\/\//u);
      expect(alias.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(alias.evidenceTitle.length).toBeGreaterThan(1);
    }
  });
});
