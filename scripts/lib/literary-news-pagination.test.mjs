import { describe, it, expect, vi } from "vitest";
import { createNewsService, newsDiscoveryParserVersion } from "./literary-news-feed.mjs";
import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";
import { buildNewsIngestion } from "./literary-news-ingestion.mjs";
import { makeNewsGeneration, parseNewsGeneration, syncNewsStorage } from "./literary-news-kv-sync.mjs";

const source = { id: "pages", name: "Book archive", url: "https://publisher.example/news/", language: "en",
  format: "html", linkPattern: /^\/news\/book-[0-9]+\/$/, refreshIntervalSeconds: 60,
  pagination: { allowedPathPattern: /^\/news\/page\/[1-9][0-9]{0,3}\/$/, nextSelector: "link[rel~=next][href]" } };
const root = source.url, page2 = `${root}page/2/`, page3 = `${root}page/3/`;
const start = new Date("2026-09-26T12:00:00Z");
const html = (id, next) => `<a href="/news/book-${id}/">Publisher announces literary book number ${id}</a>${next === undefined ? "" : `<link rel="next" href="${next}">`}`;
const response = (body, etag = '"page"') => new Response(body, { headers: { "content-type": "text/html", etag } });
const row = (id) => ({ sourceId: source.id, source: { name: source.name, language: "en", url: `${root}book-${id}/` },
  title: `Publisher announces literary book number ${id}`, verification: "held", publishedAt: null,
  description: null, discoveredAt: start.toISOString() });
async function collect(options) {
  const service = createNewsService({ sources: [source], readReviewed: () => [], now: () => start, ...options });
  try { await service.refresh(); return { scheduler: service.getScheduler(), candidates: service.getReviewQueue(), feed: await service.getFeed() }; }
  finally { service.close(); }
}
const resume = (result) => ({ previousScheduler: result.scheduler, previousCandidates: result.candidates });

describe("bounded persistent source pagination", () => {
  it("resumes the observed next page after restart, merges history and rotates end to root", async () => {
    const fetchImpl = vi.fn(async (url) => response(url === root ? html(1, page2) : url === page2 ? html(2, page3) : html(3)));
    let state;
    for (let round = 0; round < 4; round += 1) {
      state = await collect({ fetchImpl, ...state && resume(state), now: () => new Date(start.getTime() + round * 60_000) });
    }
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([root, page2, page3, root]);
    expect(state.candidates).toHaveLength(3);
    expect(state.scheduler.sources.pages.nextPageUrl).toBe(page2);
    expect(state.scheduler.lastRun).toMatchObject({ httpRequests: 1, pageChecks: 1 });
    expect(state.candidates.every((candidate) => candidate.verification === "held")).toBe(true);
  });

  it("parser/pagination changes invalidate cursor, validators and cooldown without deleting findings", async () => {
    const first = await collect({ fetchImpl: async () => response(html(1, page2)) });
    const changed = { ...source, pagination: { ...source.pagination, nextSelector: "a[rel~=next][href]" } };
    expect(newsDiscoveryParserVersion(changed)).not.toBe(newsDiscoveryParserVersion(source));
    const fetchImpl = vi.fn(async () => response(html(2)));
    const next = await collect({ sources: [changed], fetchImpl, ...resume(first) });
    expect(fetchImpl.mock.calls[0][0]).toBe(root);
    expect(fetchImpl.mock.calls[0][1].headers["If-None-Match"]).toBeUndefined();
    expect(next.candidates).toHaveLength(2);
  });

  it("the actual durable generation commits finds and cursor together; a failed write replays the same page", async () => {
    const first = await collect({ fetchImpl: async () => response(html(1, page2)) });
    const pack = (state, previous, current) => buildNewsIngestion({ feed: state.feed, candidates: state.candidates,
      scheduler: state.scheduler, sources: [source], current,
      previousState: previous ? JSON.parse(previous.previousState) : null,
      previousQueue: previous ? JSON.parse(previous.previousQueue) : null });
    let durable = parseNewsGeneration(JSON.stringify(makeNewsGeneration(pack(first, null, start).bulk)));
    const secondFetch = vi.fn(async () => response(html(2, page3)));
    const current = new Date(start.getTime() + 60_000);
    const collectNext = async ({ previousQueue }) => {
      const queue = JSON.parse(previousQueue);
      const next = await collect({ fetchImpl: secondFetch, previousCandidates: queue.items, previousScheduler: queue.scheduler, now: () => current });
      return pack(next, durable, current).bulk;
    };
    const storage = { readGeneration: async () => durable, write: vi.fn(),
      commitGeneration: vi.fn().mockRejectedValueOnce(new Error("quota"))
        .mockImplementationOnce(async (entries) => { durable = parseNewsGeneration(JSON.stringify(makeNewsGeneration(entries))); }) };
    await expect(syncNewsStorage({ storage, collect: collectNext })).rejects.toThrow("quota");
    expect(JSON.parse(durable.previousQueue).scheduler.sources.pages.nextPageUrl).toBe(page2);
    expect(storage.write).not.toHaveBeenCalled();
    await syncNewsStorage({ storage, collect: collectNext });
    expect(secondFetch.mock.calls.map(([url]) => url)).toEqual([page2, page2]);
    const saved = JSON.parse(durable.previousQueue);
    expect(saved.items).toHaveLength(2);
    expect(saved.scheduler.sources.pages.nextPageUrl).toBe(page3);
  });

  it.each([
    "https://attacker.example/news/page/2/", "http://publisher.example/news/page/2/",
    "https://user:password@publisher.example/news/page/2/", "/news/private/", "/news/page/2/?token=secret",
    "/news/page/2/#anchor", "/news/page/%32/", "//127.0.0.1/news/page/2/", root,
  ])("rejects unsafe next URL %s, retaining current finds and cursor", async (next) => {
    const fetchImpl = vi.fn(async () => response(html(1, next)));
    const result = await collect({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.scheduler.sources.pages).toMatchObject({ nextPageUrl: root, paginationError: "next_url_not_allowed" });
  });

  it("a hostile persisted cursor cannot override the code-owned destination", async () => {
    const fetchImpl = vi.fn(async () => response(html(1, page2)));
    await collect({ fetchImpl, previousScheduler: { sources: { pages: { endpoint: root,
      parserVersion: newsDiscoveryParserVersion(source), nextPageUrl: "https://attacker.example/" } } } });
    expect(fetchImpl.mock.calls[0][0]).toBe(root);
  });

  it("validators belong to the requested page; unsolicited 304 needs a bounded body retry", async () => {
    const first = await collect({ fetchImpl: async () => response(html(1, page2), '"root"') });
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 304 })).mockResolvedValueOnce(response(html(2)));
    const next = await collect({ fetchImpl, ...resume(first), now: () => new Date(start.getTime() + 60_000) });
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([page2, page2]);
    expect(fetchImpl.mock.calls.every(([, options]) => !options.headers["If-None-Match"])).toBe(true);
    expect(next.candidates).toHaveLength(2);
    expect(next.scheduler.lastRun.httpRequests).toBe(2);
    expect(next.scheduler.sources.pages.nextPageUrl).toBe(root);
  });

  it("actual HTTP cap includes 304 retries, retaining cursor when the body cannot be fetched", async () => {
    const first = await collect({ fetchImpl: async () => response(html(1, page2)) });
    const fetchImpl = vi.fn(async () => new Response(null, { status: 304 }));
    const next = await collect({ fetchImpl, ...resume(first), maxHttpRequests: 1, now: () => new Date(start.getTime() + 60_000) });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(next.scheduler.lastRun.httpRequests).toBe(1);
    expect(next.scheduler.sources.pages.nextPageUrl).toBe(page2);
    expect(next.candidates).toEqual(first.candidates);
    expect(next.feed.sources[0].status).toBe("error");
  });

  it("one shared budget bounds concurrent sources, with independent page-check cap", async () => {
    const sources = Array.from({ length: 8 }, (_, id) => ({ ...source, id: `source-${id}` }));
    const fetchImpl = vi.fn(async () => new Response(null, { status: 304 }));
    const result = await collect({ sources, fetchImpl, maxRequests: 8, maxPageChecks: 3, maxHttpRequests: 4 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result.scheduler.lastRun).toMatchObject({ httpRequests: 4, pageChecks: 3 });
    expect(result.feed.sources.filter((state) => state.status === "pending")).toHaveLength(5);
  });

  it("redirects cannot move a resumed request to another page or host", async () => {
    const first = await collect({ fetchImpl: async () => response(html(1, page2)) });
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://attacker.example/" } }));
    const next = await collect({ fetchImpl, ...resume(first), now: () => new Date(start.getTime() + 60_000) });
    expect(fetchImpl.mock.calls[0][1].redirect).toBe("manual");
    expect(next.feed.sources[0].error).toBe("redirect_not_allowed");
    expect(next.scheduler.sources.pages.nextPageUrl).toBe(page2);
    expect(next.candidates).toEqual(first.candidates);
  });

  it("the 25000 guard retains all good evidence and does not advance the page on overflow", async () => {
    const previousCandidates = Array.from({ length: 25_000 }, (_, id) => row(id));
    const next = await collect({ previousCandidates, fetchImpl: async () => response(html(25_001, page2)) });
    expect(next.candidates).toEqual(previousCandidates);
    expect(next.feed.sources[0].error).toBe("response_too_large");
    expect(next.scheduler.sources.pages.nextPageUrl).toBeUndefined();
  });

  it("only an explicit anchored HTML profile can opt into pagination", async () => {
    const plain = { ...source, pagination: undefined };
    const result = await collect({ sources: [plain], fetchImpl: async () => response(html(1, page2)) });
    expect(result.scheduler.sources.pages.nextPageUrl).toBe(root);
    expect(() => createNewsService({ sources: [{ ...source, pagination: { ...source.pagination, allowedPathPattern: /page/ } }], readReviewed: () => [], fetchImpl: vi.fn() })).toThrow("Invalid news source");
    const nobel = LITERARY_NEWS_SOURCES.find((item) => item.id === "nobel");
    expect(nobel.pagination.allowedPathPattern.test("/press-release/page/2/")).toBe(true);
    expect(nobel.pagination.allowedPathPattern.test("/press-release/private/")).toBe(false);
    expect(nobel.pagination.nextSelector).toBe("link[rel~=next][href]");
  });
});
