import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  getArticleTranslationItemRetryProgress, recordArticleTranslationItemRetryDispatch,
  recordArticleTranslationItemRetryResponse,
} from "./article-translation-item-retry";

const jobId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const articleId = "44444444-4444-4444-8444-444444444444";
const callId = "55555555-5555-4555-8555-555555555555";
const stamp = "2026-10-08T10:00:00.123456+00:00";
const target = { jobId, itemId, operationId, articleId };
const dispatch = { callId, provider: "cloudflare", model: "local-model", pass: "translation" } as const;
const metadata = { ...dispatch, httpStatus: null, requestId: null, responseId: "response-local", inputTokens: 20, outputTokens: 10 };
function progress(received = false): any {
  return { version: 1, ...target, provider: "cloudflare", phase: "running", startedAt: stamp, updatedAt: stamp,
    providerCalls: 1, canDispatch: false, replayed: false, calls: [{ ...dispatch, dispatchRecordedAt: stamp,
      responseReceivedAt: received ? stamp : null, httpStatus: null, requestId: null,
      responseId: received ? metadata.responseId : null, inputTokens: received ? 20 : null, outputTokens: received ? 10 : null }] };
}
const client = (data: unknown, error: unknown = null) => ({ rpc: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ data, error })) });

describe("M07 current journal DTO and SDK boundaries", () => {
  it("only a first confirmed dispatch grants permission, while its replay does not", async () => {
    const first = client({ ...progress(), canDispatch: true });
    expect((await recordArticleTranslationItemRetryDispatch(first, target, dispatch)).canDispatch).toBe(true);
    expect(first.rpc).toHaveBeenCalledWith("record_article_translation_item_retry_dispatch", {
      p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId, p_call_id: callId,
      p_provider: "cloudflare", p_model: "local-model", p_pass: "translation",
    });
    const replay = client({ ...progress(), replayed: true });
    expect((await recordArticleTranslationItemRetryDispatch(replay, target, dispatch)).canDispatch).toBe(false);
  });
  it("GET never grants a provider call and preserves an unknown response", async () => {
    const view = client(progress());
    const result = await getArticleTranslationItemRetryProgress(view, target);
    expect(result.canDispatch).toBe(false); expect(result.calls[0].responseReceivedAt).toBeNull();
    expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("legacy finished receipts keep unknown startedAt and an empty journal", async () => {
    const view = client({ ...progress(), phase: "finished", startedAt: null, providerCalls: 0, calls: [] });
    expect((await getArticleTranslationItemRetryProgress(view, target)).startedAt).toBeNull();
  });
  it("a received envelope binds the exact response metadata without authorising dispatch", async () => {
    const view = client(progress(true));
    const result = await recordArticleTranslationItemRetryResponse(view, target, metadata);
    expect(result.canDispatch).toBe(false); expect(result.calls[0].responseId).toBe("response-local");
    expect(view.rpc.mock.calls[0]).toEqual(["record_article_translation_item_retry_response", {
      p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId, p_metadata: metadata,
    }]);
  });
  const invalid: Array<[string, (value: any) => void]> = [
    ["GET execution authority", value => { value.canDispatch = true; }],
    ["wrong actor target entity", value => { value.articleId = jobId; }],
    ["wrong operation", value => { value.operationId = callId; }],
    ["count overclaim", value => { value.providerCalls = 2; }],
    ["missing true start provenance", value => { value.startedAt = null; }],
    ["unacknowledged metadata", value => { value.calls[0].responseId = "guessed"; }],
    ["extra response prose", value => { value.calls[0].output = "untrusted body"; }],
    ["wrong provider", value => { value.calls[0].provider = "openai"; }],
    ["duplicate call identity", value => { value.calls.push({ ...value.calls[0] }); value.providerCalls = 2; }],
    ["unknown prior request", value => { value.calls.push({ ...value.calls[0], callId: itemId }); value.providerCalls = 2; }],
    ["unsafe token counter", value => { value.calls[0].inputTokens = Number.MAX_SAFE_INTEGER + 1; }],
    ["wrong status type", value => { value.calls[0].httpStatus = "200"; }],
    ["invalid revision", value => { value.calls[0].dispatchRecordedAt = "yesterday"; }],
  ];
  for (const [name, corrupt] of invalid) it(`refuses ${name} without a compatibility fallback`, async () => {
    const value = progress(); corrupt(value); const view = client(value);
    await expect(getArticleTranslationItemRetryProgress(view, target)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
    expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not accept a receipt for a different dispatch descriptor", async () => {
    const value = { ...progress(), canDispatch: true }; value.calls[0].model = "different-model";
    await expect(recordArticleTranslationItemRetryDispatch(client(value), target, dispatch)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
  });
  it("does not accept response acknowledgement with a different provider response ID", async () => {
    const value = progress(true); value.calls[0].responseId = "other-response";
    await expect(recordArticleTranslationItemRetryResponse(client(value), target, metadata)).rejects.toMatchObject({ errorCode: "translation_retry_unconfirmed" });
  });
  for (const [name, response] of [
    ["contradictory P0002", { data: progress(), error: { code: "P0002" } }],
    ["fulfilled missing operation", { data: null, error: { code: "P0002" } }],
    ["null success", { data: null, error: null }],
    ["missing error field", { data: progress() }],
  ] as const) it(`keeps ${name} as failure and never reads null-operation eligibility`, async () => {
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => response as any);
    await expect(getArticleTranslationItemRetryProgress({ rpc }, target)).rejects.toBeInstanceOf(Error);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]?.p_operation_id).toBe(operationId);
  });
  it("uses installed SDK serialization and a real Response for distinct correlation and response IDs", async () => {
    const wire: any[] = []; const value = progress(true);
    value.provider = "openai"; Object.assign(value.calls[0], { provider: "openai", httpStatus: 200, requestId: "req-local", responseId: "resp-local" });
    const sdk = createClient("https://supabase.invalid", "public-fixture-key", { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (url, init) => { wire.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } }); } } });
    const result = await recordArticleTranslationItemRetryResponse(sdk, target, { ...metadata, provider: "openai", httpStatus: 200, requestId: "req-local", responseId: "resp-local" });
    expect(result.calls[0].requestId).toBe("req-local"); expect(result.calls[0].responseId).toBe("resp-local");
    expect(wire).toHaveLength(1); expect(wire[0].body.p_metadata).not.toHaveProperty("output");
    expect(wire[0].url).toContain("/rpc/record_article_translation_item_retry_response");
  });
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nativeRequire = createRequire(import.meta.url);
const graph = new Map<string, { module: string; source: string; sha256: string }>();
function actualPage(mocks: Record<string, unknown>) {
  const modules = new Map<string, any>();
  function load(file: string): any {
    if (modules.has(file)) return modules.get(file);
    const source = process.env.M07_JOURNAL_UI_BASELINE_ROOT ? path.join(process.env.M07_JOURNAL_UI_BASELINE_ROOT, file) : path.join(repoRoot, file);
    const data = readFileSync(source); graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: createHash("sha256").update(data).digest("hex") });
    const code = ts.transpileModule(data.toString(), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} as any }; modules.set(file, module.exports);
    const require = (name: string): unknown => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const targetPath = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(path.join(repoRoot, file)), name) : null;
      if (targetPath) for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(targetPath + ext)) return load(path.relative(repoRoot, targetPath + ext).replaceAll("\\", "/"));
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", code)(require, module, module.exports); modules.set(file, module.exports); return module.exports;
  }
  return load("apps/admin/app/(dashboard)/translations/page.tsx").default;
}
async function renderJournal(value: unknown, denied = false, error: unknown = null) {
  const actions = { retryArticleTranslationItemAction: vi.fn() };
  const query = (result: any): any => { const builder = { select: () => builder, contains: () => builder, is: () => builder, in: () => builder,
    order: () => builder, limit: () => builder, eq: () => builder, maybeSingle: () => builder,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) }; return builder; };
  const rpc = vi.fn(async (name: string) => {
    if (name === "get_article_translation_sync_run") return { data: null, error: { code: "P0002", message: "ordinary article job not found" } };
    if (name === "get_translation_job_resume") return { data: { id: jobId, kind: "article", status: "reviewing", resumeCursor: {} }, error: null };
    if (name === "get_article_translation_item_retry_progress") return { data: value, error };
    if (name === "get_article_translation_item_retry") return { data: { version: 1, ...target, provider: "cloudflare", sourceHash: "a".repeat(64),
      sourceUpdatedAt: stamp, englishUpdatedAt: null, jobVersion: "8", attemptCount: 1, maxAttempts: 2, jobStatus: "reviewing", itemStatus: "reviewing",
      phase: "running", canExecute: false, replayed: true, retryable: false, blockReason: null, result: null }, error: null };
    if (name === "get_article_translation_item_retry_candidate") return { data: { version: 1, ...target, provider: "cloudflare",
      sourceHash: "a".repeat(64), sourceUpdatedAt: stamp, englishUpdatedAt: null, phase: "running", candidateState: "missing",
      candidateHash: null, preparedAt: null, workingDraftVersion: null, workingDraftUpdatedAt: null,
      providerCalls: 1, canRecover: false, replayed: true, blockReason: "candidate_missing" }, error: null };
    if (name === "get_translation_operations_status") return { data: { queued: 0, running: 0, completed: 0, attention: 0, deadLetterItems: 0, recent: [] }, error: null };
    if (name === "get_translation_provider_self_test") return { data: { provider: "cloudflare", configured: true, binding_found: true,
      test_in_progress: false, test_passed: null, model: null, latency_ms: null, last_error_code: null, last_test_at: null, cooldown_until: null }, error: null };
    return { data: true, error: null };
  });
  const Page = actualPage({
    "@/components/TranslationSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", null, children) },
    "@/lib/admin-read-access": { requireStaffRead: async () => denied ? null : { user: { id: jobId }, role: "admin" } },
    "@/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review" } },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [] }) },
    "@/lib/premium-english-translation": { premiumTranslationRuntimeReadiness: () => ({ configured: true, bindingFound: true, provider: "cloudflare" }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ rpc, from: () => query({ data: [], count: 0, error: null }) }) },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions, "./self-test-action": actions,
    "./resume-action": actions, "./article-item-retry-action": actions,
  });
  const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ retryJob: jobId, retryItem: itemId, retryOperation: operationId }) }));
  expect(actions.retryArticleTranslationItemAction).not.toHaveBeenCalled();
  return { markup, rpc };
}
describe("M07 journal UI existing actual page", () => {
  it("shows recorded admission and unknown result without a retry form", async () => {
    const view = await renderJournal(progress());
    expect(view.markup).toContain("Допусков запросов: 1 из 4"); expect(view.markup).toContain("Результат запроса не подтверждён");
    expect(view.markup).not.toContain("Повторить только этот элемент");
    expect(view.rpc.mock.calls.filter(row => String(row[0]).includes("article_translation_item_retry")).map(row => row[0]))
      .toEqual(["get_article_translation_item_retry", "get_article_translation_item_retry_progress", "get_article_translation_item_retry_candidate"]);
    expect(view.rpc.mock.calls.filter(row => ["get_article_translation_sync_run", "get_translation_job_resume"].includes(row[0])).map(row => row[0]))
      .toEqual(["get_article_translation_sync_run", "get_translation_job_resume"]);
  });
  it("shows received correlation and response IDs without asserting human review or publication", async () => {
    const value = progress(true); value.calls[0].requestId = "request-local";
    const view = await renderJournal(value); expect(view.markup).toContain("ID запроса: request-local"); expect(view.markup).toContain("ID ответа: response-local");
    expect(view.markup).toContain("Проверка текста и его сохранение подтверждаются отдельно");
    expect(view.markup).not.toContain("Повторить только этот элемент");
  });
  it("reports malformed progress as unavailable and never leaks response prose", async () => {
    const value = progress(); value.secretBody = "PRIVATE_RESPONSE_BODY";
    const view = await renderJournal(value); expect(view.markup).toContain("Повторить чтение журнала"); expect(view.markup).not.toContain("PRIVATE_RESPONSE_BODY");
    expect(view.markup).not.toContain("Допусков запросов: 1 из 4");
  });
  it("does not read a private journal when staff access is denied", async () => {
    const view = await renderJournal(progress(true), true);
    expect(view.rpc.mock.calls.some(row => String(row[0]).includes("article_translation_item_retry"))).toBe(false);
    expect(view.markup).not.toContain("response-local");
  });
});
afterAll(() => {
  if (process.env.M07_JOURNAL_UI_TRACE) writeFileSync(process.env.M07_JOURNAL_UI_TRACE,
    JSON.stringify({ actualModules: [...graph.values()], mocked: ["Auth", "SDK RPC ledger", "catalog", "provider readiness", "nonexecuted actions"] }, null, 2));
});
