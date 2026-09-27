import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import { createPinnedNewsFetch, isPublicNewsAddress } from "./literary-news-safe-fetch.mjs";
import { createNewsService, newsDiscoveryParserVersion } from "./literary-news-feed.mjs";

const publicAnswer = [{ address: "1.1.1.1", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }];
const tick = () => new Promise((resolve) => setImmediate(resolve));

function transportFixture({ status = 200, headers = {}, body = "Literary source", holdHeaders = false, holdBody = false } = {}) {
  const connections = [];
  const requestImpl = vi.fn((url, options, callback) => {
    const req = new EventEmitter();
    const connection = { url, options, req, incoming: null, destroyed: false };
    connections.push(connection);
    req.destroy = (error) => {
      connection.destroyed = true;
      connection.incoming?.destroy(error);
      if (error) req.emit("error", error);
    };
    const abort = () => req.destroy(new Error("fixture request aborted"));
    options.signal.addEventListener("abort", abort, { once: true });
    req.end = () => queueMicrotask(() => {
      if (options.signal.aborted) { abort(); return; }
      if (holdHeaders) return;
      const incoming = new PassThrough();
      incoming.statusCode = status;
      incoming.headers = { "content-type": "text/html", ...headers };
      incoming.once("close", () => options.signal.removeEventListener("abort", abort));
      connection.incoming = incoming;
      callback(incoming);
      if (!incoming.destroyed && !holdBody) incoming.end(body);
    });
    return req;
  });
  return { requestImpl, connections };
}

describe("collector DNS-pinned HTTPS transport", () => {
  it("rejects private, special-purpose, mapped and transition addresses", () => {
    for (const address of ["0.0.0.0", "10.2.3.4", "127.1.2.3", "169.254.169.254", "100.64.1.2",
      "172.31.1.2", "192.168.1.2", "192.0.2.2", "198.18.1.2", "198.51.100.2", "203.0.113.4", "239.1.2.3",
      "::", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "3fff::1"]) {
      expect(isPublicNewsAddress(address), address).toBe(false);
    }
    for (const { address } of publicAnswer) expect(isPublicNewsAddress(address), address).toBe(true);
  });

  it("pins the connection lookup and keeps original TLS identity even if later DNS would rebind", async () => {
    const lookupImpl = vi.fn().mockResolvedValueOnce(publicAnswer).mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const fixture = transportFixture();
    const response = await createPinnedNewsFetch({ lookupImpl, requestImpl: fixture.requestImpl })("https://source.example/feed");
    const { url, options } = fixture.connections[0];
    expect(url.hostname).toBe("source.example");
    expect(options.headers.host).toBe("source.example");
    expect(options.servername).toBe("source.example");
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.agent).toBe(false);
    const connectionLookup = (lookupOptions) => new Promise((resolve, reject) => options.lookup(url.hostname, lookupOptions,
      (error, answer, family) => error ? reject(error) : resolve({ answer, family })));
    expect((await connectionLookup({ all: true })).answer).toEqual(publicAnswer);
    expect(await connectionLookup({ family: 4 })).toEqual({ answer: "1.1.1.1", family: 4 });
    expect(lookupImpl).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("Literary source");
    expect(response.url).toBe("https://source.example/feed");
  });

  it.each(["127.0.0.1", "169.254.169.254", "fd00::1", "2001:db8::1"])("refuses mixed DNS answers before any socket: %s", async (address) => {
    const fixture = transportFixture();
    const lookupImpl = vi.fn(async () => [...publicAnswer, { address, family: address.includes(":") ? 6 : 4 }]);
    await expect(createPinnedNewsFetch({ lookupImpl, requestImpl: fixture.requestImpl })("https://source.example/feed")).rejects.toThrow("fetch_failed");
    expect(fixture.requestImpl).not.toHaveBeenCalled();
  });

  it("aborts DNS promptly and never opens a socket when the late answer arrives", async () => {
    let finishLookup;
    const lookupImpl = vi.fn(() => new Promise((resolve) => { finishLookup = resolve; }));
    const fixture = transportFixture(), controller = new AbortController();
    const result = createPinnedNewsFetch({ lookupImpl, requestImpl: fixture.requestImpl })("https://source.example/feed", { signal: controller.signal });
    const rejected = expect(result).rejects.toThrow("request_aborted");
    controller.abort();
    await rejected;
    finishLookup(publicAnswer); await tick();
    expect(fixture.requestImpl).not.toHaveBeenCalled();
  });

  it.each(["headers", "body"])("aborts an active connection while waiting for %s", async (stage) => {
    const fixture = transportFixture({ holdHeaders: stage === "headers", holdBody: stage === "body" });
    const controller = new AbortController();
    const result = createPinnedNewsFetch({ lookupImpl: async () => publicAnswer, requestImpl: fixture.requestImpl })(
      "https://source.example/feed", { signal: controller.signal });
    const bodyOrHeaders = stage === "body" ? (await result).text() : result;
    const rejected = expect(bodyOrHeaders).rejects.toThrow("aborted");
    await tick(); controller.abort(); await rejected;
    expect(fixture.connections[0].destroyed).toBe(true);
  });

  it("rejects a redirect without following its private target", async () => {
    const fixture = transportFixture({ status: 302, headers: { location: "https://127.0.0.1/private" } });
    await expect(createPinnedNewsFetch({ lookupImpl: async () => publicAnswer, requestImpl: fixture.requestImpl })("https://source.example/feed")).rejects.toThrow("redirect_not_allowed");
    expect(fixture.requestImpl).toHaveBeenCalledTimes(1);
    expect(fixture.connections[0].incoming.destroyed).toBe(true);
  });

  it.each([false, true])("bounds streamed bytes, including decompressed bodies (gzip=%s)", async (compressed) => {
    const body = compressed ? gzipSync("x".repeat(1024)) : "x".repeat(1024);
    const fixture = transportFixture({ body, headers: compressed ? { "content-encoding": "gzip" } : {} });
    const response = await createPinnedNewsFetch({ lookupImpl: async () => publicAnswer, requestImpl: fixture.requestImpl })(
      "https://source.example/feed", { maxResponseBytes: 64 });
    await expect(response.text()).rejects.toThrow("response_too_large");
    expect(fixture.connections[0].incoming.destroyed).toBe(true);
  });

  it("exposes 304 validators without retaining an unread response body", async () => {
    const fixture = transportFixture({ status: 304, headers: { etag: '"unchanged"' } });
    const response = await createPinnedNewsFetch({ lookupImpl: async () => publicAnswer, requestImpl: fixture.requestImpl })("https://source.example/feed");
    expect(response.status).toBe(304); expect(response.body).toBeNull();
    expect(response.headers.get("etag")).toBe('"unchanged"');
    expect(fixture.connections[0].incoming.destroyed).toBe(true);
  });
});

const source = { id: "fixture", name: "Fixture", language: "en", format: "html", url: "https://source.example/feed",
  linkPattern: /^\/news\//, refreshIntervalSeconds: 7200 };
const stamp = "2026-09-26T12:00:00.000Z";
const candidate = { sourceId: source.id, source: { name: source.name, language: "en", url: "https://source.example/news/book" },
  title: "A verified literary source story", publishedAt: null, description: null, discoveredAt: stamp, verification: "held" };
const document = '<a href="/news/book">A verified literary source story</a>';

describe("collector cooldown and parser-profile cache", () => {
  it.each([200, 304])("success %s clears Retry-After and respects the source's configured cadence", async (successStatus) => {
    let current = new Date(stamp), step = 0;
    const fetchImpl = vi.fn(async () => ++step === 1 ? new Response(null, { status: 429, headers: { "retry-after": "86400" } })
      : step === 2 ? new Response(successStatus === 304 ? null : document, { status: successStatus, headers: { "content-type": "text/html" } })
        : new Response(null, { status: 500 }));
    const instance = createNewsService({ sources: [source], readReviewed: () => [], fetchImpl, now: () => current,
      previousCandidates: [candidate], previousScheduler: { sources: { fixture: { endpoint: source.url,
        parserVersion: newsDiscoveryParserVersion(source), etag: '"cached"' } } } });
    try {
      await instance.refresh();
      expect(instance.getScheduler().sources.fixture.retrySeconds).toBe(86400);
      current = new Date("2026-09-28T12:00:00Z"); await instance.refresh();
      const afterSuccess = instance.getScheduler().sources.fixture;
      expect(afterSuccess.failures).toBe(0); expect(afterSuccess.retrySeconds).toBe(0);
      expect(Date.parse(afterSuccess.nextDueAt) - current.getTime()).toBe(7200_000);
      current = new Date("2026-09-28T15:00:00Z"); await instance.refresh();
      const afterFailure = instance.getScheduler().sources.fixture;
      expect(afterFailure.retrySeconds).toBe(0);
      expect(Date.parse(afterFailure.nextDueAt) - current.getTime()).toBeLessThan(2000_000);
    } finally { instance.close(); }
  });

  it.each([
    { linkPattern: /^\/news\/book$/ }, { keywordPattern: /literary/ }, { linkSelector: "article a[href]" },
    { articleContainer: "article", titleSelector: "h2" }, { articleOrigins: ["https://other.example"] }, { format: "rss" },
  ])("invalidates conditional cache when parser configuration changes: %j", (change) => {
    expect(newsDiscoveryParserVersion({ ...source, ...change })).not.toBe(newsDiscoveryParserVersion(source));
  });

  it("a changed selector cannot reuse ETag or a future schedule from the old parser", async () => {
    const changed = { ...source, linkSelector: "article a[href]" };
    const fetchImpl = vi.fn(async () => new Response(`<article>${document}</article>`, { headers: { "content-type": "text/html" } }));
    const instance = createNewsService({ sources: [changed], readReviewed: () => [], fetchImpl, now: () => new Date(stamp),
      previousCandidates: [candidate], previousScheduler: { sources: { fixture: { endpoint: source.url,
        parserVersion: newsDiscoveryParserVersion(source), etag: '"old-selector"', nextDueAt: "2026-10-01T12:00:00Z" } } } });
    try {
      await instance.refresh();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][1].headers["If-None-Match"]).toBeUndefined();
      expect(instance.getScheduler().sources.fixture.parserVersion).toBe(newsDiscoveryParserVersion(changed));
      expect((await instance.getFeed()).sources[0].status).toBe("ok");
    } finally { instance.close(); }
  });
});
