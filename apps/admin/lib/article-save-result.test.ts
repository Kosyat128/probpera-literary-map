import { describe, expect, it } from "vitest";

import {
  compareArticleSaveRevisions,
  parseArticleSaveResult,
  type ArticleSaveContext,
  type ArticleSaveResult,
} from "./article-save-result";

const articleId = "a1111111-b222-4333-8444-c55555555555";
const foreignId = "d1111111-e222-4333-8444-f55555555555";
const previous = "2026-10-07T12:00:00.123456+00:00";
const next = "2026-10-07T12:00:00.123457+00:00";
const englishPrevious = "2026-10-07T11:00:00.654321+00:00";
const englishNext = "2026-10-07T11:00:00.654322+00:00";
const context: ArticleSaveContext = {
  articleId, articleUpdatedAt: previous, englishUpdatedAt: englishPrevious, workingDraftVersion: 3,
};

type Saved = Extract<ArticleSaveResult, { outcome: "saved" }>;
function canonical(): Saved {
  return {
    outcome: "saved", persistence: "article-bundle",
    receipt: {
      articleId, articleUpdatedAt: next, englishUpdatedAt: englishNext,
      workingDraftVersion: 0, workingDraftUpdatedAt: null, canonicalStatus: "draft",
    },
    publicationState: "not-requested", revalidationState: "scheduled",
    destination: `/articles/edit?id=${articleId}&saved=1`,
  };
}
function workingDraft(): Saved {
  return {
    ...canonical(), persistence: "working-draft",
    receipt: {
      articleId, articleUpdatedAt: previous, englishUpdatedAt: englishPrevious,
      workingDraftVersion: 4, workingDraftUpdatedAt: next, canonicalStatus: "published",
    },
    destination: `/articles/edit?id=${articleId}&saved=working-draft`,
  };
}

describe("article save acknowledgement belongs to the submitted context", () => {
  const operationId = "12345678-1234-4234-8234-123456789abc";
  const otherOperationId = "12345678-1234-4234-8234-123456789abd";
  it.each([
    canonical(), workingDraft(), { outcome: "unknown-outcome" }, { outcome: "dependency-unavailable" },
    { outcome: "rejected", reason: "validation" }, { outcome: "conflict", scope: "article" },
  ])("binds every operation result to the own command without weakening legacy (%j)", value => {
    const bound = { ...value, operationId };
    expect(parseArticleSaveResult(bound, { ...context, operationId })).toEqual(bound);
    expect(parseArticleSaveResult(bound, { ...context, operationId: operationId.toUpperCase() })).toEqual(bound);
    expect(parseArticleSaveResult(bound, { ...context, operationId: otherOperationId })).toBeNull();
    expect(parseArticleSaveResult(value, { ...context, operationId })).toBeNull();
    expect(parseArticleSaveResult(value, context)).toEqual(value);
  });
  it.each([null, "", "invalid", otherOperationId + "?saved=1", 1, true])("rejects malformed operation receipt ID %j", id => {
    expect(parseArticleSaveResult({ ...canonical(), operationId: id }, { ...context, operationId })).toBeNull();
  });
  it("does not permit a malformed requested operation context to accept a rejection or receipt", () => {
    expect(parseArticleSaveResult({ outcome: "unknown-outcome", operationId }, { ...context, operationId: "bad" })).toBeNull();
    expect(parseArticleSaveResult({ ...canonical(), operationId }, { ...context, operationId: "bad" })).toBeNull();
  });
  it("accepts English persistence scopes and preserves legacy absence without inferring saved text from CAS", () => {
    for (const englishState of ["saved", "status-only", "unknown"] as const) {
      const value = { ...canonical(), englishState };
      expect(parseArticleSaveResult(value, context)).toEqual(value);
    }
    const preserved = { ...canonical(), englishState: "preserved", receipt: { ...canonical().receipt, englishUpdatedAt: null } };
    expect(parseArticleSaveResult(preserved, context)).toEqual(preserved);
    expect(parseArticleSaveResult({ ...workingDraft(), englishState: "preserved" }, context)).toMatchObject({ englishState: "preserved" });
    expect(parseArticleSaveResult(canonical(), context)).toEqual(canonical());
  });
  it.each([
    { englishState: "preserved" },
    { englishState: "saved", receipt: { ...canonical().receipt, englishUpdatedAt: null } },
    { englishState: "status-only", receipt: { ...canonical().receipt, englishUpdatedAt: null } },
    { englishState: "complete" },
    { ...workingDraft(), englishState: "status-only" },
  ])("rejects an English scope contradicted by its receipt %j", patch => {
    expect(parseArticleSaveResult({ ...canonical(), ...patch }, context)).toBeNull();
  });

  it("accepts an existing canonical RU/EN save without changing CAS bytes or the caller context", () => {
    const receipt = canonical();
    const original = structuredClone(context);
    expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    expect(receipt.receipt.articleUpdatedAt).toBe(next);
    expect(receipt.receipt.englishUpdatedAt).toBe(englishNext);
    expect(context).toEqual(original);
  });

  it("accepts the server-assigned identity and first revisions for a new article", () => {
    const receipt = canonical();
    const newContext = { articleId: null, articleUpdatedAt: null, englishUpdatedAt: null, workingDraftVersion: 0 };
    expect(parseArticleSaveResult(receipt, newContext)).toEqual(receipt);
  });

  it("accepts promotion of the current article and clears only the acknowledged working draft", () => {
    const receipt = { ...canonical(), persistence: "working-draft-promotion" as const };
    expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    expect(receipt.receipt.workingDraftVersion).toBe(0);
    expect(receipt.receipt.workingDraftUpdatedAt).toBeNull();
  });

  it("accepts one working-draft revision while canonical RU/EN remain unchanged", () => {
    const receipt = workingDraft();
    const original = structuredClone(context);
    expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    expect(context).toEqual(original);
  });

  it("accepts UUID case equivalence without rewriting the receipt identity", () => {
    const receipt = canonical();
    receipt.receipt.articleId = articleId.toUpperCase();
    expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    expect(parseArticleSaveResult(canonical(), { ...context, articleId: articleId.toUpperCase() })).toEqual(canonical());
  });

  it.each([null, englishPrevious])("accepts canonical null EN for absent or preserved English (%s)", englishUpdatedAt => {
    const receipt = canonical();
    receipt.receipt.englishUpdatedAt = null;
    expect(parseArticleSaveResult(receipt, { ...context, englishUpdatedAt })).toEqual(receipt);
  });

  it("rejects a malformed submitted EN CAS even when canonical mode leaves English untouched", () => {
    const receipt = canonical();
    receipt.receipt.englishUpdatedAt = null;
    expect(parseArticleSaveResult(receipt, { ...context, englishUpdatedAt: "malformed" })).toBeNull();
  });

  it("accepts newly created English when the submitted bundle had no existing EN revision", () => {
    expect(parseArticleSaveResult(canonical(), { ...context, englishUpdatedAt: null })).toEqual(canonical());
  });

  it("accepts a working draft with confirmed absent EN", () => {
    const receipt = workingDraft();
    receipt.receipt.englishUpdatedAt = null;
    expect(parseArticleSaveResult(receipt, { ...context, englishUpdatedAt: null })).toEqual(receipt);
  });

  it("rejects a working-draft acknowledgement that rebases the submitted raw EN CAS", () => {
    const receipt = workingDraft();
    receipt.receipt.englishUpdatedAt = "2026-10-07T14:00:00.6543210+03:00";
    expect(compareArticleSaveRevisions(receipt.receipt.englishUpdatedAt, englishPrevious)).toBe(0);
    expect(parseArticleSaveResult(receipt, context)).toBeNull();
  });

  it.each(["draft", "review", "scheduled", "published", "hidden", "archived"] as const)(
    "preserves the canonical %s status rather than inferring it from navigation", canonicalStatus => {
      const receipt = canonical();
      receipt.receipt.canonicalStatus = canonicalStatus;
      expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    }
  );

  it.each(["not-requested", "started", "queued", "queue-error", "unknown"] as const)(
    "preserves independent publication state %s for an acknowledged write", publicationState => {
      const receipt = { ...canonical(), publicationState, revalidationState: "unknown" as const };
      expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    }
  );

  it("rejects a receipt belonging to another article even with a matching destination", () => {
    const receipt = canonical();
    receipt.receipt.articleId = foreignId;
    receipt.destination = `/articles/edit?id=${foreignId}`;
    expect(parseArticleSaveResult(receipt, context)).toBeNull();
  });

  it.each(["article-bundle", "working-draft-promotion"] as const)(
    "rejects non-advancing canonical RU revisions for %s", persistence => {
      for (const articleUpdatedAt of [previous, "2026-10-07T12:00:00.123455+00:00", "2026-10-07T15:00:00.1234560+03:00"]) {
        const receipt = canonical();
        receipt.persistence = persistence;
        receipt.receipt.articleUpdatedAt = articleUpdatedAt;
        expect(parseArticleSaveResult(receipt, context)).toBeNull();
      }
    }
  );

  it.each([englishPrevious, "2026-10-07T11:00:00.654320+00:00", "2026-10-07T14:00:00.6543210+03:00"])(
    "rejects an unchanged or older acknowledged English revision %s", englishUpdatedAt => {
      const receipt = canonical();
      receipt.receipt.englishUpdatedAt = englishUpdatedAt;
      expect(parseArticleSaveResult(receipt, context)).toBeNull();
    }
  );

  it("rejects promotion without an existing article identity", () => {
    const receipt = { ...canonical(), persistence: "working-draft-promotion" as const };
    expect(parseArticleSaveResult(receipt, { articleId: null, articleUpdatedAt: null, englishUpdatedAt: null, workingDraftVersion: 0 })).toBeNull();
  });

  it.each([
    { workingDraftVersion: 1, workingDraftUpdatedAt: null },
    { workingDraftVersion: 0, workingDraftUpdatedAt: next },
  ])("rejects canonical receipts retaining unacknowledged working-draft state %j", patch => {
    const receipt = canonical();
    Object.assign(receipt.receipt, patch);
    expect(parseArticleSaveResult(receipt, context)).toBeNull();
  });

  it.each([
    { workingDraftVersion: 1, workingDraftUpdatedAt: null },
    { workingDraftVersion: 0, workingDraftUpdatedAt: next },
  ])("rejects inconsistent canonical receipt markers even without a caller context %j", patch => {
    const receipt = canonical();
    Object.assign(receipt.receipt, patch);
    expect(parseArticleSaveResult(receipt)).toBeNull();
  });

  it.each([
    { workingDraftVersion: 0 }, { workingDraftUpdatedAt: null }, { canonicalStatus: "review" },
  ])("rejects inconsistent working-draft receipt markers even without a caller context %j", patch => {
    const receipt = workingDraft();
    Object.assign(receipt.receipt, patch);
    expect(parseArticleSaveResult(receipt)).toBeNull();
  });

  it.each([{ articleUpdatedAt: previous }, { workingDraftVersion: 1 }])(
    "rejects a new-article context retaining old canonical state %j", patch => {
      const newContext = { articleId: null, articleUpdatedAt: null, englishUpdatedAt: null, workingDraftVersion: 0 };
      expect(parseArticleSaveResult(canonical(), { ...newContext, ...patch })).toBeNull();
    }
  );

  it("rejects an existing canonical context without the original RU CAS", () => {
    expect(parseArticleSaveResult(canonical(), { ...context, articleUpdatedAt: null })).toBeNull();
  });

  it.each([
    { articleUpdatedAt: next }, { articleUpdatedAt: "2026-10-07T12:00:00.123455+00:00" },
    { englishUpdatedAt: null }, { englishUpdatedAt: englishNext },
    { workingDraftVersion: 3 }, { workingDraftVersion: 5 },
    { workingDraftUpdatedAt: null }, { canonicalStatus: "draft" },
  ])("rejects working-draft receipts that replace canonical state or skip the submitted version %j", patch => {
    const receipt = workingDraft();
    Object.assign(receipt.receipt, patch);
    expect(parseArticleSaveResult(receipt, context)).toBeNull();
  });

  it.each([
    { articleId: null }, { articleUpdatedAt: null }, { articleUpdatedAt: "malformed" },
    { articleId: "not-a-uuid" }, { workingDraftVersion: -1 }, { workingDraftVersion: 1.5 },
    { workingDraftVersion: Number.NaN }, { workingDraftVersion: Number.POSITIVE_INFINITY },
    { workingDraftVersion: Number.MAX_SAFE_INTEGER },
  ])("rejects invalid submitted working-draft context %j", patch => {
    expect(parseArticleSaveResult(workingDraft(), { ...context, ...patch })).toBeNull();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid canonical context draft version %s", workingDraftVersion => {
      expect(parseArticleSaveResult(canonical(), { ...context, workingDraftVersion })).toBeNull();
    }
  );

  it("allows the last safe working-draft version without rounding it", () => {
    const receipt = workingDraft();
    receipt.receipt.workingDraftVersion = Number.MAX_SAFE_INTEGER;
    expect(parseArticleSaveResult(receipt, { ...context, workingDraftVersion: Number.MAX_SAFE_INTEGER - 1 })).toEqual(receipt);
  });

  it("accepts equivalent canonical working-draft RU timestamps while retaining their original bytes", () => {
    const receipt = workingDraft();
    receipt.receipt.articleUpdatedAt = "2026-10-07T15:00:00.1234560+03:00";
    expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
    expect(receipt.receipt.articleUpdatedAt).toBe("2026-10-07T15:00:00.1234560+03:00");
  });
});

describe("article save revision precision", () => {
  it.each([
    [next, previous, 1], [previous, next, -1],
    ["2026-10-07T12:00:00.000001Z", "2026-10-07T12:00:00Z", 1],
    ["2026-10-07T12:00:00.999999Z", "2026-10-07T12:00:01Z", -1],
    ["2026-10-07T12:00:01.000000Z", "2026-10-07T12:00:00.999999Z", 1],
    ["2026-10-07T12:00:00.123456789Z", "2026-10-07T12:00:00.123456788Z", 1],
    ["2026-10-07T12:00:00.100000Z", "2026-10-07T12:00:00.099999Z", 1],
    [previous, previous, 0],
    ["2026-10-07T15:00:00.1234560+03:00", previous, 0],
    ["2026-10-07T07:00:00.123456-05:00", previous, 0],
    ["2026-10-07T12:00:00Z", "2026-10-07T12:00:00.000000+00:00", 0],
  ] as const)("compares %s to %s as %s without Date millisecond truncation", (left, right, expected) => {
    expect(compareArticleSaveRevisions(left, right)).toBe(expected);
  });

  it.each(["", "2026-10-07", "2026-10-07T12:00:00", "2026-02-30T12:00:00Z", "2026-10-07T25:00:00Z", "not-a-revision"])(
    "rejects malformed revisions on either side (%s)", invalid => {
      expect(compareArticleSaveRevisions(invalid, previous)).toBeNull();
      expect(compareArticleSaveRevisions(previous, invalid)).toBeNull();
    }
  );
});

describe("article acknowledgement destination", () => {
  it.each([
    `/articles/edit?id=${articleId}`, `/articles/edit?id=${articleId.toUpperCase()}&saved=1`,
    `/articles/${articleId}/preview?locale=ru`, `/articles/${articleId}/preview?locale=en&saved=1`,
  ])("accepts only local navigation to the acknowledged article (%s)", destination => {
    const receipt = { ...canonical(), destination };
    expect(parseArticleSaveResult(receipt, context)).toEqual(receipt);
  });

  it.each([
    "/articles/edit", `/articles/edit?id=${foreignId}`, `/articles/edit?id=${articleId}&id=${articleId}`,
    `/articles/edit?id=${articleId}&id=${foreignId}`, `/articles/edit?id=${articleId}#untrusted`,
    `/articles/${foreignId}/preview?locale=ru`, `/articles/${articleId}/preview`,
    `/articles/${articleId}/preview?locale=de`, `/articles/${articleId}/preview?locale=ru&locale=en`,
    `/ARTICLES/${articleId}/PREVIEW?locale=ru`, `/articles/${articleId}/preview/other?locale=ru`,
    `/pages/edit?id=${articleId}`, `/articles/new?id=${articleId}&saved=1`,
    `articles/edit?id=${articleId}`, `//evil.fixture.invalid/articles/edit?id=${articleId}`,
    `https://evil.fixture.invalid/articles/edit?id=${articleId}`, `https://admin.fixture.invalid/articles/edit?id=${articleId}`,
    `javascript:location='/articles/edit?id=${articleId}'`, `/\\evil.fixture.invalid/articles/edit?id=${articleId}`,
    `/articles/edit?id=${articleId}\u0000`, `/articles/edit?id=${articleId}\n`,
  ])("rejects foreign, ambiguous or malformed navigation (%s)", destination => {
    expect(parseArticleSaveResult({ ...canonical(), destination }, context)).toBeNull();
    expect(parseArticleSaveResult({ ...canonical(), destination })).toBeNull();
  });
});

describe("article action result schema", () => {
  it.each([
    { outcome: "rejected", reason: "validation" }, { outcome: "rejected", reason: "english-validation" },
    { outcome: "rejected", reason: "content" }, { outcome: "rejected", reason: "english-content" },
    { outcome: "rejected", reason: "media" }, { outcome: "rejected", reason: "permission" },
    { outcome: "rejected", reason: "schedule" }, { outcome: "dependency-unavailable" },
    { outcome: "unknown-outcome" }, { outcome: "conflict", scope: "article" }, { outcome: "conflict", scope: "english" },
  ])("preserves known non-acknowledged outcomes separately (%j)", result => {
    expect(parseArticleSaveResult(result, context)).toEqual(result);
  });

  it.each([
    null, undefined, [], "?saved=1", "saved=working-draft", { saved: "1" }, { outcome: "success" },
    { outcome: "saved" }, { outcome: "rejected" }, { outcome: "rejected", reason: "raw-provider-message" },
    { outcome: "conflict", scope: "other" }, { outcome: "dependency-unavailable", receipt: {} },
    { outcome: "unknown-outcome", error: "RAW_SECRET" }, { ...canonical(), extra: "RAW_SECRET" },
  ])("rejects missing, URL-only and unexpected result shapes (%j)", result => {
    expect(parseArticleSaveResult(result, context)).toBeNull();
  });

  it.each(["persistence", "receipt", "publicationState", "revalidationState", "destination"] as const)(
    "requires acknowledged result field %s", field => {
      const result = { ...canonical() } as Record<string, unknown>;
      delete result[field];
      expect(parseArticleSaveResult(result, context)).toBeNull();
    }
  );

  it.each([
    ["persistence", "saved"], ["persistence", []], ["publicationState", "published"],
    ["publicationState", true], ["revalidationState", "complete"], ["destination", null], ["receipt", []],
  ])("rejects invalid result %s = %j", (field, value) => {
    expect(parseArticleSaveResult({ ...canonical(), [field]: value }, context)).toBeNull();
  });

  it.each(["articleId", "articleUpdatedAt", "englishUpdatedAt", "workingDraftVersion", "workingDraftUpdatedAt", "canonicalStatus"] as const)(
    "requires explicit receipt field %s, including nullable fields", field => {
      const result = canonical();
      const receipt = { ...result.receipt } as Record<string, unknown>;
      delete receipt[field];
      expect(parseArticleSaveResult({ ...result, receipt }, context)).toBeNull();
    }
  );

  it.each([
    { articleId: "invalid" }, { articleId: null },
    { articleUpdatedAt: null }, { articleUpdatedAt: "2026-10-07" },
    { englishUpdatedAt: false }, { englishUpdatedAt: "malformed" },
    { workingDraftVersion: "0" }, { workingDraftVersion: -1 }, { workingDraftVersion: 0.5 },
    { workingDraftVersion: Number.MAX_SAFE_INTEGER + 1 },
    { workingDraftUpdatedAt: false }, { workingDraftUpdatedAt: "malformed" },
    { canonicalStatus: "deleted" }, { canonicalStatus: ["draft"] }, { rawError: "RAW_SECRET" },
  ])("rejects malformed or extra receipt fields (%j)", patch => {
    const result = canonical();
    expect(parseArticleSaveResult({ ...result, receipt: { ...result.receipt, ...patch } }, context)).toBeNull();
  });
});
