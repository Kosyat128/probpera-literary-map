export type R10Projection = { id: string; path: string; before: string; after: string };
export const r10DeltaAttestation: {
  schemaVersion: number;
  id: string;
  baselineSourceCommitSha: string;
  allowedProjectionPaths: string[];
  sourceBaselines: Record<string, string>;
  reviewedSources: Record<string, string>;
  additions: { path: string; sha256Lf: string }[];
  projections: R10Projection[];
};
export const reviewedR10AdditionPaths: Set<string>;
export function r10DeltaSha256(source: string): string;
export function isReviewedR10Addition(relativePath: string, source: string): boolean;
export function projectReviewedR10Delta(relativePath: string, source: string): string;
