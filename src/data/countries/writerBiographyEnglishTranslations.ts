import englishOverlay from "./generated/writerBiographyEnglishTranslations.generated.json";
import type { Country, WriterBiographyTranslationProfile } from "./types";
import { selectWriterBiography } from "../writerBiography";

type EnglishTranslationRecord = {
  text: string;
  sourceHash: string;
  generatedAt: string;
  /** Legacy automated QA date; never an editorial approval date. */
  reviewedAt?: string;
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
    status: "draft",
    method: "machine-translation",
    translatedFromLocale: "ru",
    sourceTextRights: "project-original",
    sources: russian.sources.map((source) => ({
      ...source,
      fields: [...source.fields],
    })),
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
 * Generated output stays a draft even if its input claims an approval. The
 * strict publication selector will not expose it, and any existing English
 * profile takes precedence, including drafts and retained stale reviews.
 * Replacement requires a separate explicit edit. Source SHA is generation provenance;
 * the separate versioned editorial review contract controls acceptance.
 */
export function mergeWriterBiographyEnglishTranslations(
  countries: Country[],
  generatedTranslations: ReadonlyMap<string, EnglishTranslationRecord> = translations
): Country[] {
  if (generatedTranslations.size === 0) return countries;
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const generated = generatedTranslations.get(`${country.id}:${writer.id}`);
      if (!generated) return writer;
      if (writer.biographyTranslations?.en) return writer;
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
