export interface V12S03SourceProjection {
  readonly id: string;
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

export interface V12S03PackageProjection {
  readonly id: string;
  readonly path: readonly [string, string];
  readonly before: Readonly<{ present: false }>;
  readonly after: Readonly<{ present: true; value: string }>;
}

export const v12S03Compatibility: Readonly<{
  schemaVersion: 1;
  id: string;
  baseMainSha: string;
  scope: string;
  projections: readonly V12S03SourceProjection[];
  packageProjections: readonly V12S03PackageProjection[];
}>;

export function projectV12S03Source(relativePath: string, source: string): string;
/** Projects parsed JSON; callers must validate its shape for their own use. */
export function projectV12S03Package(value: unknown): unknown;
