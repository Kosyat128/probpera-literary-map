import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import registry from "../../../data/book-canon-source-registry.json";
import { buildBookArchive } from "../bookArchive";
import { bookEvidenceV2Issues } from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import type { Country } from "./types";
import {
  bookR49nStoweRecovered20260912Key,
  mergeBookR49nStoweRecovered20260912,
} from "./bookR49nStoweRecovered20260912";

const fixture: Country[] = [
  { id: "russia", name: "Россия", writers: [] },
  { id: "usa", name: "США", writers: [{ id: "existing", name: "Existing", bio: "Retained biography", workDetails: [{ id: "existing-work", title: "Existing work" }] }] },
];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

describe("retained R49N Stowe book profile", () => {
  it("adds exactly the accepted work and preserves every existing author and country", () => {
    const before = structuredClone(fixture);
    const merged = mergeBookR49nStoweRecovered20260912(fixture);
    expect(fixture).toEqual(before);
    expect(merged[0]).toBe(fixture[0]);
    expect(merged[1].writers[0]).toBe(fixture[1].writers[0]);
    const writer = merged[1].writers[1];
    expect(writer.workDetails).toHaveLength(1);
    expect(`${merged[1].id}:${writer.id}:${writer.workDetails![0].id}`).toBe(bookR49nStoweRecovered20260912Key);
    expect(writer).not.toHaveProperty("bio");
    expect(writer).not.toHaveProperty("biographyTranslations");
    expect(writer).not.toHaveProperty("editorial");
    expect(mergeBookR49nStoweRecovered20260912(merged)).toEqual(merged);
  });

  it("retains exact historical RU/EN annotations, provenance, authorship and distinct edition dates", () => {
    const work = mergeBookR49nStoweRecovered20260912(fixture)[1].writers[1].workDetails![0];
    expect(hash(work.translations!.ru!.description!)).toBe("10ef92d8a4d3a4242fb12994fab900cebc858a788816f34ef59484d1c2790d0e");
    expect(hash(work.translations!.en!.description!)).toBe("f3d2a647af1c673b6482289d08d52f3988a54560cdf3009fa3ec9deaf0380783");
    expect(work.translations!.ru!.descriptionProvenance!.reviewedAt).toBe("2026-09-04");
    expect(work.authorship?.authors[0]).toMatchObject({ countryId: "usa", writerId: "harriet_beecher_stowe", creditNames: { ru: "Гарриет Бичер-Стоу", en: "Harriet Beecher Stowe" } });
    expect(work.firstPublished).toBe(1852);
    expect(work.localizedTitles?.en?.market).toBe("GB");
    expect(work.localizedTitles?.en?.evidence.map(item => item.publicationYear)).toEqual([1852, 1995]);
    expect(work.localizedTitles?.ru?.evidence[0].translator).toBeUndefined();
    expect(work).not.toHaveProperty("canon");
    expect(work).not.toHaveProperty("coverUrl");
  });

  it("is discoverable with its country and author through the existing archive builder and passes the actual current evidence gate", () => {
    const before = buildBookArchive(fixture);
    const after = buildBookArchive(mergeBookR49nStoweRecovered20260912(fixture));
    const added = after.filter(work => `${work.countryId}:${work.writerId}:${work.id}` === bookR49nStoweRecovered20260912Key);
    expect(added).toHaveLength(1);
    expect(after).toHaveLength(before.length + 1);
    const work = added[0];
    expect(work.countryId).toBe("usa");
    expect(work.writerName).toBe("Гарриет Бичер-Стоу");
    expect(isPublicBook(work)).toBe(true);
    expect(bookEvidenceV2Issues(work, { canonRegistry: registry, recordKey: bookR49nStoweRecovered20260912Key, originCountryIds: ["usa"] })).toEqual([]);
  });

  it("rejects ambiguous country, author and work matches while preserving existing writer biographies", () => {
    expect(() => mergeBookR49nStoweRecovered20260912([])).toThrow("country-cardinality");
    expect(() => mergeBookR49nStoweRecovered20260912([fixture[1], fixture[1]])).toThrow("country-cardinality");
    const merged = mergeBookR49nStoweRecovered20260912(fixture);
    const writer = { ...merged[1].writers[1], bio: "Existing independently reviewed biography" };
    const withWriter = [{ ...fixture[1], writers: [writer] }];
    expect(mergeBookR49nStoweRecovered20260912(withWriter)[0].writers[0].bio).toBe(writer.bio);
    expect(() => mergeBookR49nStoweRecovered20260912([{ ...fixture[1], writers: [writer, writer] }])).toThrow("writer-cardinality");
    expect(() => mergeBookR49nStoweRecovered20260912([{ ...fixture[1], writers: [{ ...writer, workDetails: [writer.workDetails![0], writer.workDetails![0]] }] }])).toThrow("work-cardinality");
  });
});
