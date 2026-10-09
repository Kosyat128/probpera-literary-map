import { describe, expect, it } from 'vitest';
import { extractDailyNewsDetail } from './literary-news-daily-intake.mjs';
import { checkedDailyCandidate } from './literary-news-daily-automation.mjs';

const current = new Date('2026-10-09T08:17:00Z'), url = 'https://publisher.example/news/novel';
const source = { id: 'publisher', name: 'Publisher', url: 'https://publisher.example/news/', language: 'en', topics: ['releases'] };
const body = '<article><h1>A new novel has been released</h1><p>The publisher announced a new literary novel by the writer. The book has been released in the publisher catalogue for literature readers.</p></article>';
const detail = metadata => ({ sourceId: source.id, source: { url }, publishedAt: current.toISOString(), evidence: {
  url, canonical: url, httpStatus: 200, accessedAt: current.toISOString(), responseSha256: 'a'.repeat(64),
  ...extractDailyNewsDetail(`<html>${metadata}${body}</html>`, url, source) } });

describe('explicit structured publication dates', () => {
  it('recognizes the explicit LGZ publication property observed on a current article, ignoring its modified date', async () => {
    // Metadata-only regression fixture; this SHA identifies the fetched full
    // document, not the reconstructed minimal HTML used by this offline test.
    const observed = {
      sourceUrl: 'https://lgz.ru/news/dagestan-vstretil-pisatelej/',
      accessedAt: '2026-10-09T10:26:48.335Z',
      documentSha256: '44f4f473eddf42eefb4a05581abf668583727669fdc8d0b6f6fd1ae878ffd884',
      metadata: '<meta property="og:article:published_time" content="2026-10-08T09:53:03+03:00"><meta property="og:article:modified_time" content="2026-10-07T10:54:48+03:00">',
    };
    const row = detail(observed.metadata);
    expect(row.evidence.publishedDates).toEqual([{ value: '2026-10-08T09:53:03+03:00', method: 'meta[property="og:article:published_time"]' }]);
    expect((await checkedDailyCandidate(row, current, [source])).publication).toEqual(row.evidence.publishedDates[0]);
  });
  it.each([
    ['<meta itemprop="datePublished" content="2026-10-08T12:00:00Z">', 'meta[itemprop~="datePublished"]'],
    ['<time itemprop="datePublished" datetime="2026-10-08T12:00:00Z">8 October</time>', 'time[itemprop~="datePublished"]'],
    ['<time itemprop="datePublished otherProperty" datetime="2026-10-08T12:00:00Z">8 October</time>', 'time[itemprop~="datePublished"]'],
  ])('accepts exact datePublished semantics: %s', async (metadata, method) => {
    expect((await checkedDailyCandidate(detail(metadata), current, [source])).publication)
      .toEqual({ value: '2026-10-08T12:00:00Z', method });
  });
  it('keeps generic, modified, missing-attribute and listing dates unknown', async () => {
    const row = detail('<meta itemprop="dateModified" content="2026-10-08T12:00:00Z"><time datetime="2026-10-08T12:00:00Z">8 October</time><time itemprop="datePublished">8 October</time>');
    expect(row.evidence.publishedDates).toEqual([]);
    await expect(checkedDailyCandidate(row, current, [source])).rejects.toThrow('daily_publication_date_unknown');
  });
  it.each([
    ['<meta itemprop="datePublished" content="2026-10-08"><time itemprop="datePublished" datetime="2026-10-07">7 October</time>', 'daily_publication_date_conflict'],
    ['<meta itemprop="datePublished" content="not-a-date">', 'daily_publication_date_invalid'],
    ['<meta itemprop="datePublished" content="2026-10-06T18:55:00">', 'daily_publication_date_invalid'],
    ['<time itemprop="datePublished" datetime="2026-10-10">Tomorrow</time>', 'daily_publication_date_future'],
    ['<time itemprop="datePublished" datetime="2026-09-01">Last month</time>', 'daily_publication_date_stale'],
  ])('retains existing date safeguards: %s', async (metadata, reason) => {
    await expect(checkedDailyCandidate(detail(metadata), current, [source])).rejects.toThrow(reason);
  });
});
