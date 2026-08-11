import { describe, expect, it } from "vitest";

import type {
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";
import { countries } from "./countries";
import { selectWriterBiography } from "./writerBiography";
import { selectWriterBiographyForDisplay } from "./writerBiographyDisplay";

const publishedRussian: WriterBiographyTranslationProfile = {
  locale: "ru",
  text:
    "Писатель работал с исторической прозой и внимательно исследовал повседневную речь своего времени. Его романы рассматривают нравственный выбор и влияние общества на частную жизнь.",
  sourceLanguage: "ru",
  status: "reviewed",
  method: "editorial-original",
  reviewedAt: "2026-08-08",
  sources: [
    {
      provider: "Official literary archive",
      url: "https://example.org/writers/reviewed-author",
      fields: ["identity", "life-dates", "works"],
      usage: "fact-check",
      retrievedAt: "2026-08-08",
    },
  ],
};

describe("writer biography display policy", () => {
  it("keeps the strict publication selector unchanged for a legacy record", () => {
    const writer: WriterProfile = {
      id: "legacy-author",
      name: "Автор из старой базы",
      bio:
        "Автор писал историческую прозу и литературные очерки. В его произведениях рассматриваются память, общественные перемены и частная жизнь.",
    };

    expect(selectWriterBiography(writer, "ru")).toBeNull();
    expect(selectWriterBiographyForDisplay(writer, "ru")).toEqual({
      kind: "legacy-unverified",
      locale: "ru",
      text: writer.bio,
      editorialStatus: "unverified",
      publicationGate: "not-passed",
      factCheckStatus: "not-recorded",
      provenanceStatus: "not-recorded",
      rightsStatus: "not-recorded",
      noticeCode: "legacy-biography-unverified",
      sources: [],
    });
  });

  it("never exposes Russian legacy prose as an English translation", () => {
    const writer: WriterProfile = {
      id: "legacy-author",
      bio:
        "Автор писал историческую прозу и литературные очерки. Его русская архивная справка не является английским переводом.",
    };

    expect(selectWriterBiographyForDisplay(writer, "en")).toBeNull();
  });

  it("prefers a locale-exact biography that passes the existing gate", () => {
    const writer: WriterProfile = {
      id: "reviewed-author",
      bio: "Старое поле не должно вытеснять опубликованную редакционную версию.",
      biographyTranslations: { ru: publishedRussian },
    };

    expect(selectWriterBiographyForDisplay(writer, "ru")).toEqual({
      kind: "published",
      locale: "ru",
      text: publishedRussian.text,
      editorialStatus: "reviewed",
      publicationGate: "passed",
      factCheckStatus: "existing-publication-metadata",
      provenanceStatus: "recorded",
      rightsStatus: "recorded",
      noticeCode: null,
      sources: publishedRussian.sources,
    });
  });

  it("withholds known service and generic placeholders", () => {
    const writer: WriterProfile = {
      id: "service-placeholder",
      bio:
        "Автор представлен в книжном архиве произведениями из редакционных подборок. Расширенная биографическая карточка проходит редакционную проверку.",
    };

    expect(selectWriterBiographyForDisplay(writer, "ru")).toBeNull();
  });

  it("does not turn a verified writer-card badge into biography verification", () => {
    const writer: WriterProfile = {
      id: "card-only-review",
      bio:
        "Эта архивная справка остаётся непроверенной отдельно от общей карточки автора. Для неё не записаны собственные источники и происхождение текста.",
      editorial: {
        status: "verified",
        reviewedAt: "2026-08-08",
        sources: [
          {
            title: "Authority record",
            url: "https://example.org/authority/card-only-review",
          },
        ],
      },
    };

    const display = selectWriterBiographyForDisplay(writer, "ru");
    expect(display?.kind).toBe("legacy-unverified");
    expect(display?.editorialStatus).toBe("unverified");
    expect(display?.sources).toEqual([]);
  });

  it("classifies the current corpus without promoting legacy prose", () => {
    const writers = countries.flatMap((country) => country.writers);
    const displays = writers.map((writer) =>
      selectWriterBiographyForDisplay(writer, "ru")
    );

    expect({
      cards: writers.length,
      strictGatePassing: writers.filter((writer) =>
        selectWriterBiography(writer, "ru")
      ).length,
      published: displays.filter((display) => display?.kind === "published")
        .length,
      legacyUnverified: displays.filter(
        (display) => display?.kind === "legacy-unverified"
      ).length,
      withheldKnownQualityIssues: displays.filter((display) => !display).length,
    }).toEqual({
      cards: 1_711,
      strictGatePassing: 45,
      published: 45,
      legacyUnverified: 1_666,
      withheldKnownQualityIssues: 0,
    });

    expect(
      displays
        .filter((display) => display?.kind === "legacy-unverified")
        .every(
          (display) =>
            display?.publicationGate === "not-passed" &&
            display.factCheckStatus === "not-recorded" &&
            display.provenanceStatus === "not-recorded" &&
            display.rightsStatus === "not-recorded" &&
            display.sources.length === 0
        )
    ).toBe(true);
  });
});
