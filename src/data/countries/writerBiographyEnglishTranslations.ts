import englishOverlay from "./generated/writerBiographyEnglishTranslations.generated.json";
import type { Country, WriterBiographyTranslationProfile } from "./types";
import { selectWriterBiography } from "../writerBiography";

type EnglishTranslationRecord = {
  text: string;
  sourceHash: string;
  generatedAt: string;
  reviewedAt: string;
  model: string;
  reviewerModel: string;
  editorialPostEditedAt?: string;
  editorialPostEditor?: string;
  editorialPostEditReasonCodes?: string[];
};

type EnglishTranslationOverlay = {
  version: number;
  translatedCount: number;
  translations: Record<string, EnglishTranslationRecord>;
};

const overlay = englishOverlay as EnglishTranslationOverlay;
const translations = new Map<string, EnglishTranslationRecord>(
  Object.entries(overlay.translations)
);

export function buildWriterBiographyEnglishTranslation(
  generated: EnglishTranslationRecord,
  russian: WriterBiographyTranslationProfile
): WriterBiographyTranslationProfile {
  return {
    locale: "en",
    text: generated.text,
    sourceLanguage: "Russian",
    status: "reviewed",
    method: "machine-translation",
    reviewedAt: generated.reviewedAt,
    reviewer: `Cloudflare Workers AI two-pass review: ${generated.model} + ${generated.reviewerModel}${
      generated.editorialPostEditor
        ? `; editorial post-edit: ${generated.editorialPostEditor}`
        : ""
    }`,
    translatedFromLocale: "ru",
    sourceTextRights: "project-original",
    sources: russian.sources.map((source) => ({ ...source })),
    translationMeta: {
      model: generated.model,
      reviewerModel: generated.reviewerModel,
      sourceHash: generated.sourceHash,
      generatedAt: generated.generatedAt,
      ...(generated.editorialPostEditedAt === undefined
        ? {}
        : {
            editorialPostEditedAt: generated.editorialPostEditedAt,
            editorialPostEditor: generated.editorialPostEditor,
            editorialPostEditReasonCodes: [
              ...(generated.editorialPostEditReasonCodes || []),
            ],
          }),
    },
  };
}

/**
 * Adds only the generated English translation of the currently published,
 * project-original Russian biography. Source provenance is inherited from the
 * exact Russian profile; generation/check scripts SHA-pin that source before
 * this compact public overlay is accepted by the release gate.
 */
export function mergeWriterBiographyEnglishTranslations(
  countries: Country[]
): Country[] {
  if (translations.size === 0) return countries;
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const generated = translations.get(`${country.id}:${writer.id}`);
      if (!generated) return writer;
      const russian = selectWriterBiography(writer, "ru");
      if (!russian || russian.method !== "editorial-original") return writer;

      const english = buildWriterBiographyEnglishTranslation(
        generated,
        russian
      );

      return {
        ...writer,
        biographyTranslations: {
          ...writer.biographyTranslations,
          en: english,
        },
      };
    }),
  }));
}

export const writerBiographyEnglishTranslationCount = overlay.translatedCount;
