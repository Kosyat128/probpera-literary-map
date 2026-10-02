import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { buildNewsIngestion, safeNewsRefreshFailureReason } from "./literary-news-ingestion.mjs";
import { LITERARY_NEWS_SOURCES, RETAINED_NEWS_SOURCE_GRAMMARS } from "./literary-news-sources.mjs";
import { R10_SOURCE_PROFILES } from "./literary-news-source-profiles.mjs";
import { selectReviewed } from "./literary-news-reviewed.mjs";

const current = new Date("2026-10-02T12:00:00Z"), stamp = current.toISOString();
const paths = [
  ["kiwi-verlag-de", "/buch/reviewed-literary-book/"],
  ["kiwi-verlag-de", "/verlag/reviewed-publisher-profile/"],
  ["kbr-be", "/en/agenda/reviewed-library-exhibition/"],
  ["sne-fr", "/reviewed-literary-industry-page/"],
  ["women-prize", "/reviewed-literary-prize-page/"],
];
const active = id => LITERARY_NEWS_SOURCES.find(source => source.id === id);
const historic = id => R10_SOURCE_PROFILES.find(source => source.id === id);
const candidate = (source, path) => ({
  sourceId: source.id, source: { name: source.name, url: new URL(path, source.url).href, language: source.language },
  title: "Reviewed historical literary source discovery", description: null, publishedAt: null,
  discoveredAt: "2026-09-26T12:00:00.000Z", verification: "held", reasons: ["missing_event_date"],
});
const collection = (source, candidates = [], extra = {}) => ({
  sources: [source], current, candidates,
  feed: { lastCheckedAt: stamp, sources: [{ ...source, status: "ok", lastSuccessAt: stamp }] },
  ...extra,
});
function oldSnapshot(id, path) {
  const source = historic(id);
  const result = buildNewsIngestion(collection(source, [candidate(source, path)]));
  expect(result.queue.items).toHaveLength(1);
  Object.assign(result.queue.items[0], {
    decision: { action: "needs_context", reason: "Source evidence remains held for human review" },
    evidence: { responseSha256: "a".repeat(64), accessedAt: "2026-09-26T12:00:00.000Z", method: "retained-original-source" },
    reviewMetadata: { stage: "source-review", publicationAllowed: false },
  });
  result.queue.items[0].source.retrievedAt = "2026-09-26T12:00:00.000Z";
  result.queue.items[0].reasons.push("source_context_required");
  return result;
}

describe("versioned retained held source grammar", () => {
  it("is a frozen code-owned policy independent of discovery overrides", () => {
    expect(RETAINED_NEWS_SOURCE_GRAMMARS.version).toBe("legacy-and-r10-pre-stream-v1");
    expect(Object.isFrozen(RETAINED_NEWS_SOURCE_GRAMMARS)).toBe(true);
    expect(Object.isFrozen(RETAINED_NEWS_SOURCE_GRAMMARS.profiles)).toBe(true);
    for (const [id, path] of paths) {
      expect(active(id).linkPattern.test(path)).toBe(false);
      expect(RETAINED_NEWS_SOURCE_GRAMMARS.profiles.some(profile => profile.id === id && profile.linkPattern.test(path))).toBe(true);
    }
  });

  it.each(paths)("retains %s %s with its evidence, metadata and decision across successful and failed refreshes", (id, path) => {
    const before = oldSnapshot(id, path), copy = structuredClone(before), source = active(id);
    for (const status of ["ok", "error", "pending"]) {
      const result = buildNewsIngestion(collection(source, [], {
        previousState: before.state, previousQueue: before.queue,
        feed: { lastCheckedAt: stamp, sources: [{ ...source, status,
          ...(status === "error" ? { error: "http_503" } : { lastSuccessAt: stamp }) }] },
      }));
      expect(result.queue.items).toHaveLength(1);
      const retained = result.queue.items[0];
      expect(retained).toMatchObject(copy.queue.items[0]);
      expect(retained.source.name).toBe(source.name);
      expect(retained.source.language).toBe(source.language);
      expect(retained.region).toBe(source.region);
      expect(retained.topics).toEqual(source.topics);
      expect(retained.verification).toBe("held");
      expect(retained.reasons).toContain("source_context_required");
      expect(result.state.pendingCount).toBe(1);
      expect(result.state.sources[0].candidateCount).toBe(1);
      expect(selectReviewed(result.queue.items, current, "UTC")).toEqual([]);
      expect(before).toEqual(copy);
    }
  });

  it.each(paths)("does not admit %s %s as a fresh discovery", (id, path) => {
    const source = active(id);
    expect(buildNewsIngestion(collection(source, [candidate(source, path)])).queue.items).toEqual([]);
  });

  it("keeps retained metadata when a currently valid URL is rediscovered with an updated title", () => {
    const path = "/magazin/ausgezeichnet/reviewed-literary-prize/", source = active("kiwi-verlag-de");
    const before = oldSnapshot(source.id, path);
    const fresh = { ...candidate(source, path), title: "Updated original title", discoveredAt: stamp };
    const result = buildNewsIngestion(collection(source, [fresh], { previousState: before.state, previousQueue: before.queue }));
    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0]).toMatchObject({ title: fresh.title, discoveredAt: before.queue.items[0].discoveredAt,
      evidence: before.queue.items[0].evidence, decision: before.queue.items[0].decision,
      reviewMetadata: before.queue.items[0].reviewMetadata, source: { retrievedAt: before.queue.items[0].source.retrievedAt } });
    expect(result.queue.items[0].reasons).toContain("source_context_required");
  });

  it("retains an explicit empty review decision without treating it as corrupted evidence", () => {
    const before = oldSnapshot("kiwi-verlag-de", paths[0][1]);
    before.queue.items[0].decision = null;
    const result = buildNewsIngestion(collection(active("kiwi-verlag-de"), [], {
      previousState: before.state, previousQueue: before.queue,
    }));
    expect(result.queue.items[0].decision).toBeNull();
    expect(result.queue.items[0].evidence).toEqual(before.queue.items[0].evidence);
  });

  it.each(["https://www.kiwi-verlag.de.attacker.test/buch/reviewed-literary-book/", "https://www.kiwi-verlag.de/api/token"])
    ("rejects retained untrusted URL %s even with policy fields in queue JSON", url => {
      const before = oldSnapshot("kiwi-verlag-de", paths[0][1]), source = active("kiwi-verlag-de");
      Object.assign(before.queue.items[0], { source: { ...before.queue.items[0].source, url },
        retainedGrammarVersion: RETAINED_NEWS_SOURCE_GRAMMARS.version, linkPattern: ".*", articleOrigins: [new URL(url).origin] });
      expect(() => buildNewsIngestion(collection(source, [], { previousState: before.state, previousQueue: before.queue })))
        .toThrow("previous_candidate_invalid");
      expect(buildNewsIngestion(collection(source, [before.queue.items[0]])).queue.items).toEqual([]);
    });

  it("cannot use the old grammar after the current source origin has changed", () => {
    const before = oldSnapshot("kiwi-verlag-de", paths[0][1]);
    const source = { ...active("kiwi-verlag-de"), url: "https://reviewed-new-endpoint.example/news/", articleOrigins: [] };
    expect(() => buildNewsIngestion(collection(source, [], { previousState: before.state, previousQueue: before.queue })))
      .toThrow("previous_candidate_invalid");
  });

  it("keeps held validation strict and stops on corrupt bounded review metadata", () => {
    for (const mutation of [
      { verification: "confirmed" },
      { discoveredAt: "2027-01-01T12:00:00.000Z" },
      { reasons: ["<script>unsafe</script>"] },
      { decision: { reason: "x".repeat(2049) } },
    ]) {
      const before = oldSnapshot("kiwi-verlag-de", paths[0][1]);
      Object.assign(before.queue.items[0], mutation);
      expect(() => buildNewsIngestion(collection(active("kiwi-verlag-de"), [], { previousState: before.state, previousQueue: before.queue })))
        .toThrow("previous_candidate_invalid");
    }
  });
});

describe("bounded refresh CLI diagnostics", () => {
  it("exposes only fixed reason codes and redacts arbitrary error text, URLs and credentials", () => {
    expect(safeNewsRefreshFailureReason(new Error("previous_candidate_invalid"))).toBe("previous_candidate_invalid");
    expect(safeNewsRefreshFailureReason({ code: "ENOENT", message: "sensitive local filename" })).toBe("snapshot_file_missing");
    for (const value of ["Bearer secret-token", "https://user:password@example.test/private", "previous_candidate_invalid\nsecret-token"])
      expect(safeNewsRefreshFailureReason(new Error(value))).toBe("unexpected_error");
    expect(safeNewsRefreshFailureReason(null)).toBe("unexpected_error");
  });

  it("the real CLI identifies an incomplete snapshot without printing its path or starting collection", () => {
    const secretMarker = "secret-path-marker-not-a-real-credential";
    const result = spawnSync(process.execPath, ["scripts/refresh-literary-news.mjs", "--previous-state", `.tmp/${secretMarker}.json`],
      { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("literary_news_refresh_failed: previous_snapshot_incomplete; existing remote state has not been changed");
    expect(result.stderr).not.toContain(secretMarker);
    expect(result.stdout).toBe("");
  });
});
