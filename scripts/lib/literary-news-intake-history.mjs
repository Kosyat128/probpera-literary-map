import { canonicalUrl, validTimestamp } from './literary-news-reviewed.mjs';
import { newsJsonDigest } from './literary-news-json.mjs';

export const NEWS_INTAKE_HISTORY_LIMITS = Object.freeze({ sources: 1024, articles: 1200, rejectionCooldownMs: 6 * 3600000 });
const fail = () => { throw Error('daily_intake_history_invalid'); };
const empty = () => ({ sources: [], articles: [] });

/** Scheduling metadata only: it cannot confirm a date, approve an article or spend inference. */
export function checkedDailyIntakeHistory(value, current = new Date()) {
  if (!Number.isFinite(current.getTime())) fail();
  if (value === undefined) return empty(); // Retained ledgers predate this optional field.
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['sources', 'articles'].includes(key))) fail();
  for (const [kind, key] of [['sources', 'sourceId'], ['articles', 'urlSha256']]) {
    const rows = value[kind];
    if (!Array.isArray(rows) || rows.length > NEWS_INTAKE_HISTORY_LIMITS[kind]
      || new Set(rows.map(row => row?.[key])).size !== rows.length) fail();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)
        || Object.keys(row).length !== 2 || !Object.hasOwn(row, key) || !Object.hasOwn(row, 'checkedAt')
        || !validTimestamp(row.checkedAt) || Date.parse(row.checkedAt) > current.getTime()
        || typeof row[key] !== 'string'
        || (kind === 'articles' ? !/^[a-f0-9]{64}$/.test(row[key]) : !/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(row[key]))) fail();
    }
  }
  return value;
}

export function mergeDailyIntakeHistory(current, ...histories) {
  const result = empty();
  for (const history of histories) checkedDailyIntakeHistory(history, current);
  for (const [kind, key] of [['sources', 'sourceId'], ['articles', 'urlSha256']]) {
    const rows = new Map();
    for (const history of histories) for (const row of history?.[kind] || []) {
      if (!rows.has(row[key]) || Date.parse(rows.get(row[key]).checkedAt) < Date.parse(row.checkedAt)) rows.set(row[key], { ...row });
    }
    result[kind] = [...rows.values()].sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt)
      || a[key].localeCompare(b[key])).slice(0, NEWS_INTAKE_HISTORY_LIMITS[kind]);
  }
  return result;
}

/** Least-recently-attempted sources and articles make progress regardless of Cron/registry divisors. */
export async function selectDailyNewsDetails(candidates, { current = new Date(), detailLimit,
  intakeHistory, reviewCache = [] } = {}) {
  const history = checkedDailyIntakeHistory(intakeHistory, current);
  if (!Array.isArray(candidates) || !Number.isSafeInteger(detailLimit) || detailLimit < 0 || detailLimit > 40
    || !Array.isArray(reviewCache) || reviewCache.length > 120) throw Error('daily_detail_budget_invalid');
  const deferred = new Set();
  for (const row of reviewCache) if (row?.status === 'rejected') {
    const url = canonicalUrl(row.sourceUrl), age = current.getTime() - Date.parse(row.checkedAt);
    if (!url || !validTimestamp(row.checkedAt) || !Number.isFinite(age) || age < 0) fail();
    if (age < NEWS_INTAKE_HISTORY_LIMITS.rejectionCooldownMs) deferred.add(url.href);
  }
  const sourceTimes = new Map(history.sources.map(row => [row.sourceId, Date.parse(row.checkedAt)]));
  const articleTimes = new Map(history.articles.map(row => [row.urlSha256, Date.parse(row.checkedAt)]));
  const bySource = new Map(), seenUrls = new Set(); let deferredRejections = 0;
  for (const [index, candidate] of candidates.entries()) {
    const url = canonicalUrl(candidate?.source?.url);
    if (!url || typeof candidate.sourceId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,159}$/i.test(candidate.sourceId)) fail();
    if (seenUrls.has(url.href)) continue; seenUrls.add(url.href);
    if (deferred.has(url.href)) { deferredRejections++; continue; }
    const urlSha256 = await newsJsonDigest(url.href), rows = bySource.get(candidate.sourceId) || [];
    rows.push({ candidate, urlSha256, index }); bySource.set(candidate.sourceId, rows);
  }
  for (const rows of bySource.values()) rows.sort((a, b) => (articleTimes.get(a.urlSha256) || 0)
    - (articleTimes.get(b.urlSha256) || 0) || a.index - b.index);
  const groups = [...bySource].sort(([a, aRows], [b, bRows]) => (sourceTimes.get(a) || 0)
    - (sourceTimes.get(b) || 0) || aRows[0].index - bRows[0].index);
  const selected = [], attempts = empty();
  while (selected.length < detailLimit && groups.some(([, rows]) => rows.length)) {
    for (const [sourceId, rows] of groups) {
      if (!rows.length || selected.length >= detailLimit) continue;
      const row = rows.shift(); selected.push(row.candidate);
      if (!attempts.sources.some(source => source.sourceId === sourceId)) attempts.sources.push({ sourceId, checkedAt: current.toISOString() });
      attempts.articles.push({ urlSha256: row.urlSha256, checkedAt: current.toISOString() });
    }
  }
  return { selected, deferredRejections, intakeHistory: mergeDailyIntakeHistory(current, history, attempts) };
}
