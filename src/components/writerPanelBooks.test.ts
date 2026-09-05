import { describe, expect, it } from "vitest";
import { countries, bookArchiveCountries } from "../planet/catalog";
import { buildBookArchive } from "../planet/books";
import { isPublicBook } from "../data/bookQuality";
import { selectBookText } from "../data/bookLocalization";
import { groupPublicBooksForCountry } from "./writerPanelBooks";
import { writerWorksForPanel, writerAwardsForPanel } from "./writerPanelPresentation";

const archive = buildBookArchive(bookArchiveCountries);
const russia = countries.find(country => country.id === "russia")!;
const dostoevsky = russia.writers.find(writer => writer.id === "dostoevsky")!;
const crime = archive.find(book => book.countryId === "russia" && book.writerId === "dostoevsky" && book.id === "crime-and-punishment")!;

describe("writer panel shares the enriched publication-gated book runtime", () => {
  it.each(["ru", "en"] as const)("uses the same actual reviewed record in %s without rewriting writer facts", locale => {
    expect(isPublicBook(crime)).toBe(true);
    const original = JSON.stringify(dostoevsky);
    const works = groupPublicBooksForCountry(russia, archive).get(dostoevsky.id)!;
    expect(works.find(work => work.id === crime.id)).toBe(crime);
    const row = writerWorksForPanel(dostoevsky, locale, works).find(work => work.id === crime.id)!;
    expect(row.title).toBe(selectBookText(crime, locale).title);
    expect(row.sourceCount).toBeGreaterThan(0);
    expect(row.sourceUrl).toBeTruthy();
    expect(JSON.stringify(dostoevsky)).toBe(original);
  });

  it("excludes foreign-country and quarantined-writer routes without creating a second catalog", () => {
    const result = groupPublicBooksForCountry({ ...russia, writers: [dostoevsky] }, archive);
    expect([...result.keys()]).toEqual([dostoevsky.id]);
    for (const work of result.get(dostoevsky.id)!) {
      expect(work.countryId).toBe("russia");
      expect(work.writerId).toBe(dostoevsky.id);
      expect(archive.includes(work)).toBe(true);
    }
    expect(groupPublicBooksForCountry({ ...russia, writers: [] }, archive).size).toBe(0);
  });

  it("retains publication holds and deduplicates only the same canonical route", () => {
    const held = { ...crime, id: "held-example", editorial: { ...crime.editorial, status: "draft" as const } };
    const result = groupPublicBooksForCountry(russia, [crime, crime, held]);
    expect(result.get(dostoevsky.id)).toEqual([crime]);
    expect(writerWorksForPanel(dostoevsky, "ru", [held])).toEqual([]);
  });

  it("treats an unavailable runtime as unavailable instead of restoring raw writer workDetails", () => {
    expect(groupPublicBooksForCountry(russia, []).size).toBe(0);
    expect(writerWorksForPanel(dostoevsky, "ru", [])).toEqual([]);
    expect(writerAwardsForPanel(dostoevsky, null, "ru", []).filter(award => award.kind === "work-distinction")).toEqual([]);
  });
});
