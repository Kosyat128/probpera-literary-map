import { describe, expect, it } from "vitest";

import {
  assertCandidateCanReplaceBaseline,
  assertPublicationMetadata,
  assertStableOutboxWindow,
  assertStablePublicationHeadWindow,
  publicationHeadMarker,
  publicationHeadProgress,
  publicationMetadata,
} from "./cms-publication-state.mjs";

const id = (suffix) => `cms-00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

function snapshot(ids, marker) {
  const value = {
    version: 1,
    generatedAt: "2026-08-20T12:00:00.000Z",
    source: "Supabase CMS",
    articles: ids.map((articleId) => ({ id: articleId, title: articleId })),
  };
  value.publication = publicationMetadata(value, marker);
  return value;
}

describe("CMS publication snapshot state", () => {
  it("records and verifies an exact article-set and content fingerprint", () => {
    const candidate = snapshot([id("1"), id("2")], "42");
    expect(assertPublicationMetadata(candidate)).toEqual(candidate.publication);
    candidate.articles[0].title = "changed after fingerprint";
    expect(() => assertPublicationMetadata(candidate)).toThrow("contentSha256");
  });

  it("retries instead of publishing a cross-mutation snapshot", () => {
    expect(() => assertStableOutboxWindow("41", "42")).toThrow(
      "CMS changed during export"
    );
    expect(assertStableOutboxWindow("42", "42")).toBe("42");
  });

  it("freezes both publication queues and retries a migration switch", () => {
    const head = {
      source: "outbox",
      outboxHighWater: "42",
      legacyAuditHighWater: "9",
    };
    expect(assertStablePublicationHeadWindow(head, head)).toEqual(head);
    expect(() =>
      assertStablePublicationHeadWindow(head, {
        ...head,
        legacyAuditHighWater: "10",
      })
    ).toThrow("CMS changed during export");
    expect(() =>
      assertStablePublicationHeadWindow(
        {
          source: "legacy-audit",
          outboxHighWater: "0",
          legacyAuditHighWater: "10",
        },
        { ...head, legacyAuditHighWater: "10" }
      )
    ).toThrow("CMS changed during export");
  });

  it("orders a migration transition without comparing unrelated sequences", () => {
    const legacy = {
      source: "legacy-audit",
      outboxHighWater: "0",
      legacyAuditHighWater: "91",
    };
    const migrated = {
      source: "outbox",
      outboxHighWater: "1",
      legacyAuditHighWater: "91",
    };
    expect(publicationHeadProgress(legacy, migrated).state).toBe("advanced");
    expect(() => publicationHeadProgress(migrated, legacy)).toThrow(
      "moved backwards"
    );
    expect(
      publicationHeadMarker({ ...migrated, outboxHighWater: "17" })
    ).toBe("outbox:17,legacy-audit:91");
  });

  it("rejects a bigint already rounded by JSON number parsing", () => {
    expect(() => assertStableOutboxWindow(Number.MAX_SAFE_INTEGER + 1, "42")).toThrow(
      "not a safe integer"
    );
  });

  it("fails closed when a smaller candidate omits a still-published article", () => {
    const removed = id("2");
    expect(() =>
      assertCandidateCanReplaceBaseline({
        candidate: snapshot([id("1")], "43"),
        baseline: snapshot([id("1"), removed], "42"),
        authoritativeStates: new Map([
          [removed.slice(4), { status: "published", deleted_at: null }],
        ]),
      })
    ).toThrow("still published in CMS");
  });

  it("allows an explicit authoritative unpublish or deletion", () => {
    const unpublished = id("2");
    const deleted = id("3");
    expect(
      assertCandidateCanReplaceBaseline({
        candidate: snapshot([id("1")], "44"),
        baseline: snapshot([id("1"), unpublished, deleted], "42"),
        authoritativeStates: new Map([
          [unpublished.slice(4), { status: "hidden", deleted_at: null }],
          [deleted.slice(4), null],
        ]),
      })
    ).toEqual({ removedIds: [unpublished, deleted].sort() });
  });

  it("never lets an older candidate replace a newer deployed marker", () => {
    expect(() =>
      assertCandidateCanReplaceBaseline({
        candidate: snapshot([id("1")], "41"),
        baseline: snapshot([id("1")], "42"),
      })
    ).toThrow("older than deployed");
  });

  it("keeps legacy monotonicity across migration and rejects schema rollback", () => {
    const baseline = snapshot([id("1")], {
      source: "legacy-audit",
      outboxHighWater: "0",
      legacyAuditHighWater: "42",
    });
    expect(
      assertCandidateCanReplaceBaseline({
        candidate: snapshot([id("1")], {
          source: "outbox",
          outboxHighWater: "1",
          legacyAuditHighWater: "42",
        }),
        baseline,
      })
    ).toEqual({ removedIds: [] });
    expect(() =>
      assertCandidateCanReplaceBaseline({
        candidate: snapshot([id("1")], {
          source: "outbox",
          outboxHighWater: "1",
          legacyAuditHighWater: "41",
        }),
        baseline,
      })
    ).toThrow("older than deployed");
    expect(() =>
      assertCandidateCanReplaceBaseline({
        candidate: baseline,
        baseline: snapshot([id("1")], {
          source: "outbox",
          outboxHighWater: "1",
          legacyAuditHighWater: "42",
        }),
      })
    ).toThrow("older than deployed");
  });
});
