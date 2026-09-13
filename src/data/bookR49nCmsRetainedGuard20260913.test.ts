import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBookArchive } from "./bookArchive";
import { presentBookArchiveEntry } from "./bookArchiveQueue";
import { bookPublicationIssues, isPublicBook } from "./bookQuality";
import * as cmsOverrides from "./cms/editorialOverrides";
import { bookArchiveCountries } from "./countries";
import type { Country, WorkProfile } from "./countries/types";

const usa = bookArchiveCountries.find((country) => country.id === "usa")!;
const alcott = usa.writers.find((writer) => writer.id === "louisa_may_alcott")!;
const alcottCountry: Country = { ...usa, writers: [alcott] };
const retained = buildBookArchive([alcottCountry]).find((work) => work.id === "little-women")!;
const futureDescriptions = {
  ru: "Сёстры Марч растут в семейном доме и стараются поддерживать друг друга, когда привычная жизнь требует терпения и самостоятельных решений. Их повседневные заботы, разногласия и надежды складываются в историю взросления, где каждая из сестёр ищет собственный путь.",
  en: "The March sisters grow up in their family home and try to support one another when everyday life requires patience and independent decisions. Their daily concerns, disagreements and hopes form a coming-of-age story in which each sister looks for her own path.",
};

// Simulate a later approved CMS snapshot without changing catalog evidence.
function futureCmsWork(id = "little-women"): WorkProfile {
  const work = structuredClone(alcott.workDetails!.find((entry) => entry.id === "little-women")!);
  return {
    ...work,
    id,
    title: id === "little-women" ? work.title : "CMS-only draft fixture",
    description: futureDescriptions.ru,
    editorial: { status: "verified", reviewedAt: "2026-09-13" },
    translations: {
      ru: { ...work.translations!.ru!, description: futureDescriptions.ru, status: "verified", reviewedAt: "2026-09-13" },
      en: { ...work.translations!.en!, description: futureDescriptions.en, status: "verified", reviewedAt: "2026-09-13" },
    },
  };
}

function mockCmsWorks(countryId: string, writerId: string, works: WorkProfile[]) {
  vi.spyOn(cmsOverrides, "cmsLiteraryWorkProfilesForWriter").mockImplementation(
    (country, writer) => country === countryId && writer === writerId ? works : []
  );
}

afterEach(() => vi.restoreAllMocks());

describe("R49N retained text preserves explicitly published CMS works", () => {
  it("keeps a later verified CMS edit to a retained key in both languages", () => {
    const cmsWork = futureCmsWork();
    expect(bookPublicationIssues(cmsWork)).toEqual([]);
    expect(isPublicBook(cmsWork)).toBe(true);
    mockCmsWorks("usa", "louisa_may_alcott", [cmsWork]);

    const result = buildBookArchive([alcottCountry]).find((work) => work.id === cmsWork.id)!;
    expect(isPublicBook(result)).toBe(true);
    expect(result.editorial).toEqual(cmsWork.editorial);
    for (const locale of ["ru", "en"] as const) {
      expect(result.translations?.[locale]?.description).toBe(futureDescriptions[locale]);
      expect(result.translations?.[locale]?.description).not.toBe(retained.translations?.[locale]?.description);
      expect(result.translations?.[locale]?.status).toBe("verified");
      expect(result.translations?.[locale]).not.toHaveProperty("retainedCatalogSource");
      expect(presentBookArchiveEntry(result, locale).description).toBe(futureDescriptions[locale]);
    }
  });

  it("does not exempt unverified CMS text or expose an ordinary CMS draft", () => {
    const draft = futureCmsWork();
    draft.editorial = { status: "draft" };
    const unrelatedDraft = { ...draft, id: "cms-private-draft", title: "CMS-only draft fixture" };
    expect(isPublicBook(draft)).toBe(false);
    mockCmsWorks("usa", "louisa_may_alcott", [draft, unrelatedDraft]);

    const result = buildBookArchive([alcottCountry]);
    const retainedResult = result.find((work) => work.id === "little-women")!;
    const privateResult = result.find((work) => work.id === "cms-private-draft")!;
    expect(isPublicBook(retainedResult)).toBe(false);
    expect(isPublicBook(privateResult)).toBe(false);
    for (const locale of ["ru", "en"] as const) {
      expect(retainedResult.translations?.[locale]?.description).toBe(retained.translations?.[locale]?.description);
      expect(presentBookArchiveEntry(retainedResult, locale).description).not.toBe(futureDescriptions[locale]);
      expect(privateResult.translations?.[locale]).not.toHaveProperty("retainedCatalogSource");
      expect(presentBookArchiveEntry(privateResult, locale).description).toBe("");
    }
  });

  it("does not share the CMS exemption with another writer using the same local ID", () => {
    const otherWriter = { ...alcott, id: "cms-fixture-writer", workDetails: [] };
    mockCmsWorks("usa", otherWriter.id, [futureCmsWork()]);
    const result = buildBookArchive([{ ...usa, writers: [alcott, otherWriter] }]);
    const alcottResult = result.find((work) => work.writerId === alcott.id && work.id === "little-women")!;
    expect(isPublicBook(alcottResult)).toBe(false);
    expect(alcottResult.translations?.ru?.description).toBe(retained.translations?.ru?.description);
  });

  it("still applies the final legacy quarantine after accepting a valid CMS candidate", () => {
    const chile = bookArchiveCountries.find((country) => country.id === "chile")!;
    const neruda = chile.writers.find((writer) => writer.id === "pablo_neruda")!;
    const cmsWork = futureCmsWork("twenty-love-poems");
    expect(isPublicBook(cmsWork)).toBe(true);
    mockCmsWorks("chile", "pablo_neruda", [cmsWork]);

    const result = buildBookArchive([{ ...chile, writers: [neruda] }])
      .find((work) => work.id === "twenty-love-poems")!;
    expect(result.editorial?.status).toBe("draft");
    expect(isPublicBook(result)).toBe(false);
  });
});
