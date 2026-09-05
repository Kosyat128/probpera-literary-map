import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";
import { validTimestamp } from "./literary-news-reviewed.mjs";

export const NEWS_SOURCE_STATE_KEY = "literary-news:v1:source-state";
export const NEWS_HELD_QUEUE_KEY = "literary-news:v1:held-queue";
export const NEWS_REFRESH_SECONDS = 1800;
export const NEWS_QUEUE_MAX_BYTES = 4 * 1024 * 1024;
export const NEWS_STATE_MAX_BYTES = 128 * 1024;
export const NEWS_QUEUE_MAX_ITEMS = 5000;

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0 && value <= NEWS_QUEUE_MAX_ITEMS;
const pastTimestamp = (value, now) => validTimestamp(value) && Date.parse(value) <= now.getTime();
const errorCode = (value) => typeof value === "string" && /^(?:http_[1-5]\d\d|redirect_not_allowed|unexpected_response_origin|response_too_large|unsupported_content_type|empty_response|no_article_links|unexpected_feed_format|request_timeout|request_aborted|fetch_failed)$/.test(value);

export function sourceMetadata(source) {
  return {
    id: source.id, name: source.name, url: source.url, format: source.format || "html",
    language: source.language, region: source.region || "global", topics: [...(source.topics || [])],
  };
}

export function pendingNewsSourceState(sources = LITERARY_NEWS_SOURCES) {
  return {
    schemaVersion: 1, lastCheckedAt: null, refreshIntervalSeconds: NEWS_REFRESH_SECONDS,
    pendingCount: 0,
    sources: sources.map((source) => ({
      ...sourceMetadata(source), status: "pending", lastSuccessAt: null, candidateCount: 0,
    })),
  };
}

/** KV contains operational status only; public metadata always comes from code. */
export function parseNewsSourceState(value, now = new Date(), sources = LITERARY_NEWS_SOURCES) {
  if (!object(value) || value.schemaVersion !== 1
    || !(value.lastCheckedAt === null || pastTimestamp(value.lastCheckedAt, now))
    || value.refreshIntervalSeconds !== NEWS_REFRESH_SECONDS || !count(value.pendingCount)
    || !Array.isArray(value.sources) || value.sources.length > 50) return null;
  const byId = new Map();
  for (const source of value.sources) {
    if (!object(source) || typeof source.id !== "string" || byId.has(source.id)
      || !["pending", "ok", "error"].includes(source.status)
      || !(source.lastSuccessAt === null || pastTimestamp(source.lastSuccessAt, now))
      || !count(source.candidateCount)
      || (source.status === "ok" && source.lastSuccessAt === null)
      || (source.lastSuccessAt !== null && (value.lastCheckedAt === null
        || Date.parse(source.lastSuccessAt) > Date.parse(value.lastCheckedAt)))
      || (source.status === "error" && !errorCode(source.error))) return null;
    byId.set(source.id, source);
  }
  return {
    schemaVersion: 1, lastCheckedAt: value.lastCheckedAt,
    refreshIntervalSeconds: NEWS_REFRESH_SECONDS, pendingCount: value.pendingCount,
    sources: sources.map((configured) => {
      const saved = byId.get(configured.id);
      return {
        ...sourceMetadata(configured),
        status: saved?.status || "pending", lastSuccessAt: saved?.lastSuccessAt || null,
        candidateCount: saved?.candidateCount || 0,
        ...(saved?.status === "error" ? { error: saved.error } : {}),
      };
    }),
  };
}
