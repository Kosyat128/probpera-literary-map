import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => { throw new Error("no worker runtime"); } }));

import {
  filterHeldNewsQueue, formatNewsQueueDate, literaryNewsQueueHref, loadLiteraryNewsQueue,
  NEWS_QUEUE_KEY, NEWS_SOURCE_STATE_KEY, NEWS_QUEUE_MAX_BYTES,
  newsHoldReason, parseHeldNewsQueue, parseNewsSourceState,
} from "./literary-news-queue";

const candidate = {
  sourceId: "booker",
  source: { name: "Booker Prizes", url: "https://thebookerprizes.com/news/example", language: "en" },
  title: "An original literary announcement",
  description: "Source excerpt awaiting editorial review.",
  discoveredAt: "2026-09-05T12:00:00.000Z",
  publishedAt: null,
  verification: "held" as const,
  reasons: ["missing_event_date", "bilingual_review_required", "topic_review_required"],
};
const queue = {
  schemaVersion: 1,
  generatedAt: "2026-09-05T12:05:00.000Z",
  lastCheckedAt: "2026-09-05T12:04:00.000Z",
  verification: "held",
  items: [candidate],
};
const sourceState = {
  schemaVersion: 1,
  lastCheckedAt: "2026-09-05T12:04:00.000Z",
  refreshIntervalSeconds: 1800,
  pendingCount: 1,
  sources: [{ id: "booker", name: "Booker Prizes", url: "https://thebookerprizes.com", status: "error", lastSuccessAt: "2026-09-04T12:00:00.000Z", candidateCount: 1, error: "private diagnostic", language: "en", topics: ["awards"] }],
};

describe("private literary news queue", () => {
  it("keeps unknown publication dates and held status without inventing verification", () => {
    const parsed = parseHeldNewsQueue(JSON.stringify(queue));
    expect(parsed.items[0].publishedAt).toBeNull();
    expect(parsed.items[0].verification).toBe("held");
    expect(parsed.items[0]).not.toHaveProperty("eventDate");
    expect(parsed.items[0]).not.toHaveProperty("verifiedAt");
  });

  it.each([
    { ...candidate, verification: "confirmed" },
    { ...candidate, reasons: [] },
    { ...candidate, discoveredAt: "2026-02-30T00:00:00Z" },
    { ...candidate, publishedAt: "2026-02-30" },
    { ...candidate, source: { ...candidate.source, url: "javascript:alert(1)" } },
    { ...candidate, source: { ...candidate.source, url: "https://user:secret@example.com" } },
    { ...candidate, source: { ...candidate.source, language: "bad_language" } },
  ])("rejects malformed/unconfirmed-boundary candidate %#", (item) => {
    expect(() => parseHeldNewsQueue(JSON.stringify({ ...queue, items: [item] }))).toThrow();
  });

  it("rejects duplicated candidates, excessive cardinality and oversized input before rendering", () => {
    expect(() => parseHeldNewsQueue(JSON.stringify({ ...queue, items: [candidate, candidate] }))).toThrow();
    expect(() => parseHeldNewsQueue(JSON.stringify({ ...queue, items: Array.from({ length: 5_001 }, (_, i) => ({ ...candidate, source: { ...candidate.source, url: `https://example.com/${i}` } })) }))).toThrow();
    expect(() => parseHeldNewsQueue(" ".repeat(NEWS_QUEUE_MAX_BYTES + 1))).toThrow("size limit");
    expect(() => parseHeldNewsQueue(`"${"я".repeat(NEWS_QUEUE_MAX_BYTES / 2)}"`)).toThrow("size limit");
  });

  it("preserves failed-source last success while excluding raw diagnostics", () => {
    const parsed = parseNewsSourceState(JSON.stringify(sourceState));
    expect(parsed.sources[0].status).toBe("error");
    expect(parsed.sources[0].lastSuccessAt).toBe("2026-09-04T12:00:00.000Z");
    expect(parsed.sources[0]).not.toHaveProperty("error");
    expect(() => parseNewsSourceState(JSON.stringify({ ...sourceState, pendingCount: -1 }))).toThrow();
  });

  it("reads only fixed news keys and keeps queue available when source-state fails", async () => {
    const get = vi.fn(async (key: string) => {
      if (key === NEWS_QUEUE_KEY) return JSON.stringify(queue);
      throw new Error("temporary KV failure");
    });
    const loaded = await loadLiteraryNewsQueue({ get });
    expect(get.mock.calls.map(([key]) => key).sort()).toEqual([NEWS_QUEUE_KEY, NEWS_SOURCE_STATE_KEY].sort());
    expect(loaded.queue?.items).toHaveLength(1);
    expect(loaded.sourcesError).toBe(true);
    expect(loaded.sources).toBeNull();
  });

  it("distinguishes missing binding, first missing snapshot and malformed queue", async () => {
    expect(await loadLiteraryNewsQueue()).toMatchObject({ configured: false, queue: null, queueError: false });
    expect(await loadLiteraryNewsQueue({ get: async () => null })).toMatchObject({ configured: true, queue: null, queueError: false });
    expect(await loadLiteraryNewsQueue({ get: async () => "not-json" })).toMatchObject({ configured: true, queue: null, queueError: true });
  });

  it("filters original multilingual text and source before bounded pagination", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ ...candidate, title: `Ёлка café ${i}`, sourceId: i % 2 ? "booker" : "library", source: { ...candidate.source, url: `https://example.com/${String(i).padStart(2, "0")}` } }));
    const filtered = filterHeldNewsQueue(items, { q: "елка cafe", source: "booker", page: "2" });
    expect(filtered).toMatchObject({ total: 30, page: 2, pages: 2 });
    expect(filtered.items).toHaveLength(5);
    expect(filterHeldNewsQueue(items, { page: "9999" }).page).toBe(3);
    expect(filterHeldNewsQueue(items, { page: "2.5" }).page).toBe(1);
    expect(literaryNewsQueueHref(filtered, 2)).toContain("source=booker&page=2");
  });

  it("orders timestamp offsets by actual discovery time", () => {
    const earlier = { ...candidate, title: "Earlier", discoveredAt: "2026-09-05T14:00:00+03:00" };
    expect(filterHeldNewsQueue([earlier, candidate], {}).items[0].title).toBe(candidate.title);
  });

  it("preserves a source's date-only publication without inventing midnight", () => {
    const parsed = parseHeldNewsQueue(JSON.stringify({ ...queue, items: [{ ...candidate, publishedAt: "2026-09-05" }] }));
    expect(parsed.items[0].publishedAt).toBe("2026-09-05");
    expect(formatNewsQueueDate(parsed.items[0].publishedAt!)).toContain("2026");
    expect(formatNewsQueueDate(parsed.items[0].publishedAt!)).not.toMatch(/\d{2}:\d{2}|UTC/);
    expect(formatNewsQueueDate("2026-09-05T14:00:00+03:00")).toContain("11:00 UTC");
  });

  it("translates known holding reasons and retains additional required checks", () => {
    expect(newsHoldReason("missing_event_date")).toContain("дату события");
    expect(newsHoldReason("new_review_gate")).toContain("new_review_gate");
  });

  it("keeps the page private, checks auth before reading and exposes no publication mutation", () => {
    const page = readFileSync("apps/admin/app/(dashboard)/literary-news/page.tsx", "utf8");
    expect(page).toContain('dynamic = "force-dynamic"');
    expect(page).toContain("noStore();");
    expect(page).toContain("session.mfa.checkError");
    expect(page.indexOf("await requireStaff()")).toBeLessThan(page.indexOf("await loadLiteraryNewsQueue()"));
    expect(page).toContain('method="get"');
    expect(page).not.toMatch(/action=|dangerouslySetInnerHTML|use client/);
    expect(page).toContain("data/news/reviewed.json");
    const middleware = readFileSync("apps/admin/middleware.ts", "utf8");
    expect(middleware).toContain('"private, no-store, max-age=0"');
  });
});
