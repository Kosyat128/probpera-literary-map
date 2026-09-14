import { describe, expect, it, vi } from "vitest";
import { fetchPublicWorkSources } from "./public-work-source-fetch.mjs";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const source = workId => ({ work_id: workId, provider: "Fixture", source_url: `https://example.test/${workId}`, metadata: { retained: true } });
const idsFrom = filter => filter.slice(4, -1).split(",");

describe("public literary-work source fetching", () => {
  it("uses batches of 10 and at most two requests while preserving every source row", async () => {
    const works = Array.from({ length: 69 }, (_, i) => ({ id: id(i + 1) }));
    const calls = []; let active = 0; let maximum = 0;
    const rows = await fetchPublicWorkSources(works, async filter => {
      const ids = idsFrom(filter); calls.push(ids); active += 1; maximum = Math.max(maximum, active);
      await Promise.resolve(); await Promise.resolve(); active -= 1;
      return ids.map(source);
    });
    expect(calls.map(batch => batch.length)).toEqual([10, 10, 10, 10, 10, 10, 9]);
    expect(maximum).toBe(2);
    expect(rows).toEqual(works.map(work => source(work.id)));
  });

  it("does not issue any source query when no public parent exists", async () => {
    const fetch = vi.fn();
    expect(await fetchPublicWorkSources([], fetch)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed or repeated parent IDs before constructing a filter", async () => {
    for (const works of [null, [{ id: "id),or=true" }], [{ id: id(1) }, { id: id(1) }]]) {
      const fetch = vi.fn();
      await expect(fetchPublicWorkSources(works, fetch)).rejects.toThrow(/parent/u);
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it("fails closed on out-of-scope sources, duplicate identities, and failed exact-count pages", async () => {
    await expect(fetchPublicWorkSources([{ id: id(1) }], async () => [source(id(2))])).rejects.toThrow(/scope/u);
    await expect(fetchPublicWorkSources([{ id: id(1) }], async () => [source(id(1)), source(id(1))])).rejects.toThrow(/duplicate/u);
    const fetch = vi.fn(async () => { throw new Error("PostgREST row count changed"); });
    await expect(fetchPublicWorkSources(Array.from({ length: 69 }, (_, i) => ({ id: id(i + 1) })), fetch)).rejects.toThrow("PostgREST row count changed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
