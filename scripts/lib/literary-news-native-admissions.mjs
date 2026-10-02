import { Buffer } from 'node:buffer';
import limits from '../../data/news/contract.json' with { type: 'json' };
import { verifyPublishedNewsSnapshot } from './literary-news-publication.mjs';
import { dailyNewsDay, dailyPublicationEpoch } from './literary-news-daily-profile.mjs';
import { newsAnnouncementEligible } from './literary-news-reviewed.mjs';
import { newsSemanticRevision } from './literary-news-social.mjs';

export const NATIVE_NEWS_ADMISSION_FEED_URL = 'https://news.probpera.ru/api/literary-news/feed?contract=2&timeZone=Europe%2FMoscow';
export const NATIVE_NEWS_ADMISSION_MAX_ITEMS = 24;
const fail = code => { throw Error(code); };

/** One fixed, complete public representation; its original proof is never replaced by a subset proof. */
export async function fetchNativeNewsAdmissionFeed({ fetchImpl = fetch, current = new Date() } = {}) {
  if (!Number.isFinite(current.getTime())) fail('delivery_public_feed_invalid');
  let response;
  try { response = await fetchImpl(NATIVE_NEWS_ADMISSION_FEED_URL, { method: 'GET', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } }); }
  catch { fail('delivery_public_feed_unavailable'); }
  if (response.url !== NATIVE_NEWS_ADMISSION_FEED_URL || response.redirected) {
    await response.body?.cancel().catch(() => {}); fail('delivery_public_feed_origin_invalid');
  }
  if (!response.ok || !response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel().catch(() => {}); fail('delivery_public_feed_unavailable');
  }
  if (Number(response.headers.get('content-length')) > limits.maxFeedBytes) {
    await response.body.cancel(); fail('delivery_public_feed_too_large');
  }
  const reader = response.body.getReader(), chunks = []; let length = 0, feed;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength; if (length > limits.maxFeedBytes) fail('delivery_public_feed_too_large');
      chunks.push(Buffer.from(value)); }
    try { feed = JSON.parse(Buffer.concat(chunks, length).toString('utf8')); }
    catch { fail('delivery_public_feed_invalid'); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  try { await verifyPublishedNewsSnapshot(feed); } catch { fail('delivery_public_feed_invalid'); }
  if (response.headers.get('x-probpera-news-release') !== feed.snapshot.release) fail('delivery_public_feed_release_mismatch');
  if (feed.timeZone !== 'Europe/Moscow' || feed.fallbackCapturedAt
    || Math.abs(current.getTime() - Date.parse(feed.generatedAt)) > 300000) fail('delivery_public_feed_not_current');
  return feed;
}

/** Stable explicit-publication ordering. Calendar, unknown dates and expired announcements never establish creates. */
export function selectNativeNewsAdmissionIds(feed, current = new Date()) {
  const today = dailyNewsDay(current);
  return feed.items.map((item, index) => ({ item, index, published: dailyPublicationEpoch(item.publishedAt) }))
    .filter(({ item, published }) => ['news', 'announcement'].includes(item.kind) && Number.isFinite(published)
      && published <= current.getTime() && current.getTime() - published <= 7 * 86400000
      && newsAnnouncementEligible(item, today, 'Europe/Moscow'))
    .sort((left, right) => right.published - left.published || left.index - right.index)
    .slice(0, NATIVE_NEWS_ADMISSION_MAX_ITEMS).map(({ item }) => item.id);
}

/** A current full feed authorizes creates, while remote corrections retain their existing durable identities. */
export async function currentNativeNewsDueRows(rows, feed) {
  const byId = new Map(feed.items.map(item => [item.id, item])), withdrawn = new Set(feed.withdrawals.map(row => row.id));
  const selected = [], revisions = new Map();
  for (const row of rows) {
    const job = row.state;
    if (job.remoteId) { selected.push(row); continue; }
    const current = byId.get(job.newsId);
    if (!current || withdrawn.has(job.newsId)) continue;
    if (!revisions.has(job.newsId)) revisions.set(job.newsId, await newsSemanticRevision(current));
    if (job.prepared?.textRevision === revisions.get(job.newsId)) selected.push(row);
  }
  return selected;
}
