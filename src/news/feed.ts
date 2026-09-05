import { NEWS_CATEGORIES, NEWS_REGIONS, type NewsFeed } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 1000): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const bilingual = (value: unknown) =>
  record(value) && text(value.ru) && text(value.en);
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function isNewsDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

function timestamp(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && isNewsDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function safeUrl(value: unknown) {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function sourceLanguage(value: unknown) {
  if (typeof value !== "string" || value.length > 35 || !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(value)) return false;
  try { return Boolean(new Intl.Locale(value).language); } catch { return false; }
}

export function isNewsTimeZone(value: unknown): value is string {
  if (!text(value, 100) || !/^[A-Za-z][A-Za-z0-9_+./-]*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch { return false; }
}

/** Reject malformed or untranslated responses instead of rendering source HTML. */
export function parseNewsFeed(value: unknown): NewsFeed {
  if (!record(value) || value.mode !== "local-prototype"
    || !timestamp(value.generatedAt)
    || !(value.lastCheckedAt === null || timestamp(value.lastCheckedAt))
    || !count(value.refreshIntervalSeconds) || Number(value.refreshIntervalSeconds) < 60
    || !isNewsTimeZone(value.timeZone) || !count(value.pendingCount)
    || !Array.isArray(value.sources) || value.sources.length > 50
    || !Array.isArray(value.items) || value.items.length > 500) {
    throw new Error("Invalid literary news feed");
  }
  const ids = new Set<string>();
  for (const source of value.sources) {
    if (!record(source) || !text(source.id, 120) || !text(source.name, 160)
      || !safeUrl(source.url) || !["pending", "ok", "error"].includes(String(source.status))
      || !(source.lastSuccessAt === null || timestamp(source.lastSuccessAt))
      || !count(source.candidateCount)
      || !(source.language === undefined || sourceLanguage(source.language))
      || !(source.region === undefined || NEWS_REGIONS.includes(source.region as never))
      || !(source.topics === undefined || Array.isArray(source.topics) && source.topics.every((topic) => NEWS_CATEGORIES.includes(topic as never)))) throw new Error("Invalid literary news source");
  }
  for (const item of value.items) {
    if (!record(item) || !text(item.id, 120) || ids.has(item.id)
      || !NEWS_CATEGORIES.includes(item.category as never)
      || !(item.region === undefined || NEWS_REGIONS.includes(item.region as never))
      || !(item.eventKey === undefined || text(item.eventKey, 240))
      || !["news", "announcement", "calendar"].includes(String(item.kind))
      || !isNewsDate(item.eventDate) || !timestamp(item.verifiedAt)
      || !(item.publishedAt === null || isNewsDate(item.publishedAt) || timestamp(item.publishedAt))
      || !bilingual(item.title) || !bilingual(item.summary)
      || !record(item.source) || !text(item.source.name, 160) || !safeUrl(item.source.url)
      || !sourceLanguage(item.source.language)
      || item.verification !== "confirmed") throw new Error("Invalid literary news item");
    ids.add(item.id);
  }
  return value as NewsFeed;
}
