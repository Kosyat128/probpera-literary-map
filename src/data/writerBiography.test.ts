import { describe, expect, it } from "vitest";

import type {
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";
import {
  countBiographySentences,
  selectWriterBiography,
  writerBiographyQualityIssues,
  writerBiographyText,
} from "./writerBiography";

const source = {
  provider: "Official literary archive",
  url: "https://example.org/writers/verified-author",
  fields: ["identity", "life-dates", "works"] as const,
  usage: "fact-check" as const,
  retrievedAt: "2026-08-08",
};

const russianBiography: WriterBiographyTranslationProfile = {
  locale: "ru",
  text:
    "Писатель соединял психологическую прозу с вниманием к историческим переменам и повседневной речи своего времени. Его главные романы исследуют нравственный выбор человека и влияние общества на частную жизнь.",
  sourceLanguage: "ru",
  status: "verified",
  method: "editorial-original",
  reviewedAt: "2026-08-08",
  sources: [{ ...source, fields: [...source.fields] }],
};

function writer(
  translation: WriterBiographyTranslationProfile = russianBiography
): WriterProfile {
  return {
    id: "verified-author",
    name: "Проверенный автор",
    bio: "Старый русский текст не должен быть неявным запасным вариантом.",
    biographyTranslations: { ru: translation },
  };
}

describe("writer biography publication gate", () => {
  it("показывает редакционный русский оригинал с provenance", () => {
    expect(countBiographySentences(russianBiography.text)).toBe(2);
    expect(writerBiographyQualityIssues(russianBiography, "ru", writer())).toEqual(
      []
    );
    expect(writerBiographyText(writer(), "ru")).toBe(russianBiography.text);
  });

  it("никогда не подставляет старое русское поле в английский интерфейс", () => {
    expect(selectWriterBiography(writer(), "en")).toBeNull();
    expect(writerBiographyText(writer(), "en")).toBeNull();
  });

  it("отклоняет смешанную русско-английскую биографию в локали en", () => {
    const mixed: WriterBiographyTranslationProfile = {
      ...russianBiography,
      locale: "en",
      text:
        "This English biography begins correctly but затем продолжает русским текстом, поэтому локализация не завершена. The publication gate must keep the mixed-language record out of the English interface.",
      sourceLanguage: "en",
    };

    expect(writerBiographyQualityIssues(mixed, "en", writer(mixed))).toContain(
      "английская биография содержит кириллицу"
    );
    expect(writerBiographyText(writer(mixed), "en")).toBeNull();
  });

  it("скрывает legacy-биографию без доказанного происхождения", () => {
    const legacyOnly: WriterProfile = {
      id: "legacy",
      name: "Автор из старой базы",
      biography:
        "Эта строка достаточно длинная, но у неё нет provenance и редакционного статуса. Поэтому посетитель не должен видеть её как проверенную биографию.",
    };

    expect(writerBiographyText(legacyOnly, "ru")).toBeNull();
  });

  it("не выпускает копию с сайта без лицензии и её URL", () => {
    const copied: WriterBiographyTranslationProfile = {
      ...russianBiography,
      method: "licensed-source",
      sources: [
        {
          ...russianBiography.sources[0],
          usage: "licensed-copy",
        },
      ],
    };

    expect(writerBiographyQualityIssues(copied, "ru", writer(copied))).toContain(
      "для лицензированного текста ru не зафиксированы лицензия и право копирования"
    );
    expect(writerBiographyText(writer(copied), "ru")).toBeNull();
  });

  it("требует зафиксировать права на исходник человеческого перевода", () => {
    const translated: WriterBiographyTranslationProfile = {
      ...russianBiography,
      method: "human-translation",
      sourceLanguage: "en",
    };

    expect(
      writerBiographyQualityIssues(translated, "ru", writer(translated))
    ).toContain("для перевода ru не зафиксированы права на исходный текст");
  });
});
