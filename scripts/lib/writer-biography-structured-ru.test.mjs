import { describe, expect, it } from "vitest";

import {
  isPublishableRussianBiographyClaim,
  isStructuredRussianBiographyText,
  structuredRussianBiographyFromReview,
  structuredRussianBiographyRefinementIssues,
  structuredRussianBiographySourceNarrationPattern,
  structuredRussianBiographyTautologyIssues,
  structuredRussianBiographyTechnicalPattern,
} from "./writer-biography-structured-ru.mjs";

const input = {
  key: "test:ivan_petrov",
  writerName: "Иван Петров",
  reviewedTextRu: "Иван Петров (1900-1970) - русский писатель.",
  claims: [
    {
      textRu:
        "Иван Петров был русским писателем и работал в жанре художественной прозы. Он написал роман «Северный путь».",
      verdict: "supported",
    },
  ],
  evidence: [
    {
      provider: "Литературный архив",
      url: "https://example.org/ivan-petrov",
      checkedAt: "2026-08-31",
      findingRu:
        "Биографическая справка подтверждает годы жизни Ивана Петрова, его работу в жанре художественной прозы и авторство романа «Северный путь».",
    },
  ],
  expectedSourceHash: "a".repeat(64),
};

const validText =
  "Иван Петров (1900-1970) - русский писатель, работавший в жанре художественной прозы. Среди его произведений - роман «Северный путь».";

function refinement(text = validText, expectedSourceHash = input.expectedSourceHash) {
  return { text, expectedSourceHash };
}

describe("structured Russian biography core gate", () => {
  it("accepts only publication-ready prose", () => {
    expect(isStructuredRussianBiographyText(validText)).toBe(true);
    expect(isStructuredRussianBiographyText("Короткая биография.")).toBe(false);
  });

  it.each([
    "Академическое издание определяет Ивана Петрова как русского писателя. Оно также подтверждает его роман «Северный путь» и годы жизни автора.",
    "Архив писателя включает сведения о романе «Северный путь». Биографическая справка содержит годы жизни Ивана Петрова и описание его творчества.",
    "Профиль издателя подтверждает биографию Ивана Петрова. Официальная страница перечисляет его произведения, включая роман «Северный путь».",
  ])("rejects source narration: %s", (text) => {
    expect(structuredRussianBiographySourceNarrationPattern.test(text)).toBe(
      true
    );
    expect(isStructuredRussianBiographyText(text)).toBe(false);
  });

  it.each([
    "Редакционная проверка подтверждает сведения об Иване Петрове. Текст прошёл fact-check и получил служебную пометку verified.",
    "Иван Петров - русский писатель. По данным источника, он написал роман «Северный путь», а source hash сохранён в редакционной записи.",
  ])("rejects technical narration: %s", (text) => {
    expect(structuredRussianBiographyTechnicalPattern.test(text)).toBe(true);
    expect(isStructuredRussianBiographyText(text)).toBe(false);
  });

  it.each([
    "Классик белорусской литературы, поэт и прозаик. Якуб Колас признан классиком белорусской литературы и работал как поэт и прозаик.",
    "Австрийский писатель и драматург эпохи модернизма. Артур Шницлер был австрийским писателем и драматургом эпохи модернизма.",
    "Египетский писатель, эссеист и литературный критик. Аббас Махмуд аль-Аккад был египетским писателем, эссеистом и литературным критиком.",
  ])("rejects repeated facts: %s", (text) => {
    expect(structuredRussianBiographyTautologyIssues(text)).not.toHaveLength(0);
    expect(isStructuredRussianBiographyText(text)).toBe(false);
  });

  it.each([
    "Артур Шницлер - австрийский писатель и драматург эпохи модернизма. Его литературное творчество относится к австрийской культуре этого художественного периода.",
    "Рим Кин - один из основателей современного кхмерского романа. Его литературная деятельность была связана со становлением этого жанра в современной кхмерской литературе.",
    "Якуб Колас - классик белорусской литературы, работавший как поэт и прозаик. В его творчестве соединяются поэтическая и прозаическая части национальной литературной традиции.",
    "Веревер Ликинг - родившаяся в Камеруне писательница, поэтесса и драматург. Её литературная деятельность охватывает прозу, поэзию и драматургию.",
  ])("rejects role-restating filler: %s", (text) => {
    expect(isStructuredRussianBiographyText(text)).toBe(false);
  });

  it("filters editorial/service claims from prompts", () => {
    expect(
      isPublishableRussianBiographyClaim(
        "Оценочный суперлатив заменён проверяемой формулировкой."
      )
    ).toBe(false);
    expect(
      isPublishableRussianBiographyClaim(
        "Иван Петров написал роман «Северный путь»."
      )
    ).toBe(true);
  });

  it("checks source hash, new numbers, works, names and writer identity", () => {
    expect(structuredRussianBiographyRefinementIssues(input, refinement())).toEqual(
      []
    );
    expect(
      structuredRussianBiographyRefinementIssues(
        input,
        refinement(validText, "b".repeat(64))
      )
    ).toContain("source-hash-mismatch");
    expect(
      structuredRussianBiographyRefinementIssues(
        input,
        refinement(validText.replace("1970", "1980"))
      )
    ).toContain("new-numbers:1980");
    expect(
      structuredRussianBiographyRefinementIssues(
        input,
        refinement(validText.replace("Северный путь", "Южный путь"))
      ).some((issue) => issue.startsWith("new-works:"))
    ).toBe(true);
    expect(
      structuredRussianBiographyRefinementIssues(
        input,
        refinement(validText.replace("Иван Петров", "Пётр Сидоров"))
      ).some((issue) => issue.startsWith("new-names:"))
    ).toBe(true);
    expect(
      structuredRussianBiographyRefinementIssues(
        input,
        refinement(
          "Русский писатель работал в жанре художественной прозы на протяжении своей литературной карьеры. Среди его произведений - роман «Северный путь»."
        )
      )
    ).toContain("writer-name-missing");
  });

  it("prefers a valid curated text and accepts refinement only with provenance", () => {
    const record = {
      applicableTextRu: "Русский писатель.",
      claims: [],
    };
    expect(
      structuredRussianBiographyFromReview(record, validText).derivation
    ).toBe("curated-editorial");
    expect(
      structuredRussianBiographyFromReview(
        record,
        "Слишком коротко.",
        refinement(),
        input
      ).derivation
    ).toBe("two-pass-editorial-refinement");
    expect(
      structuredRussianBiographyFromReview(
        record,
        "Слишком коротко.",
        refinement(validText, "b".repeat(64)),
        input
      ).derivation
    ).toBe("blocked-editorial-refinement");
  });
});
