import { describe, expect, it, vi } from "vitest";
import { beginCatalogTranslationOperation, dispatchCatalogTranslationOperation, getCatalogTranslationOperationArtifacts,
  parseCatalogTranslationOperationReceipt, type CatalogTranslationOperationArtifacts, type CatalogTranslationOperationIntent,
  type CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";
import { retainedCatalogTranslationPass } from "./catalog-translation-operation";

const ids = { jobId: "11111111-1111-4111-8111-111111111111", itemId: "22222222-2222-4222-8222-222222222222",
  operationId: "33333333-3333-4333-8333-333333333333", actorId: "44444444-4444-4444-8444-444444444444" };
const revision = { id: "55555555-5555-4555-8555-555555555555", updatedAt: "2026-10-30T10:00:00.123456+00:00" };
const configuration = { version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-repair-reviewer",
  twoPassReview: true, translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none",
  reviewerReasoningMode: "standard", promptFingerprint: "d".repeat(64) } as const;
const finished = { state: "translated", errorCode: null, persistence: "working-draft", draftId: "66666666-6666-4666-8666-666666666666",
  draftVersion: 1, draftUpdatedAt: revision.updatedAt, candidateHash: "f".repeat(64), publication: "unchanged", humanReview: "pending" };
function setup(entityType: "literary_work" | "country") {
  const book = entityType === "literary_work", identity = { entityType, entityId: book ? "77777777-7777-4777-8777-777777777777" : "controlled-country" };
  const intent: CatalogTranslationOperationIntent = { ...ids, ...identity, provider: "cloudflare", sourceHash: "a".repeat(64), sourceSnapshot: { immutableProviderProjection: true },
    sourceRevision: book ? { workId: identity.entityId, workUpdatedAt: revision.updatedAt, russianId: revision.id, russianUpdatedAt: revision.updatedAt }
      : { overrideId: revision.id, overrideUpdatedAt: revision.updatedAt, catalogSourceHash: "b".repeat(64) },
    targetRevision: revision, expectedState: { version: 1, retainedFullRightsBinding: true },
    configuration: { ...configuration, schemaName: book ? "probpera_literary_work_translation" : "probpera_country_profile_translation", maxOutputTokens: book ? 4000 : 12000 },
    currentCursor: { [book ? "libraryCursor" : "countryCursor"]: 2 }, resumeCursor: { [book ? "libraryCursor" : "countryCursor"]: 3 } };
  const receipt = (patch: Record<string, unknown> = {}) => ({ version: 1, ...ids, ...identity, provider: intent.provider, sourceHash: intent.sourceHash,
    rawSeedHash: "9".repeat(64), intentHash: "e".repeat(64), configurationHash: "c".repeat(64), configuration: intent.configuration,
    sourceRevision: intent.sourceRevision, targetRevision: revision, jobVersion: "1", phase: "running", canExecute: true, canDispatch: false,
    replayed: false, providerCalls: 0, pendingCallId: null, blockReason: null, resumeCursor: intent.currentCursor, result: null, ...patch });
  return { identity, intent, receipt };
}

describe.each(["literary_work", "country"] as const)("Catalog %s capabilities and full server-seed bindings", entityType => {
  it("forwards expected state and separate current/next cursors without accepting client raw seed", async () => {
    const { intent, receipt } = setup(entityType), rpc = vi.fn(async (..._args: unknown[]) => ({ data: receipt(), error: null }));
    expect((await beginCatalogTranslationOperation({ rpc } as never, intent)).canExecute).toBe(true);
    expect(rpc.mock.calls[0]).toEqual(["begin_catalog_translation_operation", expect.objectContaining({
      p_entity_type: entityType, p_entity_id: intent.entityId, p_expected_state: intent.expectedState,
      p_current_cursor: intent.currentCursor, p_resume_cursor: intent.resumeCursor,
    })]);
    expect(Object.keys(rpc.mock.calls[0][1] as object)).not.toContain("p_raw_seed");
  });
  it.each(["operation", "actor", "source", "configuration", "replayed capability", "entity kind"])("rejects mismatched %s before authorizing work", async mismatch => {
    const { intent, receipt } = setup(entityType), patch: Record<string, unknown> = mismatch === "operation" ? { operationId: revision.id }
      : mismatch === "actor" ? { actorId: revision.id } : mismatch === "source" ? { sourceHash: "0".repeat(64) }
        : mismatch === "configuration" ? { configuration: { ...intent.configuration, model: "another-model" } }
          : mismatch === "replayed capability" ? { replayed: true } : { entityType: "writer_biography" };
    const rpc = vi.fn(async () => ({ data: receipt(patch), error: null }));
    await expect(beginCatalogTranslationOperation({ rpc } as never, intent)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("binds dispatch replies to the original server seed even when row timestamps match", async () => {
    const { receipt } = setup(entityType), prior = receipt({ canExecute: false, replayed: true }) as CatalogTranslationOperationReceipt;
    const rpc = vi.fn(async () => ({ data: receipt({ canExecute: false, canDispatch: true, providerCalls: 1,
      pendingCallId: revision.id, rawSeedHash: "0".repeat(64) }), error: null }));
    await expect(dispatchCatalogTranslationOperation({ rpc } as never, prior, { callId: revision.id, provider: "cloudflare", model: configuration.model,
      pass: "translation", requestHash: "8".repeat(64) })).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
  });
  it.each([
    ["borrowed draft identity", { persistence: "private-artifact" }],
    ["missing draft version", { draftVersion: null }],
    ["candidate without human-pending", { humanReview: "unchanged" }],
    ["candidate with no persistence", { persistence: "none", draftId: null, draftVersion: null, draftUpdatedAt: null }],
  ])("rejects mixed completion: %s", (_name, patch) => {
    const { receipt, identity } = setup(entityType);
    expect(parseCatalogTranslationOperationReceipt(receipt({ phase: "finished", canExecute: false, result: { ...finished, ...patch } }), identity)).toBeNull();
  });
  it("retained-only complete output cannot borrow another pending draft identity", () => {
    const { receipt, identity } = setup(entityType);
    expect(parseCatalogTranslationOperationReceipt(receipt({ phase: "finished", canExecute: false, result: { ...finished, state: "conflict", errorCode: "write_conflict",
      persistence: "private-artifact", draftId: null, draftVersion: null, draftUpdatedAt: null } }), identity)?.result).toMatchObject({ persistence: "private-artifact", draftId: null });
  });
  it("private raw body without an acknowledged dispatched call is rejected", async () => {
    const { receipt, intent } = setup(entityType), target = receipt({ canExecute: false, replayed: true, providerCalls: 1 }) as CatalogTranslationOperationReceipt;
    const data = { version: 1, receipt: target, expectedState: intent.expectedState, rawSeed: { version: 1, fullServerRights: "private" },
      sourceSnapshot: intent.sourceSnapshot, sourceRevision: intent.sourceRevision, targetRevision: revision, configuration: intent.configuration,
      calls: [{ requestHash: "8".repeat(64), metadata: { callId: revision.id, provider: "cloudflare", model: configuration.model, pass: "translation",
        dispatchRecordedAt: revision.updatedAt, responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null },
      responseArtifact: { version: 1, body: { response: "Private prose" } } }], candidate: null };
    const rpc = vi.fn(async () => ({ data, error: null }));
    await expect(getCatalogTranslationOperationArtifacts({ rpc } as never, target)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
  });
});

describe("Retained catalog completion preserves optional review and repair semantics", () => {
  it.each([
    [false, ["translation"], true, null],
    [false, ["translation", "repair"], true, "controlled-repair-reviewer"],
    [true, ["translation", "review"], true, "controlled-repair-reviewer"],
    [true, ["translation", "repair", "review", "repair"], true, "controlled-repair-reviewer"],
    [true, ["translation"], false, null],
    [false, ["translation", "review"], false, null],
  ] as const)("review=%s passes=%j is complete=%s", (review, passes, complete, reviewerModel) => {
    const { intent, receipt } = setup("literary_work");
    const artifact = { version: 1, receipt: receipt({ canExecute: false, replayed: true, providerCalls: passes.length }), expectedState: intent.expectedState,
      rawSeed: { version: 1 }, sourceSnapshot: intent.sourceSnapshot, sourceRevision: intent.sourceRevision, targetRevision: revision,
      configuration: { ...intent.configuration, twoPassReview: review }, candidate: null,
      calls: passes.map((pass, index) => ({ requestHash: "8".repeat(64), metadata: { callId: `88888888-8888-4888-8888-${String(index + 1).padStart(12, "0")}`,
        provider: "cloudflare", model: index ? configuration.reviewerModel : configuration.model, pass, dispatchRecordedAt: revision.updatedAt,
        responseReceivedAt: revision.updatedAt, httpStatus: 200, requestId: null, responseId: `retained-${index}`, inputTokens: 1, outputTokens: 1 },
      responseArtifact: { version: 1, body: { response: JSON.stringify({ description: "A retained private description." }) } } })) } as CatalogTranslationOperationArtifacts;
    const retained = retainedCatalogTranslationPass(artifact);
    expect(retained !== null).toBe(complete);
    if (complete) { expect(retained?.value).toEqual({ description: "A retained private description." }); expect(retained?.provenance.reviewerModel).toBe(reviewerModel); }
  });
});
