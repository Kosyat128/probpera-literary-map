import { describe, expect, it } from "vitest";

import { captureArticleOperationIntent } from "./article-operation-intent";
import { articleOperationSaveResult, parseArticleOperationResult } from "./article-operation-result";
import { parseArticleSaveResult, type ArticleWorkingDraftReceipt } from "./article-save-result";

const id = "a1111111-b222-4333-8444-c55555555555";
const operationId = "11111111-2222-4333-8444-555555555555";
const before = "2026-10-07T12:00:00.123456+00:00";
const after = "2026-10-07T12:00:00.123457+00:00";
const englishBefore = "2026-10-07T11:00:00.654321+00:00";
const englishAfter = "2026-10-07T11:00:00.654322+00:00";
const draftStamp = "2026-10-07T13:00:00.000001+00:00";

function context(intent = "publish", version = "3", english = englishBefore) {
  const input = new FormData();
  for (const [key, value] of Object.entries({ id, intent, working_draft_version: version,
    expected_updated_at: before, english_expected_updated_at: english,
    title: "Ручной RU", english_title: "Manual private EN B", english_enabled: "on" })) input.set(key, value);
  const submittedIntent = captureArticleOperationIntent(input);
  if (!submittedIntent) throw new Error("Invalid fixture context");
  return { operationId, submittedIntent };
}

function promotion(status = "published", write: "preserved" | "status-only" = "preserved") {
  const workingDraft: ArticleWorkingDraftReceipt = {
    scope: "english-only", version: 4, updatedAt: draftStamp, baseArticleUpdatedAt: after,
    englishExpectedUpdatedAt: write === "preserved" ? englishBefore : englishAfter,
    englishWrite: "preserved", englishEnabled: true,
  };
  return {
    version: 1, operationId, entityType: "article", requestedEntityId: id,
    intent: "publish", persistence: "working-draft-promotion", replayed: false,
    englishWrite: write, canonicalStatus: status, workingDraft,
    result: { article_id: id, article_updated_at: after,
      english_updated_at: write === "preserved" ? null : englishAfter, homepage_replaced: 0 },
  };
}

function privateSave(status = "published", write: "saved" | "preserved" = "saved") {
  const workingDraft: ArticleWorkingDraftReceipt = {
    scope: "bundle", version: 4, updatedAt: draftStamp, baseArticleUpdatedAt: before,
    englishExpectedUpdatedAt: englishBefore, englishWrite: write, englishEnabled: write === "saved",
  };
  return {
    version: 1, operationId, entityType: "article", requestedEntityId: id,
    intent: "save", persistence: "working-draft", replayed: false,
    englishWrite: write, canonicalStatus: status, workingDraft,
    result: { articleId: id, version: 4, updatedAt: draftStamp },
  };
}

describe("private English receipt preserves canonical and private boundaries", () => {
  it.each(["published", "scheduled", "hidden", "archived"].flatMap(status =>
    (["preserved", "status-only"] as const).flatMap(write => [false, true].map(replayed => ({ status, write, replayed })))
  ))("projects the original residual receipt $status/$write/replay=$replayed", ({ status, write, replayed }) => {
    const value = { ...promotion(status, write), replayed };
    const original = structuredClone(value), trusted = context(), trustedBefore = structuredClone(trusted);
    expect(parseArticleOperationResult(value, trusted)).toEqual(value);
    expect(articleOperationSaveResult(value, trusted)).toMatchObject({
      outcome: "saved", persistence: "working-draft-promotion", englishState: write,
      receipt: { articleUpdatedAt: after, englishUpdatedAt: value.result.english_updated_at,
        workingDraftVersion: 4, workingDraftUpdatedAt: draftStamp, workingDraft: value.workingDraft },
      publicationState: "unknown", revalidationState: "unknown",
    });
    expect(value).toEqual(original);
    expect(trusted).toEqual(trustedBefore);
    // Prior A retention proves neither the new manual B nor a canonical EN write.
    expect(articleOperationSaveResult(value, trusted)?.receipt.workingDraft?.englishWrite).toBe("preserved");
  });

  it.each(["published", "scheduled", "hidden", "archived"].flatMap(status =>
    (["saved", "preserved"] as const).map(write => ({ status, write }))
  ))("accepts private saves without demoting canonical $status/$write", ({ status, write }) => {
    const value = privateSave(status, write);
    expect(parseArticleOperationResult(value, context("save"))).toEqual(value);
    expect(articleOperationSaveResult(value, context("save"))).toMatchObject({
      receipt: { canonicalStatus: status, articleUpdatedAt: before, englishUpdatedAt: englishBefore,
        workingDraftVersion: 4, workingDraft: value.workingDraft },
    });
  });

  it("keeps null canonical English distinct from raw mode-none null", () => {
    const value = promotion();
    value.workingDraft.englishExpectedUpdatedAt = null;
    expect(articleOperationSaveResult(value, context("publish", "3", ""))?.receipt.workingDraft?.englishExpectedUpdatedAt).toBeNull();
    expect(articleOperationSaveResult(value, context())?.receipt.workingDraft?.englishExpectedUpdatedAt).toBeNull();
  });

  it.each([englishAfter, null])("adopts the committed private EN CAS after an independent canonical change (%s)", englishExpectedUpdatedAt => {
    const value = promotion(), trusted = context(), beforeContext = structuredClone(trusted);
    value.workingDraft.englishExpectedUpdatedAt = englishExpectedUpdatedAt;
    const result = articleOperationSaveResult(value, trusted);
    expect(result).toMatchObject({ englishState: "preserved", receipt: { englishUpdatedAt: null,
      workingDraft: { englishExpectedUpdatedAt, englishWrite: "preserved" } } });
    expect(trusted).toEqual(beforeContext);
  });

  it("accepts equivalent technical revision formats without losing precise stored receipt bytes", () => {
    const value = promotion();
    value.workingDraft.baseArticleUpdatedAt = "2026-10-07T15:00:00.123457+03:00";
    value.workingDraft.englishExpectedUpdatedAt = "2026-10-07T14:00:00.654321+03:00";
    expect(parseArticleOperationResult(value, context())).toEqual(value);
    value.workingDraft.englishExpectedUpdatedAt = "2026-10-07T14:00:00.654322+03:00";
    expect(parseArticleOperationResult(value, context())).toEqual(value);
  });

  it.each([
    { scope: "bundle" }, { scope: "other" }, { version: 3 }, { version: 5 },
    { version: "4" }, { version: Number.MAX_SAFE_INTEGER + 1 }, { version: 0 },
    { updatedAt: "bad" }, { baseArticleUpdatedAt: before },
    { englishExpectedUpdatedAt: "invalid" }, { englishExpectedUpdatedAt: 1 },
    { englishWrite: "saved" }, { englishEnabled: "false" }, { payload: { title: "Injected body" } },
  ])("refuses malformed or unbound residual metadata %j", patch => {
    const value = promotion();
    expect(parseArticleOperationResult({ ...value, workingDraft: { ...value.workingDraft, ...patch } }, context())).toBeNull();
  });

  it.each([
    { persistence: "article-bundle" }, { canonicalStatus: "draft" }, { canonicalStatus: "review" },
    { englishWrite: "saved" }, { intent: "save" }, { workingDraft: null },
  ])("refuses contradictory canonical release envelopes %j", patch => {
    expect(parseArticleOperationResult({ ...promotion(), ...patch }, context())).toBeNull();
  });

  it("refuses forged mirrored receipt versions, stamps and scope proofs", () => {
    const trusted = context();
    const result = articleOperationSaveResult(promotion(), trusted)!;
    const saveContext = { operationId, articleId: id, articleUpdatedAt: before,
      englishUpdatedAt: englishBefore, workingDraftVersion: 3 };
    expect(parseArticleSaveResult(result, saveContext)).toEqual(result);
    for (const patch of [{ workingDraftVersion: 0 }, { workingDraftUpdatedAt: null },
      { workingDraftUpdatedAt: after }, { articleUpdatedAt: before }]) {
      expect(parseArticleSaveResult({ ...result, receipt: { ...result.receipt, ...patch } }, saveContext)).toBeNull();
    }
    expect(parseArticleSaveResult(result, { ...saveContext, workingDraftVersion: 0 })).toBeNull();
    expect(parseArticleSaveResult(result, { ...saveContext, articleId: null, articleUpdatedAt: null, workingDraftVersion: 0 })).toBeNull();
  });

  it.each([{ scope: "english-only" }, { version: 5 }, { updatedAt: after },
    { englishWrite: "preserved" }, { englishEnabled: false }, { englishExpectedUpdatedAt: englishAfter }])(
    "refuses incomplete private-save confirmation %j", patch => {
      const value = privateSave();
      expect(parseArticleOperationResult({ ...value, workingDraft: { ...value.workingDraft, ...patch } }, context("save"))).toBeNull();
    });

  it("retains old receipts as old truth, including full bilingual release and published private save", () => {
    const { workingDraft: _residual, ...full } = promotion();
    const bilingual = { ...full, englishWrite: "saved", result: { ...full.result, english_updated_at: englishAfter } };
    expect(articleOperationSaveResult(bilingual, context())).toMatchObject({
      englishState: "saved", receipt: { workingDraftVersion: 0, workingDraftUpdatedAt: null },
    });
    const { workingDraft: _private, ...oldPrivate } = privateSave();
    expect(articleOperationSaveResult(oldPrivate, context("save"))).toMatchObject({ receipt: { workingDraftVersion: 4 } });
    expect(parseArticleOperationResult({ ...oldPrivate, canonicalStatus: "hidden" }, context("save"))).toBeNull();
  });
});
