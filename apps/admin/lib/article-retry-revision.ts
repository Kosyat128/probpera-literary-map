/** Compare an instant without discarding PostgreSQL's fractional precision.
 * Keep the original strings for subsequent CAS and operation receipts.
 */
export function sameArticleRetryRevision(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  const instant = (value: string) => {
    const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
    if (!parts) return null;
    const seconds = Date.parse(parts[1] + parts[3]);
    if (!Number.isFinite(seconds)) return null;
    return { seconds, fraction: (parts[2] ?? "").replace(/0+$/u, "") };
  };
  const a = instant(left), b = instant(right);
  return a !== null && b !== null && a.seconds === b.seconds && a.fraction === b.fraction;
}
