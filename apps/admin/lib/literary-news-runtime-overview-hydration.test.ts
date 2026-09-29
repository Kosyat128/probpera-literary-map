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
