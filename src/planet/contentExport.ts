import { authorities, registryVersion } from "../../data/book-canon-source-registry.json";
import { buildBookArchive, bookArchiveKey } from "../data/bookArchive";
import {
  WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
  writerBiographyEditorialReviewIssues,
  writerBiographyReviewSourceHash,
  writerBiographyReviewTargetHash,
} from "../data/biographyEditorialReview";
import { bookDescriptionProvenanceIssues, localizedBookTitleEvidenceIssues } from "../data/bookEvidence";
import { isPublicBook } from "../data/bookQuality";
import type { Country, WriterProfile } from "../data/countries/types";
import { reconcileWriterBiographyReviews, selectWriterBiography } from "../data/writerBiography";
import { writerSearchLabel } from "../utils/writerSearchLabel";
import { contentTextHash, contentUnitId } from "./contentExportHash";
import type {
  ContentCandidateSnapshot, ContentCandidateUnit, ContentEntityRef, ContentField,
  ContentLocale, HeldContentUnit,
} from "./contentExportTypes";

const locales = ["ru", "en"] as const;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const titleEvidenceContext = { canonRegistry: { authorities, registryVersion } };
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

function reasonCode(value: string) {
  // Some existing diagnostics append an imported market/authority value.
  // Keep the stable code only, never an arbitrary source string in held data.
  const code = value.split(":", 1)[0];
  return /^[a-z0-9][a-z0-9-]{0,159}$/u.test(code) ? code : "content-publication-check-failed";
}

function canonicalId(value: string) {
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > 256 ||
      /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("invalid-canonical-content-id");
}

function indexCountries(countries: readonly Country[]) {
  if (!Array.isArray(countries) || countries.length > 1024) throw new Error("invalid-canonical-country-inventory");
  const index = new Map<string, Country>();
  let writerCount = 0;
  for (const country of countries) {
    canonicalId(country.id);
    if (index.has(country.id)) throw new Error("duplicate-canonical-country-id");
    if (!Array.isArray(country.writers)) throw new Error("invalid-canonical-writer-inventory");
    const writers = new Set<string>();
    for (const writer of country.writers) {
      canonicalId(writer.id);
      if (writers.has(writer.id)) throw new Error("duplicate-canonical-writer-id");
      writers.add(writer.id);
      if (++writerCount > 25_000) throw new Error("canonical-writer-inventory-limit");
    }
    index.set(country.id, country);
  }
  return index;
}

function plainText(value: string, field: ContentField) {
  const maximum = field === "name" ? 240 : field === "biography" ? 1600 : field === "title" ? 1000 : 900;
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum &&
    !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

/**
 * Derives downloadable-data candidates from the existing canonical catalog.
 * The caller must pass the locale-independent countries/index source exports,
 * not active-locale UI proxies. No whole profile or embedded book writer is
 * serialized. This does not create another catalog owner or confer approval.
 */
export function buildCanonicalContentCandidate({
  countries,
  bookArchiveCountries = countries,
  sourceCommit,
}: {
  countries: readonly Country[];
  bookArchiveCountries?: readonly Country[];
  sourceCommit: string;
}): ContentCandidateSnapshot {
  if (typeof sourceCommit !== "string" || !/^[a-f0-9]{40}$/u.test(sourceCommit)) throw new Error("invalid-content-source-commit");
  const publicCountries = indexCountries(countries);
  if (bookArchiveCountries !== countries) indexCountries(bookArchiveCountries);
  const units: ContentCandidateUnit[] = [];
  const held: HeldContentUnit[] = [];
  const seen = new Set<string>();

  const hold = (entityRef: ContentEntityRef, field: ContentField, locale: ContentLocale, reasons: string[]) => {
    const id = contentUnitId(entityRef, field, locale);
    if (seen.has(id)) throw new Error("duplicate-canonical-content-unit");
    seen.add(id);
    held.push({ id, entityRef: { ...entityRef }, field, locale,
      reasons: [...new Set(reasons.map(reasonCode))].sort(compare) });
  };
  const add = (unit: Omit<ContentCandidateUnit, "id" | "contentHash">) => {
    if (!plainText(unit.text, unit.field)) {
      hold(unit.entityRef, unit.field, unit.locale, ["unsafe-or-unbounded-text"]);
      return;
    }
    const id = contentUnitId(unit.entityRef, unit.field, unit.locale);
    if (seen.has(id)) throw new Error("duplicate-canonical-content-unit");
    seen.add(id);
    units.push({ ...unit, entityRef: { ...unit.entityRef }, id,
      contentHash: contentTextHash(unit.text), dependencyIds: [...new Set(unit.dependencyIds)].sort(compare) });
  };

  for (const country of publicCountries.values()) {
    const countryRef: ContentEntityRef = { kind: "country", countryId: country.id };
    if (typeof country.name === "string" && country.name.trim()) {
      add({ entityRef: countryRef, field: "name", locale: "ru", text: country.name,
        observedRuSourceHash: contentTextHash(country.name), reviewedRuSourceHash: null,
        sourceHashContract: "utf8-sha256", dependencyIds: [], publicationBasis: "canonical-name-candidate" });
    } else hold(countryRef, "name", "ru", ["canonical-name-missing"]);
    // Existing country overlay hashes have no shared current-source verifier.
    // Do not publish a possibly stale English value or upgrade its legacy hash.
    hold(countryRef, "name", "en", ["country-name-source-binding-unverified"]);

    for (const currentWriter of country.writers) {
      const entityRef: ContentEntityRef = { kind: "writer", countryId: country.id, writerId: currentWriter.id };
      let ruName: string | null = null;
      try { ruName = writerSearchLabel(currentWriter, "ru"); } catch { /* held below */ }
      for (const locale of locales) {
        let name: string | null = null;
        try { name = writerSearchLabel(currentWriter, locale); } catch { /* held below */ }
        if (!name) { hold(entityRef, "name", locale, ["canonical-name-not-eligible"]); continue; }
        add({ entityRef, field: "name", locale, text: name,
          observedRuSourceHash: ruName ? contentTextHash(ruName) : null, reviewedRuSourceHash: null,
          sourceHashContract: "utf8-sha256",
          dependencyIds: locale === "en" ? [contentUnitId(entityRef, "name", "ru")] : [],
          // The current UI selector is not independent name evidence.
          publicationBasis: "canonical-name-candidate" });
      }

      let writer: WriterProfile;
      try { writer = reconcileWriterBiographyReviews(currentWriter); }
      catch {
        for (const locale of locales) hold(entityRef, "biography", locale, ["biography-source-invalid"]);
        continue;
      }
      const observedRuSourceHash = writerBiographyReviewSourceHash(writer, "ru");
      for (const locale of locales) {
        let biography;
        try { biography = selectWriterBiography(writer, locale); } catch { /* held below */ }
        if (!biography) {
          const reasons = ["biography-not-public"];
          const stored = writer.biographyTranslations?.[locale];
          if (stored?.status === "stale") reasons.push("biography-review-stale");
          if (stored && (stored.method === "human-translation" || stored.method === "machine-translation")) {
            try { reasons.push(...writerBiographyEditorialReviewIssues(stored, writer)); }
            catch { reasons.push("biography-review-invalid"); }
          }
          hold(entityRef, "biography", locale, reasons);
          continue;
        }
        const review = biography.editorialReview;
        const translated = biography.method === "human-translation" || biography.method === "machine-translation";
        if (locale === "en" && (!translated || biography.translatedFromLocale !== "ru" ||
            !review || review.decision !== "approved" || !observedRuSourceHash ||
            review.sourceHash !== observedRuSourceHash)) {
          hold(entityRef, "biography", locale, ["english-source-review-binding-missing"]);
          continue;
        }
        let observedTargetHash: string;
        try { observedTargetHash = writerBiographyReviewTargetHash(biography); }
        catch { hold(entityRef, "biography", locale, ["biography-review-invalid"]); continue; }
        add({ entityRef, field: "biography", locale, text: biography.text,
          observedRuSourceHash,
          reviewedRuSourceHash: translated && biography.translatedFromLocale === "ru" ? review?.sourceHash || null : null,
          sourceHashContract: WRITER_BIOGRAPHY_REVIEW_HASH_CONTRACT,
          observedTargetHash,
          ...(translated && review ? { reviewTargetHash: review.targetHash } : {}),
          dependencyIds: locale === "en" ? [contentUnitId(entityRef, "biography", "ru"), contentUnitId(entityRef, "name", "ru")] : [],
          publicationBasis: translated ? "reviewed-source-bound-prose" : "authored-public-prose" });
      }
    }
  }

  // Reuse the actual canonical archive builder, including its reviewed identity
  // merges/tombstones. Non-public records contribute only opaque IDs/reasons.
  const books = buildBookArchive([...bookArchiveCountries]);
  if (books.length > 50_000) throw new Error("canonical-work-inventory-limit");
  for (const book of books) {
    canonicalId(book.countryId); canonicalId(book.writerId); canonicalId(book.id);
    const entityRef: ContentEntityRef = { kind: "work", countryId: book.countryId, writerId: book.writerId, workId: book.id };
    if (!publicCountries.has(book.countryId) || !isPublicBook(book)) {
      for (const locale of locales) for (const field of ["title", "description"] as const) {
        hold(entityRef, field, locale, [publicCountries.has(book.countryId) ? "work-not-public" : "public-country-missing"]);
      }
      continue;
    }
    const ruTitle = book.translations?.ru?.title;
    const ruDescription = book.translations?.ru?.description;
    const descriptionSha256ByLocale = Object.fromEntries(locales.flatMap(locale => {
      const text = book.translations?.[locale]?.description;
      return typeof text === "string" ? [[locale, contentTextHash(text)]] : [];
    }));
    const context = { ...titleEvidenceContext, recordKey: bookArchiveKey(book.countryId, book.writerId, book.id),
      originCountryIds: [book.countryId], descriptionSha256ByLocale };
    const ruDescriptionIssues = bookDescriptionProvenanceIssues(book, "ru", context);
    for (const locale of locales) {
      const translation = book.translations![locale]!;
      const titleIssues = localizedBookTitleEvidenceIssues(book, locale, context);
      if (titleIssues.length) hold(entityRef, "title", locale, titleIssues);
      else add({ entityRef, field: "title", locale, text: translation.title,
        observedRuSourceHash: typeof ruTitle === "string" ? contentTextHash(ruTitle) : null,
        reviewedRuSourceHash: null, sourceHashContract: "utf8-sha256",
        dependencyIds: locale === "en" ? [contentUnitId(entityRef, "title", "ru")] : [],
        publicationBasis: "evidenced-title-candidate" });

      const descriptionIssues = locale === "ru" ? [...ruDescriptionIssues] : bookDescriptionProvenanceIssues(book, locale, context);
      const provenance = translation.descriptionProvenance;
      const observedRuSourceHash = typeof ruDescription === "string" ? contentTextHash(ruDescription) : null;
      if (locale === "en" && (provenance?.origin !== "human-translation" ||
          provenance.translatedFromLocale !== "ru" || !observedRuSourceHash ||
          !sha256Pattern.test(provenance.translatedFromSourceHash || "") ||
          provenance.translatedFromSourceHash !== observedRuSourceHash)) {
        descriptionIssues.push("english-description-source-binding-missing");
      }
      if (locale === "en" && ruDescriptionIssues.length) descriptionIssues.push("russian-description-source-not-public");
      // The current work schema can bind the Russian source, but carries no
      // immutable review of the exact English target. Its prose must remain
      // held until a versioned target-review contract exists and is satisfied.
      if (locale === "en") descriptionIssues.push("english-description-target-review-binding-missing");
      if (descriptionIssues.length) hold(entityRef, "description", locale, descriptionIssues);
      else add({ entityRef, field: "description", locale, text: translation.description,
        observedRuSourceHash,
        reviewedRuSourceHash: provenance?.origin === "human-translation" && provenance.translatedFromLocale === "ru"
          ? provenance.translatedFromSourceHash || null : null,
        sourceHashContract: "utf8-sha256",
        dependencyIds: locale === "en" ? [contentUnitId(entityRef, "description", "ru")] : [],
        publicationBasis: provenance?.origin === "human-translation" ? "reviewed-source-bound-prose" : "authored-public-prose" });
    }
  }
  return { schemaVersion: 1, contract: "literary-planet-content-candidate-v1", sourceCommit,
    requiredLocales: ["ru", "en"], namespace: "adult", releaseReady: false,
    units: units.sort((left, right) => compare(left.id, right.id)),
    held: held.sort((left, right) => compare(left.id, right.id)) };
}
