import { describe, expect, it, vi } from "vitest";
import { fetchPublicWorkExternalIds } from "./public-work-external-id-fetch.mjs";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = n => ({ work_id: id(n), scheme: "openlibrary", external_id: `OL${n}W`, source_url: `https://openlibrary.org/works/OL${n}W` });

describe("public literary-work external ID export", () => {
  it("bounds parent requests and preserves multiple IDs and exact source URLs", async () => {
    const works = Array.from({ length: 41 }, (_, n) => ({ id: id(n + 1) }));
    const calls = []; let active = 0, maximum = 0;
    const rows = await fetchPublicWorkExternalIds(works, async filter => {
      const ids = filter.slice(4, -1).split(","); calls.push(ids); active++; maximum = Math.max(maximum, active);
      await Promise.resolve(); await Promise.resolve(); active--;
      return ids.flatMap(workId => {
        const n = works.findIndex(work => work.id === workId) + 1;
        return [row(n), { ...row(n), scheme: "wikidata", external_id: `Q${n}`, source_url: `https://www.wikidata.org/wiki/Q${n}` }];
      });
    });
    expect(calls.map(batch => batch.length)).toEqual([10, 10, 10, 10, 1]); expect(maximum).toBe(2);
    expect(rows).toHaveLength(82);
    expect(rows[0]).toEqual({ work_id: id(1), scheme: "openlibrary", value: "OL1W", sourceUrl: "https://openlibrary.org/works/OL1W" });
    expect(rows[1]).toEqual({ work_id: id(1), scheme: "wikidata", value: "Q1", sourceUrl: "https://www.wikidata.org/wiki/Q1" });
  });
  it("does not fetch without public parents and rejects invalid parent identities", async () => {
    const fetch = vi.fn(); expect(await fetchPublicWorkExternalIds([], fetch)).toEqual([]);
    for (const works of [null, [{ id: "x),or=true" }], [{ id: id(1) }, { id: id(1) }]])
      await expect(fetchPublicWorkExternalIds(works, fetch)).rejects.toThrow(/parent/u);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects foreign children and duplicate identifiers even across different parents", async () => {
    await expect(fetchPublicWorkExternalIds([{ id: id(1) }], async () => [row(2)])).rejects.toThrow(/scope/u);
    await expect(fetchPublicWorkExternalIds([{ id: id(1) }, { id: id(2) }], async () => [row(1), { ...row(1), work_id: id(2) }])).rejects.toThrow(/duplicate/u);
  });
  it.each([
    { scheme: "unrepresented-scheme" }, { external_id: "" }, { external_id: "x".repeat(181) },
    { source_url: "http://example.test/id" }, { source_url: "https://user:pass@example.test/id" }, { source_url: "invalid" },
  ])("fails closed on unrepresentable or invalid identity metadata %j", async invalid => {
    await expect(fetchPublicWorkExternalIds([{ id: id(1) }], async () => [{ ...row(1), ...invalid }])).rejects.toThrow(/invalid/u);
  });
  it("retains exact-count failures instead of silently exporting partial IDs", async () => {
    const fetch = vi.fn(async () => { throw new Error("PostgREST row count changed"); });
    await expect(fetchPublicWorkExternalIds(Array.from({ length: 41 }, (_, n) => ({ id: id(n + 1) })), fetch)).rejects.toThrow("PostgREST row count changed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
