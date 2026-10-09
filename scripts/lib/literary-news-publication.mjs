import limits from "../../data/news/contract.json" with { type: "json" };
import { resolveNewsTimeZone, selectReviewed, validTimestamp } from "./literary-news-reviewed.mjs";
import { newsArticleThumbnail } from "./literary-news-thumbnails.mjs";
import {newsJsonDigest,newsJsonByteSize} from './literary-news-json.mjs';

export const NEWS_PUBLICATION_POLICY = "reviewed-v2-explicit-withdrawals";
export const NEWS_ARCHIVE_PUBLICATION_POLICY = "reviewed-v2-archive-explicit-withdrawals";
export async function newsDigest(value) {
  return newsJsonDigest(value);
}
export function publicNewsItem(item) {
  const thumbnail = newsArticleThumbnail(item);
  return {
    id: item.id, category: item.category, kind: item.kind, eventDate: item.eventDate,
    publishedAt: item.publishedAt, verifiedAt: item.verifiedAt, verification: "confirmed",
    title: { ru: item.title.ru, en: item.title.en },
    summary: { ru: item.summary.ru, en: item.summary.en },
    source: { name: item.source.name, url: item.source.url, language: item.source.language },
    ...(item.region ? { region: item.region } : {}),
    ...(item.eventKey ? { eventKey: item.eventKey } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  };
}
export function validNewsWithdrawals(rows) {
  if (!Array.isArray(rows) || rows.length > limits.maxItems) throw new Error("withdrawals_invalid");
  const ids = new Set();
  return rows.map((row) => {
    if (!row || typeof row.id !== "string" || !row.id.trim() || row.id.length > 120
      || ids.has(row.id) || !validTimestamp(row.withdrawnAt)
      || typeof row.reason !== "string" || !row.reason.trim() || row.reason.length > 1000) {
      throw new Error("withdrawal_invalid");
    }
    ids.add(row.id);
    return { id: row.id, withdrawnAt: row.withdrawnAt, reason: row.reason };
  });
}
export function newsSnapshotPayload(feed) {
  return { release: feed.snapshot.release, policy: feed.snapshot.policy,
    timeZone: feed.timeZone, items: feed.items, withdrawals: feed.withdrawals };
}
/** One bounded complete representation. Legacy browsers retain their old contract. */
export async function buildPublishedNewsFeed({ records, state, current = new Date(),
  timeZone = limits.editorialTimeZone, release = "local", contractVersion = 2, withdrawals = [], archive = false }) {
  if (archive && contractVersion !== 2) throw new Error("public_archive_contract_required");
  timeZone = resolveNewsTimeZone(timeZone);
  const tombstones = validNewsWithdrawals(withdrawals).filter((row) => Date.parse(row.withdrawnAt) <= current.getTime());
  const removed = new Set(tombstones.map((row) => row.id));
  const items = selectReviewed(records.filter((row) => !removed.has(row?.id)), current, timeZone,
    { includeExpiredAnnouncements: archive }).map(publicNewsItem);
  if (items.length > limits.maxItems || state.sources.length > limits.maxSources) throw new Error("public_snapshot_over_capacity");
  const feed = {
    mode: "reviewed", generatedAt: current.toISOString(), timeZone,
    lastCheckedAt: state.lastCheckedAt, refreshIntervalSeconds: state.refreshIntervalSeconds,
    pendingCount: state.pendingCount, sources: state.sources, items,
  };
  if (contractVersion !== 2) return { ...feed,
    sources: feed.sources.slice(0, limits.legacyMaxSources), items: items.slice(0, limits.legacyMaxItems) };
  feed.contractVersion = 2;
  feed.withdrawals = tombstones;
  feed.snapshot = { id: "", release: /^[a-f0-9]{40}$/.test(release) ? release : "local",
    complete: true, count: items.length, evaluatedAt: current.toISOString(), timeZone,
    policy: archive ? NEWS_ARCHIVE_PUBLICATION_POLICY : NEWS_PUBLICATION_POLICY };
  feed.snapshot.id = await newsDigest(newsSnapshotPayload(feed));
  if (newsJsonByteSize(feed) > limits.maxFeedBytes) throw new Error("public_snapshot_too_large");
  return feed;
}

export async function verifyPublishedNewsSnapshot(feed, { requireRelease = true, archive = false } = {}) {
  if (feed?.contractVersion !== 2 || feed?.snapshot?.complete !== true
    || feed.snapshot.count !== feed.items?.length || feed.items.length > limits.maxItems
    || feed.snapshot.policy !== (archive ? NEWS_ARCHIVE_PUBLICATION_POLICY : NEWS_PUBLICATION_POLICY) || feed.snapshot.timeZone !== feed.timeZone
    || !validTimestamp(feed.snapshot.evaluatedAt) || !validTimestamp(feed.generatedAt)
    || feed.snapshot.evaluatedAt !== feed.generatedAt
    || (requireRelease && !/^[a-f0-9]{40}$/.test(feed.snapshot.release))) throw new Error("public_snapshot_incomplete");
  validNewsWithdrawals(feed.withdrawals);
  if (!Array.isArray(feed.sources) || feed.sources.length > limits.maxSources
    || selectReviewed(feed.items,new Date(feed.generatedAt),feed.timeZone,
      { includeExpiredAnnouncements: archive }).length !== feed.items.length)
    throw new Error("public_snapshot_records_invalid");
  if (await newsDigest(newsSnapshotPayload(feed)) !== feed.snapshot.id) throw new Error("public_snapshot_digest_mismatch");
  return feed;
}
