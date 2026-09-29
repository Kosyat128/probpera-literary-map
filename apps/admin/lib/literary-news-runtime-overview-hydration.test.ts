import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLiteraryNewsRuntimeOverview } from "./literary-news-runtime-overview";

const revision = "a".repeat(64);
const job = (newsId: string, extra = {}) => ({ newsId, destination: { platform: "telegram", id: "-10012345" },
  status: "pending", originalAdmission: "2026-09-30T12:00:00Z", desiredRevision: revision,
  prepared: { payload: { text: "Проверенный подготовленный текст." } }, ...extra });
const row = (id: number, newsId: string, metadata: unknown = job(newsId)) =>
  ({ id, entity_id: "post:news:" + newsId + ":telegram:-10012345", metadata });
type AuditRow = ReturnType<typeof row>;
type Query = { columns: string; ids: string[] | null; cursor: string | null; limit: number; entityType: string };
function fixture(rows: AuditRow[], hooks: { afterHead?: (query: Query) => void;
  payload?: (selected: AuditRow[], query: Query) => { data: unknown[] | null; error: unknown } } = {}) {
  const calls: Query[] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("admin_audit_log");
    const query: Query = { columns: "", ids: null, cursor: null, limit: 0, entityType: "" };
    const builder = {
      select(columns: string) { query.columns = columns; return builder; },
      eq(column: string, value: string) { expect(column).toBe("entity_type"); query.entityType = value; return builder; },
      order(column: string, order: { ascending: boolean }) { expect(column).toBe("id"); expect(order.ascending).toBe(false); return builder; },
      limit(limit: number) { query.limit = limit; return builder; },
      lt(column: string, cursor: string) { expect(column).toBe("id"); query.cursor = cursor; return builder; },
      in(column: string, ids: string[]) { expect(column).toBe("id"); query.ids = [...ids]; return builder; },
      then(resolve: (result: { data: unknown[] | null; error: unknown }) => unknown, reject?: (error: unknown) => unknown) {
        calls.push({ ...query }); expect(query.entityType).toBe("literary_news_runtime");
        let result: { data: unknown[] | null; error: unknown };
        if (query.ids) {
          const selected = rows.filter(item => query.ids!.includes(String(item.id)));
          result = hooks.payload ? hooks.payload(selected, query) : { data: selected, error: null };
        } else {
          expect(query.columns).toBe("id,entity_id");
          const selected = rows.filter(item => query.cursor === null || BigInt(item.id) < BigInt(query.cursor))
            .sort((a, b) => b.id - a.id).slice(0, query.limit);
          result = { data: selected.map(({ id, entity_id }) => ({ id, entity_id })), error: null };
          hooks.afterHead?.(query);
        }
        return Promise.resolve(result).then(resolve, reject);
      }
    };
    return builder;
  });
  return { client: { from } as unknown as Pick<SupabaseClient, "from">, calls };
}

describe("actual staff RLS loader fetches metadata once per latest CAS state", () => {
  it("1202 replay rows transfer two metadata records, preserving an old job and the exact latest version", async () => {
    const repeated = job("a", { historicalPadding: "old preparation evidence ".repeat(1000) });
    const rows = Array.from({ length: 1202 }, (_, index) => row(index + 1, index === 0 ? "old" : "a", index === 0 ? job("old") : repeated));
    const f = fixture(rows);
    const result = await loadLiteraryNewsRuntimeOverview(f.client);
    expect(result.complete).toBe(true); expect(result.rowsRead).toBe(1202); expect(result.posts).toHaveLength(2);
    expect(result.posts.find(item => item.newsId === "a")?.expectedVersion).toBe("1202");
    expect(result.posts.find(item => item.newsId === "old")?.expectedVersion).toBe("1");
    expect(f.calls.filter(call => call.ids === null)).toHaveLength(3);
    expect(f.calls.filter(call => call.ids !== null).map(call => call.ids)).toEqual([["1202", "1"]]);
    expect(f.calls.filter(call => call.columns.includes("metadata"))).toHaveLength(1);
  });
  it("new activity during the head scan cannot replace the selected CAS snapshot", async () => {
    const rows = Array.from({ length: 502 }, (_, index) => row(index + 1, index === 0 ? "old" : "a"));
    let appended = false;
    const f = fixture(rows, { afterHead() { if (!appended) { rows.push(row(9000, "a", job("a", { status: "inflight" }))); appended = true; } } });
    const result = await loadLiteraryNewsRuntimeOverview(f.client);
    expect(result.complete).toBe(true); expect(result.posts.find(item => item.newsId === "a")).toMatchObject({ expectedVersion: "502", status: "pending" });
    expect(f.calls.flatMap(call => call.ids ?? [])).not.toContain("9000");
  });
  it.each(["missing", "corrupt", "foreign_key", "unexpected_id", "duplicate"])("marks %s hydration incomplete without falling back to older metadata", async mode => {
    const rows = [row(2, "a"), row(1, "a", job("a", { status: "inflight" }))];
    const f = fixture(rows, { payload(selected) {
      if (mode === "missing") return { data: [], error: null };
      if (mode === "corrupt") return { data: [{ ...selected[0], metadata: null }], error: null };
      if (mode === "foreign_key") return { data: [{ ...selected[0], entity_id: "destination:telegram:-10012345" }], error: null };
      if (mode === "unexpected_id") return { data: [rows[1]], error: null };
      return { data: [selected[0], selected[0]], error: null };
    } });
    const result = await loadLiteraryNewsRuntimeOverview(f.client);
    expect(result.complete).toBe(false); expect(result.invalidRows).toBeGreaterThan(0);
    expect(result.posts.some(item => item.expectedVersion === "1")).toBe(false);
    expect(result.destinations.every(item => item.expectedVersion === null)).toBe(true);
  });
  it("stops after one failed payload request rather than querying remaining chunks on quota", async () => {
    const f = fixture(Array.from({ length: 300 }, (_, index) => row(index + 1, "story-" + index)),
      { payload: () => ({ data: null, error: { status: 402, message: "PRIVATE_PROVIDER_ERROR" } }) });
    const result = await loadLiteraryNewsRuntimeOverview(f.client);
    expect(result).toMatchObject({ complete: false, readError: true, posts: [] });
    expect(f.calls.filter(call => call.ids !== null)).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_ERROR");
  });
  it("preserves the eight MiB metadata cap independently of the lightweight head scan", async () => {
    const f = fixture([row(1, "a", job("a", { padding: "x".repeat(8 * 1024 * 1024) }))]);
    const result = await loadLiteraryNewsRuntimeOverview(f.client);
    expect(result.complete).toBe(false); expect(result.posts).toEqual([]);
  });
});

describe("optional staff-gated latest RPC removes dependence on historical row count", () => {
  it("uses keyset pages with a fixed upper-ID and exact versions without any audit history request", async () => {
    const rows = Array.from({ length: 502 }, (_, index) => row(index + 1, "story-" + String(index).padStart(4, "0")));
    const from = vi.fn(), rpc = vi.fn(async (_name: string, args: { p_after_key: string | null; p_upper_id: string | null; p_limit: number }) => {
      const upper = args.p_upper_id ?? "502";
      const data = rows.filter(item => BigInt(item.id) <= BigInt(upper) && (args.p_after_key === null || item.entity_id > args.p_after_key))
        .sort((a, b) => a.entity_id < b.entity_id ? -1 : 1).slice(0, args.p_limit)
        .map(item => ({ ...item, snapshot_upper_id: upper }));
      if (args.p_after_key === null) rows.push(row(9000, "story-0001", job("story-0001", { status: "inflight" })));
      return { data, error: null };
    });
    const result = await loadLiteraryNewsRuntimeOverview({ from, rpc } as unknown as SupabaseClient);
    expect(result.complete).toBe(true); expect(result.rowsRead).toBe(502); expect(result.posts).toHaveLength(502);
    expect(result.posts.find(item => item.newsId === "story-0001")).toMatchObject({ expectedVersion: "2", status: "pending" });
    expect(from).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_upper_id: "502", p_limit: 500 });
  });
  it.each(["PGRST202", "42883"])("only confirmed missing RPC %s uses the bounded two-phase fallback", async code => {
    const f = fixture([row(1, "a")]), rpc = vi.fn(async () => ({ data: null, error: { code } }));
    const result = await loadLiteraryNewsRuntimeOverview({ ...f.client, rpc } as unknown as SupabaseClient);
    expect(result.complete).toBe(true); expect(result.posts[0].expectedVersion).toBe("1");
    expect(rpc).toHaveBeenCalledTimes(1); expect(f.calls.map(call => call.columns)).toEqual(["id,entity_id", "id,entity_id,metadata"]);
  });
  it.each([{ code: "42501", status: 403 }, { code: "quota", status: 402 }, { code: "unexpected", status: 500 }])
    ("RPC error %j fails closed without an additional history request", async error => {
      const from = vi.fn(), rpc = vi.fn(async () => ({ data: null, error }));
      const result = await loadLiteraryNewsRuntimeOverview({ from, rpc } as unknown as SupabaseClient);
      expect(result).toMatchObject({ complete: false, readError: true, posts: [] });
      expect(from).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
    });
  it.each(["watermark", "missing_metadata", "key_order", "unsafe_id"])("rejects corrupt RPC %s without a legacy replay fallback", async mode => {
    const a = { ...row(1, "a"), snapshot_upper_id: "2" }, b = { ...row(2, "b"), snapshot_upper_id: "2" };
    const data: unknown[] = mode === "watermark" ? [a, { ...b, snapshot_upper_id: "3" }]
      : mode === "missing_metadata" ? [{ ...a, metadata: null }]
      : mode === "key_order" ? [b, a] : [{ ...a, id: Number.MAX_SAFE_INTEGER + 1 }];
    const from = vi.fn(), rpc = vi.fn(async () => ({ data, error: null }));
    const result = await loadLiteraryNewsRuntimeOverview({ from, rpc } as unknown as SupabaseClient);
    expect(result.complete).toBe(false); expect(result.invalidRows).toBeGreaterThan(0);
    expect(from).not.toHaveBeenCalled();
  });
});
