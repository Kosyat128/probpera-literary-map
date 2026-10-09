import { describe, expect, it } from "vitest";
import { parseNewsFeed } from "./feed";
import { readNewsFeedResponse } from "./transport";
import { buildPublishedNewsFeed } from "../../scripts/lib/literary-news-publication.mjs";
import { pendingNewsSourceState } from "../../scripts/lib/literary-news-state.mjs";

const build = (archive = false) => buildPublishedNewsFeed({ records: [], state: pendingNewsSourceState(),
  current: new Date("2026-10-09T12:00:00Z"), release: "a".repeat(40), archive });

describe("explicit complete archive transport", () => {
  it("accepts only the exact archive policy when the caller explicitly requests it", async () => {
    const archive = await build(true), current = await build();
    expect(parseNewsFeed(archive, { archive: true }).snapshot?.policy).toBe("reviewed-v2-archive-explicit-withdrawals");
    expect(() => parseNewsFeed(archive)).toThrow();
    expect(() => parseNewsFeed(current, { archive: true })).toThrow();
    const legacy = { ...current }; delete legacy.contractVersion; delete legacy.snapshot;
    expect(() => parseNewsFeed(legacy, { archive: true })).toThrow();
    await expect(readNewsFeedResponse(Response.json(archive), { archive: true })).resolves.toMatchObject({ items: [] });
    await expect(readNewsFeedResponse(Response.json(archive))).rejects.toThrow();
  });
  it("binds archive intent to the complete digest and cannot relabel a current snapshot", async () => {
    const relabelled = await build();
    relabelled.snapshot.policy = "reviewed-v2-archive-explicit-withdrawals";
    await expect(readNewsFeedResponse(Response.json(relabelled), { archive: true })).rejects.toThrow("digest");
    const truncated = await build(true);
    truncated.snapshot.count = 1;
    await expect(readNewsFeedResponse(Response.json(truncated), { archive: true })).rejects.toThrow();
  });
});
