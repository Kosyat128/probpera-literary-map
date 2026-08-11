import manifestJson from "./countries/generated/userSuppliedBookCovers.generated.json";
import type { WorkProfile } from "./countries/types";

export type UserSuppliedBookCoverEntry = {
  workKey: string;
  visibleAuthor: string;
  visibleTitle: string;
  coverUrl: string;
  coverThumbnailUrl: string;
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

export const userSuppliedBookCoverByWorkKey = new Map(
  userSuppliedBookCoverManifest.entries.map((entry) => [entry.workKey, entry])
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
    coverSourceUrl: cover.coverUrl,
    coverRights: {
      status: "editorial-original",
      sourceUrl: cover.coverUrl,
      checkedAt: userSuppliedBookCoverManifest.generatedAt.slice(0, 10),
      note: cover.provenance.note,
    },
  };
}
