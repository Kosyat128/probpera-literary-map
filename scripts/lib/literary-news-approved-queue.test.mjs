import { describe, expect, it, vi } from "vitest";
import { runDailyNewsAutomation } from "./literary-news-daily-automation.mjs";
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LIMITS, makeDailyApprovedPayload } from "./literary-news-daily-profile.mjs";
import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";
import { buildNewsIngestion } from "./literary-news-ingestion.mjs";
import { buildDailyAwareNewsIngestion, readApprovedDailyQueueProfile, syncDailyAwareNewsStorage } from "./literary-news-approved-queue.mjs";
import { createNewsStorageClient, makeNewsGeneration, parseNewsGeneration, NEWS_STATE_KEY, NEWS_QUEUE_KEY } from "./literary-news-kv-sync.mjs";

const current = new Date("2026-09-30T12:00:00Z"), stamp = current.toISOString();
const source = LITERARY_NEWS_SOURCES.find(row => row.id === "prh");
const sourceUrl = "https://global.penguinrandomhouse.com/announcements/isolated-queue-fixture/";
const text = "The publisher released the novel TestBook by Author Example. The literary novel is listed in the official publishing catalogue. Readers can discover the new release through the publisher.";
const detail = { sourceId: source.id, source: { url: sourceUrl }, evidence: {
  url: sourceUrl, canonical: sourceUrl, httpStatus: 200, accessedAt: stamp, responseSha256: "b".repeat(64),
  headline: "Publisher releases TestBook", text,
  publishedDates: [{ value: "2026-09-29T08:00:00Z", method: "jsonld.datePublished" }], images: [] } };
const draft = { status: "draft", reason: "", title: { ru: "Издатель выпустил роман TestBook", en: "Publisher releases TestBook" },
  summary: { ru: "Издатель выпустил роман TestBook автора Author Example.", en: "The publisher released the novel TestBook by Author Example." },
  category: "releases", eventIdentity: "author example testbook novel release", literaryEvidence: "literary novel",
  facts: [{ quote: "The publisher released the novel TestBook by Author Example." }] };
const review = { accepted: true, literaryTopic: true, categoryMatches: true, translationsMatch: true,
  titleSupported: true, summarySupported: true, publicationDateMatches: true, duplicateOf: null,
  unsupportedClaims: [], factChecks: [{ factIndex: 0, supported: true }] };
async function approved() {
  const result = await runDailyNewsAutomation({ intake: { details: [detail] }, current,
    ai: { request: async ({ phase }) => structuredClone(phase === "draft" ? draft : review) } });
  expect(result.profile.records).toHaveLength(1);
  return result.profile;
}
const candidate = url => ({ sourceId: source.id, source: { name: source.name, url, language: source.language },
  title: "A literary source announcement", description: null, publishedAt: null, discoveredAt: stamp, verification: "held" });
const pendingUrl = "https://global.penguinrandomhouse.com/announcements/isolated-still-held/";
const collection = extra => ({ sources: [source], current, candidates: [],
  feed: { lastCheckedAt: stamp, sources: [{ ...source, status: "ok", lastSuccessAt: stamp }] }, ...extra });

describe("private approved daily evidence removes only resolved discoveries from the held queue", () => {
  it("removes prior and fresh repeats, preserving unrelated decisions and recomputing generation counts/hash", async () => {
    const profile = await approved();
    const before = buildNewsIngestion(collection({ candidates: [candidate(sourceUrl), candidate(pendingUrl)] }));
    before.queue.items.find(row => row.source.url === pendingUrl).decision = { action: "needs_context", reason: "Check literary category" };
    const result = await buildDailyAwareNewsIngestion(collection({ approvedReview: profile,
      previousState: before.state, previousQueue: before.queue, candidates: [candidate(sourceUrl), candidate(pendingUrl)] }));
    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0]).toMatchObject({ verification: "held", source: { url: pendingUrl },
      discoveredAt: stamp, decision: { action: "needs_context" } });
    expect(result.state.pendingCount).toBe(1); expect(result.state.sources[0].candidateCount).toBe(1);
    expect(result.bulk.map(row => row.key)).toEqual([NEWS_STATE_KEY, NEWS_QUEUE_KEY]);
    const generation = makeNewsGeneration(result.bulk);
    const restored = parseNewsGeneration(JSON.stringify(generation));
    expect(JSON.parse(restored.previousQueue).items.map(row => row.source.url)).toEqual([pendingUrl]);
    generation.queue.items = [];
    expect(() => parseNewsGeneration(JSON.stringify(generation))).toThrow("corrupted");
  });
  it("removes approved old evidence even when its source fails, retaining remaining last success and queue", async () => {
    const profile = await approved(), before = buildNewsIngestion(collection({ candidates: [candidate(sourceUrl), candidate(pendingUrl)] }));
    const result = await buildDailyAwareNewsIngestion(collection({ approvedReview: profile, previousState: before.state,
      previousQueue: before.queue, feed: { lastCheckedAt: stamp, sources: [{ ...source, status: "error", error: "http_503" }] } }));
    expect(result.queue.items.map(row => row.source.url)).toEqual([pendingUrl]);
    expect(result.state.sources[0]).toMatchObject({ status: "error", error: "http_503", lastSuccessAt: stamp, candidateCount: 1 });
  });
  it("keeps all held evidence on genuine absence and rejects public flags or a recomputed outer hash over corrupt records", async () => {
    const entries = collection({ candidates: [candidate(sourceUrl)] });
    expect((await buildDailyAwareNewsIngestion(entries)).queue.items).toHaveLength(1);
    await expect(buildDailyAwareNewsIngestion({ ...entries, approvedReview: { items: [{ source: { url: sourceUrl }, machineReviewed: true }] } }))
      .rejects.toThrow();
    const profile = await approved(), corrupt = structuredClone(profile);
    corrupt.records[0].summary.en += " Unsupported fact.";
    corrupt.sha256 = (await makeDailyApprovedPayload(corrupt.records, current)).sha256;
    await expect(buildDailyAwareNewsIngestion({ ...entries, approvedReview: corrupt })).rejects.toThrow("daily_record_proof_invalid");
  });
  it("a failed or corrupted private read prevents collection and every queue/generation write", async () => {
    for (const readDailyApprovedProfile of [
      vi.fn(async () => { throw Error("HTTP 402"); }), vi.fn(async () => "broken"),
      vi.fn(async () => JSON.stringify({ schemaVersion: 1, records: [] }))
    ]) {
      const storage = { readDailyApprovedProfile, read: vi.fn(), write: vi.fn(), commitGeneration: vi.fn() }, collect = vi.fn();
      await expect(syncDailyAwareNewsStorage({ storage, collect, current })).rejects.toThrow();
      expect(collect).not.toHaveBeenCalled(); expect(storage.read).not.toHaveBeenCalled();
      expect(storage.write).not.toHaveBeenCalled(); expect(storage.commitGeneration).not.toHaveBeenCalled();
    }
  });
  it("the real sync path commits only held collector keys after validating fixed private profile evidence", async () => {
    const profile = await approved(), calls = [];
    const fetchImpl = vi.fn(async (target, init) => {
      const url = new URL(target); calls.push({ url, init });
      if (init.method === "PUT") return Response.json({ success: true, result: { successful_key_count: 2, unsuccessful_keys: [] } });
      const key = decodeURIComponent(url.pathname.split("/values/")[1]);
      if (key === DAILY_NEWS_PROFILE_KEY) return Response.json(profile);
      return Response.json({ errors: [{ code: 10009 }] }, { status: 404 });
    });
    const storage = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "isolated-token", fetchImpl });
    const result = await syncDailyAwareNewsStorage({ storage, current, collect: async ({ approvedReview }) =>
      (await buildDailyAwareNewsIngestion(collection({ approvedReview, candidates: [candidate(sourceUrl), candidate(pendingUrl)] }))).bulk });
    expect(result.pendingCount).toBe(1);
    expect(calls.filter(row => row.init.method === undefined &&
      decodeURIComponent(row.url.pathname).endsWith("/values/" + DAILY_NEWS_PROFILE_KEY))).toHaveLength(1);
    const writes = calls.filter(row => row.init.method === "PUT");
    expect(writes).toHaveLength(2);
    expect(writes.some(row => decodeURIComponent(row.url.pathname).includes(DAILY_NEWS_PROFILE_KEY))).toBe(false);
    const committed = JSON.parse(writes[0].init.body);
    expect(committed.state.pendingCount).toBe(1); expect(committed.queue.items.map(row => row.source.url)).toEqual([pendingUrl]);
    expect(JSON.parse(writes[1].init.body).map(row => row.key)).toEqual([NEWS_STATE_KEY, NEWS_QUEUE_KEY]);
    expect(calls.every(row => row.url.origin === "https://api.cloudflare.com" && !row.url.search)).toBe(true);
    await expect(storage.write([{ key: DAILY_NEWS_PROFILE_KEY, value: "{}" }])).rejects.toThrow("two literary news keys");
  });
  it("bounds the daily private response and treats only a confirmed missing key as bootstrap evidence", async () => {
    const oversized = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "isolated-token",
      fetchImpl: async () => new Response("{}", { headers: { "content-length": String(DAILY_NEWS_LIMITS.profileBytes + 1) } }) });
    await expect(readApprovedDailyQueueProfile(oversized, current)).rejects.toThrow("limit");
    for (const [code, missing] of [[10009, true], [10013, false]]) {
      const storage = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "isolated-token",
        fetchImpl: async () => Response.json({ errors: [{ code }] }, { status: 404 }) });
      if (missing) await expect(readApprovedDailyQueueProfile(storage, current)).resolves.toBeNull();
      else await expect(readApprovedDailyQueueProfile(storage, current)).rejects.toThrow("HTTP 404");
    }
  });
});
