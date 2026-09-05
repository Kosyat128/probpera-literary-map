import { load } from "cheerio";

const DEFAULT_TIME_ZONE = "UTC";
const CATEGORIES = new Set([
  "releases", "awards", "adaptations", "anniversaries", "festivals",
  "heritage", "discoveries", "obituaries", "publishing",
]);
const REGIONS = new Set([
  "global", "europe", "north-america", "latin-america", "asia", "africa", "oceania",
]);
const MAX_FETCH_CONCURRENCY = 4;
const TRACKING_QUERY = /^(utm_.+|fbclid|gclid|dclid|mc_cid|mc_eid)$/i;

function validLanguage(value) {
  if (typeof value !== "string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(value)) return false;
  try { return Boolean(new Intl.Locale(value)); } catch { return false; }
}

function canonicalUrl(value, base) {
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

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTimestamp(value) {
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
    typeof value[language] === "string" && value[language].trim().length > 0
  ));
}

function publishedInPast(value, current, today) {
  if (value === null) return true;
  if (validDate(value)) return value <= today;
  return validTimestamp(value) && Date.parse(value) <= current.getTime();
}

function selectReviewed(records, current, timeZone) {
  if (!Array.isArray(records)) throw new TypeError("reviewed_data_invalid");
  const today = todayAt(current, timeZone);
  const ids = new Set();
  const events = new Set();
  const selected = records.flatMap((record) => {
    if (!record || typeof record.id !== "string" || !record.id.trim()
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
      || !record.source || typeof record.source.name !== "string" || !record.source.name.trim()
      || !validLanguage(record.source.language)) return [];
    if (record.kind === "announcement" && (
      record.eventDate < today
      || (record.eventDate === today && todayAt(new Date(record.verifiedAt), timeZone) < today)
    )) return [];
    const source = canonicalUrl(record.source.url);
    if (!source) return [];
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

function failure(code) {
  return Object.assign(new Error(code), { newsError: code });
}

async function readBoundedDocument(response, limit, format) {
  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > limit) throw failure("response_too_large");
  const contentType = response.headers.get("content-type");
  const allowedType = format === "html"
    ? /^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/i
    : /^(application\/(?:rss\+xml|atom\+xml|xml)|text\/(?:xml|plain))(?:\s*;|$)/i;
  if (contentType && !allowedType.test(contentType)) {
    throw failure("unsupported_content_type");
  }
  if (!response.body) throw failure("empty_response");
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw failure("response_too_large");
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

function plainText(value, limit) {
  const $ = load(String(value || "").slice(0, 16_000));
  $("script,style,iframe,object,svg").remove();
  $("br").replaceWith(" ");
  const valueText = $.root().text().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const characters = [...valueText];
  return characters.length > limit ? `${characters.slice(0, limit - 1).join("")}…` : valueText;
}

function feedPublicationDate(value) {
  const input = String(value || "").trim();
  if (validDate(input)) return input;
  if (validTimestamp(input)) return new Date(input).toISOString();
  // RSS pubDate uses RFC 822 dates. Validate its calendar day before Date.parse
  // so an impossible date cannot silently roll over into another month.
  const rfc = /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+\d{2}:\d{2}(?::\d{2})?\s+(?:[+-]\d{4}|[A-Za-z]{1,5})$/i.exec(input);
  if (!rfc) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = String(months.indexOf(rfc[2].toLowerCase()) + 1).padStart(2, "0");
  if (!validDate(`${rfc[3]}-${month}-${rfc[1].padStart(2, "0")}`) || !Number.isFinite(Date.parse(input))) return null;
  return new Date(input).toISOString();
}

function discover(document, source, discoveredAt) {
  const candidates = new Map();
  function add({ href, title: originalTitle, publishedAt = null, description = null }) {
    const url = canonicalUrl(href, source.url);
    if (!href || !url || !source.articleOrigins.has(url.origin) || !source.pattern.test(url.pathname)) return;
    const title = plainText(originalTitle, 500);
    const minimumLength = source.format !== "html" || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(title) ? 3 : 15;
    if (title.length < minimumLength || /[<>]/.test(title) || candidates.has(url.href)) return;
    if (source.keywordPattern && !source.keywordPattern.test(title)) return;
    candidates.set(url.href, {
      sourceId: source.id,
      source: { name: source.name, url: url.href, language: source.language },
      region: source.region,
      topics: [...source.topics],
      title,
      publishedAt,
      description: description ? plainText(description, 400) || null : null,
      discoveredAt,
      verification: "held",
      reasons: ["missing_event_date", "bilingual_review_required", "topic_review_required"],
    });
  }
  if (source.format === "html") {
    const $ = load(document);
    $("a[href]").each((_, element) => {
      if (candidates.size >= 100) return false;
      const link = $(element);
      const heading = link.find("h1,h2,h3,h4").first().text();
      const enclosingHeading = link.closest("h1,h2,h3,h4").text();
      const containerTitle = source.articleContainer
        ? link.closest(source.articleContainer).find(source.titleSelector).first().text()
        : "";
      add({ href: link.attr("href"), title: heading || enclosingHeading || containerTitle || link.text() });
    });
  } else {
    // Cheerio's XML parser does not resolve external entities or fetch resources.
    const $ = load(document, { xmlMode: true });
    const named = (selection, name) => selection.children().filter((_, element) => (
      element.type === "tag" && element.name.split(":").at(-1) === name
    ));
    const root = $.root().children().first();
    const rootName = root[0]?.name?.split(":").at(-1);
    if ((source.format === "rss" && rootName !== "rss") || (source.format === "atom" && rootName !== "feed")) {
      throw failure("unexpected_feed_format");
    }
    const entries = source.format === "rss" ? named(named(root, "channel"), "item") : named(root, "entry");
    entries.each((_, element) => {
      if (candidates.size >= 100) return false;
      const entry = $(element);
      const field = (name) => named(entry, name).first().text();
      if (source.format === "rss") {
        const guid = named(entry, "guid").first();
        const href = field("link").trim() || (guid.attr("isPermaLink") !== "false" ? guid.text().trim() : "");
        add({
          href, title: field("title"), publishedAt: feedPublicationDate(field("pubDate") || field("date")),
          description: field("description") || field("encoded"),
        });
      } else {
        const link = named(entry, "link").filter((_, element) => {
          const node = $(element);
          return (!node.attr("rel") || node.attr("rel") === "alternate")
            && (!node.attr("type") || ["text/html", "application/xhtml+xml"].includes(node.attr("type")));
        }).first();
        add({
          href: link.attr("href"), title: field("title"),
          publishedAt: feedPublicationDate(field("published")),
          description: field("summary") || field("content"),
        });
      }
    });
  }
  return [...candidates.values()];
}

/** Local discovery only: remote headlines never become public news without review. */
export function createNewsService({
  sources,
  readReviewed,
  fetchImpl = fetch,
  now = () => new Date(),
  intervalMs = 600_000,
  timeoutMs = 10_000,
  maxResponseBytes = 2 * 1024 * 1024,
}) {
  if (!Array.isArray(sources) || typeof readReviewed !== "function") {
    throw new TypeError("News sources and readReviewed are required");
  }
  for (const value of [intervalMs, timeoutMs, maxResponseBytes]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError("News limits must be positive");
  }
  const seenSources = new Set();
  const configured = sources.map((source) => {
    const url = canonicalUrl(source.url);
    const format = source.format || "html";
    if (!url || !source.id || seenSources.has(source.id) || !source.name
      || !validLanguage(source.language) || !["html", "rss", "atom"].includes(format)
      || (source.linkPattern !== undefined && typeof source.linkPattern !== "string")
      || (format === "html" && !source.linkPattern)
      || (source.region !== undefined && !REGIONS.has(source.region))
      || (source.topics !== undefined && (!Array.isArray(source.topics) || source.topics.some((topic) => !CATEGORIES.has(topic))))
      || ((source.articleContainer !== undefined || source.titleSelector !== undefined) && (
        [source.articleContainer, source.titleSelector].some((value) => (
          typeof value !== "string" || !value.trim() || value.length > 200
        ))
      ))
      || (source.articleOrigins !== undefined && !Array.isArray(source.articleOrigins))) {
      throw new TypeError("Invalid news source configuration");
    }
    const articleOrigins = new Set([url.origin]);
    for (const value of source.articleOrigins || []) {
      const articleOrigin = canonicalUrl(value);
      if (!articleOrigin || articleOrigin.pathname !== "/" || articleOrigin.search) {
        throw new TypeError("Invalid news article origin");
      }
      articleOrigins.add(articleOrigin.origin);
    }
    seenSources.add(source.id);
    return {
      ...source, format, url: url.href, origin: url.origin, articleOrigins,
      language: new Intl.Locale(source.language).toString(), region: source.region || "global",
      topics: [...new Set(source.topics || [])], pattern: new RegExp(source.linkPattern || "^/"),
      keywordPattern: source.keywordPattern ? new RegExp(source.keywordPattern, "iu") : null,
    };
  });
  const metadata = (source) => ({
    id: source.id, name: source.name, url: source.url, format: source.format,
    language: source.language, region: source.region, topics: [...source.topics],
  });
  const states = new Map(configured.map((source) => [source.id, {
    ...metadata(source),
    status: "pending", lastSuccessAt: null, candidateCount: 0,
  }]));
  const queue = new Map();
  const controllers = new Set();
  let lastCheckedAt = null;
  let refreshing = null;
  let closed = false;

  async function check(source) {
    const controller = new AbortController();
    controllers.add(controller);
    let timer;
    let abortListener;
    try {
      const cancelled = new Promise((_, reject) => {
        abortListener = () => reject(failure(closed ? "service_closed" : "request_aborted"));
        controller.signal.addEventListener("abort", abortListener, { once: true });
      });
      const candidates = await Promise.race([
        (async () => {
          const response = await fetchImpl(source.url, {
            signal: controller.signal,
            redirect: "manual",
            headers: { Accept: source.format === "html" ? "text/html,application/xhtml+xml" : "application/rss+xml,application/atom+xml,application/xml,text/xml" },
          });
          if (response.status >= 300 && response.status < 400) throw failure("redirect_not_allowed");
          if (!response.ok) throw failure(`http_${response.status}`);
          if (response.url) {
            const actual = canonicalUrl(response.url);
            if (!actual || actual.origin !== source.origin) throw failure("unexpected_response_origin");
          }
          const document = await readBoundedDocument(response, maxResponseBytes, source.format);
          const found = discover(document, source, now().toISOString());
          if (!found.length) throw failure("no_article_links");
          return found;
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(failure("request_timeout"));
            controller.abort();
          }, timeoutMs);
        }),
        cancelled,
      ]);
      if (closed) return;
      queue.set(source.id, candidates);
      states.set(source.id, {
        ...metadata(source), status: "ok",
        lastSuccessAt: now().toISOString(), candidateCount: candidates.length,
      });
    } catch (error) {
      controller.abort();
      if (!closed) states.set(source.id, {
        ...states.get(source.id), status: "error", error: error?.newsError || "fetch_failed",
      });
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", abortListener);
      controllers.delete(controller);
    }
  }

  function refresh() {
    if (closed) return Promise.resolve();
    if (refreshing) return refreshing;
    let cursor = 0;
    async function worker() {
      while (!closed && cursor < configured.length) {
        const source = configured[cursor++];
        await check(source);
      }
    }
    refreshing = Promise.all(Array.from({ length: Math.min(MAX_FETCH_CONCURRENCY, configured.length) }, worker)).then(() => {
      if (!closed) lastCheckedAt = now().toISOString();
    }).finally(() => { refreshing = null; });
    return refreshing;
  }

  function getReviewQueue() {
    const unique = new Map();
    for (const candidate of [...queue.values()].flat()) {
      if (!unique.has(candidate.source.url)) unique.set(candidate.source.url, candidate);
    }
    return structuredClone([...unique.values()]);
  }

  async function getFeed(requestedTimeZone = DEFAULT_TIME_ZONE) {
    const timeZone = resolveNewsTimeZone(requestedTimeZone);
    const current = now();
    const reviewed = await readReviewed();
    return {
      mode: "local-prototype",
      generatedAt: current.toISOString(),
      lastCheckedAt,
      refreshIntervalSeconds: intervalMs / 1000,
      timeZone,
      sources: structuredClone([...states.values()]),
      pendingCount: getReviewQueue().length,
      items: selectReviewed(reviewed, current, timeZone),
    };
  }

  const interval = setInterval(() => { void refresh(); }, intervalMs);
  interval.unref?.();
  void refresh();

  return {
    getFeed,
    refresh,
    getReviewQueue,
    close() {
      closed = true;
      clearInterval(interval);
      for (const controller of controllers) controller.abort();
    },
  };
}
