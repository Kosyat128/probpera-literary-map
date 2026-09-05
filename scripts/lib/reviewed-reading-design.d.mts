export type ReviewedReadingDesignDelta = Readonly<{
  id: string;
  path: string;
  reason: string;
  before: string;
  after: string;
}>;
export const readingDesignAttestation: Readonly<{
  schemaVersion: number;
  id: string;
  authorizedOn: string;
  baselineMainSha: string;
  authorization: string;
  projections: readonly ReviewedReadingDesignDelta[];
}>;
export function projectReviewedReadingDesign(relativePath: string, source: string): string;
