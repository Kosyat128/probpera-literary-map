import { describe, expect, it } from "vitest";

import { getEvidenceBackedOppositeLocaleBookTitleAliases } from "./bookSearchAliases";
import { buildPublicBookArchive } from "./bookArchive";
import { countries } from "./countries";
import type { WorkLocale, WorkProfile } from "./countries/types";

// Entirely synthetic records: these URLs and editorial identities are test
// inputs for registered authority policies, not real bibliographic evidence.
function syntheticPublishedWork(): WorkProfile {
  const work: WorkProfile = {
    id: "synthetic-alias-work",
    title: "Условный маяк",
    originalTitle: "Synthetic Original Anchor",
    alternateTitles: ["Legacy alias without independent title evidence"],
    editorial: { status: "verified", reviewedAt: "2026-09-08" },
    translations: {},
    localizedTitles: {},
    sources: [],
  };
  for (const locale of ["ru", "en"] as const) {
    const ru = locale === "ru";
    const title = ru ? "Условный маяк" : "Synthetic Beacon";
    const language = ru ? "Russian" : "English";
    const market = ru ? "RU" : "US";
    const authorityIds = ru ? ["rsl", "eksmo"] : ["loc", "penguin-random-house"];
    const domains = ru ? ["search.rsl.ru", "eksmo.ru"] : ["catalog.loc.gov", "penguinrandomhouse.com"];
    const evidence = domains.map((domain, index) => ({
      entityKind: "manifestation" as const,
      manifestationId: `synthetic:${locale}:${index}`,
      sourceUrl: `https://${domain}/codex-synthetic-test/title-${locale}`,
      provider: "Synthetic test provider",
      authorityId: authorityIds[index],
      authorityTier: index === 0 ? "A" as const : "B" as const,
      recordKind: index === 0 ? "national-bibliography" as const : "publisher-catalog" as const,
      recordId: `synthetic-record:${locale}:${index}`,
      catalogTitleExact: title,
      locale,
      market,
      expressionLanguage: language,
      retrievedAt: "2026-09-08",
      checkedAt: "2026-09-08",
      checkedBy: "Synthetic test reviewer; not an editorial approval",
    }));
    work.localizedTitles![locale] = {
      entityKind: "expression", expressionId: `synthetic-expression:${locale}`,
      locale, value: title, status: "verified-published", expressionLanguage: language,
      market, selectionRule: "earliest-authorized-edition", evidence,
    };
    work.translations![locale] = {
      locale, title, sourceLanguage: language, status: "verified",
      method: "editorial-original", reviewedAt: "2026-09-08",
      description: ru
        ? "Редакционная аннотация описывает поэтику условного произведения, его композицию и место в литературной традиции без пересказа ключевых поворотов. Второе предложение содержит исключительно синтетический текст для проверки правил поиска и не описывает реальную книгу."
        : "This synthetic editorial annotation describes the structure and literary context of an imaginary work without disclosing decisive plot turns. The second sentence contains test prose for the search publication rules and makes no claim about a real book.",
      sourceUrls: evidence.map(record => record.sourceUrl),
    };
    work.sources!.push(...evidence.map(record => ({
      provider: record.provider, url: record.sourceUrl, authorityId: record.authorityId,
      recordId: record.recordId, recordKind: record.recordKind,
      market, language, fields: ["title" as const, "description" as const],
      usage: "reference-only" as const, retrievedAt: "2026-09-08",
    })));
  }
  return work;
}

describe("evidence-backed opposite-locale book search titles", () => {
  it.each<[WorkLocale, string]>([["ru", "Synthetic Beacon"], ["en", "Условный маяк"]])(
    "finds the other published title from %s without changing the work",
    (locale, title) => {
      const work = syntheticPublishedWork();
      const before = structuredClone(work);
      expect(getEvidenceBackedOppositeLocaleBookTitleAliases(work, locale)).toEqual([title]);
      expect(work).toEqual(before);
    }
  );

  it.each<[string, (work: WorkProfile) => void]>([
    ["missing published-title evidence", work => { delete work.localizedTitles!.en; }],
    ["changed translated title", work => { work.translations!.en!.title = "Changed without evidence"; }],
    ["changed evidence value", work => { work.localizedTitles!.en!.value = "Stale title"; }],
    ["only one independent record", work => { work.localizedTitles!.en!.evidence.pop(); }],
    ["unregistered authority", work => { work.localizedTitles!.en!.evidence[0].authorityId = "invented-authority"; }],
    ["wrong authority domain", work => { work.localizedTitles!.en!.evidence[0].sourceUrl = "https://unrelated.example/title"; }],
    ["conflicting evidence locations", work => {
      work.translations!.en!.titleEvidence = { ...work.localizedTitles!.en!, value: "Conflicting title" };
    }],
    ["missing structured title sources", work => { work.sources = work.sources!.filter(source => source.language !== "English"); }],
    ["withdrawn work publication", work => { work.editorial!.status = "draft"; }],
    ["draft translation", work => { work.translations!.en!.status = "draft"; }],
  ])("rejects %s", (_reason, mutate) => {
    const work = syntheticPublishedWork();
    mutate(work);
    expect(getEvidenceBackedOppositeLocaleBookTitleAliases(work, "ru")).toEqual([]);
  });

  it("accepts evidence stored on the translation without adding legacy aliases or credits", () => {
    const work = syntheticPublishedWork();
    work.translations!.en!.titleEvidence = work.localizedTitles!.en;
    delete work.localizedTitles!.en;
    work.authorship = { kind: "single", authors: [{ creditNames: { ru: "Условный автор", en: "Synthetic Credit" } }] };
    expect(getEvidenceBackedOppositeLocaleBookTitleAliases(work, "ru")).toEqual(["Synthetic Beacon"]);
  });

  it("does not add a duplicate when the exact title is already visible", () => {
    const work = syntheticPublishedWork();
    work.translations!.ru!.title = work.translations!.en!.title;
    expect(getEvidenceBackedOppositeLocaleBookTitleAliases(work, "ru")).toEqual([]);
  });

  it("keeps aliases attached to existing canonical public books and reports real browser candidates", () => {
    const books = buildPublicBookArchive(countries);
    const candidates: Array<{ key: string; ru: string; en: string; queryInRu: string[]; queryInEn: string[] }> = [];
    let ruAliasCount = 0;
    let enAliasCount = 0;
    for (const book of books) {
      const queryInRu = getEvidenceBackedOppositeLocaleBookTitleAliases(book, "ru");
      const queryInEn = getEvidenceBackedOppositeLocaleBookTitleAliases(book, "en");
      const ru = book.translations!.ru!.title.trim();
      const en = book.translations!.en!.title.trim();
      for (const alias of queryInRu) expect(alias).toBe(en);
      for (const alias of queryInEn) expect(alias).toBe(ru);
      ruAliasCount += queryInRu.length;
      enAliasCount += queryInEn.length;
      if (queryInRu.length || queryInEn.length) {
        candidates.push({ key: `${book.countryId}:${book.writerId}:${book.id}`, ru, en, queryInRu, queryInEn });
      }
    }
    // A bounded local runtime receipt, not a new editorial verification or a
    // requirement that the current catalog contain any accepted alias.
    console.info("S10_CANONICAL_BOOK_ALIAS_AUDIT", JSON.stringify({
      publicBooks: books.length, ruAliasCount, enAliasCount,
      bothLocales: candidates.filter(item => item.queryInRu.length && item.queryInEn.length).length,
      samples: candidates.filter(item => item.queryInRu.length && item.queryInEn.length).slice(0, 4),
    }));
  });
});
