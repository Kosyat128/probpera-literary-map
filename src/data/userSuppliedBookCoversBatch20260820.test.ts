import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { buildBookArchive, isCoverArtworkDisplayAllowed } from "./bookArchive";
import { bookPublicationIssues, isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import batchManifestJson from "./countries/generated/userSuppliedBookCoversBatch20260820.generated.json";
import {
  userSuppliedBookWorkBatch20260820Count,
  userSuppliedBookWorkSupplementsBatch20260820,
} from "./countries/userSuppliedBookWorkSupplementsBatch20260820";
import {
  userSuppliedBookCoverBatch20260820Manifest,
  userSuppliedBookCoverManifests,
} from "./userSuppliedBookCovers";

const archiveSha256 =
  "0ad2a8f1c49573d51418beA2acf023a36b87db6e767b75dc869aa92f59b05cd3".toLocaleLowerCase(
    "en"
  );
const baseline = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});
const archive = buildBookArchive(bookArchiveCountries);
const keyOf = (book: { countryId: string; writerId: string; id: string }) =>
  [book.countryId, book.writerId, book.id].join(":");
const baselineByKey = new Map(baseline.map((book) => [keyOf(book), book]));
const archiveByKey = new Map(archive.map((book) => [keyOf(book), book]));

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

describe("пользовательские редакционные обложки - batch 2026-08-20", () => {
  it("подключает все 43 artwork третьим манифестом и сохраняет прежние primary", () => {
    const entries = userSuppliedBookCoverBatch20260820Manifest.entries;
    const primaryEntries = entries.filter((entry) => entry.isPrimary);
    const secondaryEntries = entries.filter((entry) => !entry.isPrimary);
    const previousEntries = userSuppliedBookCoverManifests
      .slice(0, -1)
      .flatMap((manifest) => manifest.entries);
    const previousKeys = new Set(previousEntries.map((entry) => entry.workKey));
    const previousUrls = new Set(
      previousEntries.flatMap((entry) => [
        entry.coverUrl,
        entry.coverThumbnailUrl,
      ])
    );

    expect(userSuppliedBookCoverBatch20260820Manifest).toEqual(batchManifestJson);
    expect(userSuppliedBookCoverManifests).toHaveLength(3);
    expect(userSuppliedBookCoverBatch20260820Manifest).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-08-20T00:00:00.000Z",
      archive: {
        name: "Новые обложки.rar",
        sha256: archiveSha256,
        bytes: 94_728_556,
        entries: 43,
        uniqueImages: 43,
      },
    });
    expect(entries).toHaveLength(43);
    expect(primaryEntries).toHaveLength(31);
    expect(secondaryEntries).toHaveLength(12);
    expect(new Set(entries.map((entry) => entry.workKey)).size).toBe(41);
    expect(new Set(entries.map((entry) => entry.coverUrl)).size).toBe(43);
    expect(primaryEntries.some((entry) => previousKeys.has(entry.workKey))).toBe(false);
    expect(
      secondaryEntries.filter(
        (entry) =>
          !entries.some(
            (candidate) =>
              candidate.workKey === entry.workKey && candidate.isPrimary
          )
      )
    ).toHaveLength(10);
    expect(
      entries.some(
        (entry) =>
          previousUrls.has(entry.coverUrl) ||
          previousUrls.has(entry.coverThumbnailUrl)
      )
    ).toBe(false);
    expect(
      entries.every(
        (entry) =>
          entry.provenance.archiveSha256 === archiveSha256 &&
          entry.provenance.note.includes("не является обложкой конкретного") &&
          entry.provenance.note.includes("не содержит вымышленного ISBN")
      )
    ).toBe(true);
  });

  it("создаёт ровно 17 отсутствовавших произведений с RU/EN и provenance", () => {
    const createdWorks = Object.entries(
      userSuppliedBookWorkSupplementsBatch20260820
    ).flatMap(([countryId, writers]) =>
      Object.entries(writers).flatMap(([writerId, works]) =>
        works.map((work) => ({ countryId, writerId, work }))
      )
    );

    expect(userSuppliedBookWorkBatch20260820Count).toBe(17);
    expect(createdWorks).toHaveLength(17);
    for (const { countryId, writerId, work } of createdWorks) {
      const key = `${countryId}:${writerId}:${work.id}`;
      const canonical = baselineByKey.get(key);
      expect(canonical, key).toBeDefined();
      expect(canonical?.translations?.ru?.title).toBe(work.title);
      expect(canonical?.translations?.en?.title).toMatch(/[A-Za-z]/u);
      expect(canonical?.sources?.length).toBeGreaterThan(0);
      expect(canonical?.externalIds?.length).toBeGreaterThan(0);
      expect(bookPublicationIssues(canonical!)).toEqual([]);
      expect(isPublicBook(canonical!)).toBe(true);
      expect(JSON.stringify(canonical)).not.toMatch(/isbn[-_ ]?1[03]/iu);
    }

    expect(archive).toHaveLength(9_729);
    expect(baseline).toHaveLength(9_729);
    expect(archive.filter(isPublicBook)).toHaveLength(48);
    expect(baseline.filter(isPublicBook)).toHaveLength(48);
    expect(archive.filter((book) => !isPublicBook(book))).toHaveLength(9_681);
  });

  it("применяет только 31 primary и оставляет 12 secondary вне публичного overlay", () => {
    const entries = userSuppliedBookCoverBatch20260820Manifest.entries;
    for (const entry of entries.filter((candidate) => candidate.isPrimary)) {
      const before = baselineByKey.get(entry.workKey);
      const after = archiveByKey.get(entry.workKey);
      expect(before, entry.workKey).toBeDefined();
      expect(before?.coverUrl).toBeUndefined();
      expect(before?.coverRights).toBeUndefined();
      expect(before?.edition).toBeUndefined();
      expect(after).toMatchObject({
        coverUrl: entry.coverUrl,
        coverThumbnailUrl: entry.coverThumbnailUrl,
        coverWidth: 720,
        coverHeight: 1_080,
        coverThumbnailWidth: 360,
        coverThumbnailHeight: 540,
        coverRights: {
          status: "editorial-original",
          checkedAt: "2026-08-20",
        },
      });
      expect(after?.edition).toBeUndefined();
      expect(isCoverArtworkDisplayAllowed(after!)).toBe(true);
    }
    for (const entry of entries.filter((candidate) => !candidate.isPrimary)) {
      const before = baselineByKey.get(entry.workKey);
      const after = archiveByKey.get(entry.workKey);
      const primary = entries.find(
        (candidate) => candidate.workKey === entry.workKey && candidate.isPrimary
      );
      if (primary) {
        expect(after?.coverUrl).toBe(primary.coverUrl);
      } else {
        const previousPrimary = userSuppliedBookCoverManifests
          .slice(0, -1)
          .flatMap((manifest) => manifest.entries)
          .find((candidate) => candidate.workKey === entry.workKey);
        expect(after?.coverUrl).toBe(previousPrimary?.coverUrl ?? before?.coverUrl);
        expect(after?.coverUrl).toBeTruthy();
      }
      expect(after?.coverUrl).not.toBe(entry.coverUrl);
    }
  });

  it("фиксирует 43 файла ровно в одной категории и не создаёт алиас-дубли", async () => {
    const reportPath = fileURLToPath(
      new URL(
        "../../reports/user-supplied-book-cover-import-2026-08-20.json",
        import.meta.url
      )
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const indexes = [
      ...report.imports,
      ...report.skippedExisting,
      ...report.alternativeArtwork,
      ...report.rightsQuarantine,
      ...report.unmatched,
    ]
      .map((entry: { sourceIndex: number }) => entry.sourceIndex)
      .sort((left: number, right: number) => left - right);

    expect(indexes).toEqual(Array.from({ length: 43 }, (_, index) => index + 1));
    expect(report.summary).toMatchObject({
      archiveEntries: 43,
      uniqueWorks: 41,
      matchedSourceFiles: 43,
      matchedToCanonical: 41,
      imported: 43,
      artworkRecords: 43,
      assetFiles: 86,
      primaryArtwork: 31,
      secondaryArtwork: 12,
      skippedExisting: 10,
      aliasConsolidated: 2,
      createdWorks: 17,
      existingCanonicalWorks: 24,
      unmatched: 0,
      rightsQuarantined: 0,
      archiveBooks: 9_729,
      publicBooks: 48,
      pendingBooks: 9_681,
    });
    expect(report.sourceInventory).toMatchObject({
      entries: 43,
      uniqueImages: 43,
      duplicateEntries: 0,
      width: 1_024,
      height: 1_536,
      uncompressedBytes: 99_527_961,
    });
    expect(report.artworks).toHaveLength(43);
    expect(new Set(report.artworks.map((entry: { sourceIndex: number }) => entry.sourceIndex)).size).toBe(43);
    expect(new Set(report.artworks.map((entry: { workKey: string }) => entry.workKey)).size).toBe(41);
    expect(report.alternativeArtwork).toEqual([
      expect.objectContaining({
        visibleTitle: "Простые смертные",
        selectedSourceIndex: 9,
        workKey: "england:david_mitchell:the-bone-clocks",
        isPrimary: false,
        coverUrl: expect.stringContaining("20260820-alternate.webp"),
      }),
      expect.objectContaining({
        visibleTitle: "Дом Слэйд",
        selectedSourceIndex: 7,
        workKey: "england:david_mitchell:slade-house",
        isPrimary: false,
        coverUrl: expect.stringContaining("20260820-alternate.webp"),
      }),
    ]);
  });

  it("хранит 43 оптимизированные пары WebP с проверяемыми размерами и SHA-256", async () => {
    await Promise.all(
      userSuppliedBookCoverBatch20260820Manifest.entries.map(async (entry) => {
        const fullPath = fileURLToPath(
          new URL(`../../public/${entry.coverUrl}`, import.meta.url)
        );
        const thumbnailPath = fileURLToPath(
          new URL(`../../public/${entry.coverThumbnailUrl}`, import.meta.url)
        );
        const [full, thumbnail, fullMetadata, thumbnailMetadata] =
          await Promise.all([
            readFile(fullPath),
            readFile(thumbnailPath),
            sharp(fullPath).metadata(),
            sharp(thumbnailPath).metadata(),
          ]);

        expect(fullMetadata).toMatchObject({
          format: "webp",
          width: 720,
          height: 1_080,
          hasAlpha: false,
        });
        expect(thumbnailMetadata).toMatchObject({
          format: "webp",
          width: 360,
          height: 540,
          hasAlpha: false,
        });
        expect(sha256(full)).toBe(entry.coverSha256);
        expect(sha256(thumbnail)).toBe(entry.coverThumbnailSha256);
      })
    );
  });

  it("учитывает ровно 86 новых asset и не оставляет искусственный запас в file-count budget", async () => {
    const coversDirectory = fileURLToPath(
      new URL("../../public/brand/book-covers/", import.meta.url)
    );
    const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
    const [assets, performanceBudget] = await Promise.all([
      readdir(coversDirectory, { recursive: true, withFileTypes: true }),
      readFile(`${repositoryRoot}performance-budget.json`, "utf8").then(JSON.parse),
    ]);
    const webpAssets = assets.filter(
      (asset) => asset.isFile() && asset.name.endsWith(".webp")
    );
    const batchAssets = webpAssets.filter((asset) =>
      asset.name.includes("20260820")
    );

    expect(batchAssets).toHaveLength(86);
    expect(performanceBudget.bookCoverCount).toBe(webpAssets.length);
    expect(performanceBudget.bookCoverCount).toBe(424);
  });
});
