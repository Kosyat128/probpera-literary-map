export const analyticsPeriods = [7, 30, 90, 365] as const;

export type AnalyticsPeriod = (typeof analyticsPeriods)[number];

export type AnalyticsCount = { views: number };
export type AnalyticsPathCount = AnalyticsCount & { path: string };
export type AnalyticsSourceCount = AnalyticsCount & { source: string };
export type AnalyticsTransitionCount = AnalyticsCount & {
  from: string;
  to: string;
};
export type AnalyticsDailyCount = AnalyticsCount & { day: string };

export type AnalyticsReport = {
  from: string;
  to: string;
  views: number;
  visitors: number;
  pages: number;
  ratings: number;
  averageRating: number | null;
  comments: number;
  daily: AnalyticsDailyCount[];
  topPaths: AnalyticsPathCount[];
  topSources: AnalyticsSourceCount[];
  topTransitions: AnalyticsTransitionCount[];
};

const emptyReport = (from: string, to: string): AnalyticsReport => ({
  from,
  to,
  views: 0,
  visitors: 0,
  pages: 0,
  ratings: 0,
  averageRating: null,
  comments: 0,
  daily: [],
  topPaths: [],
  topSources: [],
  topTransitions: [],
});

function finiteCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeText(value: unknown, maximum = 320) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/gu, " ").trim().slice(0, maximum)
    : "";
}

function rows<T>(value: unknown, mapper: (row: Record<string, unknown>) => T | null) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 400)
    .map((row) => row && typeof row === "object" ? mapper(row as Record<string, unknown>) : null)
    .filter((row): row is T => row !== null);
}

export function resolveAnalyticsRange(periodValue: unknown, now = new Date()) {
  const parsed = Number(periodValue);
  const period = analyticsPeriods.includes(parsed as AnalyticsPeriod)
    ? (parsed as AnalyticsPeriod)
    : 30;
  const to = new Date(now);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - period);
  return { period, from: from.toISOString(), to: to.toISOString() };
}

export function normalizeAnalyticsReport(
  value: unknown,
  fallbackFrom: string,
  fallbackTo: string
): AnalyticsReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyReport(fallbackFrom, fallbackTo);
  }
  const source = value as Record<string, unknown>;
  return {
    from: safeText(source.from, 64) || fallbackFrom,
    to: safeText(source.to, 64) || fallbackTo,
    views: finiteCount(source.views),
    visitors: finiteCount(source.visitors),
    pages: finiteCount(source.pages),
    ratings: finiteCount(source.ratings),
    averageRating: source.averageRating == null ? null : finiteCount(source.averageRating),
    comments: finiteCount(source.comments),
    daily: rows(source.daily, (row) => {
      const day = safeText(row.day, 10);
      return /^\d{4}-\d{2}-\d{2}$/u.test(day)
        ? { day, views: finiteCount(row.views) }
        : null;
    }),
    topPaths: rows(source.topPaths, (row) => {
      const path = safeText(row.path);
      return path ? { path, views: finiteCount(row.views) } : null;
    }),
    topSources: rows(source.topSources, (row) => {
      const sourceName = safeText(row.source, 180);
      return sourceName ? { source: sourceName, views: finiteCount(row.views) } : null;
    }),
    topTransitions: rows(source.topTransitions, (row) => {
      const from = safeText(row.from);
      const to = safeText(row.to);
      return from && to ? { from, to, views: finiteCount(row.views) } : null;
    }),
  };
}

function csvCell(value: string | number) {
  const text = String(value).replace(/\r?\n/gu, " ");
  const formulaSafe = /^[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${formulaSafe.replace(/"/gu, '""')}"`;
}

export function analyticsReportCsv(report: AnalyticsReport) {
  const rows = [
    ["Раздел", "Значение", "Просмотры"],
    ["Период", `${report.from} - ${report.to}`, report.views],
    ["Читатели", report.visitors, ""],
    ["Страницы", report.pages, ""],
    ["Оценки", report.ratings, ""],
    ["Средняя оценка", report.averageRating ?? "", ""],
    ["Комментарии", report.comments, ""],
    ...report.daily.map((item) => ["День", item.day, item.views]),
    ...report.topPaths.map((item) => ["Страница", item.path, item.views]),
    ...report.topSources.map((item) => ["Источник", item.source, item.views]),
    ...report.topTransitions.map((item) => ["Переход", `${item.from} → ${item.to}`, item.views]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
