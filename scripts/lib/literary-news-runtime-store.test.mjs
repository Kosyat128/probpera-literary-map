import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import { buildPublishedNewsFeed } from "./literary-news-publication.mjs";
import { pendingNewsSourceState } from "./literary-news-state.mjs";
import { createNewsRuntimeStore, dispatchNewsBatch, newsPostKey, reconcileNewsSnapshot } from "./literary-news-social.mjs";

const now = new Date("2026-09-26T12:00:00Z");
const destinations = [{ platform: "telegram", id: "-100123", mode: "on" }, { platform: "vk", id: "-456", mode: "on" }];
const item = { ...reviewed.find(row => row.kind === "news"), id: "quota-fixture", eventKey: "quota-fixture",
  eventDate: "2026-09-25", publishedAt: null, verifiedAt: "2026-09-25T12:00:00Z" };
const feed = records => buildPublishedNewsFeed({ records, withdrawals: [], current: now,
  release: "a".repeat(40), state: pendingNewsSourceState(), timeZone: "Europe/Moscow" });

// Real supabase-js/PostgREST request construction; only the isolated HTTP endpoint is substituted.
function fixture({ latestAvailable = true, intercept } = {}) {
  const journal = [], requests = []; let sequence = 0, metadataRows = 0;
  const append = (key, state) => {
    const row = { id: ++sequence, entity_id: key, metadata: structuredClone(state), entity_type: "literary_news_runtime" };
    journal.push(row); return row;
  };
  const latest = key => journal.findLast(row => row.entity_id === key);
  const fetchImpl = vi.fn(async (input, options) => {
    const url = new URL(input), body = options.body ? JSON.parse(options.body) : null;
    const request = { url, body, select: url.searchParams.get("select"), method: options.method };
    requests.push(request);
    const intercepted = await intercept?.({ request, journal, append, latest });
    if (intercepted) return intercepted;
    if (url.pathname.endsWith("/rpc/read_latest_literary_news_runtime")) {
      if (!latestAvailable) return Response.json({ code: "PGRST202", message: "RPC not yet installed" }, { status: 404 });
      const unique = new Map();
      for (const row of journal) if (row.entity_id.startsWith(body.p_prefix)) unique.set(row.entity_id, row);
      const rows = [...unique.values()].filter(row => body.p_after_key === null || row.entity_id > body.p_after_key)
        .sort((a, b) => a.entity_id < b.entity_id ? -1 : 1).slice(0, body.p_limit);
      metadataRows += rows.length; return Response.json(rows);
    }
    if (url.pathname.endsWith("/rpc/compare_append_literary_news_runtime")) {
      const current = latest(body.p_key);
      if ((current?.id ?? null) !== body.p_expected_id)
        return Response.json({ applied: false, id: current?.id ?? null, state: current?.metadata ?? null });
      const saved = append(body.p_key, body.p_state);
      return Response.json({ applied: true, id: saved.id, state: saved.metadata });
    }
    const columns = request.select.split(",");
    let rows = [...journal].reverse();
    const entity = url.searchParams.get("entity_id");
    if (entity?.startsWith("eq.")) rows = rows.filter(row => row.entity_id === entity.slice(3));
    if (entity?.startsWith("like.")) {
      const prefix = entity.slice(5, -1).replace(/\\([\\%_])/g, "$1");
      rows = rows.filter(row => row.entity_id.startsWith(prefix));
    }
    const id = url.searchParams.get("id");
    if (id?.startsWith("lt.")) rows = rows.filter(row => row.id < Number(id.slice(3)));
    if (id?.startsWith("in.")) {
      const ids = new Set(id.slice(4, -1).split(",").map(Number)); rows = rows.filter(row => ids.has(row.id));
    }
    rows = rows.slice(0, Number(url.searchParams.get("limit")));
    if (columns.includes("metadata")) metadataRows += rows.length;
    return Response.json(rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]]))));
  });
  const client = createClient("https://runtime-fixture.supabase.co", "isolated-fixture", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchImpl },
  });
  return { store: createNewsRuntimeStore(client), journal, requests, append, latest, fetchImpl,
    get metadataRows() { return metadataRows; } };
}

describe("runtime quota and batch reconciliation with the actual Supabase request path", () => {
  it("a replay of 220 current items uses three reads and no repeated per-item requests", async () => {
    const f = fixture();
    const records = Array.from({ length: 220 }, (_, n) => ({ ...item, id: "batch-" + n, eventKey: "batch-" + n }));
    const snapshot = await feed(records);
    await reconcileNewsSnapshot(f.store, snapshot, destinations, now);
    const before = f.requests.length;
    const replay = await reconcileNewsSnapshot(f.store, snapshot, destinations, now);
    const repeated = f.requests.slice(before);
    expect(replay.newAdmissions).toBe(0); expect(replay.expectedThisSnapshot).toBe(440);
    expect(repeated).toHaveLength(3);
    expect(repeated.filter(row => row.url.pathname.endsWith("/rpc/read_latest_literary_news_runtime"))).toHaveLength(2);
    expect(repeated.filter(row => row.url.pathname.endsWith("/rpc/compare_append_literary_news_runtime"))).toHaveLength(0);
  });

  it("a concurrent remote receipt wins the version check and survives a corrected desired revision", async () => {
    let race = false, receiptId;
    const f = fixture({ intercept: ({ request, append, latest }) => {
      if (race && request.body?.p_key === newsPostKey(item.id, destinations[0])
        && request.url.pathname.endsWith("/rpc/compare_append_literary_news_runtime")) {
        race = false;
        const row = latest(request.body.p_key);
        receiptId = append(row.entity_id, { ...row.metadata, status: "sent_current", remoteId: "17",
          acknowledgedRevision: row.metadata.desiredRevision }).id;
      }
    } });
    await reconcileNewsSnapshot(f.store, await feed([item]), destinations, now);
    race = true;
    const revised = { ...item, summary: { ...item.summary, ru: "Уточнённое сообщение первоисточника." } };
    await reconcileNewsSnapshot(f.store, await feed([revised]), destinations, now);
    const row = await f.store.read(newsPostKey(item.id, destinations[0]));
    expect(row.id).toBeGreaterThan(receiptId);
    expect(row.state).toMatchObject({ remoteId: "17", status: "correction_pending" });
    expect(row.state.desiredRevision).not.toBe(row.state.acknowledgedRevision);
    // Reconciliation cache cannot hide subsequent operator/delivery updates.
    f.append(newsPostKey(item.id, destinations[0]), { ...row.state, remoteId: "19" });
    expect((await f.store.read(newsPostKey(item.id, destinations[0]))).state.remoteId).toBe("19");
  });

  it("latest-key pagination returns 510 current receipts without any older payloads", async () => {
    const f = fixture();
    for (let n = 0; n < 510; n++) {
      const key = "post:news:" + String(n).padStart(4, "0") + ":telegram:-100123";
      f.append(key, { key, status: "inflight", oldPayload: "old".repeat(3000) });
      f.append(key, { key, status: "sent_current", remoteId: String(n + 1) });
    }
    const rows = await f.store.list("post:");
    expect(rows).toHaveLength(510); expect(rows.every(row => row.state.status === "sent_current")).toBe(true);
    expect(f.requests).toHaveLength(2); expect(f.metadataRows).toBe(510);
  });

  it("before RPC installation only IDs scan history and only 20 latest payloads cross the API", async () => {
    const f = fixture({ latestAvailable: false });
    for (let n = 0; n < 1202; n++) {
      const key = "post:news:" + n % 20 + ":telegram:-100123";
      f.append(key, { key, revision: n, payload: "large".repeat(2000) });
    }
    const rows = await f.store.list("post:");
    expect(rows).toHaveLength(20); expect(f.metadataRows).toBe(20); expect(f.requests).toHaveLength(4);
    const before = f.requests.length;
    await f.store.list("history:");
    expect(f.requests.slice(before).every(row => !row.url.pathname.includes("/rpc/"))).toBe(true);
  });

  it("one 402 stops reads, writes and fallback queries without exposing provider text", async () => {
    const f = fixture({ intercept: () => Response.json({ message: "private-provider-detail", code: "exceed_cached_egress_quota" }, { status: 402 }) });
    await expect(f.store.list()).rejects.toThrow("runtime_quota_exceeded");
    await expect(f.store.read("heartbeat:scheduler")).rejects.toThrow("runtime_quota_exceeded");
    await expect(f.store.compareAppend("history:coverage", null, {})).rejects.toThrow("runtime_quota_exceeded");
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("a nonquota database error remains a failure and cannot trigger the missing-RPC fallback", async () => {
    const f = fixture({ intercept: () => Response.json({ code: "42501", message: "permission denied" }, { status: 403 }) });
    await expect(f.store.list()).rejects.toThrow("runtime_history_read_failed");
    expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("402 after a real dispatch stops the batch, retaining dispatchStarted for receipt reconciliation", async () => {
    let sent = false;
    const f = fixture({ intercept: ({ request }) => {
      if (sent && request.url.pathname.endsWith("/rpc/compare_append_literary_news_runtime"))
        return Response.json({ code: "exceed_cached_egress_quota" }, { status: 402 });
    } });
    const records = [item, { ...item, id: "quota-second", eventKey: "quota-second" }];
    await reconcileNewsSnapshot(f.store, await feed(records), [destinations[0]], now);
    f.append("destination:telegram:-100123", { mode: "on", paused: false, historyReconciled: true });
    const jobs = (await f.store.list("post:")).map(row => row.state);
    const transport = { preflight: async () => ({ ok: true }), send: vi.fn(async () => {
      sent = true; return { kind: "accepted", remoteId: "17" };
    }) };
    await expect(dispatchNewsBatch({ store: f.store, jobs, transport, now: () => now })).rejects.toThrow("runtime_quota_exceeded");
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(f.journal.filter(row => row.metadata.dispatchStartedAt).at(-1)?.metadata.status).toBe("inflight");
    const before = f.requests.length;
    await expect(f.store.list("post:")).rejects.toThrow("runtime_quota_exceeded");
    expect(f.requests).toHaveLength(before);
  });
});
