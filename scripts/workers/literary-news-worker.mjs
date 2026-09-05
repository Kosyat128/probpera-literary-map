import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import { resolveNewsTimeZone, selectReviewed } from "../lib/literary-news-reviewed.mjs";
import { NEWS_SOURCE_STATE_KEY, NEWS_STATE_MAX_BYTES, parseNewsSourceState, pendingNewsSourceState } from "../lib/literary-news-state.mjs";

const FEED_PATH = "/api/literary-news/feed";
const headersFor = (release) => ({
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Probpera-News-Release": /^[a-f0-9]{40}$/.test(release || "") ? release : "local",
});

function publicItem(item) {
  return {
    id: item.id, category: item.category, kind: item.kind, eventDate: item.eventDate,
    publishedAt: item.publishedAt, verifiedAt: item.verifiedAt, verification: "confirmed",
    title: { ru: item.title.ru, en: item.title.en },
    summary: { ru: item.summary.ru, en: item.summary.en },
    source: { name: item.source.name, url: item.source.url, language: item.source.language },
    ...(item.region ? { region: item.region } : {}),
    ...(item.eventKey ? { eventKey: item.eventKey } : {}),
  };
}

async function readSourceState(namespace) {
  const stream = await namespace.get(NEWS_SOURCE_STATE_KEY, "stream");
  if (stream === null) return null;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > NEWS_STATE_MAX_BYTES) throw new Error("source_state_too_large");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/** No discovery, queue reads, secrets or remote URLs are accepted by this API. */
export async function handleNewsRequest(request, env, current = new Date()) {
  const headers = headersFor(env.NEWS_RELEASE_SHA);
  const url = new URL(request.url);
  if (url.pathname !== FEED_PATH) return Response.json({ error: "not_found" }, { status: 404, headers });
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, {
    status: 405, headers: { ...headers, Allow: "GET" },
  });
  let state = pendingNewsSourceState();
  try {
    // Read one fixed key. Private catalogs and held candidates are never read.
    state = parseNewsSourceState(await readSourceState(env.NEWS_STATE), current) || state;
  } catch {
    // Reviewed stories remain available; null checked-at never invents freshness.
    console.warn(JSON.stringify({ event: "literary_news_state_unavailable" }));
  }
  const timeZone = resolveNewsTimeZone(url.searchParams.get("timeZone"));
  return Response.json({
    mode: "reviewed", generatedAt: current.toISOString(), timeZone,
    lastCheckedAt: state.lastCheckedAt, refreshIntervalSeconds: state.refreshIntervalSeconds,
    pendingCount: state.pendingCount, sources: state.sources,
    items: selectReviewed(reviewed, current, timeZone).slice(0, 500).map(publicItem),
  }, { headers });
}

/** @type {ExportedHandler<Env>} */
export default { fetch(request, env) { return handleNewsRequest(request, env); } };
