import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

type Row = Record<string, any>;
const repo = process.cwd(), nativeRequire = createRequire(path.join(repo, "package.json"));
const nativeRedirect = nativeRequire("next/dist/client/components/redirect");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const actionFile = "apps/admin/app/(dashboard)/translations/article-item-retry-action.ts";
const sourceGraph = new Map<string, Row>(), traces: Row[] = [];
const ids = { jobId: "11111111-1111-4111-8111-111111111111", itemId: "22222222-2222-4222-8222-222222222222",
  operationId: "33333333-3333-4333-8333-333333333333", articleId: "44444444-4444-4444-8444-444444444444" };
const stamp = "2026-10-08T10:00:00.123456+00:00", englishStamp = "2026-10-07T10:00:00.654321+00:00";
const sourceHash = "a".repeat(64), candidateHash = "b".repeat(64);
const running = { version: 1, ...ids, provider: "cloudflare", sourceHash, sourceUpdatedAt: stamp,
  englishUpdatedAt: englishStamp, jobVersion: "8", attemptCount: 1, maxAttempts: 2,
  jobStatus: "reviewing", itemStatus: "reviewing", phase: "running", canExecute: false,
  replayed: true, retryable: false, blockReason: null, result: null };
function finished(cancelled = false): Row {
  return { ...running, phase: "finished", jobVersion: "9", attemptCount: 2,
    jobStatus: cancelled ? "cancelled" : "partial", itemStatus: cancelled ? "cancelled" : "succeeded",
    result: { outcome: cancelled ? "cancelled" : "succeeded", errorCode: null,
      persistence: cancelled ? "none" : "working-draft", workingDraftVersion: cancelled ? null : 1,
      workingDraftUpdatedAt: cancelled ? null : stamp, publication: "unchanged",
      humanReview: cancelled ? "unchanged" : "pending", providerCalls: 2 } };
}
function candidate(done = false): Row {
  return { version: 1, ...ids, provider: "cloudflare", sourceHash, sourceUpdatedAt: stamp,
    englishUpdatedAt: englishStamp, phase: done ? "finished" : "running",
    candidateState: done ? "finished" : "staged", candidateHash, preparedAt: stamp,
    workingDraftVersion: 1, workingDraftUpdatedAt: stamp, providerCalls: 2,
    canRecover: !done, replayed: done, blockReason: null };
}
function actualAction(client: Row, boundary: Row) {
  const cache = new Map<string, Row>();
  const unused = () => { boundary.providerCalls++; throw new Error("Recovery must not call a provider or runtime admission"); };
  const mocks: Row = {
    "next/cache": { revalidatePath: () => { boundary.cacheCalls++; } },
    "@/lib/auth": { requireStaff: async () => ({ user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, role: "admin" }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => client },
    "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: unused },
    "@/lib/premium-translation-runtime": { premiumTranslationRuntimeMetadata: unused },
    "@/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: unused },
    "@/lib/translation-operation-budget": { createTranslationOperationBudget: unused },
  };
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(repo, file);
    const source = process.env.M07_CANDIDATE_BINDING_BASELINE_ROOT
      ? path.join(process.env.M07_CANDIDATE_BINDING_BASELINE_ROOT, file) : filename;
    const bytes = readFileSync(source);
    sourceGraph.set(file, { module: file, source: path.relative(repo, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(repo, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const suffix of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + suffix)) {
        return load(path.relative(repo, target + suffix).replaceAll("\\", "/"));
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return load(actionFile).recoverArticleTranslationItemCandidateAction;
}
type Scenario = { name: string; done?: boolean; lostAck?: boolean; cancelled?: boolean;
  mutateReceipt?: (value: Row) => void; mutateLaterCandidate?: (value: Row) => void; expected?: string };
const scenarios: Scenario[] = [
  { name: "same stored candidate finishes once without another model call" },
  { name: "lost ACK reconciles the same stored candidate", lostAck: true },
  { name: "already finished same candidate remains idempotent", done: true },
  { name: "confirmed cancellation retains private candidate metadata", done: true, cancelled: true, expected: "translation_operation_stopped" },
  { name: "RECOVER bad draft CAS cannot become success through GET", mutateReceipt: value => { value.result.workingDraftVersion = 2; }, expected: "translation_retry_unconfirmed" },
  { name: "already finished reply is bound to the original draft CAS", done: true, mutateReceipt: value => { value.result.workingDraftVersion = 2; }, expected: "translation_retry_unconfirmed" },
  { name: "one microsecond changed finished draft cannot confirm the candidate", done: true,
    mutateReceipt: value => { value.result.workingDraftUpdatedAt = "2026-10-08T10:00:00.123457+00:00"; }, expected: "translation_retry_unconfirmed" },
  { name: "finished provider call count must match the candidate", done: true,
    mutateReceipt: value => { value.result.providerCalls = 3; }, expected: "translation_retry_unconfirmed" },
  { name: "cancelled finished reply retains the same admission count", done: true, cancelled: true,
    mutateReceipt: value => { value.result.providerCalls = 3; }, expected: "translation_retry_unconfirmed" },
  { name: "lost ACK cannot reconcile a different candidate hash", lostAck: true,
    mutateLaterCandidate: value => { value.candidateHash = "c".repeat(64); }, expected: "translation_retry_unconfirmed" },
];
describe("M07 same private candidate binds every finished recovery response", () => {
  it.each(scenarios)("$name", async scenario => {
    const wire: Row[] = [], boundary = { providerCalls: 0, cacheCalls: 0 }; let gets = 0, candidateGets = 0;
    const doneReceipt = finished(scenario.cancelled); scenario.mutateReceipt?.(doneReceipt);
    const client = { rpc: async (name: string, args: Row) => {
      wire.push({ name, args });
      if (name === "get_article_translation_sync_run") return { data: null, error: { code: "P0002", message: "ordinary article job not found" } };
      if (name === "get_translation_job_resume") return { data: { id: ids.jobId, kind: "article", status: "reviewing", resumeCursor: {} }, error: null };
      if (name === "get_article_translation_item_retry") {
        gets++; return { data: structuredClone(scenario.done || gets > 1 ? doneReceipt : running), error: null };
      }
      if (name === "get_article_translation_item_retry_candidate") {
        candidateGets++; const value = candidate(Boolean(scenario.done || gets > 1));
        if (candidateGets > 1) scenario.mutateLaterCandidate?.(value);
        return { data: value, error: null };
      }
      if (name === "recover_article_translation_item_retry_candidate") {
        if (scenario.lostAck) throw new Error("Controlled lost response after finish");
        return { data: structuredClone(doneReceipt), error: null };
      }
      throw new Error("Unexpected controlled RPC " + name);
    } };
    const action = actualAction(client, boundary), form = new FormData();
    for (const [name, value] of [["job_id", ids.jobId], ["item_id", ids.itemId],
      ["operation_id", ids.operationId], ["candidate_hash", candidateHash]]) form.set(name, value);
    const original = [...form.entries()]; let error: unknown;
    try { await action(form); } catch (value) { error = value; }
    expect((error as { digest?: string })?.digest).toMatch(/^NEXT_REDIRECT;/u);
    const url = new URL(nativeRedirect.getURLFromRedirectError(error), "https://fixture.invalid");
    traces.push({ scenario: scenario.name, expectedError: scenario.expected ?? null, actualError: url.searchParams.get("errorCode"),
      expectedDraftVersion: 1, returnedDraftVersion: doneReceipt.result.workingDraftVersion, boundary, wire });
    expect(url.pathname).toBe("/translations");
    expect(Object.fromEntries(["retryJob", "retryItem", "retryOperation"].map(key => [key, url.searchParams.get(key)])))
      .toEqual({ retryJob: ids.jobId, retryItem: ids.itemId, retryOperation: ids.operationId });
    expect([...form.entries()]).toEqual(original); expect(boundary.providerCalls).toBe(0);
    expect(wire.filter(row => row.name === "recover_article_translation_item_retry_candidate")).toHaveLength(scenario.done ? 0 : 1);
    expect(wire.every(row => !Object.hasOwn(row.args, "p_english_payload"))).toBe(true);
    expect(url.searchParams.get("errorCode")).toBe(scenario.expected ?? null);
  });
});
afterAll(() => {
  if (process.env.M07_CANDIDATE_BINDING_EVIDENCE) writeFileSync(process.env.M07_CANDIDATE_BINDING_EVIDENCE, JSON.stringify({
    sourceGraph: [...sourceGraph.values()], traces,
    limitations: ["Actual action/adapter/private-draft schemas/native Next signals; controlled Auth/SDK/cache responses",
      "No SQL/database/PostgREST/GoTrue/provider/network/production execution", "Before failures reproduce a contract defect; never acceptance PASS"],
  }, null, 2) + "\n", { flag: "wx" });
});
