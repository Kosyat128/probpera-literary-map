import { describe, expect, it, vi } from "vitest";
import { getRedirectError } from "next/dist/client/components/redirect";
import { attachLibraryTranslationScanOperation, beginLibraryTranslationScan, checkpointLibraryTranslationScanItem,
  continueLibraryTranslationScan, getLibraryTranslationScan, parseLibraryTranslationScanReceipt,
  type LibraryTranslationScanReceipt } from "./library-translation-scan-rpc";
import type { CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";

const id = (prefix: string, n: number) => `${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${String(n).padStart(12, "0")}`;
const scanId = id("1", 1), actorId = id("4", 1), transitionId = id("9", 1);
const configuration = { version: 1, provider: "cloudflare", model: "controlled-translator", reviewerModel: "controlled-reviewer",
  twoPassReview: true, translatorReasoningEffort: "none", translatorReasoningMode: "standard", reviewerReasoningEffort: "none",
  reviewerReasoningMode: "standard", promptFingerprint: "d".repeat(64), schemaName: "probpera_literary_work_translation", maxOutputTokens: 4000 } as const;
function parent(patch: Record<string, unknown> = {}) {
  return { version: 1, scanId, jobId: scanId, jobVersion: "1", actorId, kind: "literary_work", provider: "cloudflare", status: "reviewing",
    configurationHash: "c".repeat(64), windowIndex: 0, predecessorJobId: null, successorJobId: null, upperId: id("b", 6), afterId: null,
    lastId: id("b", 3), membershipHash: "a".repeat(64), totalItems: 3, nextPosition: 0, lastWindow: false, exhausted: false,
    members: [1, 2, 3].map((n, position) => ({ itemId: id("2", n), position, workId: id("b", n), status: "reviewing" })),
    child: null, replayed: false, transition: "read", blockReason: null, ...patch } as LibraryTranslationScanReceipt;
}
function child(patch: Record<string, unknown> = {}) {
  return { version: 1, jobId: id("5", 1), itemId: id("6", 1), operationId: id("7", 1), entityType: "literary_work", entityId: id("b", 1), actorId,
    provider: "cloudflare", sourceHash: "e".repeat(64), rawSeedHash: "f".repeat(64), intentHash: "8".repeat(64), configurationHash: "c".repeat(64), configuration,
    sourceRevision: { workId: id("b", 1), workUpdatedAt: "2026-10-30T10:00:00.123456+00:00", russianId: id("a", 1), russianUpdatedAt: "2026-10-30T10:00:00.123456+00:00" },
    targetRevision: { id: id("d", 1), updatedAt: "2026-10-30T10:00:00.123456+00:00" }, jobVersion: "1", phase: "running", canExecute: false, canDispatch: false, replayed: false,
    providerCalls: 0, pendingCallId: null, blockReason: null, resumeCursor: { libraryCursor: 0 }, result: null, ...patch };
}
const parsedParent = () => parseLibraryTranslationScanReceipt(parent())!;
const rpcReturning = (data: unknown) => vi.fn(async (..._args: unknown[]) => ({ data, error: null }));

describe("Library stable scan receipt boundaries", () => {
  it("retains opaque membership and configuration hashes without inventing a source hash", () => {
    const input = parent(), frozen = structuredClone(input), parsed = parseLibraryTranslationScanReceipt(input);
    expect(parsed).toEqual(input); expect(input).toEqual(frozen); expect(parsed).not.toHaveProperty("sourceSnapshot");
  });
  it.each([
    ["duplicate work", (r: ReturnType<typeof parent>) => { r.members[1].workId = r.members[0].workId; }],
    ["duplicate item", (r: ReturnType<typeof parent>) => { r.members[1].itemId = r.members[0].itemId; }],
    ["position gap", (r: ReturnType<typeof parent>) => { r.members[1].position = 2; }],
    ["reversed order", (r: ReturnType<typeof parent>) => { r.members.reverse(); }],
    ["above upper bound", (r: ReturnType<typeof parent>) => { r.upperId = id("b", 2); }],
    ["wrong last member", (r: ReturnType<typeof parent>) => { r.lastId = id("b", 2); }],
    ["unverified prefix", (r: ReturnType<typeof parent>) => { r.afterId = id("b", 1); }],
    ["different first job", (r: ReturnType<typeof parent>) => { r.jobId = id("3", 1); }],
    ["wrong count", (r: ReturnType<typeof parent>) => { r.totalItems = 2; }],
    ["position after end", (r: ReturnType<typeof parent>) => { r.nextPosition = 4; }],
    ["unconfirmed processed prefix", (r: ReturnType<typeof parent>) => { r.nextPosition = 1; }],
    ["premature terminal suffix", (r: ReturnType<typeof parent>) => { r.members[1].status = "skipped"; }],
    ["premature exhaustion", (r: ReturnType<typeof parent>) => { r.lastWindow = true; r.exhausted = true; }],
    ["unbounded scalar ordinal", (r: ReturnType<typeof parent>) => { r.windowIndex = 2_000_000; r.predecessorJobId = id("3", 1); r.jobId = id("3", 2); }],
  ] as const)("rejects %s rather than selecting another live row", (_name, mutate) => {
    const value = parent(); mutate(value); expect(parseLibraryTranslationScanReceipt(value)).toBeNull();
  });
  it.each([null, undefined, {}, { ...parent(), sourceSnapshot: { privateText: "not operational metadata" } }])("rejects missing or expanded receipt %j", value => {
    expect(parseLibraryTranslationScanReceipt(value)).toBeNull();
  });
  it("accepts a complete500-member window with a stable ordinal and no modulo wrap", () => {
    const members = Array.from({ length: 500 }, (_, position) => ({ itemId: id("2", position + 1), position, workId: id("b", position + 1), status: position < 499 ? "skipped" : "reviewing" }));
    const value = parent({ members, upperId: id("b", 510), lastId: id("b", 500), totalItems: 500, nextPosition: 499 });
    expect(parseLibraryTranslationScanReceipt(value)?.nextPosition).toBe(499);
  });
  it("retains the completed window membership at explicit exhaustion", () => {
    const value = parent({ lastWindow: true, exhausted: true, nextPosition: 3, status: "completed", blockReason: "window_complete",
      members: parent().members.map(member => ({ ...member, status: "skipped" })) });
    expect(parseLibraryTranslationScanReceipt(value)?.members).toHaveLength(3);
  });
  it("bounds the entire successor membership, including positions not yet inspected", () => {
    const members = Array.from({ length: 500 }, (_, position) => ({ itemId: id("2", position + 1), position, workId: id("b", position + 1), status: "reviewing" }));
    const value = parent({ jobId: id("3", 1), predecessorJobId: id("3", 2), windowIndex: 1_999_999, members, totalItems: 500, lastId: id("b", 500), upperId: id("b", 500) });
    expect(parseLibraryTranslationScanReceipt(value)).toBeNull();
    expect(parseLibraryTranslationScanReceipt({ ...value, members: members.slice(0, 499), totalItems: 499, lastId: id("b", 499) })?.totalItems).toBe(499);
  });
  it.each([
    ["dispatch capability", { canDispatch: true }], ["execution capability", { canExecute: true }],
    ["another entity", { entityId: id("b", 2) }], ["different actor", { actorId: id("4", 2) }],
    ["different configuration", { configurationHash: "0".repeat(64) }],
  ] as const)("an attached child cannot smuggle %s", (_name, patch) => {
    expect(parseLibraryTranslationScanReceipt(parent({ child: { binding: "attached", initialProviderCalls: 0, receipt: child(patch) }, blockReason: "child_pending" }))).toBeNull();
  });
  it("allows an observed blocked child from another actor without granting any provider capability", () => {
    const receipt = child({ actorId: id("4", 2), phase: "blocked", blockReason: "operation_owned_by_another_actor" });
    const value = parent({ child: { binding: "observed-blocked", initialProviderCalls: 0, receipt }, blockReason: "child_owned_by_another_actor" });
    expect(parseLibraryTranslationScanReceipt(value)?.child?.receipt.canExecute).toBe(false);
  });
  it.each([
    ["running current", "running", 0, null, 0, true],
    ["running wrong next", "running", 0, null, 1, false],
    ["finished paid next", "finished", 2, "conflict", 1, true],
    ["finished paid wrong current", "finished", 2, "conflict", 0, false],
    ["finished skipped zero current", "finished", 0, "skipped", 0, true],
    ["finished skipped zero wrong next", "finished", 0, "skipped", 1, false],
    ["finished zero conflict existing next", "finished", 0, "conflict", 1, true],
  ] as const)("retains the existing paid scalar semantics: %s", (_name, phase, providerCalls, state, ordinal, valid) => {
    const result = state === null ? null : { state, errorCode: state === "conflict" ? "write_conflict" : null, persistence: "none", draftId: null,
      draftVersion: null, draftUpdatedAt: null, candidateHash: null, publication: "unchanged", humanReview: "unchanged" };
    const value = parent({ child: { binding: "attached", initialProviderCalls: 0, receipt: child({ phase, providerCalls, result, resumeCursor: { libraryCursor: ordinal } }) }, blockReason: "child_pending" });
    expect(parseLibraryTranslationScanReceipt(value) !== null).toBe(valid);
  });
});

describe("Actual typed scan RPC request and response bindings", () => {
  it("sends only the scan intent and existing configuration at BEGIN", async () => {
    const rpc = rpcReturning(parent({ transition: "created" }));
    await beginLibraryTranslationScan({ rpc } as never, scanId, configuration);
    expect(rpc.mock.calls).toEqual([["begin_library_translation_scan", { p_scan_id: scanId, p_configuration: configuration }]]);
  });
  it("GET stays on the requested saved window, including a historical predecessor", async () => {
    const rpc = rpcReturning(parent({ successorJobId: id("3", 1) }));
    expect((await getLibraryTranslationScan({ rpc } as never, scanId)).jobId).toBe(scanId);
    expect(rpc.mock.calls).toEqual([["get_library_translation_scan", { p_job_id: scanId }]]);
  });
  it("GET rejects a different window receipt", async () => {
    const rpc = rpcReturning(parent()); await expect(getLibraryTranslationScan({ rpc } as never, id("3", 1))).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it("attaches the exact real child and its intent before allowing the caller to continue", async () => {
    const receipt = child() as CatalogTranslationOperationReceipt, result = parent({ jobVersion: "2", transition: "attached", child: { binding: "attached", initialProviderCalls: 0, receipt }, blockReason: "child_pending" });
    const rpc = rpcReturning(result); await attachLibraryTranslationScanOperation({ rpc } as never, parsedParent(), receipt, transitionId);
    expect(rpc.mock.calls).toEqual([["attach_library_translation_scan_operation", { p_window_job_id: scanId, p_expected_version: "1", p_item_id: id("2", 1), p_operation_job_id: receipt.jobId, p_operation_item_id: receipt.itemId,
      p_operation_id: receipt.operationId, p_intent_hash: receipt.intentHash, p_transition_id: transitionId }]]);
  });
  it.each(["missing child", "different operation", "different private seed", "different source revision", "already dispatched", "position advanced"])("does not confirm admission from %s", async mismatch => {
    const receipt = child() as CatalogTranslationOperationReceipt;
    const patch = mismatch === "different operation" ? { operationId: id("7", 2) } : mismatch === "different private seed" ? { rawSeedHash: "0".repeat(64) }
      : mismatch === "different source revision" ? { sourceRevision: { ...receipt.sourceRevision, russianUpdatedAt: "2026-10-30T10:00:01.123456+00:00" } }
        : mismatch === "already dispatched" ? { providerCalls: 1, pendingCallId: id("8", 1) } : {};
    const result = parent({ jobVersion: "2", transition: "attached", nextPosition: mismatch === "position advanced" ? 1 : 0,
      child: mismatch === "missing child" ? null : { binding: "attached", initialProviderCalls: 0, receipt: child(patch) }, blockReason: "child_pending" });
    const rpc = rpcReturning(result); await expect(attachLibraryTranslationScanOperation({ rpc } as never, parsedParent(), receipt, transitionId)).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it("records a zero-provider logical observation with its own transition UUID", async () => {
    const before = parsedParent(), observation = { version: 1, type: "free", state: "manual", reason: null, sourceHash: null } as const;
    const members = structuredClone(before.members); members[0].status = "skipped";
    const rpc = rpcReturning(parent({ jobVersion: "2", nextPosition: 1, members, transition: "advanced" }));
    await checkpointLibraryTranslationScanItem({ rpc } as never, before, transitionId, observation);
    expect(rpc.mock.calls).toEqual([["checkpoint_library_translation_scan_item", { p_window_job_id: scanId, p_expected_version: "1", p_item_id: id("2", 1), p_transition_id: transitionId, p_observation: observation, p_operation_id: null }]]);
  });
  it("rejects membership substitution at checkpoint even when position and version look valid", async () => {
    const result = parent({ jobVersion: "2", nextPosition: 1, membershipHash: "0".repeat(64) });
    const rpc = rpcReturning(result); await expect(checkpointLibraryTranslationScanItem({ rpc } as never, parsedParent(), transitionId,
      { version: 1, type: "free", state: "manual", reason: null, sourceHash: null })).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it.each(["unchanged receipt", "unproven hold", "skipped position"])("does not call %s confirmed progress", async mismatch => {
    const result = parent(mismatch === "unproven hold" ? { transition: "held" } : mismatch === "skipped position" ? { transition: "advanced", nextPosition: 2 } : {});
    const rpc = rpcReturning(result); await expect(checkpointLibraryTranslationScanItem({ rpc } as never, parsedParent(), transitionId,
      { version: 1, type: "free", state: "manual", reason: null, sourceHash: null })).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it.each(["zero-call-held", "held"] as const)("accepts an explicit %s without claiming an advance", async transition => {
    const result = parent({ jobVersion: "2", transition, blockReason: transition === "held" ? "scan_stopped" : null });
    const rpc = rpcReturning(result); expect((await checkpointLibraryTranslationScanItem({ rpc } as never, parsedParent(), transitionId,
      { version: 1, type: "child-terminal" }, id("7", 1))).nextPosition).toBe(0);
  });
  it("follows only a successor bound to the same high-water and original scan", async () => {
    const before = parsedParent(), members = [4, 5, 6].map((n, position) => ({ itemId: id("2", n), position, workId: id("b", n), status: "reviewing" }));
    const result = parent({ jobId: id("3", 1), predecessorJobId: scanId, windowIndex: 1, afterId: id("b", 3), lastId: id("b", 6), members, lastWindow: true });
    const rpc = rpcReturning(result); expect((await continueLibraryTranslationScan({ rpc } as never, before, configuration)).windowIndex).toBe(1);
    expect(rpc.mock.calls).toEqual([["continue_library_translation_scan", { p_window_job_id: scanId, p_expected_version: "1", p_configuration: configuration }]]);
  });
  it.each(["upper bound", "predecessor", "scan identity"])("rejects a changed successor %s", async mismatch => {
    const result = parent({ jobId: id("3", 1), predecessorJobId: mismatch === "predecessor" ? id("3", 2) : scanId, windowIndex: 1,
      scanId: mismatch === "scan identity" ? id("1", 2) : scanId, upperId: mismatch === "upper bound" ? id("b", 7) : id("b", 6), afterId: id("b", 3), lastId: id("b", 6), lastWindow: true,
      members: [4, 5, 6].map((n, position) => ({ itemId: id("2", n), position, workId: id("b", n), status: "reviewing" })) });
    const rpc = rpcReturning(result); await expect(continueLibraryTranslationScan({ rpc } as never, parsedParent(), configuration)).rejects.toMatchObject({ errorCode: "translation_scan_unconfirmed" });
  });
  it.each(["40001", "42501", "22023", "57014", "PGRST202"])("keeps database refusal %s bounded without leaking private text", async code => {
    const rpc = vi.fn(async () => ({ data: null, error: { code, message: "PRIVATE CANONICAL PROSE MUST NOT LEAK" } }));
    await expect(getLibraryTranslationScan({ rpc } as never, scanId)).rejects.toMatchObject({ databaseCode: code });
    try { await getLibraryTranslationScan({ rpc } as never, scanId); } catch (error) { expect(String(error)).not.toContain("PRIVATE CANONICAL"); }
  });
  it("rethrows native navigation signals instead of turning them into a fresh scan", async () => {
    const signal = getRedirectError("/login", "replace", 307), rpc = vi.fn(async () => { throw signal; });
    await expect(getLibraryTranslationScan({ rpc } as never, scanId)).rejects.toBe(signal);
  });
});
