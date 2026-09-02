export function articleSynopsisRevisionProjection(
  article: unknown,
): Record<string, unknown>;

export function articleSynopsisRevisionSha256(
  article: unknown,
): string;

export function articleSynopsisCorpusSha256(
  snapshots: readonly {
    article: unknown;
    documentPath: string;
  }[],
): string;
