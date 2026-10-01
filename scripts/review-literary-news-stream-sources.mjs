import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createNewsService } from './lib/literary-news-feed.mjs';
import { LITERARY_NEWS_SOURCES } from './lib/literary-news-sources.mjs';
import { STREAM_SOURCE_DISCOVERY_OVERRIDES } from './lib/literary-news-stream-source-overrides.mjs';
import { extractDailyNewsDetail } from './lib/literary-news-daily-intake.mjs';
import { boundedFetch, pool } from './research-literary-news-sources.mjs';

const clean = row => ({ url: row.url, httpStatus: row.status, contentType: row.contentType,
  bytes: row.bytes, responseSha256: row.sha256, accessedAt: row.accessedAt });
const onlyIds = new Set((process.argv.find(arg => arg.startsWith('--ids='))?.slice(6) || '').split(',').filter(Boolean));
if ([...onlyIds].some(id => !/^[a-z0-9][a-z0-9_-]+$/u.test(id) || !STREAM_SOURCE_DISCOVERY_OVERRIDES[id])) {
  throw new Error('Unknown code-owned stream source review ID');
}
const outputPath = process.argv.find(arg => arg.startsWith('--output='))?.slice(9)
  || 'reports/r10/sources/stream-profile-review-20261001.json';
if (!/^reports\/r10\/sources\/[a-z0-9-]+\.json$/u.test(outputPath)) throw new Error('Invalid review report path');
const sources = LITERARY_NEWS_SOURCES.filter(source => STREAM_SOURCE_DISCOVERY_OVERRIDES[source.id]
  && (!onlyIds.size || onlyIds.has(source.id)));
const results = await pool(sources, async source => {
  const requests = [];
  let beforeCount = null;
  try {
    const old = JSON.parse(await readFile(source.evidenceReport, 'utf8'));
    beforeCount = old.candidateCount;
  } catch { /* No prior report is evidence of absence. */ }
  const service = createNewsService({ sources: [source], readReviewed: () => [], timeoutMs: 15000,
    fetchImpl: async url => {
      const response = await boundedFetch(url, { includeBytes: true, encoding: source.encoding, timeout: 14000,
        allowedHosts: new Set([new URL(source.url).hostname]) });
      requests.push(clean(response));
      return new Response(response.rawBytes, { headers: { 'content-type': response.contentType } });
    } });
  try {
    await service.refresh();
    const state = (await service.getFeed()).sources[0];
    const finds = service.getReviewQueue();
    let sample = null, detailError = null;
    // Article identity comes from this actual bounded parser run. The old sample
    // is preferred only if it is still listed; its URL cannot grant access.
    const preferred = finds.filter(row => source.exampleArticleUrls.includes(row.source.url));
    const options = [...preferred, ...finds.filter(row => !preferred.includes(row))];
    for (const item of options.slice(0, 3)) {
      try {
        const detail = await boundedFetch(item.source.url, { encoding: source.encoding,
          allowedHosts: new Set(source.articleOrigins.map(origin => new URL(origin).hostname)) });
        requests.push(clean(detail));
        const extracted = extractDailyNewsDetail(detail.text, detail.url, source);
        if (extracted.headline.length < 10 || extracted.text.length < 80) {
          detailError = 'detail_article_identity_missing'; continue;
        }
        sample = { url: item.source.url, discoveryTitle: item.title, detailHeadline: extracted.headline,
          publicationDates: extracted.publishedDates, sourcePublishedAt: item.publishedAt,
          detailTextCharacters: extracted.text.length,
          detailTextSha256: createHash('sha256').update(extracted.text).digest('hex') };
        break;
      } catch (error) { detailError = error.message; }
    }
    const record = { sourceId: source.id, endpoint: source.url, countryCodes: source.countryCodes,
      status: state.status, ...(state.error ? { error: state.error } : {}),
      ...(detailError && !sample ? { detailError } : {}), beforeRecordedCandidateCount: beforeCount,
      currentArticleCandidateCount: finds.length, articleDetailVerified: Boolean(sample),
      parser: { linkPattern: source.linkPattern?.source || null, linkSelector: source.linkSelector || 'a[href]',
        articleContainer: source.articleContainer || null, titleSelector: source.titleSelector || null },
      requests, sample, publicCount: 0 };
    console.log(`${source.id}: ${state.status}, ${finds.length} article finds, detail=${Boolean(sample)}`);
    return record;
  } finally { service.close(); }
}, 4);
const report = { schemaVersion: 1, checkedAt: new Date().toISOString(),
  scope: 'Current bounded source index, production discovery parser, and separate article detail probes. Availability and article identity only; no publication or freshness guarantee.',
  previousBaseline: { checkpoint: '2026-09-27', promotedProfiles: 108, combinedRegistry: 115 },
  counts: { reviewedSourceOverrides: sources.length, availableEndpoints: results.filter(row => row.status === 'ok').length,
    separatelyVerifiedDetails: results.filter(row => row.articleDetailVerified).length,
    currentArticleFinds: results.reduce((count, row) => count + row.currentArticleCandidateCount, 0),
    published: 0 },
  failedSources: results.filter(row => row.status !== 'ok' || !row.articleDetailVerified).map(row => ({
    sourceId: row.sourceId, error: row.error || row.detailError || 'detail_article_identity_missing' })), results };
await mkdir('reports/r10/sources', { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.counts));
