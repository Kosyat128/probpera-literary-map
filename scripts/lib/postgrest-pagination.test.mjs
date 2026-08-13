import { describe, expect, it, vi } from "vitest";
import {
  collectPostgrestPages,
  parsePostgrestContentRange,
} from "./postgrest-pagination.mjs";

describe("PostgREST pagination", () => {
  it("parses exact ranges including an empty result", () => {
    expect(parsePostgrestContentRange("0-1/3")).toEqual({ start: 0, end: 1, total: 3 });
    expect(parsePostgrestContentRange("*/0")).toEqual({ start: null, end: null, total: 0 });
  });

  it("collects every page and validates the declared total", async () => {
    const source = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const fetchPage = vi.fn(async ({ from, to }) => {
      const rows = source.slice(from, to + 1);
      return {
        rows,
        contentRange: rows.length ? `${from}-${from + rows.length - 1}/${source.length}` : `*/${source.length}`,
      };
    });

    await expect(
      collectPostgrestPages({ fetchPage, identity: (row) => row.id, pageSize: 2, table: "works" })
    ).resolves.toEqual(source);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("rejects duplicates caused by an unstable page order", async () => {
    const pages = [
      { rows: [{ id: "a" }, { id: "b" }], contentRange: "0-1/3" },
      { rows: [{ id: "b" }], contentRange: "2-2/3" },
    ];

    await expect(
      collectPostgrestPages({
        fetchPage: async ({ pageIndex }) => pages[pageIndex],
        identity: (row) => row.id,
        pageSize: 2,
        table: "works",
      })
    ).rejects.toThrow("duplicate identity b");
  });

  it("rejects changing totals instead of publishing a partial snapshot", async () => {
    const pages = [
      { rows: [{ id: "a" }, { id: "b" }], contentRange: "0-1/3" },
      { rows: [{ id: "c" }], contentRange: "2-2/4" },
    ];

    await expect(
      collectPostgrestPages({
        fetchPage: async ({ pageIndex }) => pages[pageIndex],
        identity: (row) => row.id,
        pageSize: 2,
        table: "works",
      })
    ).rejects.toThrow("row count changed");
  });
});
