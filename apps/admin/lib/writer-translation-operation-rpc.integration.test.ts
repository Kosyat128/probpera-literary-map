import { describe, expect, it, vi } from "vitest";
import { beginWriterTranslationOperation, getWriterTranslationOperationArtifacts, parseWriterTranslationOperationReceipt,
  type WriterTranslationOperationIntent, type WriterTranslationOperationReceipt } from "./writer-translation-operation-rpc";

const identity = { countryId: "russia", writerId: "leo_tolstoy" };
const ids = { jobId: "11111111-1111-4111-8111-111111111111", itemId: "22222222-2222-4222-8222-222222222222",
  operationId: "33333333-3333-4333-8333-333333333333", actorId: "44444444-4444-4444-8444-444444444444" };
const revision = { id: "55555555-5555-4555-8555-555555555555", updatedAt: "2026-10-29T20:00:00.123456+00:00" };
const configuration = { version: 1, provider: "cloudflare", model: "synthetic-translator", reviewerModel: "synthetic-reviewer", twoPassReview: true,
  translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none", reviewerReasoningMode: "standard",
  promptFingerprint: "d".repeat(64), schemaName: "probpera_writer_biography_translation", maxOutputTokens: 4000 } as const;
const intent: WriterTranslationOperationIntent = { ...ids, ...identity, provider: "cloudflare", sourceHash: "a".repeat(64), sourceSnapshot: { rawRights: "Unchanged source rights" },
  sourceRevision: { ...identity, overrideId: revision.id, overrideUpdatedAt: revision.updatedAt, catalogSourceHash: "b".repeat(64), replaceEnglishTombstone: false },
  targetRevision: revision, expectedOverrideFields: { rights: "Exact author consent" }, configuration, currentCursor: { writerCursor: 2 }, resumeCursor: { writerCursor: 3 } };
const receipt = (patch: Record<string, unknown> = {}) => ({ version: 1, ...ids, ...identity, entityId: "russia:leo_tolstoy", provider: intent.provider,
  sourceHash: intent.sourceHash, intentHash: "e".repeat(64), configurationHash: "c".repeat(64), configuration,
  sourceRevision: intent.sourceRevision, targetRevision: revision, jobVersion: "1", phase: "running", canExecute: true,
  canDispatch: false, replayed: false, providerCalls: 0, pendingCallId: null, blockReason: null, resumeCursor: intent.currentCursor, result: null, ...patch });
const finishedResult = { state: "translated", errorCode: null, persistence: "working-draft", draftId: "66666666-6666-4666-8666-666666666666", draftVersion: 1,
  draftUpdatedAt: revision.updatedAt, candidateHash: "f".repeat(64), publication: "unchanged", humanReview: "pending" };

describe("Writer durable RPC capabilities are bound and structurally complete", () => {
  it("accepts a consistent admission and forwards current and next cursor separately", async () => {
    const rpc = vi.fn(async () => ({ data: receipt(), error: null }));
    const admitted = await beginWriterTranslationOperation({ rpc } as never, intent);
    expect(admitted.canExecute).toBe(true);
    expect(rpc.mock.calls[0]).toEqual(["begin_writer_translation_operation", expect.objectContaining({
      p_current_cursor: { writerCursor: 2 }, p_resume_cursor: { writerCursor: 3 }, p_expected_override_fields: intent.expectedOverrideFields,
    })]);
  });

  it.each([
    ["wrong operation", { operationId: "77777777-7777-4777-8777-777777777777" }],
    ["wrong actor", { actorId: "77777777-7777-4777-8777-777777777777" }],
    ["wrong source hash", { sourceHash: "0".repeat(64) }],
    ["changed source revision", { sourceRevision: { ...intent.sourceRevision, catalogSourceHash: "0".repeat(64) } }],
    ["changed configuration", { configuration: { ...configuration, model: "another-translator" } }],
    ["dispatch without a prior call", { canDispatch: true }],
    ["execute replayed capability", { replayed: true }],
    ["missing identity", { entityId: "another:writer" }],
  ])("%s cannot authorize initial paid work", async (_name, patch) => {
    const rpc = vi.fn(async () => ({ data: receipt(patch as Record<string, unknown>), error: null }));
    await expect(beginWriterTranslationOperation({ rpc } as never, intent)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["private artifact with another draft ID", { persistence: "private-artifact" }],
    ["draft without its version", { draftVersion: null }],
    ["candidate without pending review", { humanReview: "unchanged" }],
    ["no persistence with candidate hash", { persistence: "none", draftId: null, draftVersion: null, draftUpdatedAt: null }],
    ["translated without a canonical-independent private draft", { persistence: "private-artifact", draftId: null, draftVersion: null, draftUpdatedAt: null }],
  ])("rejects mixed completion receipt: %s", (_name, patch) => {
    const value = receipt({ phase: "finished", canExecute: false, result: { ...finishedResult, ...(patch as Record<string, unknown>) } });
    expect(parseWriterTranslationOperationReceipt(value, identity)).toBeNull();
  });

  it("retained complete candidate has no borrowed pending-slot draft identity", () => {
    const value = receipt({ phase: "finished", canExecute: false, result: { ...finishedResult, state: "conflict", errorCode: "write_conflict",
      persistence: "private-artifact", draftId: null, draftVersion: null, draftUpdatedAt: null } });
    expect(parseWriterTranslationOperationReceipt(value, identity)?.result).toMatchObject({ persistence: "private-artifact", draftId: null, candidateHash: "f".repeat(64) });
  });

  it.each(["wrong operation", "missing dispatched call", "raw body without acknowledgement"])("private read rejects %s", async kind => {
    const bound = receipt({ canExecute: false, replayed: true }) as WriterTranslationOperationReceipt;
    const call = { requestHash: "f".repeat(64), metadata: { callId: "88888888-8888-4888-8888-888888888888", provider: "cloudflare", model: configuration.model,
      pass: "translation", dispatchRecordedAt: revision.updatedAt, responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null,
      inputTokens: null, outputTokens: null }, responseArtifact: { version: 1, body: { response: "Private received prose" } } };
    const data = { version: 1, receipt: { ...bound, ...(kind === "wrong operation" ? { operationId: "77777777-7777-4777-8777-777777777777" } : {}) },
      sourceSnapshot: intent.sourceSnapshot, sourceRevision: intent.sourceRevision, targetRevision: revision,
      expectedOverrideFields: intent.expectedOverrideFields, configuration, calls: kind === "wrong operation" ? [] : [call], candidate: null };
    if (kind === "raw body without acknowledgement") data.receipt.providerCalls = 1;
    const rpc = vi.fn(async () => ({ data, error: null }));
    await expect(getWriterTranslationOperationArtifacts({ rpc } as never, bound)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
  });
});
