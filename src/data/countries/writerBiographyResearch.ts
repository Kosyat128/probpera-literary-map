import {
  countBiographySentences,
  isGenericBiographyText,
  selectWriterBiography,
  writerBiographyQualityIssues,
} from "../writerBiography";
import type {
  Country,
  WriterBiographyLocale,
  WriterBiographySourceProfile,
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./types";

export const WRITER_BIOGRAPHY_RESEARCH_AUTHOR =
  "Codex editorial draft" as const;

export type WriterBiographyResearchStatus =
  | "research"
  | "reviewed"
  | "verified";

export type WriterBiographyFactCheck = {
  summary: string;
  sourceUrls: string[];
  evidence: Array<{
    sourceUrl: string;
    supports: string;
  }>;
};

export type WriterBiographyResearchTranslation = {
  locale: WriterBiographyLocale;
  text: string;
  sourceLanguage: string;
  method: "editorial-original" | "human-translation";
  translatedFromLocale?: WriterBiographyLocale;
  sourceTextRights?: "project-original";
  sources: WriterBiographySourceProfile[];
};

export type WriterBiographyResearchDraft = {
  key: `${string}:${string}`;
  countryId: string;
  writerId: string;
  author: typeof WRITER_BIOGRAPHY_RESEARCH_AUTHOR;
  status: WriterBiographyResearchStatus;
  researchedAt: string;
  selectionReason: string;
  facts: {
    identity: WriterBiographyFactCheck;
    lifeDates: WriterBiographyFactCheck;
    nationalLiteraryContext: WriterBiographyFactCheck;
    notableWorks: WriterBiographyFactCheck;
  };
  translations: Record<
    WriterBiographyLocale,
    WriterBiographyResearchTranslation
  >;
  sources: WriterBiographySourceProfile[];
  rights: {
    sourceUse: "facts-only";
    proseCreation: "project-original-editorial-draft";
    sourceProseCopied: false;
    wikipediaUsed: false;
    note: string;
  };
  review: {
    independentReviewRequired: true;
    decision: "pending" | "approved" | "changes-requested";
    reviewer: string | null;
    reviewedAt: string | null;
  };
};

const requiredFactFields = new Set<string>([
  "identity",
  "life-dates",
  "biography-facts",
  "works",
]);

const fieldForFact = {
  identity: "identity",
  lifeDates: "life-dates",
  nationalLiteraryContext: "biography-facts",
  notableWorks: "works",
} as const;

function distinctNonEmpty(values: string[]) {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function sourceHostname(url: string) {
  try {
    return new URL(url).hostname.toLocaleLowerCase("en");
  } catch {
    return "";
  }
}

function isIsoCalendarDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizedCredit(value: string | null) {
  return (value || "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en");
}

function translationTextIssues(
  translation: WriterBiographyResearchTranslation,
  locale: WriterBiographyLocale
) {
  const issues: string[] = [];
  const text = translation.text.replace(/\s+/gu, " ").trim();
  const sentenceCount = countBiographySentences(text);

  if (translation.locale !== locale) issues.push(`${locale}: locale mismatch`);
  if (sentenceCount < 2 || sentenceCount > 4) {
    issues.push(`${locale}: biography must contain 2-4 sentences`);
  }
  if (text.length < 120 || text.length > 1_600) {
    issues.push(`${locale}: biography must contain 120-1600 characters`);
  }
  if (locale === "ru" && !/[\u0400-\u04ff]/u.test(text)) {
    issues.push("ru: biography has no Cyrillic text");
  }
  if (
    locale === "en" &&
    (!/[A-Za-z]/u.test(text) || /\p{Script=Cyrillic}/u.test(text))
  ) {
    issues.push("en: biography must be English-only");
  }
  if (isGenericBiographyText(text)) issues.push(`${locale}: generic biography`);
  if (!translation.sources.length) issues.push(`${locale}: no per-text provenance`);

  if (locale === "ru" && translation.method !== "editorial-original") {
    issues.push("ru: research text must be an editorial original");
  }
  if (
    locale === "en" &&
    (translation.method !== "editorial-original" ||
      translation.sourceLanguage !== "en" ||
      translation.translatedFromLocale !== undefined ||
      translation.sourceTextRights !== undefined)
  ) {
    issues.push("en: text must be declared as an independent English editorial original");
  }

  return issues;
}

/**
 * Validates a research record without treating it as publication-ready. A
 * research draft is expected to fail the public gate until an independent
 * reviewer records an approval, their name and the review date.
 */
export function writerBiographyResearchDraftIssues(
  draft: WriterBiographyResearchDraft,
  options: { requireApproval?: boolean } = {}
) {
  const issues: string[] = [];
  if (draft.key !== `${draft.countryId}:${draft.writerId}`) {
    issues.push("key does not match countryId:writerId");
  }
  if (draft.author !== WRITER_BIOGRAPHY_RESEARCH_AUTHOR) {
    issues.push("unexpected research author");
  }
  if (!isIsoCalendarDate(draft.researchedAt)) {
    issues.push("invalid research date");
  }

  const providers = distinctNonEmpty(draft.sources.map((source) => source.provider));
  const hostnames = distinctNonEmpty(
    draft.sources.map((source) => sourceHostname(source.url))
  );
  if (providers.size < 2 || hostnames.size < 2) {
    issues.push("fewer than two independent source providers");
  }
  if (
    draft.sources.some(
      (source) =>
        !source.provider.trim() ||
        !/^https:\/\//iu.test(source.url) ||
        !source.retrievedAt ||
        !source.fields.length
    )
  ) {
    issues.push("source provenance is incomplete");
  }
  if (new Set(draft.sources.map((source) => source.url)).size !== draft.sources.length) {
    issues.push("duplicate source URLs");
  }

  const coveredFields = new Set<string>(
    draft.sources.flatMap((source) => source.fields)
  );
  for (const field of requiredFactFields) {
    if (!coveredFields.has(field)) issues.push(`sources do not cover ${field}`);
  }

  const sourcesByUrl = new Map(
    draft.sources.map((source) => [source.url, source] as const)
  );
  const sourceUrls = new Set(sourcesByUrl.keys());
  for (const [factName, fact] of Object.entries(draft.facts)) {
    if (!fact.summary.trim()) issues.push(`${factName}: empty fact-check summary`);
    if (!fact.sourceUrls.length) {
      issues.push(`${factName}: no supporting source reference`);
    }
    if (fact.sourceUrls.some((url) => !sourceUrls.has(url))) {
      issues.push(`${factName}: unknown source URL`);
    }
    const evidenceUrls = new Set(
      fact.evidence.map((item) => item.sourceUrl)
    );
    if (
      fact.evidence.some(
        (item) =>
          !item.supports.trim() ||
          !fact.sourceUrls.includes(item.sourceUrl) ||
          !sourceUrls.has(item.sourceUrl)
      ) ||
      fact.sourceUrls.some((url) => !evidenceUrls.has(url))
    ) {
      issues.push(`${factName}: field-level evidence is incomplete`);
    }
    const requiredField = fieldForFact[factName as keyof typeof fieldForFact];
    if (
      requiredField &&
      fact.sourceUrls.some(
        (url) => !sourcesByUrl.get(url)?.fields.includes(requiredField)
      )
    ) {
      issues.push(`${factName}: source does not declare ${requiredField} support`);
    }
  }

  if (
    draft.rights.sourceUse !== "facts-only" ||
    draft.rights.proseCreation !== "project-original-editorial-draft" ||
    draft.rights.sourceProseCopied !== false ||
    draft.rights.wikipediaUsed !== false
  ) {
    issues.push("rights declaration does not establish original facts-only prose");
  }

  issues.push(...translationTextIssues(draft.translations.ru, "ru"));
  issues.push(...translationTextIssues(draft.translations.en, "en"));
  if (
    draft.translations.ru.text.trim() === draft.translations.en.text.trim()
  ) {
    issues.push("RU and EN texts are identical");
  }
  for (const locale of ["ru", "en"] as const) {
    const translationSources = new Map(
      draft.translations[locale].sources.map((source) => [source.url, source])
    );
    if (translationSources.size !== draft.translations[locale].sources.length) {
      issues.push(`${locale}: duplicate per-text source URLs`);
    }
    const urls = new Set(translationSources.keys());
    if ([...sourceUrls].some((url) => !urls.has(url))) {
      issues.push(`${locale}: per-text provenance omits a research source`);
    }
    if ([...urls].some((url) => !sourceUrls.has(url))) {
      issues.push(`${locale}: per-text provenance contains an undeclared source`);
    }
    for (const sourceRecord of draft.sources) {
      const translationSource = translationSources.get(sourceRecord.url);
      if (
        translationSource &&
        (translationSource.provider !== sourceRecord.provider ||
          translationSource.usage !== sourceRecord.usage ||
          translationSource.retrievedAt !== sourceRecord.retrievedAt ||
          [...translationSource.fields].sort().join("|") !==
            [...sourceRecord.fields].sort().join("|"))
      ) {
        issues.push(`${locale}: per-text source metadata does not match research`);
      }
    }
  }

  if (options.requireApproval) {
    if (draft.status !== "reviewed" && draft.status !== "verified") {
      issues.push("research status is not publishable");
    }
    if (draft.review.decision !== "approved") {
      issues.push("independent review is not approved");
    }
    if (!draft.review.reviewer?.trim()) issues.push("independent reviewer is missing");
    if (!isIsoCalendarDate(draft.review.reviewedAt)) {
      issues.push("review date is missing or invalid");
    }
    if (
      normalizedCredit(draft.review.reviewer) === normalizedCredit(draft.author)
    ) {
      issues.push("draft author cannot approve their own text");
    }
  }

  return [...new Set(issues)];
}

function publicationTranslations(
  draft: WriterBiographyResearchDraft
): Record<WriterBiographyLocale, WriterBiographyTranslationProfile> {
  const status = draft.status === "verified" ? "verified" : "reviewed";
  const reviewedAt = draft.review.reviewedAt || "";
  const reviewer = draft.review.reviewer || "";
  return {
    ru: {
      ...draft.translations.ru,
      status,
      reviewedAt,
      reviewer,
    },
    en: {
      ...draft.translations.en,
      status,
      reviewedAt,
      reviewer,
    },
  };
}

export function isWriterBiographyResearchDraftPublishable(
  draft: WriterBiographyResearchDraft
) {
  if (writerBiographyResearchDraftIssues(draft, { requireApproval: true }).length) {
    return false;
  }
  const biographyTranslations = publicationTranslations(draft);
  const candidate: WriterProfile = {
    id: draft.writerId,
    biographyTranslations,
  };
  return (["ru", "en"] as const).every(
    (locale) =>
      writerBiographyQualityIssues(
        biographyTranslations[locale],
        locale,
        candidate
      ).length === 0
  );
}

/**
 * Deterministic runtime promotion. Research/rejected/duplicate/invalid records
 * are ignored, and an existing public biography is never overwritten.
 */
export function mergeReviewedWriterBiographyDrafts(
  countries: Country[],
  drafts: readonly WriterBiographyResearchDraft[]
): Country[] {
  const keyCounts = new Map<string, number>();
  for (const draft of drafts) {
    keyCounts.set(draft.key, (keyCounts.get(draft.key) || 0) + 1);
  }
  const targetKeyCounts = new Map<string, number>();
  for (const country of countries) {
    for (const writer of country.writers) {
      const key = `${country.id}:${writer.id}`;
      targetKeyCounts.set(key, (targetKeyCounts.get(key) || 0) + 1);
    }
  }
  const publishable = new Map(
    drafts
      .filter(
        (draft) =>
          keyCounts.get(draft.key) === 1 &&
          targetKeyCounts.get(draft.key) === 1 &&
          isWriterBiographyResearchDraftPublishable(draft)
      )
      .map((draft) => [draft.key, draft] as const)
  );

  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => {
      const draft = publishable.get(`${country.id}:${writer.id}`);
      if (!draft) return writer;
      const promoted = publicationTranslations(draft);
      const keepRussian = Boolean(selectWriterBiography(writer, "ru"));
      const keepEnglish = Boolean(selectWriterBiography(writer, "en"));
      if (keepRussian && keepEnglish) return writer;
      return {
        ...writer,
        biographyTranslations: {
          ...writer.biographyTranslations,
          ru: keepRussian ? writer.biographyTranslations?.ru : promoted.ru,
          en: keepEnglish ? writer.biographyTranslations?.en : promoted.en,
        },
      };
    }),
  }));
}
