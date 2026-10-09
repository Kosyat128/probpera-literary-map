import { isReadRecord } from "./admin-read-result";
import type { AnalyticsReport } from "./analytics-report";

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function text(value: unknown): value is string {
  // A label must survive the existing formatter; do not turn a read into []
  // by letting control-only values reach its row filter. No data is rewritten.
  return typeof value === "string" && /[^\s\u0000-\u001f\u007f]/u.test(value);
}

function day(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Match the JSONB RPC projection before the existing display/CSV formatter. */
export function isAnalyticsReport(
  value: unknown,
  requestedFrom: string,
  requestedTo: string,
): value is AnalyticsReport {
  if (!isReadRecord(value)) return false;
  if (typeof value.from !== "string" || typeof value.to !== "string" ||
    !Number.isFinite(Date.parse(value.from)) || !Number.isFinite(Date.parse(value.to)) ||
    Date.parse(value.from) !== Date.parse(requestedFrom) ||
    Date.parse(value.to) !== Date.parse(requestedTo)) return false;
  if (![value.views, value.visitors, value.pages, value.ratings, value.comments].every(count)) return false;
  if (value.averageRating !== null && (typeof value.averageRating !== "number" ||
    !Number.isFinite(value.averageRating) || value.averageRating < 1 || value.averageRating > 5)) return false;
  const lists = [value.daily, value.topPaths, value.topSources, value.topTransitions];
  if (!lists.every(Array.isArray)) return false;
  return (value.daily as unknown[]).every((row) =>
    isReadRecord(row) && day(row.day) && count(row.views)) &&
    (value.topPaths as unknown[]).every((row) =>
      isReadRecord(row) && text(row.path) && count(row.views)) &&
    (value.topSources as unknown[]).every((row) =>
      isReadRecord(row) && text(row.source) && count(row.views)) &&
    (value.topTransitions as unknown[]).every((row) =>
      isReadRecord(row) && text(row.from) && text(row.to) && count(row.views));
}
