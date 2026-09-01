const MAX_CURSOR_TOKEN = 1_000_000_000;

function cursorToken(value: unknown) {
  const text = String(value ?? "0").trim();
  if (!/^\d+$/u.test(text)) return 0;
  const parsed = Number.parseInt(text, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_CURSOR_TOKEN) {
    return 0;
  }
  return parsed;
}

export function translationBackfillCursorParams(formData: FormData) {
  return {
    articleCursor: cursorToken(formData.get("articleCursor")),
    libraryCursor: cursorToken(formData.get("libraryCursor")),
    writerCursor: cursorToken(formData.get("writerCursor")),
    countryCursor: cursorToken(formData.get("countryCursor")),
  };
}

export function normalizeBackfillCursor(value: unknown, total: number) {
  if (!Number.isInteger(total) || total <= 0) return 0;
  const parsed = cursorToken(value);
  if (parsed >= total) return 0;
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
