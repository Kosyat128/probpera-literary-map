import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildBookArchive, buildPublicBookArchive, type BookArchiveEntry } from "../data/bookArchive";
import { writerBiographyReviewSourceHash, writerBiographyReviewTargetHash } from "../data/biographyEditorialReview";
import { bookArchiveCountries as canonicalBookCountries, countries as canonicalCountries } from "../data/countries/index";
import type { Country, WorkProfile, WriterBiographyTranslationProfile, WriterProfile } from "../data/countries/types";
import { buildCanonicalContentCandidate } from "./contentExport";
import { contentTextHash, contentUnitId } from "./contentExportHash";
import type { ContentCandidateSnapshot, ContentEntityRef, ContentField, ContentLocale } from "./contentExportTypes";

const sourceCommit = "a".repeat(40);
const canonicalBook = buildPublicBookArchive(canonicalBookCountries).find(book =>
  book.countryId === "russia" && book.writerId === "dostoevsky" && book.id === "crime-and-punishment"
)!;
// Materialize the serializable record once; tests never mutate live catalog
// views. The changed IDs/credits/provenance below are synthetic fixtures only.
const workTemplate = JSON.parse(JSON.stringify(canonicalBook)) as BookArchiveEntry;
const ref: ContentEntityRef = { kind: "writer", countryId: "russia", writerId: "s08-synthetic-writer" };
const workRef: ContentEntityRef = { kind: "work", countryId: "russia", writerId: "s08-synthetic-writer", workId: "s08-synthetic-work" };

function syntheticWork(): WorkProfile {
  const value = structuredClone(workTemplate) as Partial<BookArchiveEntry>;
  for (const key of ["country", "writer", "countryId", "countryName", "writerId", "writerName"] as const) delete value[key];
  value.id = "s08-synthetic-work";
  delete value.authorship;
  const sourceUrls = ["https://search.rsl.ru/synthetic-content-export", "https://eksmo.ru/synthetic-content-export"];
  value.sources!.push(...sourceUrls.map((url, index) => ({
    url, provider: "Synthetic description authority fixture", authorityId: index ? "eksmo" : "rsl",
    authorityTier: index ? "B" as const : "A" as const, market: "RU", language: "Russian",
    recordKind: "authoritative-work-page" as const, recordId: `synthetic-${index}`,
    fields: ["description" as const], usage: "reference-only" as const, retrievedAt: "2026-09-08",
  })));
  for (const locale of ["ru", "en"] as const) {
    const translation = value.translations![locale]!;
    translation.sourceUrls.push(...sourceUrls);
    translation.method = locale === "ru" ? "editorial-original" : "human-translation";
    if (locale === "en") translation.sourceLanguage = "Russian";
    translation.descriptionProvenance = {
      origin: locale === "ru" ? "official-source-synthesis" : "human-translation",
      sourceLanguage: "Russian", sourceCountry: "russia", sourceUrls,
      rights: { textOrigin: "project-original", copiedSourceText: false },
      author: "Synthetic fixture author; no real editorial approval",
      createdAt: "2026-09-08", reviewedAt: "2026-09-08", reviewedBy: "Synthetic fixture reviewer",
      ...(locale === "en" ? { translatedFromLocale: "ru" as const,
        translatedFromSourceHash: contentTextHash(value.translations!.ru!.description) } : {}),
    };
  }
  return value as WorkProfile;
}

function fixture() {
  const ru: WriterBiographyTranslationProfile = {
    locale: "ru", sourceLanguage: "ru", method: "editorial-original", status: "verified",
    text: "Этот условный писатель создан исключительно для проверки экспорта литературных данных и не представляет реального человека. Его синтетическая биография позволяет проверить связь исходного текста и перевода без публикации выдуманных фактов.",
    reviewedAt: "2026-09-08", reviewer: "Synthetic Russian fixture reviewer", sourceTextRights: "project-original",
    sources: [{ provider: "Synthetic source fixture", url: "https://example.org/synthetic-content-export",
      fields: ["identity", "biography-facts"], usage: "fact-check", retrievedAt: "2026-09-08" }],
  };
  const en: WriterBiographyTranslationProfile = {
    locale: "en", sourceLanguage: "ru", method: "human-translation", status: "reviewed",
    text: "This synthetic writer exists only to test literary data export and does not describe a real person. The example biography exercises the source and translation binding without publishing invented facts as catalog content.",
    reviewedAt: "2026-09-08", reviewer: "Synthetic English fixture reviewer",
    translatedFromLocale: "ru", sourceTextRights: "project-original", sources: structuredClone(ru.sources),
  };
  const writer: WriterProfile = { id: "s08-synthetic-writer", name: "Условный писатель", fullName: "Synthetic Writer",
    bio: "SECRET LEGACY PROSE MUST NOT BE EXPORTED", biographyTranslations: { ru, en }, workDetails: [syntheticWork()] };
  en.editorialReview = {
    schemaVersion: 1, hashContract: "writer-biography-review-v1", decision: "approved", reviewerType: "human",
    reviewer: en.reviewer!, reviewedAt: en.reviewedAt!, evidenceRef: "editorial-review:s08-synthetic-fixture",
    sourceHash: writerBiographyReviewSourceHash(writer, "ru")!, targetHash: writerBiographyReviewTargetHash(en),
  };
  const country: Country = { id: "russia", name: "Россия", writers: [writer] };
  return { country, writer, ru, en };
}

const project = (country: Country) => buildCanonicalContentCandidate({ countries: [country], sourceCommit });
function unit(snapshot: ContentCandidateSnapshot, entity: ContentEntityRef, field: ContentField, locale: ContentLocale) {
  return snapshot.units.find(item => item.id === contentUnitId(entity, field, locale));
}
function held(snapshot: ContentCandidateSnapshot, entity: ContentEntityRef, field: ContentField, locale: ContentLocale) {
  return snapshot.held.find(item => item.id === contentUnitId(entity, field, locale));
}

describe("canonical adult content candidate export", () => {
  it("projects exact fields and distinct observed/reviewed hashes without exposing entire profiles", () => {
    const { country, ru, en } = fixture();
    const before = structuredClone(country);
    const snapshot = project(country);
    expect(snapshot).toMatchObject({ schemaVersion: 1, contract: "literary-planet-content-candidate-v1",
      namespace: "adult", requiredLocales: ["ru", "en"], sourceCommit, releaseReady: false });
    const english = unit(snapshot, ref, "biography", "en")!;
    expect(english).toMatchObject({ text: en.text, publicationBasis: "reviewed-source-bound-prose",
      sourceHashContract: "writer-biography-review-v1", reviewedRuSourceHash: en.editorialReview!.sourceHash,
      observedRuSourceHash: en.editorialReview!.sourceHash, observedTargetHash: en.editorialReview!.targetHash,
      reviewTargetHash: en.editorialReview!.targetHash });
    expect(english.contentHash).toBe(createHash("sha256").update(en.text).digest("hex"));
    expect(english.contentHash).not.toBe(english.observedTargetHash);
    expect(unit(snapshot, ref, "biography", "ru")).toMatchObject({ text: ru.text,
      observedRuSourceHash: en.editorialReview!.sourceHash, reviewedRuSourceHash: null });
    expect(JSON.stringify(snapshot)).not.toMatch(/SECRET|portrait|workDetails|biographyTranslations|Synthetic source fixture/);
    expect(country).toEqual(before);
  });

  it("keeps current writer names as candidates and never invents English country source verification", () => {
    const { country } = fixture();
    const snapshot = project(country);
    for (const locale of ["ru", "en"] as const) expect(unit(snapshot, ref, "name", locale))
      .toMatchObject({ publicationBasis: "canonical-name-candidate", reviewedRuSourceHash: null });
    const countryRef: ContentEntityRef = { kind: "country", countryId: country.id };
    expect(held(snapshot, countryRef, "name", "en")?.reasons).toEqual(["country-name-source-binding-unverified"]);
    expect(unit(snapshot, countryRef, "name", "en")).toBeUndefined();
  });

  it("holds an English-ineligible writer label without deriving a spelling from its technical ID", () => {
    const { country, writer } = fixture();
    delete writer.fullName;
    expect(held(project(country), ref, "name", "en")?.reasons).toEqual(["canonical-name-not-eligible"]);
  });

  it.each(["draft", "stale", "raw machine translation"])("never serializes %s biography text", condition => {
    const { country, en } = fixture();
    en.text = "SECRET WITHHELD ENGLISH BIOGRAPHY";
    if (condition === "raw machine translation") { en.method = "machine-translation"; delete en.editorialReview; }
    else en.status = condition as "draft" | "stale";
    const snapshot = project(country);
    expect(unit(snapshot, ref, "biography", "en")).toBeUndefined();
    expect(held(snapshot, ref, "biography", "en")).toBeDefined();
    expect(JSON.stringify(snapshot)).not.toContain("SECRET");
  });

  it.each(["source text", "source metadata", "target text", "withdrawn review"])("holds a biography after %s changes without repairing historical approval", condition => {
    const { country, ru, en } = fixture();
    const originalReview = structuredClone(en.editorialReview);
    if (condition === "source text") ru.text += " Это проверка изменения русского источника.";
    if (condition === "source metadata") ru.reviewer = "Different synthetic Russian reviewer";
    if (condition === "target text") en.text += " This sentence changes the approved target.";
    if (condition === "withdrawn review") en.editorialReview!.decision = "withdrawn";
    const snapshot = project(country);
    expect(unit(snapshot, ref, "biography", "en")).toBeUndefined();
    expect(held(snapshot, ref, "biography", "en")).toBeDefined();
    expect(en.editorialReview!.sourceHash).toBe(originalReview!.sourceHash);
    expect(en.editorialReview!.targetHash).toBe(originalReview!.targetHash);
    expect(en.status).toBe("reviewed");
  });

  it("holds independently authored English prose lacking an actual source-bound translation review", () => {
    const { country, en } = fixture();
    en.method = "editorial-original";
    delete en.editorialReview;
    const snapshot = project(country);
    expect(held(snapshot, ref, "biography", "en")?.reasons).toContain("english-source-review-binding-missing");
    expect(JSON.stringify(snapshot)).not.toContain(en.text);
  });

  it("exports evidenced titles and Russian prose while holding English prose without an immutable target review", () => {
    const { country, writer } = fixture();
    const book = writer.workDetails![0];
    const snapshot = project(country);
    for (const locale of ["ru", "en"] as const) {
      expect(unit(snapshot, workRef, "title", locale)).toMatchObject({
        entityRef: workRef, text: book.translations![locale]!.title, publicationBasis: "evidenced-title-candidate",
        reviewedRuSourceHash: null,
      });
    }
    expect(unit(snapshot, workRef, "description", "ru")).toMatchObject({
      publicationBasis: "authored-public-prose", text: book.translations!.ru!.description,
      sourceHashContract: "utf8-sha256", reviewedRuSourceHash: null,
    });
    expect(unit(snapshot, workRef, "description", "en")).toBeUndefined();
    expect(held(snapshot, workRef, "description", "en")?.reasons)
      .toContain("english-description-target-review-binding-missing");
    expect(snapshot.units.map(item => item.text)).not.toContain(book.translations!.en!.description);
  });

  it.each(["changed Russian description", "source provenance withdrawn", "unbound English description"])("holds description after %s without hiding an independently evidenced title", condition => {
    const { country, writer } = fixture();
    const book = writer.workDetails![0];
    if (condition === "changed Russian description") {
      book.translations!.ru!.description = "Синтетическая поправка: " + book.translations!.ru!.description;
    }
    if (condition === "source provenance withdrawn") delete book.translations!.ru!.descriptionProvenance;
    if (condition === "unbound English description") delete book.translations!.en!.descriptionProvenance!.translatedFromSourceHash;
    const snapshot = project(country);
    expect(unit(snapshot, workRef, "description", "en")).toBeUndefined();
    expect(held(snapshot, workRef, "description", "en")?.reasons)
      .toContain(condition === "source provenance withdrawn" ? "russian-description-source-not-public"
        : "english-description-source-binding-missing");
    expect(unit(snapshot, workRef, "title", "en")).toBeDefined();
  });

  it.each(["missing English evidence", "guessed English title"])("holds %s without adding Russian fallback text", condition => {
    const { country, writer } = fixture();
    const book = writer.workDetails![0];
    if (condition === "missing English evidence") { delete book.localizedTitles?.en; delete book.translations!.en!.titleEvidence; }
    else book.translations!.en!.title = "SECRET GUESSED ENGLISH TITLE";
    const snapshot = project(country);
    expect(unit(snapshot, workRef, "title", "en")).toBeUndefined();
    expect(held(snapshot, workRef, "title", "en")).toBeDefined();
    expect(unit(snapshot, workRef, "title", "ru")).toBeDefined();
    expect(JSON.stringify(snapshot)).not.toContain("SECRET");
  });

  it("keeps nonpublic work content in an ID-only held report", () => {
    const { country, writer } = fixture();
    writer.workDetails![0].editorial!.status = "draft";
    writer.workDetails![0].translations!.en!.title = "SECRET DRAFT TITLE";
    const snapshot = project(country);
    expect(snapshot.units.filter(item => item.entityRef.kind === "work")).toEqual([]);
    expect(snapshot.held.filter(item => item.entityRef.kind === "work")).toHaveLength(4);
    expect(JSON.stringify(snapshot)).not.toContain("SECRET");
  });

  it("redacts imported diagnostic values as well as withheld title text", () => {
    const { country, writer } = fixture();
    const work = writer.workDetails![0];
    const evidence = work.localizedTitles?.en ?? work.translations!.en!.titleEvidence;
    expect(evidence).toBeDefined();
    evidence!.market = "SECRET IMPORTED MARKET VALUE";
    const snapshot = project(country);
    expect(held(snapshot, workRef, "title", "en")).toBeDefined();
    expect(JSON.stringify(snapshot)).not.toContain("SECRET");
    expect(snapshot.held.every(item => item.reasons.every(reason => /^[a-z0-9][a-z0-9-]*$/u.test(reason)))).toBe(true);
  });

  it("allows separately gated work titles to survive writer quarantine without restoring the removed identity", () => {
    const { country } = fixture();
    const snapshot = buildCanonicalContentCandidate({
      countries: [{ id: country.id, name: country.name, writers: [] }], bookArchiveCountries: [country], sourceCommit,
    });
    expect(snapshot.units.some(item => item.entityRef.kind === "writer")).toBe(false);
    expect(unit(snapshot, workRef, "title", "en")).toBeDefined();
    expect(JSON.stringify(snapshot)).not.toContain("Synthetic Writer");
    expect(JSON.stringify(snapshot)).not.toContain("SECRET");
  });

  it("holds works whose country no longer exists in the public source", () => {
    const { country } = fixture();
    const snapshot = buildCanonicalContentCandidate({ countries: [], bookArchiveCountries: [country], sourceCommit });
    expect(snapshot.units).toEqual([]);
    expect(snapshot.held).toHaveLength(4);
    expect(snapshot.held.every(item => item.reasons.includes("public-country-missing"))).toBe(true);
  });

  it("is deterministic across input order and does not mutate canonical records", () => {
    const { country } = fixture();
    const other: Country = { id: "synthetic-second-country", name: "Другая страна", writers: [
      { id: "second-writer", name: "Второй писатель", fullName: "Second Writer" },
      { id: "first-writer", name: "Первый писатель", fullName: "First Writer" },
    ] };
    const before = structuredClone([country, other]);
    const first = buildCanonicalContentCandidate({ countries: [country, other], sourceCommit });
    const second = buildCanonicalContentCandidate({ countries: [{ ...other, writers: [...other.writers].reverse() }, country], sourceCommit });
    expect(second).toEqual(first);
    expect(first.units.map(item => item.id)).toEqual(first.units.map(item => item.id).sort());
    expect([country, other]).toEqual(before);
  });

  it.each(["country", "writer"])("rejects ambiguous duplicate %s IDs instead of exporting arbitrary first matches", kind => {
    const { country } = fixture();
    if (kind === "writer") country.writers.push(structuredClone(country.writers[0]));
    expect(() => buildCanonicalContentCandidate({ countries: kind === "country" ? [country, structuredClone(country)] : [country], sourceCommit }))
      .toThrow(`duplicate-canonical-${kind}-id`);
  });

  it("preserves real canonical work IDs without claiming the current production catalog is complete", () => {
    const country = canonicalCountries.find(item => item.id === canonicalBook.countryId)!;
    const archiveCountry = canonicalBookCountries.find(item => item.id === canonicalBook.countryId)!;
    const currentWriter = country.writers.find(item => item.id === canonicalBook.writerId)!;
    const archiveWriter = archiveCountry.writers.find(item => item.id === canonicalBook.writerId)!;
    const publicSource = { ...country, writers: [currentWriter] };
    const archiveSource = { ...archiveCountry, writers: [archiveWriter] };
    const snapshot = buildCanonicalContentCandidate({ countries: [publicSource], bookArchiveCountries: [archiveSource], sourceCommit });
    const exactKeys = new Set(buildBookArchive([archiveSource]).map(book => `${book.countryId}:${book.writerId}:${book.id}`));
    for (const item of [...snapshot.units, ...snapshot.held]) {
      if (item.entityRef.kind !== "work") continue;
      expect(exactKeys.has(`${item.entityRef.countryId}:${item.entityRef.writerId}:${item.entityRef.workId}`)).toBe(true);
    }
    const actualRef: ContentEntityRef = { kind: "work", countryId: canonicalBook.countryId, writerId: canonicalBook.writerId, workId: canonicalBook.id };
    expect(unit(snapshot, actualRef, "title", "en")?.text).toBe(canonicalBook.translations!.en!.title);
    expect(snapshot.releaseReady).toBe(false);
  });
});
