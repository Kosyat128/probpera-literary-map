import { describe, expect, it } from 'vitest';
import { collectDailyNewsReview, selectDailyNewsSources } from './literary-news-daily-intake.mjs';
import { checkedDailyIntakeHistory, mergeDailyIntakeHistory, NEWS_INTAKE_HISTORY_LIMITS, selectDailyNewsDetails } from './literary-news-intake-history.mjs';
import { checkedDailyCandidate, copyDailyLedger, emptyDailyLedger, mergeDailyLedgers, runDailyNewsAutomation, validateDailyLedger } from './literary-news-daily-automation.mjs';
import { newsJsonDigest } from './literary-news-json.mjs';

const current = new Date('2026-10-09T08:17:00Z');
const candidate = (source, article = 0) => ({ sourceId: source, source: { url: `https://${source}.example/news/${article}` } });

describe('durable detail selection without inference or relaxed evidence', () => {
  it('eventually visits every article and source even when all first articles are undated or rejected', async () => {
    const candidates = Array.from({ length: 32 }, (_, n) => Array.from({ length: 4 }, (_, k) => candidate(`source-${n}`, k))).flat();
    const seen = new Set(); let intakeHistory;
    for (let tick = 0; tick < 16; tick++) {
      const result = await selectDailyNewsDetails(candidates, { current: new Date(current.getTime() + tick * 7200000), detailLimit: 10, intakeHistory });
      expect(result.selected).toHaveLength(10);
      expect(new Set(result.selected.map(row => row.sourceId)).size).toBe(10);
      result.selected.forEach(row => seen.add(row.source.url)); intakeHistory = result.intakeHistory;
    }
    expect(seen.size).toBe(candidates.length);
  });
  it.each([99, 124, 149, 210, 222])('retains source fairness with rotating registry size %i instead of aliasing Cron divisors', async count => {
    const source = (id, language = 'en') => ({ id, name: id, language, url: `https://${id}.example/feed`, format: 'rss', region: 'global' });
    const sources = [...Array.from({ length: 12 }, (_, n) => source(`ru-${n}`, 'ru')), ...Array.from({ length: count }, (_, n) => source(`world-${n}`))];
    const seen = new Set(); let intakeHistory;
    for (let tick = 0; tick < 84; tick++) {
      const now = new Date(current.getTime() + tick * 7200000);
      const candidates = selectDailyNewsSources({ sources, current: now, rotationMinutes: 120 }).map(row => candidate(row.id));
      const result = await selectDailyNewsDetails(candidates, { current: now, detailLimit: 10, intakeHistory });
      result.selected.forEach(row => seen.add(row.sourceId)); intakeHistory = result.intakeHistory;
    }
    expect(seen.size).toBe(sources.length);
  });
  it('defers recent rejected URLs for six hours before any detail fetch, then allows changed content to be checked again', async () => {
    const candidates = Array.from({ length: 6 }, (_, n) => candidate('source', n));
    const reviewCache = candidates.slice(0, 5).map(row => ({ status: 'rejected', sourceUrl: row.source.url, checkedAt: current.toISOString() }));
    const first = await selectDailyNewsDetails(candidates, { current, detailLimit: 5, reviewCache });
    expect(first.selected).toEqual([candidates[5]]); expect(first.deferredRejections).toBe(5);
    const later = await selectDailyNewsDetails(candidates, { current: new Date(current.getTime() + 6 * 3600000), detailLimit: 5, reviewCache, intakeHistory: first.intakeHistory });
    expect(later.selected).toEqual(candidates.slice(0, 5)); expect(later.deferredRejections).toBe(0);
    await expect(selectDailyNewsDetails(candidates, { current, detailLimit: 5,
      reviewCache: [{ ...reviewCache[0], checkedAt: '2026-10-10T00:00:00Z' }] })).rejects.toThrow('daily_intake_history_invalid');
  });
  it('never defers completed drafts or replaces evidence with listing dates', async () => {
    const row = { ...candidate('source'), publishedAt: current.toISOString() };
    const result = await selectDailyNewsDetails([row, row], { current, detailLimit: 10,
      reviewCache: [{ status: 'draft', sourceUrl: row.source.url, checkedAt: current.toISOString() }] });
    expect(result.selected).toEqual([row]); expect(result.selected[0].evidence).toBeUndefined();
    expect(result.intakeHistory.sources).toHaveLength(1); expect(result.intakeHistory.articles).toHaveLength(1);
  });
  it('preserves new optional history through ledger checkpoints, deep copies and newest-per-key merges', async () => {
    const legacy = emptyDailyLedger(current); expect(await validateDailyLedger(legacy, current)).toBe(legacy);
    const selection = await selectDailyNewsDetails([candidate('source')], { current, detailLimit: 1 });
    const result = await runDailyNewsAutomation({ previous: legacy, intake: { details: [], intakeHistory: selection.intakeHistory }, current,
      ai: { request() { throw Error('inference_must_not_run'); } } });
    expect(result.state.intakeHistory).toEqual(selection.intakeHistory);
    const copy = copyDailyLedger(result.state); copy.intakeHistory.articles[0].checkedAt = '2026-10-08T00:00:00Z';
    expect(result.state.intakeHistory.articles[0].checkedAt).toBe(current.toISOString());
    const merged = await mergeDailyLedgers(copy, null, result.state, current);
    expect(merged.intakeHistory).toEqual(selection.intakeHistory);
    const corrupt = structuredClone(result.state); corrupt.intakeHistory.articles[0].checkedAt = '2026-10-10T00:00:00Z';
    await expect(validateDailyLedger(corrupt, current)).rejects.toThrow('daily_intake_history_invalid');
  });
  it('moves past a fetched undated leading article on the next persisted run to check another actual article', async () => {
    const source = { id: 'publisher', name: 'Publisher', language: 'en', topics: ['releases'], format: 'rss', url: 'https://publisher.example/feed' };
    const urls = ['https://publisher.example/news/undated', 'https://publisher.example/news/dated'];
    const xml = `<rss version="2.0"><channel><title>Publisher</title>${urls.map((url, index) => `<item><title>New literary novel ${index}</title><link>${url}</link><pubDate>Fri, 09 Oct 2026 0${7 - index}:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`;
    const fetchImpl = async url => {
      const text = url === source.url ? xml : `<html>${url === urls[1] ? '<meta itemprop="datePublished" content="2026-10-09T06:00:00Z">' : ''}<article><h1>New literary novel</h1><p>The publisher released a new novel by the writer. Literature readers can find this newly published literary work in the catalogue.</p></article></html>`;
      return { url, status: 200, contentType: url === source.url ? 'application/rss+xml' : 'text/html', text,
        bytes: Buffer.byteLength(text), sha256: await newsJsonDigest(text), accessedAt: current.toISOString() };
    };
    const options = { current, sources: [source], sourceLimit: 1, detailLimit: 1, fetchImpl };
    const first = await collectDailyNewsReview(options); expect(first.details[0].source.url).toBe(urls[0]);
    const result = await runDailyNewsAutomation({ current, sources: [source], intake: first,
      ai: { request() { throw Error('unknown_date_must_not_infer'); } } });
    expect(result.report.held[0].reason).toBe('daily_publication_date_unknown'); expect(result.report.aiCalls).toBe(0);
    const later = await collectDailyNewsReview({ ...options, current: new Date(current.getTime() + 7200000), intakeHistory: result.state.intakeHistory });
    expect(later.details[0].source.url).toBe(urls[1]);
    expect((await checkedDailyCandidate(later.details[0], new Date(current.getTime() + 7200000), [source])).publication.value).toBe('2026-10-09T06:00:00Z');
  });
  it('bounds history growth and rejects malformed or duplicate persisted entries', async () => {
    const articles = Array.from({ length: NEWS_INTAKE_HISTORY_LIMITS.articles }, (_, n) => ({ urlSha256: n.toString(16).padStart(64, '0'), checkedAt: '2026-10-08T00:00:00Z' }));
    const newer = { sources: [], articles: [{ urlSha256: await newsJsonDigest('https://new.example/news'), checkedAt: current.toISOString() }] };
    const merged = mergeDailyIntakeHistory(current, { sources: [], articles }, newer);
    expect(merged.articles).toHaveLength(1200); expect(merged.articles[0]).toEqual(newer.articles[0]);
    for (const invalid of [null, {}, { sources: [], articles: [...articles, articles[0]] },
      { sources: [], articles: [articles[0], articles[0]] }, { sources: [{ sourceId: 'bad source', checkedAt: current.toISOString() }], articles: [] }])
      expect(() => checkedDailyIntakeHistory(invalid, current)).toThrow('daily_intake_history_invalid');
  });
});
