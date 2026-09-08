import { describe, expect, it } from "vitest";

import type {
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";
import {
  countBiographySentences,
  reconcileWriterBiographyReviews,
  selectWriterBiography,
  writerBiographyQualityIssues,
  writerBiographyText,
} from "./writerBiography";
import {
  writerBiographyReviewSourceHash,
  writerBiographyReviewTargetHash,
} from "./biographyEditorialReview";

const source = {
  provider: "Official literary archive",
  url: "https://example.org/writers/verified-author",
  fields: ["identity", "life-dates", "biography-facts", "works"] as const,
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
  reviewer: "Редакционная проверка",
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

/** Synthetic review only: no fixture is evidence of real catalog approval. */
function syntheticApprovedTranslation(
  method: "machine-translation" | "human-translation" = "machine-translation"
): WriterProfile {
  const english: WriterBiographyTranslationProfile = {
    locale: "en",
    text:
      "This synthetic writer explored moral choices and social change in a series of fictional stories created for this test fixture. The example text exists only to exercise the publication contract and contains no real catalog approval.",
    sourceLanguage: "ru",
    status: "reviewed",
    method,
    reviewedAt: "2026-09-08",
    reviewer: "Synthetic fixture human reviewer",
    translatedFromLocale: "ru",
    sourceTextRights: "project-original",
    sources: structuredClone(russianBiography.sources),
    translationMeta: method === "machine-translation" ? {
      model: "synthetic-translator-model",
      reviewerModel: "synthetic-qa-model",
      sourceHash: "a".repeat(64),
      generatedAt: "2026-09-07T12:00:00.000Z",
    } : undefined,
  };
  const result: WriterProfile = {
    id: "synthetic-approved-writer",
    name: "Synthetic writer",
    biographyTranslations: { ru: structuredClone(russianBiography), en: english },
  };
  english.editorialReview = {
    schemaVersion: 1,
    hashContract: "writer-biography-review-v1",
    decision: "approved",
    reviewerType: "human",
    reviewer: "Synthetic fixture human reviewer",
    reviewedAt: "2026-09-08",
    evidenceRef: "https://example.org/test-only/biography-review",
    sourceHash: writerBiographyReviewSourceHash(result, "ru")!,
    targetHash: writerBiographyReviewTargetHash(english),
  };
  return result;
}

describe("writer biography publication gate", () => {
  it.each(["machine-translation", "human-translation"] as const)(
    "accepts a synthetic explicitly approved %s with exact source and target bindings",
    (method) => {
      const candidate = syntheticApprovedTranslation(method);
      expect(writerBiographyQualityIssues(candidate.biographyTranslations!.en, "en", candidate)).toEqual([]);
      expect(selectWriterBiography(candidate, "en")).toBe(candidate.biographyTranslations!.en);
      expect(reconcileWriterBiographyReviews(candidate)).toBe(candidate);
    }
  );

  it.each(["machine-translation", "human-translation"] as const)(
    "rejects %s without explicit editorial acceptance even with post-edit credits",
    (method) => {
      const candidate = syntheticApprovedTranslation(method);
      delete candidate.biographyTranslations!.en!.editorialReview;
      candidate.biographyTranslations!.en!.translationMeta = {
        ...candidate.biographyTranslations!.en!.translationMeta,
        editorialPostEditedAt: "2026-09-08T12:00:00.000Z",
        editorialPostEditor: "Automated bilingual QA",
        editorialPostEditReasonCodes: ["english-style-polish"],
      };
      expect(writerBiographyQualityIssues(candidate.biographyTranslations!.en, "en", candidate)).toContain("missing-review");
      expect(selectWriterBiography(candidate, "en")).toBeNull();
      const reconciled = reconcileWriterBiographyReviews(candidate);
      expect(reconciled.biographyTranslations!.en!.status).toBe("draft");
      expect(reconciled.biographyTranslations!.ru).toBe(candidate.biographyTranslations!.ru);
      expect(candidate.biographyTranslations!.en!.status).toBe("reviewed");
    }
  );

  it.each([
    ["target text", "target-changed", (candidate: WriterProfile) => { candidate.biographyTranslations!.en!.text += " Changed."; }],
    ["source text", "source-changed", (candidate: WriterProfile) => { candidate.biographyTranslations!.ru!.text += " Дополнение."; }],
    ["writer name", "source-changed", (candidate: WriterProfile) => { candidate.name = "Changed synthetic name"; }],
    ["source provenance", "source-changed", (candidate: WriterProfile) => { candidate.biographyTranslations!.ru!.sources[0]!.url = "https://example.org/changed-source"; }],
    ["missing source", "missing-source", (candidate: WriterProfile) => { delete candidate.biographyTranslations!.ru; }],
  ] as const)("marks a previously approved translation stale after changing %s", (_label, issue, mutate) => {
    const candidate = syntheticApprovedTranslation();
    mutate(candidate);
    expect(writerBiographyQualityIssues(candidate.biographyTranslations!.en, "en", candidate)).toContain(issue);
    expect(selectWriterBiography(candidate, "en")).toBeNull();
    const reconciled = reconcileWriterBiographyReviews(candidate);
    expect(reconciled.biographyTranslations!.en!.status).toBe("stale");
    expect(reconcileWriterBiographyReviews(reconciled)).toBe(reconciled);
    expect(candidate.biographyTranslations!.en!.status).toBe("reviewed");
  });

  it.each(["rejected", "withdrawn"] as const)("returns an approval marked %s to draft", (decision) => {
    const candidate = syntheticApprovedTranslation();
    candidate.biographyTranslations!.en!.editorialReview!.decision = decision;
    expect(selectWriterBiography(candidate, "en")).toBeNull();
    expect(reconcileWriterBiographyReviews(candidate).biographyTranslations!.en!.status).toBe("draft");
  });

  it.each([
    ["draft", (source: WriterBiographyTranslationProfile) => { source.status = "draft"; }],
    ["stale", (source: WriterBiographyTranslationProfile) => { source.status = "stale"; }],
    ["missing source reviewer", (source: WriterBiographyTranslationProfile) => { delete source.reviewer; }],
    ["invalid source length", (source: WriterBiographyTranslationProfile) => { source.text = "Короткий текст."; }],
    ["missing factual provenance", (source: WriterBiographyTranslationProfile) => { source.sources[0]!.usage = "structured-data"; }],
    ["unlicensed source copy", (source: WriterBiographyTranslationProfile) => { source.method = "licensed-source"; }],
  ] as const)("rejects an exact synthetic review over an ineligible source: %s", (_label, mutate) => {
    const candidate = syntheticApprovedTranslation("human-translation");
    const english = candidate.biographyTranslations!.en!;
    mutate(candidate.biographyTranslations!.ru!);
    // This approval binds the invalid source itself, so a hash mismatch alone
    // cannot explain the rejection. No real approval is represented here.
    english.editorialReview!.sourceHash = writerBiographyReviewSourceHash(candidate, "ru")!;
    const issues = writerBiographyQualityIssues(english, "en", candidate);
    expect(issues).toContain("source-not-publishable");
    expect(issues).not.toContain("source-changed");
    expect(issues).not.toContain("target-changed");
    expect(selectWriterBiography(candidate, "en")).toBeNull();
    expect(reconcileWriterBiographyReviews(candidate).biographyTranslations!.en!.status).toBe("stale");
    expect(candidate.biographyTranslations!.en!.status).toBe("reviewed");
  });

  it("rejects cyclic RU/EN translation sources without recursive publication", () => {
    const candidate = syntheticApprovedTranslation("human-translation");
    const russian = candidate.biographyTranslations!.ru!;
    russian.method = "human-translation";
    russian.translatedFromLocale = "en";
    russian.sourceTextRights = "public-domain";
    candidate.biographyTranslations!.en!.sourceTextRights = "public-domain";
    expect(writerBiographyQualityIssues(candidate.biographyTranslations!.en, "en", candidate)).toContain("source-not-publishable");
    expect(selectWriterBiography(candidate, "en")).toBeNull();
    expect(selectWriterBiography(candidate, "ru")).toBeNull();
    const reconciled = reconcileWriterBiographyReviews(candidate);
    expect(reconciled.biographyTranslations!.en!.status).toBe("stale");
    expect(reconciled.biographyTranslations!.ru!.status).toBe("stale");
  });

  it("returns malformed approval to draft without inventing a replacement review", () => {
    const candidate = syntheticApprovedTranslation();
    candidate.biographyTranslations!.en!.editorialReview!.reviewedAt = "2026-02-30";
    expect(writerBiographyQualityIssues(candidate.biographyTranslations!.en, "en", candidate)).toContain("invalid-review");
    const reconciled = reconcileWriterBiographyReviews(candidate);
    expect(reconciled.biographyTranslations!.en!.status).toBe("draft");
    expect(reconciled.biographyTranslations!.en!.editorialReview).toBe(candidate.biographyTranslations!.en!.editorialReview);
  });

  it.each(["draft", "stale"] as const)("never automatically promotes a %s with otherwise valid synthetic review", (status) => {
    const candidate = syntheticApprovedTranslation();
    candidate.biographyTranslations!.en!.status = status;
    expect(reconcileWriterBiographyReviews(candidate)).toBe(candidate);
    expect(selectWriterBiography(candidate, "en")).toBeNull();
  });

  it("preserves authored and legacy-only writer references", () => {
    const authored = writer();
    expect(reconcileWriterBiographyReviews(authored)).toBe(authored);
    const legacy: WriterProfile = { id: "legacy", bio: "Legacy text." };
    expect(reconcileWriterBiographyReviews(legacy)).toBe(legacy);
  });

  it("показывает редакционный русский оригинал с provenance", () => {
    expect(countBiographySentences(russianBiography.text)).toBe(2);
    expect(writerBiographyQualityIssues(russianBiography, "ru", writer())).toEqual(
      []
    );
    expect(writerBiographyText(writer(), "ru")).toBe(russianBiography.text);
  });

  it("не считает инициалы в имени отдельными предложениями", () => {
    const englishBiography: WriterBiographyTranslationProfile = {
      ...russianBiography,
      locale: "en",
      text:
        "J. R. R. Tolkien was an English writer and philologist whose scholarship shaped his fiction and its invented languages. His novels established a major tradition within modern fantasy literature.",
      sourceLanguage: "en",
    };

    expect(countBiographySentences(englishBiography.text)).toBe(2);
    expect(
      writerBiographyQualityIssues(
        englishBiography,
        "en",
        writer(englishBiography)
      )
    ).toEqual([]);
  });

  it("считает конец предложения после тронного римского числа", () => {
    expect(
      countBiographySentences(
        "Университет назван в честь Мухаммеда V. В 2003 году Фатима Мернисси получила литературную премию."
      )
    ).toBe(2);
  });

  it("не принимает корректное корейское имя Рён за повреждённую кодировку", () => {
    const koreanBiography: WriterBiographyTranslationProfile = {
      ...russianBiography,
      text:
        "Пэк Нам Рён (род. 1949) - северокорейский романист. Его роман «Friend», впервые изданный в КНДР в 1988 году, вышел на английском языке в 2020 году.",
    };

    expect(
      writerBiographyQualityIssues(koreanBiography, "ru", writer(koreanBiography))
    ).not.toContain("биография ru похожа на повреждённую кодировку");
  });

  it("по-прежнему блокирует настоящую mojibake-строку", () => {
    const corrupted: WriterBiographyTranslationProfile = {
      ...russianBiography,
      text:
        "РџРёСЃР°С‚РµР»СЊ СЃРѕР·РґР°РІР°Р» РїСЂРѕР·Сѓ Рё РґСЂР°РјР°С‚Сѓ. Р•РіРѕ РїСЂРѕРёР·РІРµРґРµРЅРёСЏ РёР·РґР°РІР°Р»РёСЃСЊ РЅР° СЂР°Р·РЅС‹С… СЏР·С‹РєР°С….",
    };

    expect(
      writerBiographyQualityIssues(corrupted, "ru", writer(corrupted))
    ).toContain("биография ru похожа на повреждённую кодировку");
  });

  it("не выпускает биографию без указанного редактора", () => {
    const { reviewer: _reviewer, ...withoutReviewer } = russianBiography;
    const incomplete = withoutReviewer as WriterBiographyTranslationProfile;

    expect(
      writerBiographyQualityIssues(incomplete, "ru", writer(incomplete))
    ).toContain("не указан редактор биографии ru");
    expect(selectWriterBiography(writer(incomplete), "ru")).toBeNull();
  });

  it("требует fact-check evidence именно для biography-facts", () => {
    const weakEvidence: WriterBiographyTranslationProfile = {
      ...russianBiography,
      sources: [
        {
          ...russianBiography.sources[0],
          usage: "structured-data",
          fields: ["identity"],
        },
      ],
    };
    expect(
      writerBiographyQualityIssues(weakEvidence, "ru", writer(weakEvidence))
    ).toContain("нет fact-check источника biography-facts для биографии ru");
    expect(selectWriterBiography(writer(weakEvidence), "ru")).toBeNull();
  });

  it("не позволяет машинному переводу выдаваться за verified", () => {
    const machineEnglish: WriterBiographyTranslationProfile = {
      locale: "en",
      text:
        "Leo Tolstoy was a Russian writer whose novels examined moral choice and social change throughout his creative period. His major works received lasting recognition among readers and literary scholars.",
      sourceLanguage: "Russian",
      status: "verified",
      method: "machine-translation",
      reviewedAt: "2026-08-08",
      reviewer: "Independent English review",
      translatedFromLocale: "ru",
      sourceTextRights: "project-original",
      sources: russianBiography.sources,
      translationMeta: {
        model: "translator",
        reviewerModel: "reviewer",
        sourceHash: "a".repeat(64),
        generatedAt: "2026-08-08T12:00:00.000Z",
      },
    };
    const completeWriter: WriterProfile = {
      id: "verified-author",
      name: "Проверенный автор",
      biographyTranslations: { ru: russianBiography, en: machineEnglish },
    };

    expect(
      writerBiographyQualityIssues(machineEnglish, "en", completeWriter)
    ).toContain(
      "машинный перевод en должен иметь статус reviewed"
    );
    expect(selectWriterBiography(completeWriter, "en")).toBeNull();
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
