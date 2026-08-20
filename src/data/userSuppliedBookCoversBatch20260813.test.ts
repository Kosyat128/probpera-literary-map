import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { buildBookArchive, isCoverArtworkDisplayAllowed } from "./bookArchive";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import previousManifestJson from "./countries/generated/userSuppliedBookCovers.generated.json";
import batchManifestJson from "./countries/generated/userSuppliedBookCoversBatch20260813.generated.json";
import {
  userSuppliedBookCoverBatch20260813Manifest,
  userSuppliedBookCoverManifests,
} from "./userSuppliedBookCovers";

const archiveSha256 =
  "2f6f57c33c94dff8fc2423a9db2caa3ac58603b9843b549fbe3b9db59553234f";
const baseline = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});
const archive = buildBookArchive(bookArchiveCountries);
const keyOf = (book: {
  countryId: string;
  writerId: string;
  id: string;
}) => [book.countryId, book.writerId, book.id].join(":");
const baselineByKey = new Map(baseline.map((book) => [keyOf(book), book]));
const archiveByKey = new Map(archive.map((book) => [keyOf(book), book]));

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

describe("пользовательские редакционные обложки — batch 2026-08-13", () => {
  it("подключает 51 новую обложку отдельным непересекающимся манифестом", () => {
    const entries = userSuppliedBookCoverBatch20260813Manifest.entries;
    const previousKeys = new Set(
      previousManifestJson.entries.map((entry) => entry.workKey)
    );
    const previousUrls = new Set(
      previousManifestJson.entries.flatMap((entry) => [
        entry.coverUrl,
        entry.coverThumbnailUrl,
      ])
    );

    expect(userSuppliedBookCoverBatch20260813Manifest).toEqual(batchManifestJson);
    expect(userSuppliedBookCoverManifests).toHaveLength(3);
    expect(userSuppliedBookCoverBatch20260813Manifest).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-08-13T00:00:00.000Z",
      archive: {
        name: "Новые обложки.rar",
        sha256: archiveSha256,
        bytes: 307_935_513,
        entries: 101,
        uniqueImages: 100,
      },
    });
    expect(entries).toHaveLength(51);
    expect(new Set(entries.map((entry) => entry.workKey)).size).toBe(51);
    expect(new Set(entries.map((entry) => entry.coverUrl)).size).toBe(51);
    expect(new Set(entries.map((entry) => entry.coverThumbnailUrl)).size).toBe(51);
    expect(entries.some((entry) => previousKeys.has(entry.workKey))).toBe(false);
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
          entry.provenance.sourceFilename.startsWith(
            "ChatGPT Image 13 авг. 2026 г., "
          ) &&
          entry.provenance.sourceEvidence === "chatgpt-image-filename" &&
          entry.provenance.note.includes(
            "не является обложкой конкретного издательского издания"
          )
      )
    ).toBe(true);
  });

  it("применяет batch только к карточкам без прежней обложки или издания", () => {
    for (const entry of userSuppliedBookCoverBatch20260813Manifest.entries) {
      const before = baselineByKey.get(entry.workKey);
      const after = archiveByKey.get(entry.workKey);

      expect(before).toBeDefined();
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
          checkedAt: "2026-08-13",
        },
      });
      expect(after?.edition).toBeUndefined();
      expect(isCoverArtworkDisplayAllowed(after!)).toBe(true);
    }

    expect(archive).toHaveLength(9_729);
    expect(baseline).toHaveLength(9_729);
    expect(archive.filter(isPublicBook)).toHaveLength(48);
    expect(baseline.filter(isPublicBook)).toHaveLength(48);
  });

  it("фиксирует каждую запись архива ровно в одной категории решения", async () => {
    const reportPath = fileURLToPath(
      new URL("../../reports/user-supplied-book-cover-import-2026-08-13.json", import.meta.url)
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    const indexes = [
      ...report.imports,
      ...report.skippedExisting,
      ...report.alternativeArtwork,
      ...report.exactDuplicates,
      ...report.rightsQuarantine,
      ...report.unmatched,
    ]
      .map((entry: { sourceIndex: number }) => entry.sourceIndex)
      .sort((left: number, right: number) => left - right);

    expect(report.archive.sha256).toBe(archiveSha256);
    expect(report.sourceInventory).toMatchObject({
      entries: 101,
      uniqueImages: 100,
      duplicateEntries: 1,
      width: 1_024,
      height: 1_536,
      format: "png",
      alpha: false,
      uncompressedBytes: 321_363_903,
    });
    expect(report.sourceInventory.duplicateGroups).toEqual([
      expect.objectContaining({ sourceIndexes: [1, 61] }),
    ]);
    expect(report.rightsEvidence).toMatchObject({
      chatGptFilenameEntries: 99,
      uuidFilenameEntries: 2,
      selectedImportsWithChatGptFilename: 51,
      embeddedMetadataEntries: 0,
      quarantinedSourceIndexes: [2],
    });
    expect(report.summary).toMatchObject({
      matchedToCanonical: 57,
      imported: 51,
      skippedExisting: 6,
      alternativeArtwork: 9,
      exactDuplicates: 1,
      unmatched: 33,
      rightsQuarantined: 1,
      archiveBooks: 9_712,
      publicBooks: 31,
      pendingBooks: 9_681,
    });
    expect(indexes).toEqual(Array.from({ length: 101 }, (_, index) => index + 1));
    expect(report.rightsQuarantine).toEqual([
      expect.objectContaining({
        sourceIndex: 2,
        reason:
          "no-generator-or-license-metadata-and-no-provenance-bearing-duplicate",
      }),
    ]);
  });

  it("хранит 51 оптимизированную пару WebP с проверяемыми размерами и SHA-256", async () => {
    await Promise.all(
      userSuppliedBookCoverBatch20260813Manifest.entries.map(async (entry) => {
        const fullPath = fileURLToPath(
          new URL("../../public/" + entry.coverUrl, import.meta.url)
        );
        const thumbnailPath = fileURLToPath(
          new URL("../../public/" + entry.coverThumbnailUrl, import.meta.url)
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
});
