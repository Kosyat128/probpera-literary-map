import { LITERARY_NEWS_SOURCES, RETAINED_NEWS_SOURCE_GRAMMARS } from "./literary-news-sources.mjs";
import { canonicalUrl, validDate, validTimestamp } from "./literary-news-reviewed.mjs";
import {
  NEWS_HELD_QUEUE_KEY, NEWS_SOURCE_STATE_KEY, NEWS_QUEUE_MAX_BYTES, NEWS_QUEUE_MAX_ITEMS,
  NEWS_REFRESH_SECONDS, parseNewsSourceState, sourceMetadata,
} from "./literary-news-state.mjs";

const plain = (value, max) => typeof value === "string" && value.trim().length > 0
  && value.length <= max && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
const REASONS = ["missing_event_date", "bilingual_review_required", "topic_review_required"];
const retainedGrammars = new Map();
for (const profile of RETAINED_NEWS_SOURCE_GRAMMARS.profiles) {
  retainedGrammars.set(profile.id, [...(retainedGrammars.get(profile.id) || []), profile]);
}

function candidateRecord(value, configured, current, retained = false) {
  const source = configured.get(value?.sourceId);
  const url = canonicalUrl(value?.source?.url);
  if (!source || !url || url.href.length > 2048 || value?.verification !== "held"
    || !plain(value.title, 500) || !validTimestamp(value.discoveredAt)
    || Date.parse(value.discoveredAt) > current.getTime()
    || !(value.publishedAt === null || validDate(value.publishedAt) || validTimestamp(value.publishedAt))
    || !(value.description === null || plain(value.description, 400))) return null;
  const origins = new Set([new URL(source.url).origin, ...(source.articleOrigins || [])]);
  if (!origins.has(url.origin)) return null;
  if (source.linkPattern && !source.linkPattern.test(url.pathname)
    && !(retained && (retainedGrammars.get(source.id) || []).some(profile =>
      profile.origins.includes(url.origin) && profile.linkPattern.test(url.pathname)))) return null;
  return {
    sourceId: source.id, source: { name: source.name, url: url.href, language: source.language },
    region: source.region || "global", topics: [...(source.topics || [])],
    title: value.title, publishedAt: value.publishedAt, description: value.description,
    discoveredAt: value.discoveredAt, verification: "held", reasons: [...REASONS],
  };
}

function readPreviousQueue(value, configured, current) {
  if (value === null) return [];
  if (!value || value.schemaVersion !== 1 || value.verification !== "held"
    || !validTimestamp(value.generatedAt) || Date.parse(value.generatedAt) > current.getTime()
    || !(value.lastCheckedAt === null || validTimestamp(value.lastCheckedAt))
    || !Array.isArray(value.items) || value.items.length > NEWS_QUEUE_MAX_ITEMS
    || Buffer.byteLength(JSON.stringify(value)) > NEWS_QUEUE_MAX_BYTES) {
    throw new Error("previous_queue_invalid");
  }
  return value.items.flatMap((item) => {
    if (!configured.has(item?.sourceId)) {
      // Retired sources retain bounded evidence and decisions; they are never
      // fetched or admitted through this archived record.
      const url = canonicalUrl(item?.source?.url);
      if (!url || !plain(item?.sourceId,120) || !plain(item?.title,500)
        || item.verification !== "held" || !validTimestamp(item.discoveredAt)) throw new Error("previous_candidate_invalid");
      return [{...item,archived:true,reasons:[...new Set([...(item.reasons || []),"source_inactive"])]}];
    }
    const candidate = candidateRecord(item, configured, current, true);
    if (!candidate) throw new Error("previous_candidate_invalid");
    if (item.reasons !== undefined && (!Array.isArray(item.reasons) || item.reasons.some(reason => !plain(reason, 120)))
      || item.decision !== undefined && item.decision !== null && (typeof item.decision !== "object" || Array.isArray(item.decision)
        || Buffer.byteLength(JSON.stringify(item.decision)) > 2048)) throw new Error("previous_candidate_invalid");
    // Keep private review metadata and evidence. Trusted current source identity
    // and held status remain authoritative; compatibility grants no publication.
    return [{ ...item, ...candidate, source: { ...item.source, ...candidate.source },
      reasons: [...new Set([...(item.reasons || []), ...candidate.reasons])] }];
  });
}

/** Merge an entire completed attempt; a failed source never erases its last result. */
export function buildNewsIngestion({ feed, candidates, previousState = null, previousQueue = null,
  sources = LITERARY_NEWS_SOURCES, current = new Date(), scheduler = null, approvedSourceUrls = [] }) {
  if (!Array.isArray(approvedSourceUrls) || approvedSourceUrls.some(url => canonicalUrl(url)?.href !== url))
    throw new Error("approved_queue_urls_invalid");
  const approved = new Set(approvedSourceUrls);
  if ((previousState === null) !== (previousQueue === null)) throw new Error("previous_snapshot_incomplete");
  const before = previousState === null ? null : parseNewsSourceState(previousState, current, sources);
  if (previousState !== null && !before) throw new Error("previous_state_invalid");
  if (!validTimestamp(feed?.lastCheckedAt) || Date.parse(feed.lastCheckedAt) > current.getTime()
    || !Array.isArray(feed.sources) || !Array.isArray(candidates)) throw new Error("collection_result_invalid");
  const configured = new Map(sources.map((source) => [source.id, source]));
  const prior = readPreviousQueue(previousQueue, configured, current);
  const priorByUrl = new Map(prior.map((item) => [item.source.url, item]));
  const fresh = candidates.map((value) => candidateRecord(value, configured, current)).filter(Boolean);
  const attempts = new Map(feed.sources.map((source) => [source.id, source]));
  const seen = new Set();
  const merged = [];
  const states = sources.map((source) => {
    const attempt = attempts.get(source.id);
    if (!attempt || !["ok", "error", "pending"].includes(attempt.status)) throw new Error("collection_incomplete");
    const previous = before?.sources.find((entry) => entry.id === source.id);
    const fromSource = attempt.status === "ok"
      ? [...fresh.filter((item) => item.sourceId === source.id), ...prior.filter((item) => item.sourceId === source.id)]
      : prior.filter((item) => item.sourceId === source.id);
    let count = 0;
    for (const candidate of fromSource) {
      if (approved.has(candidate.source.url) || seen.has(candidate.source.url)) continue;
      seen.add(candidate.source.url);
      const old = priorByUrl.get(candidate.source.url);
      merged.push({ ...old, ...candidate, source: { ...old?.source, ...candidate.source },
        reasons: [...new Set([...(old?.reasons || []), ...candidate.reasons])],
        discoveredAt: old?.discoveredAt || candidate.discoveredAt,
        ...(old?.decision ? {decision:old.decision} : {}) });
      count += 1;
    }
    return {
      ...sourceMetadata(source), status: attempt.status === "pending" ? previous?.status || "pending" : attempt.status,
      lastSuccessAt: attempt.status === "ok" ? attempt.lastSuccessAt : previous?.lastSuccessAt || null,
      candidateCount: count,
      ...(attempt.status === "error" ? { error: attempt.error }
        : attempt.status === "pending" && previous?.error ? {error:previous.error} : {}),
    };
  });
  for (const item of prior.filter((candidate) => !configured.has(candidate.sourceId))) {
    if (!approved.has(item.source.url) && !seen.has(item.source.url)) { merged.push(item); seen.add(item.source.url); }
  }
  const queue = {
    schemaVersion: 1, generatedAt: current.toISOString(), lastCheckedAt: feed.lastCheckedAt,
    verification: "held", items: merged, ...(scheduler ? {scheduler} : {}),
  };
  // Stop before upload instead of silently discarding evidence to fit a KV value.
  if (merged.length > NEWS_QUEUE_MAX_ITEMS || Buffer.byteLength(JSON.stringify(queue)) > NEWS_QUEUE_MAX_BYTES) {
    throw new Error("held_queue_too_large");
  }
  const state = parseNewsSourceState({
    schemaVersion: 1, lastCheckedAt: feed.lastCheckedAt, refreshIntervalSeconds: NEWS_REFRESH_SECONDS,
    pendingCount: merged.length, sources: states,
  }, current, sources);
  if (!state) throw new Error("collection_state_invalid");
  return {
    state, queue,
    bulk: [
      { key: NEWS_SOURCE_STATE_KEY, value: JSON.stringify(state) },
      { key: NEWS_HELD_QUEUE_KEY, value: JSON.stringify(queue) },
    ],
  };
}

const SAFE_REFRESH_FAILURE_REASONS = new Set([
  "previous_snapshot_incomplete", "previous_snapshot_invalid", "previous_snapshot_too_large",
  "previous_state_invalid", "previous_queue_invalid", "previous_candidate_invalid",
  "approved_queue_urls_invalid", "collection_result_invalid", "collection_incomplete",
  "held_queue_too_large", "collection_state_invalid", "snapshot_limit_invalid",
  "daily_queue_profile_reader_required", "daily_queue_profile_invalid", "daily_profile_invalid",
  "daily_profile_duplicate", "daily_profile_daily_limit", "daily_record_invalid",
  "daily_thumbnail_invalid", "daily_record_proof_invalid",
]);

/** Only fixed bounded codes cross the CLI diagnostic boundary, never raw errors. */
export function safeNewsRefreshFailureReason(error) {
  if (SAFE_REFRESH_FAILURE_REASONS.has(error?.message)) return error.message;
  if (error?.code === "ENOENT") return "snapshot_file_missing";
  if (error?.code === "EACCES" || error?.code === "EPERM") return "file_access_denied";
  return "unexpected_error";
}
