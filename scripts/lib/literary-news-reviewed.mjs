// Pure publication rules shared by the local collector and the public Worker.
export const DEFAULT_TIME_ZONE = "UTC";
export const CATEGORIES = new Set([
  "releases", "awards", "adaptations", "anniversaries", "festivals",
  "heritage", "discoveries", "obituaries", "publishing",
]);
export const REGIONS = new Set([
  "global", "europe", "north-america", "latin-america", "asia", "africa", "oceania",
]);
const TRACKING_QUERY = /^(utm_.+|fbclid|gclid|dclid|mc_cid|mc_eid)$/i;

export function validLanguage(value) {
  if (typeof value !== "string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(value)) return false;
  try { return Boolean(new Intl.Locale(value)); } catch { return false; }
}

export function canonicalUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url;
  } catch {
    return null;
  }
}

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && validDate(value.slice(0, 10))
    && Number.isFinite(Date.parse(value));
}

export function resolveNewsTimeZone(value) {
  if (typeof value !== "string" || value.length > 100 || !/^[A-Za-z][A-Za-z0-9_+./-]*$/.test(value)) {
    return DEFAULT_TIME_ZONE;
  }
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function todayAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function bilingual(value) {
  return value && ["ru", "en"].every((language) => (
    typeof value[language] === "string" && value[language].trim().length > 0 && value[language].length <= 1000
  ));
}

function publishedInPast(value, current, today) {
  if (value === null) return true;
  if (validDate(value)) return value <= today;
  return validTimestamp(value) && Date.parse(value) <= current.getTime();
}

export function selectReviewed(records, current, timeZone) {
  if (!Array.isArray(records)) throw new TypeError("reviewed_data_invalid");
  const today = todayAt(current, timeZone);
  const ids = new Set();
  const events = new Set();
  const selected = records.flatMap((record) => {
    if (!record || typeof record.id !== "string" || !record.id.trim() || record.id.length > 120
      || record.verification !== "confirmed"
      || !["news", "announcement", "calendar"].includes(record.kind)
      || !CATEGORIES.has(record.category)
      || !bilingual(record.title) || !bilingual(record.summary)
      || !validDate(record.eventDate)
      || (record.kind === "news" && record.eventDate > today)
      || !validTimestamp(record.verifiedAt) || Date.parse(record.verifiedAt) > current.getTime()
      || !publishedInPast(record.publishedAt, current, today)
      || (record.region !== undefined && !REGIONS.has(record.region))
      || (record.eventKey !== undefined && (
        typeof record.eventKey !== "string" || !record.eventKey.trim() || record.eventKey.length > 240
      ))
      || !record.source || typeof record.source.name !== "string" || !record.source.name.trim() || record.source.name.length > 160
      || !validLanguage(record.source.language)) return [];
    if (record.kind === "announcement" && (
      record.eventDate < today
      || (record.eventDate === today && todayAt(new Date(record.verifiedAt), timeZone) < today)
    )) return [];
    const source = canonicalUrl(record.source.url);
    if (!source || source.href.length > 2048) return [];
    const eventKeys = [`url:${source.href}|${record.eventDate}|${record.kind}`];
    if (record.eventKey !== undefined) eventKeys.push(`event:${record.eventKey.trim()}`);
    if (ids.has(record.id) || eventKeys.some((key) => events.has(key))) return [];
    ids.add(record.id);
    for (const key of eventKeys) events.add(key);
    return [{ ...record, source: { ...record.source, url: source.href } }];
  });
  const recentFrom = new Date(Date.parse(`${today}T00:00:00Z`) - 14 * 86_400_000)
    .toISOString().slice(0, 10);
  const rank = (record) => {
    if (record.eventDate === today) return 0;
    if (record.kind === "news" && record.eventDate >= recentFrom) return 1;
    if (record.eventDate > today) return 2;
    return 3;
  };
  const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return selected.sort((left, right) => {
    const group = rank(left);
    const groupDifference = group - rank(right);
    if (groupDifference) return groupDifference;
    const chronological = compareText(left.eventDate, right.eventDate);
    if (chronological) return group === 2 ? chronological : -chronological;
    return compareText(left.id, right.id);
  });
}
