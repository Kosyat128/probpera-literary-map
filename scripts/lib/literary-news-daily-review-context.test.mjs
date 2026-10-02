import { describe, expect, it, vi } from 'vitest';
import { runDailyNewsAutomation } from './literary-news-daily-automation.mjs';
import { DAILY_NEWS_LIMITS, DAILY_NEWS_WINDOW } from './literary-news-daily-profile.mjs';

const current = new Date('2026-10-02T09:00:00Z');
const source = { id: 'context-fixture', name: 'Literary context fixture', language: 'en', region: 'global',
  url: 'https://source.example/news/', topics: ['releases'], linkPattern: /^\/news\/[^/]+$/ };
const articleUrl = 'https://source.example/news/new-novel';
const quote = 'The publisher released a literary novel by a debut writer.';
const proposed = { status: 'draft', reason: '', category: 'releases', eventIdentity: 'debut-writer-new-novel-release',
  title: { ru: 'Издатель выпустил дебютный роман', en: 'Publisher releases a debut writer’s novel' },
  summary: { ru: 'Издатель выпустил литературный роман автора-дебютанта.', en: quote },
  literaryEvidence: 'literary novel', facts: [{ quote }] };
const accepted = { accepted: true, literaryTopic: true, categoryMatches: true, translationsMatch: true,
  titleSupported: true, summarySupported: true, publicationDateMatches: true, duplicateOf: null,
  unsupportedClaims: [], factChecks: [{ factIndex: 0, supported: true }] };

function existing(id, publishedAt, extra = {}) {
  return { id, category: 'awards', title: { ru: `Премия ${id}`, en: `Prize jury selection ${id}` },
    source: { name: source.name, language: 'en', url: `https://source.example/news/${id}` },
    eventDate: '2027-01-01', publishedAt, ...extra };
}

async function captureReview(reviewed) {
  const requests = [];
  const ai = { request: vi.fn(async request => {
    requests.push(request);
    return request.phase === 'draft' ? structuredClone(proposed) : structuredClone(accepted);
  }) };
  const result = await runDailyNewsAutomation({ current, sources: [source], reviewed, ai, maxAiCalls: 30,
    intake: { schemaVersion: 2, contract: 'literary-news-daily-intake-v2', details: [{
      id: 'new-novel', sourceId: source.id, source: { name: source.name, language: 'en', url: articleUrl },
      evidence: { url: articleUrl, canonical: articleUrl, httpStatus: 200, accessedAt: current.toISOString(),
        responseSha256: 'a'.repeat(64), headline: 'A debut writer’s literary novel',
        text: `${quote} Readers can find the new work in the publisher’s literary catalogue.`,
        publishedDates: [{ value: '2026-10-02T08:00:00Z', method: 'meta[property="article:published_time"]' }], images: [] },
    }] } });
  expect(result.report.newlyAccepted).toBe(1);
  expect(requests.map(request => request.phase)).toEqual(['draft', 'review']);
  const draftRequest = JSON.parse(requests[0].messages[1].content);
  expect(draftRequest).not.toHaveProperty('recentExisting');
  const reviewRequest = JSON.parse(requests[1].messages[1].content);
  expect(reviewRequest.SOURCE_DATA.publication.value).toBe('2026-10-02T08:00:00Z');
  expect(reviewRequest.draft).toEqual(proposed);
  return reviewRequest.recentExisting;
}

describe('publication-ordered bounded independent review context', () => {
  it('keeps the newest 80 actual publications when a larger older archive is appended afterwards', async () => {
    const fresh = Array.from({ length: 90 }, (_, index) => existing(`current-${index}`,
      new Date(Date.parse('2026-10-01T08:00:00Z') + index * 60_000).toISOString()));
    const archive = Array.from({ length: 120 }, (_, index) => existing(`archive-${index}`, '2026-09-10'));
    const reviewed = Object.freeze([...fresh, ...archive].map(record => Object.freeze(record)));
    const before = JSON.stringify(reviewed);
    const context = await captureReview(reviewed);
    expect(context).toHaveLength(80);
    expect(context.map(record => record.id)).toEqual(Array.from({ length: 80 }, (_, index) => `current-${89 - index}`));
    expect(context.some(record => record.id.startsWith('archive-'))).toBe(false);
    expect(JSON.stringify(reviewed)).toBe(before);
    expect(context.every(record => Object.keys(record).join(',') === 'id,category,title,eventDate')).toBe(true);
  });

  it('uses Moscow midnight for date-only dates, preserves ties and ignores capture/event dates without adding a horizon', async () => {
    const reviewed = Object.freeze([
      existing('date-only', '2026-10-01'),
      existing('after-midnight', '2026-09-30T21:30:00Z'),
      existing('tie-first', '2026-10-01T03:00:00+03:00'),
      existing('tie-second', '2026-10-01T00:00:00Z'),
      existing('before-midnight', '2026-09-30T20:59:59Z'),
      existing('unknown', null, { observedAt: current.toISOString(), verifiedAt: current.toISOString(), eventDate: '2027-09-29' }),
      existing('invalid', 'not-a-date', { discoveredAt: current.toISOString() }),
      existing('explicit-old', '2025-01-01T12:00:00Z'),
    ].map(record => Object.freeze(record)));
    const before = JSON.stringify(reviewed);
    const context = await captureReview(reviewed);
    expect(context.map(record => record.id)).toEqual([
      'tie-first', 'tie-second', 'after-midnight', 'date-only', 'before-midnight', 'explicit-old',
    ]);
    expect(JSON.stringify(reviewed)).toBe(before);
    expect(DAILY_NEWS_WINDOW).toEqual({ start: '2026-09-29', endExclusive: '2027-09-30', timeZone: 'Europe/Moscow' });
    expect(DAILY_NEWS_LIMITS.aiCallsPerDay).toBe(80);
  });
});
