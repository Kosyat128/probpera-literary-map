import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildBookArchive,
  coverArtworkSrcSet,
  isCoverArtworkDisplayAllowed,
} from "./bookArchive";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import manifestJson from "./countries/generated/userSuppliedBookCovers.generated.json";
import {
  applyUserSuppliedBookCover,
  userSuppliedBookCoverManifest,
} from "./userSuppliedBookCovers";

const baseline = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});
const archive = buildBookArchive(bookArchiveCountries);
const baselineByKey = new Map(
  baseline.map((book) => [
    `${book.countryId}:${book.writerId}:${book.id}`,
    book,
  ])
);
const archiveByKey = new Map(
  archive.map((book) => [
    `${book.countryId}:${book.writerId}:${book.id}`,
    book,
  ])
);

const immutableExistingKeys = [
  "england:charles_dickens:oliver-twist-editorial",
  "usa:vladimir_nabokov:lolita-editorial",
  "usa:ray_bradbury:dandelion-wine-editorial",
  "usa:john_steinbeck:the-grapes-of-wrath-editorial",
  "usa:francis_scott_fitzgerald:tender-is-the-night",
  "russia:bulgakov:heart-of-a-dog-editorial",
];
const excludedSourceIndexes = [
  5, 7, 14, 19, 25, 26, 30, 37, 41, 44, 49, 50, 55, 60, 62, 68, 75,
];
const immutableContentFields = [
  "id",
  "title",
  "alternateTitles",
  "originalTitle",
  "firstPublished",
  "originalLanguage",
  "genres",
  "tags",
  "description",
  "translations",
  "sources",
  "externalIds",
  "distinctions",
  "sourceUrl",
  "editorial",
] as const;

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

describe("пользовательские редакционные обложки", () => {
  it("содержит детерминированное отображение ровно для 54 проверенных работ", () => {
    const entries = userSuppliedBookCoverManifest.entries;
    const sourceIndexes = entries.map((entry) => entry.provenance.sourceIndex);

    expect(userSuppliedBookCoverManifest).toEqual(manifestJson);
    expect(entries).toHaveLength(54);
    expect(sourceIndexes).toEqual([...sourceIndexes].sort((a, b) => a - b));
    expect(new Set(sourceIndexes).size).toBe(54);
    expect(new Set(entries.map((entry) => entry.workKey)).size).toBe(54);
    expect(new Set(entries.map((entry) => entry.coverUrl)).size).toBe(54);
    expect(new Set(entries.map((entry) => entry.coverThumbnailUrl)).size).toBe(54);
    expect(entries.every((entry) => entry.equivalentWorkKeys.includes(entry.workKey))).toBe(
      true
    );
    expect(entries.every((entry) => entry.provenance.kind === "user-supplied")).toBe(
      true
    );
    expect(
      entries.every(
        (entry) =>
          entry.provenance.archiveSha256 ===
          "7778202af51486bc609b24b98997735bcfb211b309f257734618aae1be93857b"
      )
    ).toBe(true);
    expect(sourceIndexes.filter((index) => excludedSourceIndexes.includes(index))).toEqual(
      []
    );
  });

  it("применяет overlay только к существующим карточкам без обложки или CMS-издания", () => {
    const addedKeys = archive
      .filter((book) => {
        const key = `${book.countryId}:${book.writerId}:${book.id}`;
        return !baselineByKey.get(key)?.coverUrl && Boolean(book.coverUrl);
      })
      .map((book) => `${book.countryId}:${book.writerId}:${book.id}`)
      .sort();
    const expectedKeys = userSuppliedBookCoverManifest.entries
      .map((entry) => entry.workKey)
      .sort();

    expect(addedKeys).toEqual(expectedKeys);
    for (const entry of userSuppliedBookCoverManifest.entries) {
      const baselineBook = baselineByKey.get(entry.workKey);
      const coveredBook = archiveByKey.get(entry.workKey);
      expect(baseline.filter((book) => `${book.countryId}:${book.writerId}:${book.id}` === entry.workKey)).toHaveLength(1);
      expect(baselineBook).toBeDefined();
      expect(baselineBook?.coverUrl).toBeUndefined();
      expect(baselineBook?.coverRights).toBeUndefined();
      expect(baselineBook?.edition).toBeUndefined();
      expect(coveredBook).toMatchObject({
        coverUrl: entry.coverUrl,
        coverThumbnailUrl: entry.coverThumbnailUrl,
        coverWidth: 720,
        coverHeight: 1_080,
        coverThumbnailWidth: 360,
        coverThumbnailHeight: 540,
        coverRights: {
          status: "editorial-original",
        },
      });
      expect(coveredBook?.edition).toBeUndefined();
      expect(isCoverArtworkDisplayAllowed(coveredBook!)).toBe(true);
      expect(coveredBook?.coverRights).not.toHaveProperty("creator");
      expect(coveredBook?.coverRights).not.toHaveProperty("rightsHolder");
      expect(coveredBook?.coverRights).not.toHaveProperty("licenseName");
      expect(coveredBook?.coverRights?.checkedAt).toBe("2026-08-11");
      expect(coveredBook?.coverRights?.note).toContain(
        "не является обложкой конкретного издательского издания"
      );
    }
  });

  it("использует точные width descriptors и сохраняет legacy fallback", () => {
    const entry = userSuppliedBookCoverManifest.entries[0];
    const coveredBook = archiveByKey.get(entry.workKey)!;

    expect(coverArtworkSrcSet(coveredBook)).toBe(
      `${entry.coverThumbnailUrl} 360w, ${entry.coverUrl} 720w`
    );
    expect(
      coverArtworkSrcSet({
        ...coveredBook,
        coverWidth: undefined,
        coverThumbnailWidth: undefined,
        coverUrl: "legacy/full.webp",
        coverThumbnailUrl: "legacy/thumb.webp",
      })
    ).toBe("legacy/thumb.webp 400w, legacy/full.webp 800w");
  });

  it("не изменяет названия, тексты, статусы и количество книг", () => {
    expect(archive).toHaveLength(9_712);
    expect(baseline).toHaveLength(9_712);
    expect(archive.filter(isPublicBook)).toHaveLength(31);
    expect(baseline.filter(isPublicBook)).toHaveLength(31);
    expect(archive.filter((book) => !isPublicBook(book))).toHaveLength(9_681);

    for (const entry of userSuppliedBookCoverManifest.entries) {
      const before = baselineByKey.get(entry.workKey)!;
      const after = archiveByKey.get(entry.workKey)!;
      for (const field of immutableContentFields) {
        expect(after[field], `${entry.workKey}:${field}`).toEqual(before[field]);
      }
    }
  });

  it("оставляет шесть прежних редакционных обложек полностью неизменными", () => {
    for (const key of immutableExistingKeys) {
      const before = baselineByKey.get(key);
      const after = archiveByKey.get(key);
      expect(before?.coverUrl).toBeTruthy();
      expect(after?.coverUrl).toBe(before?.coverUrl);
      expect(after?.coverThumbnailUrl).toBe(before?.coverThumbnailUrl);
      expect(after?.coverSourceUrl).toBe(before?.coverSourceUrl);
      expect(after?.coverRights).toEqual(before?.coverRights);
      expect(after?.edition).toEqual(before?.edition);
    }
  });

  it("останавливает overlay, если защищён любой известный эквивалент работы", () => {
    const entry = userSuppliedBookCoverManifest.entries.find(
      (candidate) => candidate.equivalentWorkKeys.length > 1
    );
    expect(entry).toBeDefined();
    const alternateKey = entry!.equivalentWorkKeys.find(
      (key) => key !== entry!.workKey
    );
    expect(alternateKey).toBeTruthy();
    const source = baselineByKey.get(entry!.workKey)!;

    expect(
      applyUserSuppliedBookCover(entry!.workKey, source, new Set([alternateKey!]))
    ).toBe(source);

    const alreadyCovered = {
      ...source,
      coverUrl: "brand/book-covers/future-editorial.webp",
      coverRights: {
        status: "editorial-original" as const,
        sourceUrl: "brand/book-covers/future-editorial.webp",
      },
    };
    expect(
      applyUserSuppliedBookCover(entry!.workKey, alreadyCovered, new Set())
    ).toBe(alreadyCovered);
  });

  it("хранит 54 пары WebP с точными размерами и SHA-256", async () => {
    await Promise.all(
      userSuppliedBookCoverManifest.entries.map(async (entry) => {
        const fullPath = fileURLToPath(
          new URL(`../../public/${entry.coverUrl}`, import.meta.url)
        );
        const thumbnailPath = fileURLToPath(
          new URL(`../../public/${entry.coverThumbnailUrl}`, import.meta.url)
        );
        const [full, thumbnail, fullMetadata, thumbnailMetadata] = await Promise.all([
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
        expect(entry).toMatchObject({
          coverWidth: 720,
          coverHeight: 1_080,
          coverThumbnailWidth: 360,
          coverThumbnailHeight: 540,
        });
        expect(sha256(full)).toBe(entry.coverSha256);
        expect(sha256(thumbnail)).toBe(entry.coverThumbnailSha256);
      })
    );
  });

  it("включает overlay в общий аудит прав без двойного счёта", async () => {
    const auditPath = fileURLToPath(
      new URL("../../reports/cover-rights-audit.json", import.meta.url)
    );
    const audit = JSON.parse(await readFile(auditPath, "utf8"));
    const overlayRows = audit.covers.filter(
      (cover: { provenance?: { kind?: string } }) =>
        cover.provenance?.kind === "user-supplied"
    );

    expect(audit.generatedAt).toBe("2026-08-11T00:00:00.000Z");
    expect(audit.summary).toMatchObject({
      covers: 119,
      countryCovers: 65,
      userSuppliedCovers: 54,
      displayAllowed: 119,
      blocked: 0,
      withIssues: 0,
    });
    expect(overlayRows).toHaveLength(54);
    expect(new Set(overlayRows.map((cover: { coverUrl: string }) => cover.coverUrl)).size).toBe(
      54
    );
    expect(
      overlayRows.every(
        (cover: {
          checkedAt?: string;
          sourceUrl?: string;
          coverWidth?: number;
          coverHeight?: number;
          coverThumbnailWidth?: number;
          coverThumbnailHeight?: number;
          provenance?: { archiveSha256?: string; imageSha256?: string };
        }) =>
          cover.checkedAt === "2026-08-11" &&
          cover.sourceUrl?.startsWith("brand/book-covers/") &&
          cover.coverWidth === 720 &&
          cover.coverHeight === 1_080 &&
          cover.coverThumbnailWidth === 360 &&
          cover.coverThumbnailHeight === 540 &&
          /^[a-f0-9]{64}$/u.test(cover.provenance?.archiveSha256 || "") &&
          /^[a-f0-9]{64}$/u.test(cover.provenance?.imageSha256 || "")
      )
    ).toBe(true);
  });
});
