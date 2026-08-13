export type RevisionPatchPolicy = {
  snapshotIdColumn: string;
  blockedColumns: readonly string[];
  allowedColumns?: readonly string[];
  forceUpdatedBy?: boolean;
};

export function isRevisionSnapshot(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * Builds a database patch from a server-owned revision snapshot. Chrome
 * entities use an explicit column allowlist so identifiers, ownership fields,
 * timestamps and any future columns cannot be restored accidentally.
 */
export function buildRevisionRestorePatch(
  snapshot: unknown,
  policy: RevisionPatchPolicy,
  actorId: string
) {
  if (!isRevisionSnapshot(snapshot)) {
    throw new Error("Снимок версии повреждён.");
  }
  const allowed = policy.allowedColumns
    ? new Set(policy.allowedColumns)
    : null;
  const patch = Object.fromEntries(
    Object.entries(snapshot).filter(
      ([column]) =>
        column !== policy.snapshotIdColumn &&
        !policy.blockedColumns.includes(column) &&
        (!allowed || allowed.has(column))
    )
  );
  if (policy.forceUpdatedBy) patch.updated_by = actorId;
  if (!Object.keys(patch).length) {
    throw new Error("В этой версии нет полей, разрешённых для восстановления.");
  }
  return patch;
}
