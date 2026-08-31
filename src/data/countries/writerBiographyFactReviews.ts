import reviewOverlay from "./generated/writerBiographyFactReviewCorrections.generated.json";
import type {
  Country,
  WriterBiographyTranslationProfile,
} from "./types";

const corrections = new Map<string, string>(
  Object.entries(reviewOverlay.corrections)
);
type RussianBiographyPublication = {
  text: string;
  reviewedAt: string;
  source: {
    provider: string;
    url: string;
    retrievedAt: string;
  };
};
const russianBiographies = new Map<string, RussianBiographyPublication>(
  Object.entries(reviewOverlay.russianBiographies)
);

/**
 * Applies proven text corrections. For Russian writers, the same review also
 * publishes a strict-gate Russian biography with one primary institutional
 * source; the complete claim evidence remains in build-time reports.
 */
export function mergeWriterBiographyFactReviews(
  countries: Country[]
): Country[] {
  if (corrections.size === 0 && russianBiographies.size === 0) return countries;
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const key = `${country.id}:${writer.id}`;
      const correctedText = corrections.get(key);
      const publication = russianBiographies.get(key);
      if (!correctedText && !publication) return writer;

      const russianTranslation: WriterBiographyTranslationProfile | undefined =
        publication
          ? {
              locale: "ru",
              text: publication.text,
              sourceLanguage: "ru",
              status: "verified",
              method: "editorial-original",
              reviewedAt: publication.reviewedAt,
              reviewer: "Редакционная фактологическая проверка Codex",
              sources: [
                {
                  provider: publication.source.provider,
                  url: publication.source.url,
                  fields: ["biography-facts"],
                  usage: "fact-check",
                  retrievedAt: publication.source.retrievedAt,
                },
              ],
            }
          : undefined;

      return {
        ...writer,
        bio: correctedText || publication?.text || writer.bio,
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
  reviewed: reviewOverlay.reviewedCount,
  corrected: reviewOverlay.correctedCount,
  published: reviewOverlay.publishedCorrectionCount,
  russianPublished: reviewOverlay.publishedRussianBiographyCount,
} as const;
