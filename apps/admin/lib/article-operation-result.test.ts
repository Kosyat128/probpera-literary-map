import { describe, expect, it } from "vitest";

import { captureArticleOperationIntent } from "./article-operation-intent";
import {
  articleOperationSaveResult,
  parseArticleOperationResult,
  type ArticleOperationResultContext,
} from "./article-operation-result";

const articleId = "a1111111-b222-4333-8444-c55555555555";
const generatedId = "d1111111-e222-4333-8444-f55555555555";
const operationId = "11111111-2222-4333-8444-555555555555";
const foreignOperationId = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const ruBefore = "2026-10-07T12:00:00.123456+00:00";
const enBefore = "2026-10-07T11:00:00.654321+00:00";
const ruAfter = "2026-10-07T12:00:00.123457+00:00";
const enAfter = "2026-10-07T11:00:00.654322+00:00";

function context(patch: Record<string, string | undefined> = {}): ArticleOperationResultContext {
  const input = new FormData();
  for (const [name, value] of Object.entries({ id: articleId, intent: "save", expected_updated_at: ruBefore,
    english_expected_updated_at: enBefore, working_draft_version: "3", preview_locale: "en",
    title: "Ручной RU заголовок", english_title: "Manual EN title", sources: "Ручной источник\r\nВторая строка",
    english_sources: "Manual EN source\nSecond line", ...patch })) {
    if (value !== undefined) input.set(name, value);
  }
  const submittedIntent = captureArticleOperationIntent(input);
  if (!submittedIntent) throw new Error("Invalid operation result test context");
  return { operationId, submittedIntent };
}
function bundle(patch: Record<string, unknown> = {}) {
  return {
    version: 1,
    operationId,
    entityType: "article",
    requestedEntityId: articleId,
    intent: "save",
    persistence: "article-bundle",
    replayed: false,
    result: { article_id: articleId, article_updated_at: ruAfter, english_updated_at: enAfter, homepage_replaced: 0 },
    canonicalStatus: "draft",
    ...patch,
  };
}
function draft(patch: Record<string, unknown> = {}) {
  return bundle({ persistence: "working-draft", canonicalStatus: "published",
    result: { articleId, version: 4, updatedAt: ruAfter }, ...patch });
}

// A stored operation result acknowledges a DB write only. The projection does
// not invent completed publication/cache effects or cleanup author snapshots.
describe("article operation result acknowledges only the matching submitted command", () => {
  it.each([false, true])("accepts a strict canonical envelope with replayed=%s and retains raw precise revisions", replayed => {
    const value = bundle({ replayed });
    const original = structuredClone(value);
    expect(parseArticleOperationResult(value, context())).toEqual(value);
    expect(Object.keys(parseArticleOperationResult(value, context())!)).toHaveLength(9);
    expect(articleOperationSaveResult(value, context())).toEqual({
      operationId,
      englishState: "unknown",
      outcome: "saved", persistence: "article-bundle",
      receipt: { articleId, articleUpdatedAt: ruAfter, englishUpdatedAt: enAfter,
        workingDraftVersion: 0, workingDraftUpdatedAt: null, canonicalStatus: "draft" },
      publicationState: "unknown", revalidationState: "unknown", destination: `/articles/edit?id=${articleId}`,
    });
    expect(value).toEqual(original);
  });

  it.each(["saved", "status-only"] as const)("projects the actual SQL English write scope %s without treating a status revision as text save", englishWrite => {
    const value = bundle({ englishWrite });
    expect(parseArticleOperationResult(value, context())).toEqual(value);
    expect(articleOperationSaveResult(value, context())).toMatchObject({ operationId, englishState: englishWrite,
      receipt: { englishUpdatedAt: enAfter } });
  });
  it("projects preserved English from bundle mode none and disabled draft while retaining original draft CAS", () => {
    const value = bundle({ englishWrite: "preserved", result: { ...bundle().result, english_updated_at: null } });
    expect(articleOperationSaveResult(value, context())).toMatchObject({ englishState: "preserved", receipt: { englishUpdatedAt: null } });
    expect(articleOperationSaveResult(draft({ englishWrite: "preserved" }), context())).toMatchObject({ englishState: "preserved", receipt: { englishUpdatedAt: enBefore } });
  });
  it("rejects write scope inconsistent with actual persisted receipt kind", () => {
    expect(parseArticleOperationResult(bundle({ englishWrite: "saved", result: { ...bundle().result, english_updated_at: null } }), context())).toBeNull();
    expect(parseArticleOperationResult(bundle({ englishWrite: "preserved" }), context())).toBeNull();
    expect(parseArticleOperationResult(draft({ englishWrite: "status-only" }), context())).toBeNull();
    expect(parseArticleOperationResult(bundle({ englishWrite: "unknown" }), context())).toBeNull();
  });

  it.each([false, true])("projects published working draft replayed=%s with original live RU/EN CAS and only version+1", replayed => {
    const value = draft({ replayed });
    expect(parseArticleOperationResult(value, context())).toEqual(value);
    expect(articleOperationSaveResult(value, context())).toMatchObject({ persistence: "working-draft",
      receipt: { articleId, articleUpdatedAt: ruBefore, englishUpdatedAt: enBefore,
        workingDraftVersion: 4, workingDraftUpdatedAt: ruAfter, canonicalStatus: "published" },
      publicationState: "unknown", revalidationState: "unknown" });
  });

  it.each([false, true])("projects a matching publish promotion replayed=%s and resets the adopted private draft context", replayed => {
    const trusted = context({ intent: "publish" });
    const value = bundle({ intent: "publish", persistence: "working-draft-promotion", canonicalStatus: "hidden", replayed });
    expect(parseArticleOperationResult(value, trusted)).toEqual(value);
    expect(articleOperationSaveResult(value, trusted)).toMatchObject({ persistence: "working-draft-promotion",
      receipt: { articleUpdatedAt: ruAfter, workingDraftVersion: 0, workingDraftUpdatedAt: null, canonicalStatus: "hidden" },
      publicationState: "unknown", revalidationState: "unknown" });
  });

  it("allows a new operation to return its assigned identity without claiming a source-copy identity", () => {
    const trusted = context({ id: undefined, expected_updated_at: undefined,
      english_expected_updated_at: undefined, working_draft_version: undefined });
    const value = bundle({ requestedEntityId: null,
      result: { ...bundle().result, article_id: generatedId } });
    expect(parseArticleOperationResult(value, trusted)).toEqual(value);
    expect(articleOperationSaveResult(value, trusted)).toMatchObject({ receipt: { articleId: generatedId },
      destination: `/articles/edit?id=${generatedId}` });
    expect(parseArticleOperationResult({ ...value, requestedEntityId: articleId }, trusted)).toBeNull();
  });

  it("keeps preserved-English null acknowledgement compatible rather than guessing the dynamic English mode", () => {
    const value = bundle({ result: { ...bundle().result, english_updated_at: null } });
    expect(parseArticleOperationResult(value, context())).toEqual(value);
    expect(articleOperationSaveResult(value, context())?.receipt.englishUpdatedAt).toBeNull();
    const trusted = context({ english_expected_updated_at: undefined });
    const working = draft();
    expect(articleOperationSaveResult(working, trusted)?.receipt.englishUpdatedAt).toBeNull();
  });

  it.each(["ru", "en"])("derives an internal preview destination from frozen submitted locale %s", preview_locale => {
    const trusted = context({ intent: "preview", preview_locale });
    const value = bundle({ intent: "preview" });
    expect(articleOperationSaveResult(value, trusted)?.destination).toBe(`/articles/${articleId}/preview?locale=${preview_locale}`);
    expect(articleOperationSaveResult(draft({ intent: "preview" }), trusted)?.destination)
      .toBe(`/articles/${articleId}/preview?locale=${preview_locale}`);
  });

  it("accepts UUID case equivalence while retaining exact raw DB envelope bytes", () => {
    const trusted = context({ id: articleId.toUpperCase() });
    trusted.operationId = operationId.toUpperCase();
    const value = bundle();
    expect(parseArticleOperationResult(value, trusted)).toEqual(value);
    expect(articleOperationSaveResult(value, trusted)?.receipt.articleId).toBe(articleId);
  });

  it("supports the last safe draft increment and rejects overflow of the original version", () => {
    const trusted = context({ working_draft_version: String(Number.MAX_SAFE_INTEGER - 1) });
    const value = draft({ result: { articleId, version: Number.MAX_SAFE_INTEGER, updatedAt: ruAfter } });
    expect(parseArticleOperationResult(value, trusted)).toEqual(value);
    expect(parseArticleOperationResult(value, context({ working_draft_version: String(Number.MAX_SAFE_INTEGER) }))).toBeNull();
  });
});

describe("article operation result refuses forged bindings and incomplete acknowledgement", () => {
  it.each([
    { operationId: foreignOperationId }, { requestedEntityId: generatedId }, { requestedEntityId: null },
    { intent: "preview" }, { entityType: "page" }, { version: 2 },
  ])("rejects another operation, entity or submitted intent %j", patch => {
    expect(parseArticleOperationResult(bundle(patch), context())).toBeNull();
    expect(articleOperationSaveResult(bundle(patch), context())).toBeNull();
  });

  it("rejects a malformed trusted operation ID or internally mismatched frozen submitted context", () => {
    expect(parseArticleOperationResult(bundle(), { ...context(), operationId: "not-a-uuid" })).toBeNull();
    const trusted = context();
    trusted.submittedIntent = { ...trusted.submittedIntent, entityId: generatedId };
    expect(parseArticleOperationResult(bundle(), trusted)).toBeNull();
  });

  it("refuses a bundle receipt belonging to a foreign entity despite matching outer requested identity", () => {
    const value = bundle({ result: { ...bundle().result, article_id: generatedId } });
    expect(parseArticleOperationResult(value, context())).toBeNull();
    expect(articleOperationSaveResult(value, context())).toBeNull();
  });

  it.each([ruBefore, "2026-10-07T15:00:00.1234560+03:00", "2026-10-07T12:00:00.123455+00:00"])(
    "rejects unchanged or older RU acknowledgement %s using existing precise revision comparison", article_updated_at => {
      expect(parseArticleOperationResult(bundle({ result: { ...bundle().result, article_updated_at } }), context())).toBeNull();
    }
  );

  it.each([enBefore, "2026-10-07T11:00:00.654320+00:00"])(
    "rejects unchanged or older non-null English acknowledgement %s", english_updated_at => {
      expect(parseArticleOperationResult(bundle({ result: { ...bundle().result, english_updated_at } }), context())).toBeNull();
    }
  );

  it("requires a published existing article and exact next version for a working draft", () => {
    expect(parseArticleOperationResult(draft({ canonicalStatus: "draft" }), context())).toBeNull();
    expect(parseArticleOperationResult(draft({ result: { articleId, version: 3, updatedAt: ruAfter } }), context())).toBeNull();
    expect(parseArticleOperationResult(draft({ result: { articleId, version: 5, updatedAt: ruAfter } }), context())).toBeNull();
    const newContext = context({ id: undefined, expected_updated_at: undefined,
      english_expected_updated_at: undefined, working_draft_version: undefined });
    expect(parseArticleOperationResult(draft({ requestedEntityId: null }), newContext)).toBeNull();
  });

  it("rejects promotion unless the trusted existing operation submitted publish", () => {
    expect(parseArticleOperationResult(bundle({ persistence: "working-draft-promotion" }), context())).toBeNull();
    const trusted = context({ id: undefined, expected_updated_at: undefined,
      english_expected_updated_at: undefined, working_draft_version: undefined, intent: "publish" });
    expect(parseArticleOperationResult(bundle({ persistence: "working-draft-promotion", requestedEntityId: null,
      intent: "publish", result: { ...bundle().result, article_id: generatedId } }), trusted)).toBeNull();
  });
});

describe("article operation result accepts only the exact JSON ledger shape", () => {
  it.each([null, undefined, [], [bundle()], "saved", { outcome: "saved" }])(
    "rejects absent, lookup arrays or client banners as a ledger envelope %#", candidate => {
      expect(parseArticleOperationResult(candidate, context())).toBeNull();
    }
  );

  it("requires every envelope key explicitly and rejects extra delivery, hashes or cleanup claims", () => {
    for (const key of Object.keys(bundle())) {
      const incomplete: Record<string, unknown> = { ...bundle() };
      delete incomplete[key];
      expect(parseArticleOperationResult(incomplete, context()), key).toBeNull();
    }
    for (const key of ["destination", "publicationState", "revalidationState", "hash", "cleanupAllowed", "rawError"]) {
      expect(parseArticleOperationResult(bundle({ [key]: "forged" }), context()), key).toBeNull();
    }
    expect(parseArticleOperationResult(bundle({ replayed: "true" }), context())).toBeNull();
    expect(parseArticleOperationResult(bundle({ canonicalStatus: "deleted" }), context())).toBeNull();
  });

  it("rejects missing, extra or incompatible raw result fields for each persistence kind", () => {
    const raw = bundle().result;
    for (const key of Object.keys(raw)) {
      const incomplete: Record<string, unknown> = { ...raw };
      delete incomplete[key];
      expect(parseArticleOperationResult(bundle({ result: incomplete }), context()), key).toBeNull();
    }
    expect(parseArticleOperationResult(bundle({ result: { ...raw, audit: "forged" } }), context())).toBeNull();
    expect(parseArticleOperationResult(bundle({ result: [raw] }), context())).toBeNull();
    expect(parseArticleOperationResult(bundle({ result: draft().result }), context())).toBeNull();
    expect(parseArticleOperationResult(draft({ result: raw }), context())).toBeNull();
    expect(parseArticleOperationResult(draft({ result: { articleId, version: 4, updatedAt: ruAfter, extra: true } }), context())).toBeNull();
  });

  it("rejects malformed timestamps, foreign draft identity, raw integer overflow and legacy string version in the ledger", () => {
    for (const result of [
      { ...bundle().result, article_updated_at: "not-a-stamp" },
      { ...bundle().result, english_updated_at: false },
      { ...bundle().result, homepage_replaced: -1 },
      { ...bundle().result, homepage_replaced: 1.5 },
      { ...bundle().result, homepage_replaced: 2_147_483_648 },
    ]) expect(parseArticleOperationResult(bundle({ result }), context())).toBeNull();
    for (const result of [
      { articleId: generatedId, version: 4, updatedAt: ruAfter },
      { articleId, version: "4", updatedAt: ruAfter },
      { articleId, version: 0, updatedAt: ruAfter },
      { articleId, version: 4.5, updatedAt: ruAfter },
      { articleId, version: Number.MAX_SAFE_INTEGER + 1, updatedAt: ruAfter },
      { articleId, version: 4, updatedAt: null },
    ]) expect(parseArticleOperationResult(draft({ result }), context())).toBeNull();
  });
});
