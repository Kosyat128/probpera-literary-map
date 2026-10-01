export const russianCalendarExpansionAttestation: {
  id: string;
  baselineCommitSha: string;
  historicalPinsChanged: false;
  sourceBaselines: Record<string, string>;
  reviewedSources: Record<string, string>;
  additions: { path: string; sha256Lf: string }[];
  foundations: { path: string; sha256Lf: string; sha256Raw: string }[];
  projections: { id: string; path: string; before: string; after: string }[];
};
export const reviewedRussianCalendarExpansionAdditionPaths: Set<string>;
export function russianCalendarExpansionSha256(source: string): string;
export function projectReviewedRussianCalendarExpansion(relativePath: string, source: string): string;
export function isReviewedRussianCalendarExpansionAddition(relativePath: string, source: string): boolean;
