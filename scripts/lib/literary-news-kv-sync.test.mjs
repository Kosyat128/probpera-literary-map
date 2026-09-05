import { describe, expect, it, vi } from "vitest";
import { createNewsStorageClient, NEWS_QUEUE_KEY, NEWS_STATE_KEY, syncNewsStorage } from "./literary-news-kv-sync.mjs";

function bulk() {
  const lastCheckedAt = "2026-09-05T10:00:00Z";
  return [
    { key: NEWS_STATE_KEY, value: JSON.stringify({ schemaVersion: 1, lastCheckedAt, sources: [], pendingCount: 1 }) },
    { key: NEWS_QUEUE_KEY, value: JSON.stringify({ schemaVersion: 1, lastCheckedAt, verification: "held", items: [{ verification: "held" }] }) },
  ];
}

describe("scheduled literary news storage", () => {
  it("bootstraps only missing snapshots and passes existing snapshots intact to the collector", async () => {
    for (const previous of [null, "existing snapshot"]) {
      const storage = { read: vi.fn().mockResolvedValue(previous), write: vi.fn() };
      const collect = vi.fn().mockResolvedValue(bulk());
      await syncNewsStorage({ storage, collect });
      expect(collect).toHaveBeenCalledWith({ previousState: previous, previousQueue: previous });
      expect(storage.write).toHaveBeenCalledWith(bulk());
    }
  });
  it("never collects or overwrites after a failed or incomplete read", async () => {
    for (const read of [vi.fn().mockRejectedValue(new Error("HTTP 403")), vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("existing")]) {
      const storage = { read, write: vi.fn() };
      const collect = vi.fn();
      await expect(syncNewsStorage({ storage, collect })).rejects.toThrow();
      expect(collect).not.toHaveBeenCalled();
      expect(storage.write).not.toHaveBeenCalled();
    }
  });
  it("cannot overwrite admin catalogs or publish unreviewed discoveries", async () => {
    const variants = [bulk(), bulk()];
    variants[0][0].key = "editorial-catalog.json";
    variants[1][1].value = variants[1][1].value.replaceAll('"held"', '"confirmed"');
    for (const entries of variants) {
      const storage = { read: vi.fn().mockResolvedValue(null), write: vi.fn() };
      await expect(syncNewsStorage({ storage, collect: async () => entries })).rejects.toThrow();
      expect(storage.write).not.toHaveBeenCalled();
    }
  });
  it("distinguishes a missing key from a wrong namespace or an authorization failure", async () => {
    for (const [status, code, missing] of [[404, 10009, true], [404, 10013, false], [403, 10000, false]]) {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ errors: [{ code }] }), { status }));
      const client = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "test-secret", fetchImpl });
      if (missing) await expect(client.read(NEWS_STATE_KEY)).resolves.toBeNull();
      else await expect(client.read(NEWS_STATE_KEY)).rejects.toThrow(`HTTP ${status}`);
      expect(fetchImpl.mock.calls[0][1].redirect).toBe("manual");
      expect(new URL(fetchImpl.mock.calls[0][0]).hostname).toBe("api.cloudflare.com");
    }
  });
  it("rejects redirect responses and storage keys outside the news namespace", async () => {
    const fetchImpl = vi.fn(async () => new Response("redirect", { status: 302 }));
    const client = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "test-secret", fetchImpl });
    await expect(client.read(NEWS_STATE_KEY)).rejects.toThrow("HTTP 302");
    await expect(client.read("editorial-catalog.json")).rejects.toThrow("Unexpected");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("rejects account-path injection before any request or credential transmission", () => {
    for (const accountId of ["https://example.org", "a".repeat(32) + "/../../outside", "a".repeat(32) + "@example.org", "a".repeat(32) + "?redirect=https://example.org"]) {
      const fetchImpl = vi.fn();
      expect(() => createNewsStorageClient({ accountId, apiToken: "test-secret", fetchImpl })).toThrow("credentials");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });
  it("keeps requests on the literal API authority and two fixed storage paths", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    const client = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "test-secret", fetchImpl });
    await client.read(NEWS_STATE_KEY);
    await client.read(NEWS_QUEUE_KEY);
    for (const [target] of fetchImpl.mock.calls) {
      expect(target).toBeInstanceOf(URL);
      expect(target.origin).toBe("https://api.cloudflare.com");
      expect(target.username).toBe("");
      expect(target.password).toBe("");
      expect(target.search).toBe("");
      expect(target.hash).toBe("");
      expect(target.pathname).toMatch(/^\/client\/v4\/accounts\/a{32}\/storage\/kv\/namespaces\/f3ae59fd55ee4c0cac8ff1613db81680\/values\/literary-news%3Av1%3A(?:source-state|held-queue)$/u);
    }
  });
  it("retries a partially successful bulk write with identical values", async () => {
    const partial = { success: true, result: { unsuccessful_keys: [NEWS_QUEUE_KEY], successful_key_count: 1 } };
    const complete = { success: true, result: { unsuccessful_keys: [], successful_key_count: 2 } };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json(partial))
      .mockResolvedValueOnce(Response.json(complete));
    const client = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "test-secret", fetchImpl });
    await client.write(bulk());
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
  });
  it("fails when a bulk response never confirms both keys", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ success: true, result: { successful_key_count: 1 } }));
    const client = createNewsStorageClient({ accountId: "a".repeat(32), apiToken: "test-secret", fetchImpl });
    await expect(client.write(bulk())).rejects.toThrow("three attempts");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
