import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBookArchive, resolveBookArchivePublicTarget } from "../bookArchive";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries, countries } from "./index";
import {
  applyBookR49nRetainedDrafts20260912Work,
  bookR49nRetainedDraftRecordKeys,
  bookR49nRetainedDraftsProtectedReviewedKeys,
} from "./bookR49nRetainedDrafts20260912";
import { mergeBookR49nAlcottDraft20260912 } from "./bookR49nAlcottDraft20260912";
import type { WorkProfile } from "./types";

const report = JSON.parse(readFileSync("reports/book-r49n-retained-drafts-20260912.json", "utf8"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)]))
    : value;
const hash = (value: unknown) => sha(JSON.stringify(canonical(value)));
const archive = buildBookArchive(bookArchiveCountries);
const keyOf = (book: typeof archive[number]) => [book.countryId, book.writerId, book.id].join(":");
const byKey = new Map(archive.map(book => [keyOf(book), book]));
const omitContext = ({ country, writer, ...book }: typeof archive[number]) => book;
type Proof = { recordKey: string; locale: "ru" | "en"; textSha256: string; decision: string; sourceUrls: string[] };
const draftProofs: Proof[] = report.selectedVersions.filter((proof: Proof) => proof.decision === "display-exact-retained-text-as-draft");

describe("R49N retained draft display", () => {
  it("pins the supplied source and exact generated source modules without inventing editorial approval", () => {
    expect(report.source.sha256).toBe("f441344f6b4367684c8f5ec39f746f12c079ff05e5130b3183e06bab7c359674");
    for (const [path, expected] of Object.entries(report.sourceFileHashes)) {
      expect(sha(readFileSync(path, "utf8").replace(/\r\n/g, "\n"))).toBe(expected);
    }
    expect(report.fullWorkRead).toBe(false);
    expect(report.newHumanApproval).toBe(false);
    expect(report.evidenceV2ApprovalGranted).toBe(false);
    expect(report.counts).toMatchObject({ sourceCurrentCards: 1546, appliedPendingPairs: 1494, currentReviewedPairsPreserved: 52 });
    expect(report.historicalSourceRecovery.sha256).toBe("c33659097ac4fe4059da520cc2b204ad70cccdaa04699d2ee93508828f18d035");
    expect(report.historicalSourceRecovery.review.summary).toMatchObject({ recoveredVersions: 76, recoveredBindings: 153, noExplicitReferenceVersions: 7 });
  });

  it("exposes exactly 9763 canonical entries while preserving all 69 reviewed records byte-for-byte", () => {
    expect(archive).toHaveLength(9763);
    expect(byKey.size).toBe(9763);
    expect(archive.filter(isPublicBook)).toHaveLength(69);
    expect(archive.filter(book => !isPublicBook(book))).toHaveLength(9694);
    expect([...bookR49nRetainedDraftsProtectedReviewedKeys].sort()).toEqual(report.reviewedBefore.map((row: {key: string}) => row.key).sort());
    for (const row of report.reviewedBefore) {
      const book = byKey.get(row.key)!;
      expect(hash(omitContext(book)), row.key).toBe(row.sha256);
      expect(isPublicBook(book), row.key).toBe(true);
    }
  });

  it("copies all 2988 selected pending texts exactly, with no inherited review for a replaced synopsis", () => {
    expect(bookR49nRetainedDraftRecordKeys).toHaveLength(1494);
    expect(draftProofs).toHaveLength(2988);
    const textRows: string[] = [];
    for (const proof of draftProofs) {
      const book = byKey.get(proof.recordKey)!;
      const translation = book.translations?.[proof.locale] as NonNullable<WorkProfile["translations"]>["ru"] & {retainedCatalogSource?: string};
      expect(sha(translation!.description), proof.recordKey + ":" + proof.locale).toBe(proof.textSha256);
      expect(translation!.status).toBe("draft");
      expect(translation!.retainedCatalogSource).toBe("R49N-20260912");
      expect(translation!.descriptionProvenance).toBeUndefined();
      expect(translation!.sourceUrls).toEqual(proof.sourceUrls);
      expect(book.editorial?.status).toBe("draft");
      expect(isPublicBook(book)).toBe(false);
      textRows.push(proof.recordKey + "\0" + proof.locale + "\0" + sha(translation!.description) + "\n");
    }
    expect(sha(textRows.sort().join(""))).toBe(report.pendingTextHash.sha256);
    expect(sha(byKey.get("greece:homer:legacy-homer-илиада")!.translations!.ru!.description))
      .toBe("132d302c7aae67766104c06b0e4e8787e80dbd1afcd6ea73ec32c76b4c41bb96");
    expect(byKey.get("argentina:jorge_luis_borges:article-series-alevrb")!.translations!.ru!.sourceUrls)
      .toContain("https://www.buffalo.edu/capenchair/exhibits/jlborges.html");
  });

  it("leaves every record outside the exact pending set unchanged", () => {
    const targets = new Set(bookR49nRetainedDraftRecordKeys);
    const untouched = report.baselineRecords.filter((row: {key: string}) => !targets.has(row.key));
    expect(untouched).toHaveLength(8269);
    for (const row of untouched) expect(hash(omitContext(byKey.get(row.key)!)), row.key).toBe(row.sha256);
    const protectedMetadata = report.baselineRecords.map((row: {key: string}) => {
      const { description, translations, editorial, ...metadata } = omitContext(byKey.get(row.key)!);
      return { key: row.key, sha256: hash(metadata) };
    }).sort((a: {key: string}, b: {key: string}) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    expect(hash(protectedMetadata)).toBe(report.baselineProtectedMetadataSha256);
    const sample: WorkProfile = {id: "not-in-r49n", title: "Untouched", editorial: {status: "draft"}};
    expect(applyBookR49nRetainedDrafts20260912Work("usa", "unknown", sample)).toBe(sample);
  });

  it("adds only the draft Alcott book identity and keeps its biography outside the public writer corpus", () => {
    const alcott = byKey.get("usa:louisa_may_alcott:little-women")!;
    expect(alcott.firstPublished).toBe(1868);
    expect(alcott.authorship?.authors[0].creditNames).toEqual({ru: "Луиза Мэй Олкотт", en: "Louisa May Alcott"});
    expect(alcott.editorial?.status).toBe("draft");
    expect(alcott.writer.bio).toBeUndefined();
    expect(alcott.writer.biography).toBeUndefined();
    expect(countries.flatMap(country => country.writers).some(writer => writer.id === "louisa_may_alcott")).toBe(false);
    expect(resolveBookArchivePublicTarget(countries, alcott)).toBeNull();
    expect(report.addedAlcott.sourceRecordCanonicalSha256).toBe("b21364f9bb413707c39e6023ebec3de5fa0b1da41e38f2f670cef3795badd231");
    const twice = mergeBookR49nAlcottDraft20260912(bookArchiveCountries);
    expect(twice.find(country => country.id === "usa")).toBe(bookArchiveCountries.find(country => country.id === "usa"));
  });
});

