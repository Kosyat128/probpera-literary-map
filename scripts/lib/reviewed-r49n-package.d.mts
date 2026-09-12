export const r49nPackageAttestation: Readonly<{
  additions: readonly Readonly<{ path: string; sha256: string }>[];
  projections: readonly Readonly<{
    id: string;
    path: string;
    before: string;
    after: string;
  }>[];
}>;
export const reviewedR49nPackageAdditionPaths: Set<string>;
export function reviewedR49nPackageSourceSha256(source: string): string;
export function isReviewedR49nPackageAddition(relativePath: string, source: string): boolean;
export function projectReviewedR49nPackage(relativePath: string, source: string): string;
