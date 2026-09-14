import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBookArchive } from "./bookArchive";
import { presentBookArchiveEntry } from "./bookArchiveQueue";
import { bookEvidenceV2Issues } from "./bookEvidence";
import { isPublicBook } from "./bookQuality";
import canonRegistry from "../../data/book-canon-source-registry.json";
import * as cmsOverrides from "./cms/editorialOverrides";
import { bookArchiveCountries } from "./countries";
import * as legacyReaudit from "./countries/bookEvidenceV2LegacyVerifiedReaudit01";
import type { Country, WorkProfile } from "./countries/types";

const { evidenceV2ProfileFromLiveContent } = await import(
  new URL("../../scripts/lib/book-evidence-v2-registry-rotation.mjs", import.meta.url).href
) as { evidenceV2ProfileFromLiveContent: (snapshot: unknown) => WorkProfile };
const packet = JSON.parse(readFileSync(new URL("../../reports/wells-editorial-repair-20260913.json", import.meta.url), "utf8"));
const england = bookArchiveCountries.find((country) => country.id === "england")!;
const wells = england.writers.find((writer) => writer.id === "h_g_wells")!;
const wellsCountry: Country = { ...england, writers: [wells] };
const key = "when-the-sleeper-wakes";
// Historical fallback must not become the newly exported CMS record it tests.
const baseline = (() => {
  const lookup = vi.spyOn(cmsOverrides, "cmsLiteraryWorkProfilesForWriter").mockReturnValue([]);
  try { return buildBookArchive([wellsCountry]).find((work) => work.id === key)!; }
  finally { lookup.mockRestore(); }
})();

function reviewedCmsWork(sourceContent = packet.afterContent): WorkProfile {
  const content = structuredClone(sourceContent);
  const contentText = JSON.stringify(content);
  return evidenceV2ProfileFromLiveContent({
    workId: packet.workId,
    legacyId: packet.legacyId,
    updatedAt: packet.expectedUpdatedAt,
    isCmsLocked: true,
    content,
    contentText,
    // This local fixture binds its own exact serialization; it is not a DB hash.
    contentSha256: createHash("sha256").update(contentText).digest("hex"),
  });
}

function mockCmsWorks(writerId: string, works: WorkProfile[]) {
  vi.spyOn(cmsOverrides, "cmsLiteraryWorkProfilesForWriter").mockImplementation(
    (country, writer) => country === "england" && writer === writerId ? works : []
  );
}

afterEach(() => vi.restoreAllMocks());

describe("reviewed Wells CMS content survives static archive overlays", () => {
  it("preserves the currently exported qualified CMS record independently of the historical fallback", () => {
    const currentCms = cmsOverrides.cmsLiteraryWorkProfilesForWriter("england", wells.id).find(work => work.id === key);
    const qualified = currentCms && isPublicBook(currentCms) &&
      currentCms.localizedTitles?.ru && currentCms.localizedTitles?.en &&
      currentCms.translations?.ru?.titleEvidence && currentCms.translations?.en?.titleEvidence &&
      currentCms.translations.ru.descriptionProvenance && currentCms.translations.en.descriptionProvenance;
    if (qualified) {
      expect(bookEvidenceV2Issues(currentCms, {
        canonRegistry, recordKey: `england:h_g_wells:${key}`, originCountryIds: ["england"],
        descriptionSha256ByLocale: {
          ru: createHash("sha256").update(currentCms.translations!.ru!.description).digest("hex"),
          en: createHash("sha256").update(currentCms.translations!.en!.description).digest("hex"),
        },
      })).toEqual([]);
    }
    const expected = qualified ? currentCms : baseline;
    for (const includeR49nCatalog of [true, false]) {
      const result = buildBookArchive([wellsCountry], { includeR49nCatalog }).find(work => work.id === key)!;
      for (const field of ["title", "description", "translations", "localizedTitles", "sources", "editorial"] as const) {
        expect(result[field], field).toEqual(expected[field]);
      }
    }
  });

  it("preserves the exact repaired CMS text, sources, titles and provenance in both archive modes", () => {
    const cmsWork = reviewedCmsWork();
    const original = structuredClone(cmsWork);
    expect(isPublicBook(cmsWork)).toBe(true);
    mockCmsWorks(wells.id, [cmsWork]);

    for (const includeR49nCatalog of [true, false]) {
      const result = buildBookArchive([wellsCountry], { includeR49nCatalog }).find((work) => work.id === key)!;
      for (const field of ["title", "description", "translations", "localizedTitles", "sources", "editorial"] as const) {
        expect(result[field], field).toEqual(cmsWork[field]);
      }
      expect(result.description).toBe(packet.beforeContent.work.description);
      expect(result.translations).not.toEqual(baseline.translations);
      for (const locale of ["ru", "en"] as const) {
        expect(presentBookArchiveEntry(result, locale).description).toBe(cmsWork.translations![locale]!.description);
      }
    }
    expect(cmsWork).toEqual(original);
  });

  it("keeps legacy proof-free CMS and drafts on the fallback without exposing private text", () => {
    const draft = reviewedCmsWork();
    draft.editorial = { status: "draft" };
    const privateDraft = { ...draft, id: "cms-private-wells-draft", title: "CMS-only draft fixture" };
    const legacyCms = reviewedCmsWork(packet.beforeContent);
    expect(isPublicBook(draft)).toBe(false);
    expect(isPublicBook(legacyCms)).toBe(true);

    for (const unqualifiedCms of [draft, legacyCms]) {
      mockCmsWorks(wells.id, [unqualifiedCms, privateDraft]);
      const result = buildBookArchive([wellsCountry]);
      const existing = result.find((work) => work.id === key)!;
      const privateResult = result.find((work) => work.id === privateDraft.id)!;
      expect(isPublicBook(privateResult)).toBe(false);
      for (const locale of ["ru", "en"] as const) {
        expect(existing.translations?.[locale]?.description).toBe(baseline.translations?.[locale]?.description);
        expect(existing.translations?.[locale]?.descriptionProvenance).toEqual(baseline.translations?.[locale]?.descriptionProvenance);
        expect(presentBookArchiveEntry(privateResult, locale).description).toBe("");
      }
    }
  });

  it("does not use another writer's CMS profile with the same local work ID", () => {
    const otherWriter = { ...wells, id: "cms-fixture-writer", workDetails: [] };
    mockCmsWorks(otherWriter.id, [reviewedCmsWork()]);
    const result = buildBookArchive([{ ...england, writers: [wells, otherWriter] }]);
    const wellsResult = result.find((work) => work.writerId === wells.id && work.id === key)!;
    expect(wellsResult.translations).toEqual(baseline.translations);
    expect(wellsResult.description).toBe(baseline.description);
  });

  it("lets the final legacy review quarantine even an accepted CMS profile", () => {
    const cmsWork = reviewedCmsWork();
    mockCmsWorks(wells.id, [cmsWork]);
    const actualReaudit = legacyReaudit.applyBookEvidenceV2LegacyVerifiedReaudit01Work;
    vi.spyOn(legacyReaudit, "applyBookEvidenceV2LegacyVerifiedReaudit01Work").mockImplementation((country, writer, work) => {
      if (country !== "england" || writer !== wells.id || work.id !== key) return actualReaudit(country, writer, work);
      // Simulate a future Wells hold through the existing real quarantine rule.
      expect(work.translations).toEqual(cmsWork.translations);
      const held = actualReaudit("chile", "pablo_neruda", { ...work, id: "twenty-love-poems" });
      return { ...held, id: key };
    });
    const result = buildBookArchive([wellsCountry]).find((work) => work.id === key)!;
    expect(result.editorial?.status).toBe("draft");
    expect(isPublicBook(result)).toBe(false);
    expect(result.translations?.ru?.status).toBe("draft");
    expect(result.translations?.en?.status).toBe("draft");
  });
});
