import encodedReviewRuntime from "./generated/writerBiographyFactReviewRuntime.generated.json";
import type {
  Country,
  WriterBiographyTranslationProfile,
} from "./types";

type RussianBiographyPublication = {
  text: string;
  reviewedAt: string;
  source: {
    provider: string;
    url: string;
    retrievedAt: string;
    fields: BiographySourceField[];
  };
};
type BiographySourceField =
  "identity" | "life-dates" | "biography-facts" | "awards" | "works";
type StructuredRussianBiographyPublication = {
  text: string;
  works: string[];
  reviewedAt: string;
  reviewer: string;
  sourceHash: string;
  sourceTextRights: "project-original";
  translatorModel?: string;
  reviewerModel?: string;
  generatedAt?: string;
  sources: Array<{
    provider: string;
    url: string;
    retrievedAt: string;
    fields: BiographySourceField[];
  }>;
};
type EncodedSource = [
  providerIndex: number,
  url: string,
  dateIndex: number,
  fields: BiographySourceField[],
];
type EncodedStructuredRussianBiography = [
  text: string,
  works: string[],
  reviewedAtIndex: number,
  reviewerIndex: number,
  sourceHash: string,
  sourceIndexes: number[],
  translatorModel?: string | null,
  reviewerModel?: string | null,
  generatedAt?: string | null,
];
type WriterBiographyClientRuntime = {
  version: number;
  reviewVersion: number;
  reviewedCount: number;
  correctedCount: number;
  publishedCorrectionCount: number;
  publishedRussianBiographyCount: number;
  publishedStructuredRussianBiographyCount: number;
  publishedStructuredWorkTitleCount: number;
  corrections: Record<string, string>;
  russianBiographies: Record<string, RussianBiographyPublication>;
  reviewers: string[];
  dates: string[];
  providers: string[];
  sources: EncodedSource[];
  biographies: Record<string, EncodedStructuredRussianBiography>;
};

const reviewRuntime =
  encodedReviewRuntime as unknown as WriterBiographyClientRuntime;
const corrections = new Map<string, string>(
  Object.entries(reviewRuntime.corrections)
);

function normalizedWorkTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const russianWorkTitleInflectionEndings = [
  "иями",
  "ями",
  "ами",
  "ого",
  "его",
  "ому",
  "ему",
  "ыми",
  "ими",
  "ую",
  "юю",
  "ая",
  "яя",
  "ое",
  "ее",
  "ые",
  "ие",
  "ый",
  "ий",
  "ии",
  "ой",
  "ей",
  "ах",
  "ях",
  "ом",
  "ем",
  "ам",
  "ям",
  "ов",
  "ев",
  "а",
  "я",
  "ы",
  "и",
  "у",
  "ю",
  "е",
] as const;

function normalizedWorkTitleStem(value: string): string {
  return normalizedWorkTitle(value)
    .split(" ")
    .map((token) => {
      if (!/^[а-я]+$/u.test(token) || token.length < 5) return token;
      const ending = russianWorkTitleInflectionEndings.find(
        (candidate) =>
          token.endsWith(candidate) && token.length - candidate.length >= 4
      );
      return ending ? token.slice(0, -ending.length) : token;
    })
    .join(" ");
}

export function equivalentReviewedWorkTitle(
  left: string,
  right: string
): boolean {
  const first = normalizedWorkTitle(left);
  const second = normalizedWorkTitle(right);
  if (!first || !second) return false;
  if (first === second) return true;

  const [shorter, longer] =
    first.length <= second.length ? [first, second] : [second, first];
  if (
    shorter.length >= 4 &&
    ` ${longer} `.includes(` ${shorter} `)
  ) {
    return true;
  }

  return normalizedWorkTitleStem(first) === normalizedWorkTitleStem(second);
}

function appendReviewedWorks(
  writerWorks: string[] | undefined,
  workDetails: Country["writers"][number]["workDetails"],
  reviewedWorks: string[]
): string[] | undefined {
  if (reviewedWorks.length === 0) return writerWorks;
  const existing = [...(writerWorks || [])];
  const structuredTitles = [
    ...existing,
    ...(workDetails || []).map((work) => work.title),
  ];
  for (const title of reviewedWorks) {
    if (
      !normalizedWorkTitle(title) ||
      structuredTitles.some((candidate) =>
        equivalentReviewedWorkTitle(candidate, title)
      )
    ) {
      continue;
    }
    existing.push(title);
    structuredTitles.push(title);
  }
  return existing;
}
const russianBiographies = new Map<string, RussianBiographyPublication>(
  Object.entries(reviewRuntime.russianBiographies)
);
const structuredRussianBiographies = new Map<
  string,
  StructuredRussianBiographyPublication
>(
  Object.entries(reviewRuntime.biographies).map(([key, encoded]) => {
    const [
      text,
      works,
      reviewedAtIndex,
      reviewerIndex,
      sourceHash,
      sourceIndexes,
      translatorModel,
      reviewerModel,
      generatedAt,
    ] = encoded;
    return [
      key,
      {
        text,
        works,
        reviewedAt: reviewRuntime.dates[reviewedAtIndex]!,
        reviewer: reviewRuntime.reviewers[reviewerIndex]!,
        sourceHash: `sha256:${sourceHash}`,
        sourceTextRights: "project-original",
        ...(translatorModel ? { translatorModel } : {}),
        ...(reviewerModel ? { reviewerModel } : {}),
        ...(generatedAt ? { generatedAt } : {}),
        sources: sourceIndexes.map((index) => {
          const [providerIndex, url, retrievedAtIndex, fields] =
            reviewRuntime.sources[index]!;
          return {
            provider: reviewRuntime.providers[providerIndex]!,
            url,
            retrievedAt: reviewRuntime.dates[retrievedAtIndex]!,
            fields,
          };
        }),
      },
    ];
  })
);

/**
 * Applies proven text corrections. For Russian writers, the same review also
 * publishes a strict-gate Russian biography with one primary institutional
 * source; the complete claim evidence remains in build-time reports.
 */
export function mergeWriterBiographyFactReviews(
  countries: Country[]
): Country[] {
  if (
    corrections.size === 0 &&
    russianBiographies.size === 0 &&
    structuredRussianBiographies.size === 0
  ) {
    return countries;
  }
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const key = `${country.id}:${writer.id}`;
      const correctedText = corrections.get(key);
      const russianPrimaryPublication = russianBiographies.get(key);
      const publication = structuredRussianBiographies.get(key);
      if (!correctedText && !publication && !russianPrimaryPublication) {
        return writer;
      }

      const publicationSources = russianPrimaryPublication
        ? [russianPrimaryPublication.source]
        : publication
          ? [...publication.sources]
          : [];

      const russianTranslation: WriterBiographyTranslationProfile | undefined =
        publication || russianPrimaryPublication
          ? {
              locale: "ru",
              text: publication?.text || russianPrimaryPublication!.text,
              sourceLanguage: "ru",
              status: "verified",
              method: "editorial-original",
              reviewedAt:
                publication?.reviewedAt || russianPrimaryPublication!.reviewedAt,
              reviewer:
                publication?.reviewer ||
                "Редакционная фактологическая проверка Codex",
              sourceTextRights: publication?.sourceTextRights || "project-original",
              sources: publicationSources.map((source) => ({
                  provider: source.provider,
                  url: source.url,
                  fields: source.fields,
                  usage: "fact-check",
                  retrievedAt: source.retrievedAt,
              })),
              translationMeta: publication
                ? {
                    sourceHash: publication.sourceHash,
                    generatedAt:
                      publication.generatedAt || publication.reviewedAt,
                    model: publication.translatorModel,
                    reviewerModel: publication.reviewerModel,
                  }
                : undefined,
            }
          : undefined;

      return {
        ...writer,
        bio:
          publication?.text ||
          russianPrimaryPublication?.text ||
          correctedText ||
          writer.bio,
        works: publication
          ? appendReviewedWorks(
              writer.works,
              writer.workDetails,
              publication.works
            )
          : writer.works,
        biographyTranslations: russianTranslation
          ? {
              ...writer.biographyTranslations,
              ru: russianTranslation,
            }
          : writer.biographyTranslations,
      };
    }),
  }));
}

export const writerBiographyFactReviewCounts = {
  reviewed: reviewRuntime.reviewedCount,
  corrected: reviewRuntime.correctedCount,
  published: reviewRuntime.publishedCorrectionCount,
  russianPublished: reviewRuntime.publishedRussianBiographyCount,
  structuredRussianPublished:
    reviewRuntime.publishedStructuredRussianBiographyCount,
  structuredWorkTitlesPublished:
    reviewRuntime.publishedStructuredWorkTitleCount,
} as const;
