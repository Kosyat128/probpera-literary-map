import { load } from "cheerio";
import { createHash } from "node:crypto";
import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";
import { fetchPinnedNewsSource } from "./literary-news-safe-fetch.mjs";
import { NEWS_QUEUE_MAX_ITEMS } from "./literary-news-state.mjs";

import { DEFAULT_TIME_ZONE, CATEGORIES, REGIONS, validLanguage, canonicalUrl, validDate, validTimestamp, resolveNewsTimeZone, selectReviewed } from "./literary-news-reviewed.mjs";
export { resolveNewsTimeZone } from "./literary-news-reviewed.mjs";

const MAX_FETCH_CONCURRENCY = 4;

export function newsDiscoveryParserVersion(source) {
  const regexp = (pattern) => pattern ? [pattern.source, pattern.flags] : null;
  const profile = {
    format: source.format || "html", linkPattern: regexp(source.linkPattern),
    keywordPattern: regexp(source.keywordPattern), linkSelector: source.linkSelector || "a[href]",
    articleContainer: source.articleContainer || null, titleSelector: source.titleSelector || null,
    articleOrigins: [...(source.articleOrigins || [])].sort(),
    ...(source.pagination ? { pagination: {
      allowedPathPattern: regexp(source.pagination.allowedPathPattern),
      nextSelector: source.pagination.nextSelector,
    } } : {}),
  };
  return `r10-discovery-3:${createHash("sha256").update(JSON.stringify(profile)).digest("hex")}`;
}

function failure(code) {
  return Object.assign(new Error(code), { newsError: code });
}

// Pagination is opt-in code configuration. Remote HTML cannot grant another
// origin, query endpoint, credential, or path outside this exact path grammar.
function pageUrl(value, source, base = source.url) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.origin !== source.origin || url.username || url.password || url.search || url.hash) return null;
    if (url.href === source.url) return url.href;
    return source.pagination?.allowedPathPattern.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

function nextPage(document, source, currentPage) {
  if (!source.pagination) return { nextPageUrl: source.url };
  const $ = load(document);
  const links = $(source.pagination.nextSelector).toArray().map((element) => $(element).attr("href"));
  if (!links.length) return { nextPageUrl: source.url };
  const urls = links.map((href) => pageUrl(href, source, currentPage));
  if (urls.some((url) => !url || url === currentPage) || new Set(urls).size !== 1) {
    // Keep this page's usable finds, but do not mistake an unsafe/ambiguous next
    // link for the end of the archive or advance the durable cursor.
    return { nextPageUrl: currentPage, paginationError: "next_url_not_allowed" };
  }
  return { nextPageUrl: urls[0] };
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
    $(source.linkSelector || "a[href]").each((_, element) => {
      if (candidates.size >= 1000) throw failure("response_too_large");
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
      if (candidates.size >= 1000) throw failure("response_too_large");
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
  sources = LITERARY_NEWS_SOURCES,
  readReviewed,
  fetchImpl = fetchPinnedNewsSource,
  now = () => new Date(),
  intervalMs = 600_000,
  timeoutMs = 10_000,
  maxResponseBytes = 2 * 1024 * 1024,
  previousScheduler = null,
  previousCandidates = [],
  maxRequests = sources.length,
  maxPageChecks = maxRequests,
  maxHttpRequests = maxRequests * 2,
}) {
  if (!Array.isArray(sources) || typeof readReviewed !== "function") {
    throw new TypeError("News sources and readReviewed are required");
  }
  for (const value of [intervalMs, timeoutMs, maxResponseBytes]) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError("News limits must be positive");
  }
  if (!Number.isSafeInteger(maxRequests) || maxRequests < 0 || maxRequests > 250) throw new TypeError("Invalid source-check budget");
  if (!Number.isSafeInteger(maxPageChecks) || maxPageChecks < 0 || maxPageChecks > 250
    || !Number.isSafeInteger(maxHttpRequests) || maxHttpRequests < 0 || maxHttpRequests > 500) throw new TypeError("Invalid page/HTTP budget");
  const seenSources = new Set();
  const configured = sources.map((source) => {
    const url = canonicalUrl(source.url);
    const format = source.format || "html";
    if (!url || !source.id || seenSources.has(source.id) || !source.name
      || !validLanguage(source.language) || !["html", "rss", "atom"].includes(format)
      || (source.linkPattern !== undefined && (!(source.linkPattern instanceof RegExp) || source.linkPattern.global || source.linkPattern.sticky))
      || (source.keywordPattern !== undefined && (!(source.keywordPattern instanceof RegExp) || source.keywordPattern.global || source.keywordPattern.sticky))
      || (format === "html" && !source.linkPattern)
      || (source.pagination !== undefined && (format !== "html" || !source.pagination
        || !(source.pagination.allowedPathPattern instanceof RegExp)
        || source.pagination.allowedPathPattern.global || source.pagination.allowedPathPattern.sticky
        || !source.pagination.allowedPathPattern.source.startsWith("^") || !source.pagination.allowedPathPattern.source.endsWith("$")
        || typeof source.pagination.nextSelector !== "string" || !source.pagination.nextSelector.trim()
        || source.pagination.nextSelector.length > 200 || url.search))
      || (source.linkSelector !== undefined && (typeof source.linkSelector !== "string"
        || !source.linkSelector.trim() || source.linkSelector.length > 500))
      || (source.refreshIntervalSeconds !== undefined && (!Number.isSafeInteger(source.refreshIntervalSeconds)
        || source.refreshIntervalSeconds <= 0 || source.refreshIntervalSeconds > 86400))
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
      topics: [...new Set(source.topics || [])], pattern: source.linkPattern || /^\//,
      keywordPattern: source.keywordPattern || null,
      parserVersion: newsDiscoveryParserVersion(source),
    };
  });
  if ((fetchImpl === fetchPinnedNewsSource || fetchImpl === fetch) && sources.some((source) => !LITERARY_NEWS_SOURCES.includes(source))) {
    throw new TypeError("News source is not in the approved code-owned registry");
  }
  const metadata = (source) => ({
    id: source.id, name: source.name, url: source.url, format: source.format,
    language: source.language, region: source.region, topics: [...source.topics],
    ...(source.sourceFamilyId ? { sourceFamilyId: source.sourceFamilyId } : {}),
    ...(source.countryCodes ? { countryCodes: [...source.countryCodes] } : {}),
    ...(source.coverageCountryCodes ? { coverageCountryCodes: [...source.coverageCountryCodes] } : {}),
  });
  const states = new Map(configured.map((source) => [source.id, {
    ...metadata(source),
    status: "pending", lastSuccessAt: null, candidateCount: 0,
  }]));
  const queue = new Map();
  const scheduler = new Map();
  let nextSourceIndex = Number.isSafeInteger(previousScheduler?.nextSourceIndex) && previousScheduler.nextSourceIndex >= 0
    ? previousScheduler.nextSourceIndex % Math.max(1, configured.length) : 0;
  for (const source of configured) {
    const prior = previousScheduler?.sources?.[source.id];
    if (prior?.endpoint === source.url && prior?.parserVersion === source.parserVersion) scheduler.set(source.id, {
      ...prior,nextDueAt:validTimestamp(prior.nextDueAt) ? prior.nextDueAt : null,
      failures:Number.isSafeInteger(prior.failures) && prior.failures >= 0 ? Math.min(prior.failures,8) : 0,
      etag:typeof prior.etag === "string" && prior.etag.length <= 500 && !/[\r\n]/.test(prior.etag) ? prior.etag : null,
      lastModified:typeof prior.lastModified === "string" && prior.lastModified.length <= 100 && !/[\r\n]/.test(prior.lastModified) ? prior.lastModified : null,
      nextPageUrl: source.pagination ? pageUrl(prior.nextPageUrl, source) || source.url : source.url,
      validatorUrl: source.pagination ? pageUrl(prior.validatorUrl, source) : source.url,
      pageCandidateUrls: Array.isArray(prior.pageCandidateUrls) && prior.pageCandidateUrls.length <= 1000
        && prior.pageCandidateUrls.every((url) => typeof url === "string" && url.length <= 2048) ? prior.pageCandidateUrls : [],
    });
    queue.set(source.id, previousCandidates.filter((item) => item.sourceId === source.id));
  }
  const controllers = new Set();
  let lastCheckedAt = null;
  let refreshing = null;
  let closed = false;
  let lastRun = { httpRequests: 0, pageChecks: 0, maxHttpRequests, maxPageChecks };

  async function check(source, budget) {
    if (source.discoveryEnabled === false) {
      const previous = states.get(source.id);
      states.set(source.id, { ...previous, ...metadata(source), status: "error", error: "source_disabled" });
      return;
    }
    const controller = new AbortController();
    const schedule = scheduler.get(source.id);
    const currentPage = source.pagination ? schedule?.nextPageUrl || source.url : source.url;
    budget.pageChecks += 1;
    const request = (headers) => {
      if (budget.httpRequests >= maxHttpRequests) throw failure("fetch_failed");
      budget.httpRequests += 1;
      return fetchImpl(currentPage, { signal: controller.signal, redirect: "manual", maxResponseBytes, timeoutMs, headers });
    };
    controllers.add(controller);
    let timer;
    let abortListener;
    let retrySeconds = 0;
    try {
      const cancelled = new Promise((_, reject) => {
        abortListener = () => reject(failure(closed ? "service_closed" : "request_aborted"));
        controller.signal.addEventListener("abort", abortListener, { once: true });
      });
      const result = await Promise.race([
        (async () => {
          const savedCandidates = queue.get(source.id) || [];
          const canReuse = savedCandidates.length && schedule && (!source.pagination || (
            schedule.validatorUrl === currentPage && schedule.pageCandidateUrls?.length
            && schedule.pageCandidateUrls.every((url) => savedCandidates.some((candidate) => candidate.source.url === url))
          ));
          const validators = canReuse ? {
            ...(schedule.etag ? {"If-None-Match":schedule.etag} : {}),
            ...(schedule.lastModified ? {"If-Modified-Since":schedule.lastModified} : {}),
          } : {};
          let response = await request({ Accept: source.format === "html" ? "text/html,application/xhtml+xml" : "application/rss+xml,application/atom+xml,application/xml,text/xml", ...validators });
          if (response.status === 304 && canReuse) return { candidates: savedCandidates, schedule };
          if (response.status === 304) response = await request({ Accept: "*/*" });
          if (response.status >= 300 && response.status < 400) throw failure("redirect_not_allowed");
          if (response.status === 429 || response.status === 503) {
            const retry = response.headers.get("retry-after");
            const seconds = /^\d+$/.test(retry || "") ? Number(retry) : (Date.parse(retry) - now().getTime()) / 1000;
            if (Number.isFinite(seconds) && seconds > 0) retrySeconds = Math.min(seconds,86400);
          }
          if (!response.ok) throw failure(`http_${response.status}`);
          if (response.url) {
            const actual = canonicalUrl(response.url);
            if (!actual || actual.origin !== source.origin || (source.pagination && actual.href !== currentPage)) throw failure("unexpected_response_origin");
          }
          const document = await readBoundedDocument(response, maxResponseBytes, source.format);
          const found = discover(document, { ...source, url: currentPage }, now().toISOString());
          if (!found.length) throw failure("no_article_links");
          return { candidates: found, schedule: { ...schedule, paginationError: null,
            ...nextPage(document, source, currentPage), validatorUrl: currentPage,
            pageCandidateUrls: source.pagination ? found.map((candidate) => candidate.source.url) : [],
            etag: response.headers.get("etag")?.slice(0,500) || null,
            lastModified: response.headers.get("last-modified")?.slice(0,100) || null } };
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
      const merged = new Map((queue.get(source.id) || []).map((candidate) => [candidate.source.url, candidate]));
      for (const candidate of result.candidates) {
        const old = merged.get(candidate.source.url);
        merged.set(candidate.source.url, { ...candidate, discoveredAt: old?.discoveredAt || candidate.discoveredAt,
          ...(old?.decision ? { decision: old.decision } : {}) });
      }
      const candidates = [...merged.values()];
      const allUrls = new Set([...queue.entries()].filter(([id]) => id !== source.id).flatMap(([, rows]) => rows.map((row) => row.source.url)));
      for (const candidate of candidates) allUrls.add(candidate.source.url);
      // No eviction: the previous candidates and cursor survive capacity failure.
      // The durable ingestion serializer separately checks the shared byte limit.
      if (allUrls.size > NEWS_QUEUE_MAX_ITEMS) throw failure("response_too_large");
      queue.set(source.id, candidates);
      scheduler.set(source.id, {...result.schedule,endpoint:source.url,parserVersion:source.parserVersion,failures:0,retrySeconds:0,
        nextDueAt:new Date(now().getTime() + (source.refreshIntervalSeconds || 21600) * 1000).toISOString()});
      states.set(source.id, {
        ...metadata(source), status: "ok",
        lastSuccessAt: now().toISOString(), candidateCount: candidates.length,
      });
    } catch (error) {
      controller.abort();
      const failures = Math.min((schedule?.failures || 0) + 1, 8);
      const waitSeconds = Math.max(retrySeconds, Math.min(86400,1800 * 2 ** (failures - 1)));
      // Stable per-source jitter prevents synchronized retries without nondeterministic tests.
      const jitter = [...source.id].reduce((n,c) => n + c.charCodeAt(0),0) % 181;
      scheduler.set(source.id, {...scheduler.get(source.id),endpoint:source.url,parserVersion:source.parserVersion,failures,retrySeconds,
        nextDueAt:new Date(now().getTime() + (waitSeconds + jitter) * 1000).toISOString()});
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
    const due = [];
    for (let checked = 0; checked < configured.length && due.length < Math.min(maxRequests, maxPageChecks, maxHttpRequests); checked++) {
      const source = configured[nextSourceIndex]; nextSourceIndex = (nextSourceIndex + 1) % configured.length;
      const saved = scheduler.get(source.id);
      if (!saved?.nextDueAt || Date.parse(saved.nextDueAt) <= now().getTime()) due.push(source);
    }
    let cursor = 0;
    const budget = { httpRequests: 0, pageChecks: 0, maxHttpRequests, maxPageChecks };
    let exhausted = false;
    async function worker() {
      while (!closed && !exhausted && cursor < due.length) {
        const source = due[cursor++];
        if (budget.httpRequests >= maxHttpRequests) {
          nextSourceIndex = configured.indexOf(source);
          exhausted = true;
          break;
        }
        await check(source, budget);
      }
    }
    refreshing = Promise.all(Array.from({ length: Math.min(MAX_FETCH_CONCURRENCY, configured.length) }, worker)).then(() => {
      if (!closed) lastCheckedAt = now().toISOString();
      lastRun = budget;
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
    getScheduler() { return structuredClone({nextSourceIndex,lastRun,sources:Object.fromEntries(scheduler)}); },
    close() {
      closed = true;
      clearInterval(interval);
      for (const controller of controllers) controller.abort();
    },
  };
}
