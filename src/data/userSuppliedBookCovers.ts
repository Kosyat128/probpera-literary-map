import manifestJson from "./countries/generated/userSuppliedBookCovers.generated.json";
import batch20260813ManifestJson from "./countries/generated/userSuppliedBookCoversBatch20260813.generated.json";
import type { WorkProfile } from "./countries/types";

export type UserSuppliedBookCoverEntry = {
  workKey: string;
  visibleAuthor: string;
  visibleTitle: string;
  coverUrl: string;
  coverThumbnailUrl: string;
  coverWidth: number;
  coverHeight: number;
  coverThumbnailWidth: number;
  coverThumbnailHeight: number;
  coverSha256: string;
  coverThumbnailSha256: string;
  equivalentWorkKeys: string[];
  provenance: {
    kind: "user-supplied";
    archiveSha256: string;
    imageSha256: string;
    sourceFilename: string;
    sourceIndex: number;
    matchBasis: string;
    sourceEvidence?: "chatgpt-image-filename";
    note: string;
  };
};

type UserSuppliedBookCoverManifest = {
  schemaVersion: 1;
  generatedAt: string;
  archive: {
    name: string;
    sha256: string;
    bytes: number;
    entries: number;
    uniqueImages: number;
  };
  entries: UserSuppliedBookCoverEntry[];
};

export const userSuppliedBookCoverManifest =
  manifestJson as UserSuppliedBookCoverManifest;

export const userSuppliedBookCoverBatch20260813Manifest =
  batch20260813ManifestJson as UserSuppliedBookCoverManifest;

export const userSuppliedBookCoverManifests = [
  userSuppliedBookCoverManifest,
  userSuppliedBookCoverBatch20260813Manifest,
] as const;

export const userSuppliedBookCoverByWorkKey = new Map(
  userSuppliedBookCoverManifests.flatMap((manifest) =>
    manifest.entries.map((entry) => [
      entry.workKey,
      {
        ...entry,
        checkedAt: manifest.generatedAt.slice(0, 10),
      },
    ] as const)
  )
);

export function applyUserSuppliedBookCover(
  workKey: string,
  work: WorkProfile,
  protectedWorkKeys: ReadonlySet<string>
): WorkProfile {
  const cover = userSuppliedBookCoverByWorkKey.get(workKey);
  if (
    !cover ||
    work.coverUrl ||
    work.coverRights ||
    work.edition ||
    cover.equivalentWorkKeys.some((key) => protectedWorkKeys.has(key))
  ) {
    return work;
  }

  return {
    ...work,
    coverUrl: cover.coverUrl,
    coverThumbnailUrl: cover.coverThumbnailUrl,
    coverWidth: cover.coverWidth,
    coverHeight: cover.coverHeight,
    coverThumbnailWidth: cover.coverThumbnailWidth,
    coverThumbnailHeight: cover.coverThumbnailHeight,
    coverSourceUrl: cover.coverUrl,
    coverRights: {
      status: "editorial-original",
      sourceUrl: cover.coverUrl,
      checkedAt: cover.checkedAt,
      note: cover.provenance.note,
    },
  };
}
