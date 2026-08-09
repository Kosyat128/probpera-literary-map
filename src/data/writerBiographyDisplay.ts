import type {
  WriterBiographyLocale,
  WriterBiographySourceProfile,
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";
import {
  isGenericBiographyText,
  legacyWriterBiography,
  selectWriterBiography,
} from "./writerBiography";

export type WriterBiographyDisplay =
  | {
      kind: "published";
      locale: WriterBiographyLocale;
      text: string;
      editorialStatus: WriterBiographyTranslationProfile["status"];
      publicationGate: "passed";
      factCheckStatus: "existing-publication-metadata";
      provenanceStatus: "recorded";
      rightsStatus: "recorded";
      noticeCode: null;
      sources: WriterBiographySourceProfile[];
    }
  | {
      kind: "legacy-unverified";
      locale: "ru";
      text: string;
      editorialStatus: "unverified";
      publicationGate: "not-passed";
      factCheckStatus: "not-recorded";
      provenanceStatus: "not-recorded";
      rightsStatus: "not-recorded";
      noticeCode: "legacy-biography-unverified";
      sources: [];
    };

/**
 * Returns a visitor-facing biography without changing the strict publication
 * gate. A gate-passing locale is preferred. For Russian only, a legacy text
 * may be exposed after the existing automated screen has rejected known
 * service/generic placeholders. Its unverified classification is internal QA
 * metadata only; public views intentionally render no status marker.
 *
 * `legacy-unverified` never means fact-checked, licensed or provenance-backed.
 * `noticeCode` remains internal QA metadata; current public views deliberately
 * render no status marker. They must not reuse the writer-card
 * `editorial.status` as evidence for this text.
 */
export function selectWriterBiographyForDisplay(
  writer: WriterProfile,
  locale: WriterBiographyLocale
): WriterBiographyDisplay | null {
  const published = selectWriterBiography(writer, locale);
  if (published) {
    return {
      kind: "published",
      locale,
      text: published.text.trim(),
      editorialStatus: published.status,
      publicationGate: "passed",
      factCheckStatus: "existing-publication-metadata",
      provenanceStatus: "recorded",
      rightsStatus: "recorded",
      noticeCode: null,
      sources: published.sources,
    };
  }

  // A Russian legacy field must never become a fallback translation.
  if (locale !== "ru") return null;

  const text = legacyWriterBiography(writer);
  if (!text || isGenericBiographyText(text)) return null;

  return {
    kind: "legacy-unverified",
    locale: "ru",
    text,
    editorialStatus: "unverified",
    publicationGate: "not-passed",
    factCheckStatus: "not-recorded",
    provenanceStatus: "not-recorded",
    rightsStatus: "not-recorded",
    noticeCode: "legacy-biography-unverified",
    sources: [],
  };
}
