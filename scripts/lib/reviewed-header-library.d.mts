export type ReviewedHeaderLibraryDelta = Readonly<{
  id: string;
  path: string;
  reason: string;
  before: string;
  after: string;
}>;
export const headerLibraryAttestation: Readonly<{
  schemaVersion: number;
  id: string;
  authorizedOn: string;
  baselineMainSha: string;
  authorization: string;
  allowedPaths: readonly string[];
  sourceBaselines: Readonly<Record<string, string>>;
  projections: readonly ReviewedHeaderLibraryDelta[];
}>;
export function projectReviewedHeaderLibrary(relativePath: string, source: string): string;
