export const referenceReleaseAttestation: Readonly<{
  projections: readonly Readonly<{
    id: string;
    path: string;
    before: string;
    after: string;
  }>[];
}>;
export function reviewedReferenceReleaseSourceSha256(source: string): string;
export function projectReviewedReferenceRelease(relativePath: string, source: string): string;
