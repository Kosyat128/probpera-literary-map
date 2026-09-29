export type CalendarFollowupProjection = { id: string; path: string; before: string; after: string };
export const calendarFollowupAttestation: {
  schemaVersion: number;
  id: string;
  baselineCommitSha: string;
  historicalPinsChanged: false;
  authorization: { humanReview: false; releaseAccepted: false; productionApplied: false };
  allowedProjectionPaths: string[];
  sourceBaselines: Record<string, string>;
  reviewedSources: Record<string, string>;
  additions: { path: string; sha256Lf: string }[];
  foundations: { path: string; sha256Lf: string }[];
  projections: CalendarFollowupProjection[];
};
export const reviewedCalendarAdditionPaths: Set<string>;
export function calendarFollowupSha256(source: string): string;
export function projectReviewedCalendarFollowup(relativePath: string, source: string): string;
export function isReviewedCalendarAddition(relativePath: string, source: string): boolean;
