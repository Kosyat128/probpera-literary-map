export function normalizeBackfillCursor(value: unknown, total: number) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= total) return 0;
  return parsed;
}

export function advanceBackfillCursor(
  start: number,
  processed: number,
  total: number
) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const safeStart = normalizeBackfillCursor(start, total);
  const safeProcessed =
    Number.isInteger(processed) && processed > 0 ? processed : 0;
  return (safeStart + safeProcessed) % total;
}

export function circularBackfillIndex(
  start: number,
  step: number,
  total: number
) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const safeStart = normalizeBackfillCursor(start, total);
  const safeStep = Number.isInteger(step) && step > 0 ? step : 0;
  return (safeStart + safeStep) % total;
}
