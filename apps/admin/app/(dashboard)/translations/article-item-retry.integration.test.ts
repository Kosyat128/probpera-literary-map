import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadHtml } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const nativeRedirect = nativeRequire("next/dist/client/components/redirect");
const { createClient } = nativeRequire("@supabase/supabase-js");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
type Row = Record<string, any>;
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const pageFile = "apps/admin/app/(dashboard)/translations/page.tsx";
const actionFile = "apps/admin/app/(dashboard)/translations/article-item-retry-action.ts";
const adapterFile = "apps/admin/lib/article-translation-item-retry.ts";

function actualModules(mocks: Record<string, unknown>, ui = false) {
  const modules = new Map<string, Row>();
  function load(file: string): Row {
    const filename = path.join(repoRoot, file);
    if (modules.has(filename)) return modules.get(filename)!;
    const before = ui && process.env.M07_ITEM_UI_BASELINE_ROOT;
    const source = before ? path.join(before, file) : filename;
    if (!existsSync(source)) throw new Error(`Uncaptured actual dependency: ${file}`);
    const bytes = readFileSync(source);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row }; modules.set(filename, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) {
        const relative = path.relative(repoRoot, target).replaceAll("\\", "/");
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + extension)) return load(relative + extension);
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    modules.set(filename, module.exports); return module.exports;
  }
  return { load };
}

const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const articleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const categoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const englishId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const jobId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const otherItemId = "44444444-4444-4444-8444-444444444444";
const revision = "2026-10-08T10:00:00.123456+00:00";
const englishRevision = "2026-10-07T10:00:00.654321+00:00";
const authored = { ru: "Original RU \u2014 source and rights", en: "Original EN \u2014 manual rights" };
const privateError = "PRIVATE_PROVIDER_SECRET=local_do_not_render";
const resumeCursor = { articleScan: { version: 1, order: "id", upperId: articleId, afterId: null,
  pendingIds: [articleId], nextIndex: 0, lastWindow: true, exhausted: false } };
const readySourceHash = hash("UI canonical source fixture");
function receipt(overrides: Row = {}): Row {
  return { version: 1, jobId, itemId, articleId, provider: "cloudflare", sourceHash: readySourceHash,
    sourceUpdatedAt: revision, englishUpdatedAt: englishRevision, jobVersion: "7", attemptCount: 1, maxAttempts: 1,
    jobStatus: "partial", itemStatus: "dead_letter", operationId: null, phase: "ready", canExecute: false,
    replayed: false, retryable: true, blockReason: null, result: null, ...overrides };
}
function runningReceipt(overrides: Row = {}) {
  return receipt({ operationId, phase: "running", canExecute: false, retryable: false, replayed: true,
    jobVersion: "8", attemptCount: 1, maxAttempts: 2, jobStatus: "reviewing", itemStatus: "reviewing", ...overrides });
}
function finishedReceipt(overrides: Row = {}) {
  return runningReceipt({ phase: "finished", jobStatus: "partial", itemStatus: "succeeded", attemptCount: 2,
    result: { outcome: "succeeded", errorCode: null, persistence: "working-draft", workingDraftVersion: 7,
      workingDraftUpdatedAt: revision, publication: "unchanged", humanReview: "pending", providerCalls: 2 }, ...overrides });
}
function nativeSignal() { try { navigation.redirect("/item-retry-native-signal"); } catch (error) { return error; } }

function uiFixture(options: { phase?: "ready" | "running" | "finished" | "blocked"; readError?: boolean; denied?: boolean; reviewing?: boolean; legacyView?: boolean; listCount?: number } = {}) {
  const actionNames = ["translatePremiumArticleBatchAction", "translatePremiumLibraryBatchAction", "translatePremiumWriterBatchAction", "translatePremiumCountryBatchAction", "translatePremiumSiteCopyBatchAction", "runPremiumTranslationSelfTestAction", "resumeTranslationJobAction", "retryArticleTranslationItemAction"];
  const actions = Object.fromEntries(actionNames.map(name => [name, vi.fn()]));
  const selected = options.phase === "running" ? runningReceipt() : options.phase === "finished" ? finishedReceipt()
    : options.phase === "blocked" ? receipt({ phase: "blocked", retryable: false, blockReason: "manual_english" }) : receipt();
  const job = { id: jobId, kind: "article", status: options.reviewing ? "reviewing" : "partial", totalItems: options.listCount ?? 10,
    succeededItems: options.listCount ? 0 : 8, failedItems: options.listCount ?? 2, resumeCursor, createdAt: revision, updatedAt: revision };
  const called: Row[] = [];
  const staff = vi.fn(async () => options.denied ? null : { user: { id: actorId }, role: "admin" });
  function query(result: Row) {
    const builder: Row = { select: () => builder, contains: () => builder, is: () => builder, in: () => builder,
      order: () => builder, limit: () => builder, maybeSingle: () => builder, eq: () => builder,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) };
    return builder;
  }
  let providerProbeIdentity: unknown = null;
  const from = vi.fn((table: string) => {
    called.push({ from: table });
    if (["articles", "article_translations", "literary_work_translations"].includes(table)) return query({ data: null, count: 10, error: null });
    if (table === "homepage_blocks") return query({ data: [], error: null });
    if (table === "translation_provider_self_tests") return query({ data: { provider: "cloudflare", configured: true, binding_found: true,
      test_passed: true, model: "local-model", latency_ms: 0, last_error_code: null, last_test_at: new Date().toISOString(), cooldown_until: null, test_in_progress: false, configuration_identity: providerProbeIdentity }, error: null });
    if (table === "translation_job_items") return query(options.readError ? { data: null, error: { code: "57014", message: privateError } } : {
      data: Array.from({ length: options.listCount ?? 1 }, (_value, index) => ({
        id: index === (options.listCount ? 50 : 0) ? itemId : `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`,
        job_id: jobId, entity_type: "article", entity_id: index === (options.listCount ? 50 : 0) ? articleId : `66666666-6666-4666-8666-${String(index + 1).padStart(12, "0")}`,
        position: options.listCount ? index : 8, status: options.phase === "running" ? "reviewing" : "dead_letter",
        source_hash: readySourceHash, attempt_count: 1, max_attempts: options.phase === "running" ? 2 : 1, last_error_code: "provider_request_failed" })), error: null,
    });
    throw new Error(`Unexpected UI table ${table}`);
  });
  const rpc = vi.fn(async (name: string, input?: Row) => {
    called.push({ rpc: name, input });
    if (name === "premium_machine_translation_ready" || name === "translation_operations_ready" || name === "article_translation_sync_ready") return { data: true, error: null };
    if (name === "get_article_translation_sync_run") return { data: null, error: { code: "P0002", message: "ordinary article job not found" } };
    if (name === "get_translation_operations_status") return { data: { queued: 0, running: options.reviewing ? 1 : 0, completed: 1, attention: 1,
      deadLetterItems: 2, recent: [job], runnerMode: "staff-bounded-sync-resume" }, error: null };
    if (name === "get_translation_job_resume") return { data: { id: job.id, kind: job.kind, status: job.status, resumeCursor: job.resumeCursor }, error: null };
    if (name === "get_article_translation_item_retry") return options.readError
      ? { data: null, error: { code: "57014", message: privateError } } : { data: selected, error: null };
    throw new Error(`Unexpected UI RPC ${name}`);
  });
  const modules = actualModules({
    "@/components/TranslationSubmitButton": { __esModule: true, default: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => createElement("button", { type: "submit", disabled }, children) },
    "@/lib/admin-read-access": { requireStaffRead: staff },
    "@/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review", openAiPremiumTranslationReview: true } },
    "apps/admin/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review", openAiPremiumTranslationReview: true } },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [] }) },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: async () => { throw Error("Read-only page must not dispatch the provider"); } } } }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from, rpc }) },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions, "./self-test-action": actions,
    "./resume-action": actions, "./article-item-retry-action": actions,
  }, true);
  const Page = modules.load(pageFile).default;
  async function render(overrides: Row = {}) {
    providerProbeIdentity = await modules.load("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
    const query = options.legacyView ? {} : { retryJob: jobId, retryItem: itemId,
      ...(options.phase === "running" || options.phase === "finished" ? { retryOperation: operationId } : {}) };
    const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ ...query, ...overrides }) }));
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    expect(markup).not.toContain(privateError); traces.push({ kind: "actual-page", options, called, markup });
    return { markup, $: loadHtml(markup) };
  }
  return { render, staff, from, rpc };
}
function retrySection($: ReturnType<typeof loadHtml>) { return $("section.panel").filter((_index, element) => $(element).children("span.eyebrow").text() === "Адресный повтор статьи"); }

describe("M07 actual item retry page keeps explicit intent and read-only reconciliation", () => {
  it("renders one failed item form distinct from corpus continuation with frozen job/item/CAS and a private draft explanation", async () => {
    const { $ } = await uiFixture().render(); const section = retrySection($);
    expect(section.length).toBe(1); const form = section.find("form"); expect(form.length).toBe(1);
    expect(form.find("button").text()).toBe("Повторить только этот элемент"); expect(form.find("button").is(":disabled")).toBe(false);
    expect(form.find('input[name="job_id"]').val()).toBe(jobId); expect(form.find('input[name="item_id"]').val()).toBe(itemId);
    expect(form.find('input[name="expected_job_version"]').val()).toBe("7"); expect(form.find('input[name="expected_attempt_count"]').val()).toBe("1");
    expect(form.find('input[name="source_hash"]').val()).toBe(readySourceHash);
    expect(form.find('input[name="operation_id"]').val()).toMatch(/^[a-f0-9-]{36}$/u);
    expect(section.text()).toContain("приватный рабочий черновик"); expect(section.text()).toContain("Остальные кандидаты и позиция обхода сохраняются");
  });
  it("running receipt displays checking without a second translate form", async () => {
    const view = uiFixture({ phase: "running" }); const { $ } = await view.render(); const section = retrySection($);
    expect(section.length).toBe(1); expect(section.find("form").length).toBe(0);
    expect(section.find("a").filter((_i, el) => $(el).text() === "Проверить квитанцию").attr("href")).toContain(`retryOperation=${operationId}`);
    expect(view.rpc.mock.calls.filter(call => String(call[0]).startsWith("begin_") || String(call[0]).startsWith("finish_"))).toHaveLength(0);
  });
  it("finished receipt distinguishes private machine completion from public publication and human review", async () => {
    const { $ } = await uiFixture({ phase: "finished" }).render(); const section = retrySection($);
    expect(section.length).toBe(1); expect(section.find("form").length).toBe(0);
    expect(section.text()).toContain("рабочий черновик версии 7"); expect(section.text()).toContain("Опубликованные RU/EN сохранены");
    expect(section.text()).toContain("Человеческая проверка ещё не выполнена");
  });
  it("a failed receipt read displays an explicit notice and offers no item submission", async () => {
    const { $ } = await uiFixture({ readError: true }).render(); const section = retrySection($);
    expect(section.length).toBe(1); expect(section.text()).toContain("Недоступно"); expect(section.find("form").length).toBe(0);
  });
  it("manual English block remains explicit without an automatic item retry", async () => {
    const { $ } = await uiFixture({ phase: "blocked" }).render(); const section = retrySection($);
    expect(section.length).toBe(1); expect(section.text()).toContain("Ручная английская версия защищена"); expect(section.find("form").length).toBe(0);
  });
  it("a selected reviewing job disables continuation while item result is pending", async () => {
    const { $ } = await uiFixture({ phase: "running", reviewing: true }).render({ articleJob: jobId });
    const continuation = $('form.panel.settings-stack').filter((_i, el) => $(el).children("span.eyebrow").text() === "Статьи");
    expect(continuation.length).toBe(1);
    const button = continuation.find("button").filter((_index, element) => $(element).text() === "Продолжить оставшихся кандидатов");
    expect(button.length).toBe(1); expect(button.is(":disabled")).toBe(true);
  });
  it("a selected failed element beyond the first fifty is reachable without starting a corpus scan", async () => {
    const view = uiFixture({ listCount: 51 }); const { $ } = await view.render(); const section = retrySection($);
    expect(section.length).toBe(1);
    const target = section.find("a").filter((_index, element) => String($(element).attr("href")).includes(`retryItem=${itemId}`));
    expect(target.length).toBe(1); expect(target.closest("div.status-list").text()).toContain("Элемент 51");
    expect(section.text()).not.toContain("первые 50"); expect(section.find('form input[name="item_id"]').val()).toBe(itemId);
    expect(view.rpc.mock.calls.every(call => !String(call[0]).startsWith("begin_") && !String(call[0]).startsWith("finish_"))).toBe(true);
  });
  it("a ready explicit operation query reuses that frozen ID for one user submission without executing during render", async () => {
    const view = uiFixture(); const { $ } = await view.render({ retryOperation: operationId }); const section = retrySection($);
    expect(section.length).toBe(1); expect(section.find("form").length).toBe(1);
    expect(section.find('input[name="operation_id"]').val()).toBe(operationId); expect(section.find("button").is(":disabled")).toBe(false);
    expect(view.rpc.mock.calls.find(call => call[0] === "get_article_translation_item_retry")?.[1]).toEqual({ p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId });
  });
  it("denied staff read exposes no selected item form or privileged retry reads", async () => {
    const view = uiFixture({ denied: true }); const { $ } = await view.render(); const section = retrySection($);
    expect(section.length).toBe(1); expect(section.find("form").length).toBe(0); expect(section.text()).toContain("Недоступно");
    expect(view.from.mock.calls.filter(call => call[0] === "translation_job_items")).toHaveLength(0);
    expect(view.rpc.mock.calls.filter(call => call[0] === "get_article_translation_item_retry")).toHaveLength(0);
  });
});

type ActionOptions = {
  initialReceipt?: Row;
  receiptError?: Row;
  receiptData?: unknown;
  noClient?: boolean;
  noSession?: boolean;
  runtimeAllowed?: boolean;
  provider?: string;
  sourceChanged?: boolean;
  manualEnglish?: boolean;
  privateDraft?: Row;
  beginError?: Row;
  beginOverrides?: Row;
  beginLost?: boolean;
  beginLostCommitted?: boolean;
  finishError?: Row;
  finishLost?: boolean;
  finishLostCommitted?: boolean;
  cancelledDuringProvider?: boolean;
  modelError?: unknown;
  modelBeforeProviderError?: unknown;
  nativeAt?: "get" | "begin" | "finish" | "model";
  fulfilledNative?: boolean;
};
function actionFixture(options: ActionOptions = {}) {
  const article: Row = { id: articleId, title: authored.ru, subtitle: "Original subtitle", excerpt: "Original excerpt", slug: "original-ru",
    content_html: `<p>${authored.ru}</p>`, content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.ru }] }] },
    cover_alt: "Original image rights", cover_external_url: null, category_id: categoryId, legacy_path: null, canonical_url: "https://site.invalid/culture/original-ru",
    status: "published", deleted_at: null, allow_indexing: true, featured: false, show_on_homepage: true, pinned: false,
    sources: [{ text: "https://source.invalid/original" }], bibliography: [{ text: "Original bibliography" }], seo_title: "Original title", seo_description: "Original description", seo_keywords: ["author"],
    og_title: "Original OG", og_description: "Original OG description", updated_at: revision, categories: { slug: "culture" }, rights: { holder: "Original author", license: "CC BY" } };
  const reads: Row[] = [], rpcCalls: Row[] = [], domainReads: Row[] = [], legacyWrites: Row[] = [], attempts: Row[] = [], journal: Row[] = [];
  const providerCalls: Row[] = [];
  let privateDraft = options.privateDraft ?? null;
  let prepared: { outcome: Row; envelope: Row; candidateHash: string } | null = null;
  let english: Row;
  let currentReceipt: Row;
  const session = vi.fn(async () => options.noSession ? null : { user: { id: actorId }, role: "admin" });
  const gate = vi.fn(async () => options.runtimeAllowed !== false);
  const revalidatePath = vi.fn();
  const build = vi.fn(async () => { throw new Error("Private retry must not request a public build"); });
  const translator = vi.fn(async (_input: Row, call: Row) => {
    if (Object.hasOwn(options, "modelBeforeProviderError")) throw options.modelBeforeProviderError;
    call.operationBudget?.beforeProviderCall();
    const translation = { provider: "cloudflare", model: "local-model", pass: "translation" };
    const firstCall = await call.providerJournal?.beforeDispatch(translation);
    if (options.nativeAt === "model") throw nativeSignal();
    if (Object.hasOwn(options, "modelError")) throw options.modelError;
    await call.providerJournal?.responseReceived({ ...translation, callId: firstCall, httpStatus: null,
      requestId: "local-request", responseId: "local-response", inputTokens: 30, outputTokens: 20 });
    call.operationBudget?.beforeProviderCall();
    const review = { provider: "cloudflare", model: "local-review", pass: "review" };
    const secondCall = await call.providerJournal?.beforeDispatch(review);
    await call.providerJournal?.responseReceived({ ...review, callId: secondCall, httpStatus: null,
      requestId: "local-review-request", responseId: "local-review-response", inputTokens: 20, outputTokens: 20 });
    return { title: "New private English", subtitle: "New subtitle", excerpt: "New excerpt", content_html: "<p>New private English</p>", cover_alt: "Original image rights",
      sources: ["https://source.invalid/original"], bibliography: ["Original bibliography"], seo_title: "New private title", seo_description: "New description", seo_keywords: ["author"],
      og_title: "New OG", og_description: "New OG description", model: "local-model", reviewModel: "local-review", requestId: "local-request", reviewRequestId: "local-review-request",
      inputTokens: 30, outputTokens: 20, reviewInputTokens: 20, reviewOutputTokens: 20 };
  });
  const client: Row = { from(table: string) {
    const filters: Row[] = []; let columns = "";
    const query: Row = { select(value: string) { columns = value; return query; }, eq(key: string, value: unknown) { filters.push({ key, value }); return query; },
      is(key: string, value: unknown) { filters.push({ key, value }); return query; },
      insert(payload: Row) { legacyWrites.push({ table, payload }); throw new Error("Private item retry performed a direct canonical or audit insert"); },
      update(payload: Row) { legacyWrites.push({ table, payload }); throw new Error("Private item retry performed a direct canonical update"); },
      async maybeSingle() {
        reads.push({ table, columns, filters: structuredClone(filters) });
        if (table === "articles") return { data: structuredClone(article), error: null };
        if (table === "article_translations") return { data: structuredClone(english), error: null };
        if (table === "article_working_drafts") return { data: structuredClone(privateDraft), error: null };
        throw new Error(`Unexpected item retry read ${table}`);
      } };
    return query;
  }, async rpc(name: string, input: Row) {
    if (name === "get_article_translation_sync_run" || name === "get_translation_job_resume") {
      domainReads.push({ name, input: structuredClone(input) });
      if (name === "get_article_translation_sync_run") return { data: null, error: { code: "P0002", message: "ordinary article job not found" } };
      return { data: { id: jobId, kind: "article", status: currentReceipt.jobStatus, resumeCursor }, error: null };
    }
    rpcCalls.push({ name, input: structuredClone(input) });
    const phase = name === "get_article_translation_item_retry" ? "get"
      : name === "begin_article_translation_item_retry" ? "begin"
      : name === "finish_article_translation_item_retry" ? "finish" : null;
    if (options.nativeAt === phase) {
      if (options.fulfilledNative) return { data: null, error: nativeSignal() };
      throw nativeSignal();
    }
    if (name === "get_article_translation_item_retry") {
      if (options.receiptError) return { data: null, error: options.receiptError };
      if (Object.hasOwn(options, "receiptData")) return { data: options.receiptData, error: null };
      return { data: structuredClone(currentReceipt), error: null };
    }
    if (name === "begin_article_translation_item_retry") {
      if (options.beginError) return { data: null, error: options.beginError };
      if (options.beginLost && !options.beginLostCommitted) throw new Error("Unknown begin transport outcome");
      currentReceipt = runningReceipt({ sourceHash: originalSourceHash });
      attempts.push({ itemId, operationId, attempt: 2 });
      if (options.beginLostCommitted) throw new Error("Begin committed but response lost");
      return { data: { ...structuredClone(currentReceipt), replayed: false, canExecute: true, ...options.beginOverrides }, error: null };
    }
    if (name === "get_article_translation_item_retry_candidate") return { data: candidate(), error: null };
    if (name === "record_article_translation_item_retry_dispatch") {
      providerCalls.push({ callId: input.p_call_id, provider: input.p_provider, model: input.p_model, pass: input.p_pass,
        dispatchRecordedAt: revision, responseReceivedAt: null, httpStatus: null, requestId: null,
        responseId: null, inputTokens: null, outputTokens: null });
      return { data: progress(true), error: null };
    }
    if (name === "record_article_translation_item_retry_response") {
      const row = providerCalls.find(value => value.callId === input.p_metadata.callId);
      if (!row) throw new Error("Response has no admitted fixture call");
      Object.assign(row, input.p_metadata, { responseReceivedAt: revision });
      return { data: progress(false), error: null };
    }
    if (name === "stage_article_translation_item_retry_candidate") {
      if (providerCalls.length !== input.p_outcome.providerCalls || providerCalls.some(value => value.responseReceivedAt === null)) {
        throw new Error("Candidate fixture has unconfirmed provider calls");
      }
      prepared = { outcome: structuredClone(input.p_outcome), envelope: structuredClone(input.p_english_payload),
        candidateHash: hash(JSON.stringify({ outcome: input.p_outcome, envelope: input.p_english_payload })) };
      privateDraft = { article_id: articleId, version: 7, updated_at: revision, draft_scope: "english-only", draft_english_enabled: true,
        english_payload: structuredClone(input.p_english_payload), base_article_updated_at: revision, expected_english_updated_at: englishRevision };
      return { data: candidate(), error: null };
    }
    if (name === "finish_article_translation_item_retry") {
      if (options.finishError) return { data: null, error: options.finishError };
      if (options.finishLost && !options.finishLostCommitted) throw new Error("Unknown finish transport outcome");
      const outcome = options.cancelledDuringProvider ? "cancelled" : input.p_outcome.status;
      const succeeded = outcome === "succeeded";
      if (prepared && (JSON.stringify(prepared.outcome) !== JSON.stringify(input.p_outcome) ||
        JSON.stringify(prepared.envelope) !== JSON.stringify(input.p_english_payload))) throw new Error("FINISH changed the prepared fixture intent");
      if (succeeded && !prepared) throw new Error("FINISH has no saved candidate");
      currentReceipt = finishedReceipt({ sourceHash: originalSourceHash, itemStatus: succeeded ? "succeeded" : outcome,
        jobStatus: outcome === "cancelled" ? "cancelled" : "partial", result: { outcome, errorCode: outcome === "cancelled" ? null : input.p_outcome.errorCode ?? null,
          persistence: succeeded ? "working-draft" : "none", workingDraftVersion: succeeded ? 7 : null, workingDraftUpdatedAt: succeeded ? revision : null,
          publication: "unchanged", humanReview: succeeded ? "pending" : "unchanged", providerCalls: input.p_outcome.providerCalls } });
      journal.push({ itemId, operationId, outcome });
      if (options.finishLostCommitted) throw new Error("Finish committed but response lost");
      return { data: structuredClone(currentReceipt), error: null };
    }
    throw new Error(`A single item action tried an unrelated RPC ${name}`);
  } };
  const modules = actualModules({
    "next/cache": { revalidatePath }, "@/lib/auth": { requireStaff: session },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => options.noClient ? null : client },
    "apps/admin/lib/auto-translate-article": { translateArticleSourceToEnglish: translator },
    "apps/admin/lib/env": { adminEnv: { openAiAutoTranslateArticles: true, publicSiteUrl: "https://site.invalid", premiumTranslationProvider: options.provider ?? "cloudflare",
      cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review", openAiPremiumTranslationReview: true } },
    "apps/admin/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: gate },
    "@/lib/publication": { requestPublicBuild: build },
  });
  const sourceHash = modules.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash;
  const originalSourceHash = sourceHash({ title: article.title, subtitle: article.subtitle, excerpt: article.excerpt, slug: article.slug,
    contentHtml: article.content_html, contentJson: article.content_json, coverAlt: article.cover_alt, sources: article.sources, bibliography: article.bibliography,
    seoTitle: article.seo_title, seoDescription: article.seo_description, seoKeywords: article.seo_keywords, ogTitle: article.og_title, ogDescription: article.og_description });
  english = { id: englishId, article_id: articleId, locale: "en", title: authored.en, content_html: `<p>${authored.en}</p>`, status: "published",
    slug: "original-en", canonical_url: "https://site.invalid/original-en", updated_at: englishRevision, deleted_at: null, source_content_hash: hash("old source"), source_article_updated_at: englishRevision,
    content_json: options.manualEnglish ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.en }] }] }
      : modules.load("apps/admin/lib/article-translation-machine-ownership.ts").premiumArticleMachineContentJson({ sourceHash: hash("old source"), model: "old-model", reviewerModel: null, translatorRequestId: "old-request", reviewerRequestId: null, generatedAt: englishRevision }),
    sources: [{ text: "https://source.invalid/manual-en" }], rights: { holder: "English author", license: "Original author consent" }, reviewed_at: englishRevision, approved_at: englishRevision, published_at: englishRevision };
  const originalArticle = structuredClone(article), originalEnglish = structuredClone(english), originalPrivateDraft = structuredClone(privateDraft);
  currentReceipt = receipt({ sourceHash: originalSourceHash, ...options.initialReceipt });
  function progress(canDispatch: boolean) {
    return { version: 1, jobId, itemId, articleId, operationId, provider: "cloudflare", phase: "running",
      startedAt: providerCalls.length ? revision : null, updatedAt: revision, providerCalls: providerCalls.length,
      canDispatch, replayed: false, calls: structuredClone(providerCalls) };
  }
  function candidate() {
    return { version: 1, jobId, itemId, articleId, operationId, provider: "cloudflare", sourceHash: originalSourceHash,
      sourceUpdatedAt: revision, englishUpdatedAt: englishRevision, phase: currentReceipt.phase,
      candidateState: prepared ? currentReceipt.phase === "finished" ? "finished" : "staged" : "missing",
      candidateHash: prepared?.candidateHash ?? null, preparedAt: prepared ? revision : null,
      workingDraftVersion: prepared ? 7 : null, workingDraftUpdatedAt: prepared ? revision : null,
      providerCalls: providerCalls.length, canRecover: Boolean(prepared && currentReceipt.phase === "running"),
      replayed: currentReceipt.phase === "finished", blockReason: prepared ? null : "candidate_missing" };
  }
  if (options.sourceChanged) { article.title += " edited after intent"; article.updated_at = "2026-10-08T11:00:00.123456+00:00"; }
  const action = modules.load(actionFile).retryArticleTranslationItemAction;
  function form(overrides: Record<string, string> = {}) {
    const data = new FormData(); for (const [key, value] of Object.entries({ job_id: jobId, item_id: itemId, operation_id: operationId,
      expected_job_version: "7", expected_attempt_count: "1", source_hash: originalSourceHash, ...overrides })) data.set(key, value);
    return data;
  }
  async function run(data = form()) {
    const original = [...data.entries()];
    try { await action(data); throw new Error("Expected actual native Next redirect"); }
    catch (error) {
      expect((error as Row).digest).toMatch(/^NEXT_REDIRECT;/u); expect([...data.entries()]).toEqual(original);
      const url = new URL(nativeRedirect.getURLFromRedirectError(error), "https://site.invalid"); expect(url.href).not.toContain(privateError);
      traces.push({ kind: "actual-item-action", options, originalArticle, originalEnglish, originalPrivateDraft, article: structuredClone(article), english: structuredClone(english),
        privateDraft: structuredClone(privateDraft), receipt: structuredClone(currentReceipt), rpcCalls, domainReads, reads, legacyWrites, attempts, journal, translatorCalls: translator.mock.calls, redirect: url.pathname + url.search });
      return url;
    }
  }
  return { run, form, modules, client, article, originalArticle, originalEnglish, originalPrivateDraft, getEnglish: () => english,
    getPrivateDraft: () => privateDraft, rpcCalls, domainReads, reads, legacyWrites, attempts, journal, translator, gate, session, revalidatePath, build,
    originalSourceHash, currentReceipt: () => currentReceipt };
}
function protectedPublic(view: ReturnType<typeof actionFixture>) {
  expect(view.domainReads.map(call => call.name)).toEqual(Array.from({ length: view.domainReads.length / 2 },
    () => ["get_article_translation_sync_run", "get_translation_job_resume"]).flat());
  expect(view.domainReads.every(call => call.input.p_job_id === jobId && Object.keys(call.input).length === 1)).toBe(true);
  expect(view.getEnglish()).toEqual(view.originalEnglish); expect(view.legacyWrites).toEqual([]); expect(view.build).not.toHaveBeenCalled();
  expect(view.rpcCalls.every(call => ["get_article_translation_item_retry", "begin_article_translation_item_retry", "finish_article_translation_item_retry",
    "get_article_translation_item_retry_candidate", "record_article_translation_item_retry_dispatch", "record_article_translation_item_retry_response",
    "stage_article_translation_item_retry_candidate"].includes(call.name))).toBe(true);
}

// The action is a new feature, so these tests execute current exports only.
// An opt-in UI proof registers only the six identical old/current page cases;
// it does not mark absent new action exports as successful or failed tests.
if (!process.env.M07_ITEM_RETRY_ONLY_UI) {
  describe("M07 actual item retry action targets one durable item and preserves public versions", () => {
    const successfulRpcNames = ["get_article_translation_item_retry", "begin_article_translation_item_retry",
      "get_article_translation_item_retry_candidate", "record_article_translation_item_retry_dispatch",
      "record_article_translation_item_retry_response", "record_article_translation_item_retry_dispatch",
      "record_article_translation_item_retry_response", "stage_article_translation_item_retry_candidate",
      "finish_article_translation_item_retry"];
    it("runs one item, one attempt and one two-pass model, then stores only private draft EN without moving corpus cursor", async () => {
      const view = actionFixture(); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(false);
      expect(Object.fromEntries(url.searchParams)).toEqual({ retryJob: jobId, retryItem: itemId, retryOperation: operationId });
      expect(view.rpcCalls.map(call => call.name)).toEqual(successfulRpcNames);
      expect(view.rpcCalls[1].input).toEqual({ p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId, p_expected_job_version: "7", p_expected_attempt_count: 1,
        p_expected_source_hash: view.originalSourceHash, p_expected_article_updated_at: revision, p_expected_english_updated_at: englishRevision, p_provider: "cloudflare" });
      expect(view.rpcCalls.at(-1)!.input).toMatchObject({ p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId,
        p_outcome: { status: "succeeded", providerCalls: 2, model: "local-model", requestId: "local-request", inputTokens: 30, outputTokens: 20 },
        p_english_payload: { mode: "save", payload: { status: "draft", source_content_hash: view.originalSourceHash, reviewed_at: null, approved_at: null, published_at: null } } });
      expect(view.attempts).toEqual([{ itemId, operationId, attempt: 2 }]); expect(view.journal).toEqual([{ itemId, operationId, outcome: "succeeded" }]);
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getPrivateDraft()?.draft_scope).toBe("english-only"); protectedPublic(view);
      expect(view.article).toEqual(view.originalArticle);
      for (const read of view.reads) {
        expect(read.filters).toEqual(expect.arrayContaining(read.table === "articles"
          ? [{ key: "id", value: articleId }, { key: "deleted_at", value: null }]
          : read.table === "article_translations" ? [{ key: "article_id", value: articleId }, { key: "locale", value: "en" }]
          : [{ key: "article_id", value: articleId }]));
      }
      expect(resumeCursor).toEqual({ articleScan: { version: 1, order: "id", upperId: articleId, afterId: null, pendingIds: [articleId], nextIndex: 0, lastWindow: true, exhausted: false } });
    });
    it("a double submit reads the same finished operation without a second model, attempt or private write", async () => {
      const view = actionFixture(); await view.run(); const firstCalls = view.rpcCalls.length; const firstDraft = structuredClone(view.getPrivateDraft());
      const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(false); expect(view.rpcCalls.slice(firstCalls).map(call => call.name)).toEqual(["get_article_translation_item_retry"]);
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.attempts).toHaveLength(1); expect(view.journal).toHaveLength(1); expect(view.getPrivateDraft()).toEqual(firstDraft); protectedPublic(view);
    });
    it("a running operation is a receipt check, never a renewed provider entitlement", async () => {
      const view = actionFixture({ initialReceipt: runningReceipt() }); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed");
      expect(view.rpcCalls).toHaveLength(1); expect(view.translator).not.toHaveBeenCalled(); expect(view.gate).not.toHaveBeenCalled(); expect(view.reads).toEqual([]); protectedPublic(view);
    });
    it("a denied session starts neither privileged SDK reads nor a model request", async () => {
      const view = actionFixture({ noSession: true }); const url = await view.run(); expect(url.pathname).toBe("/login");
      expect(view.rpcCalls).toEqual([]); expect(view.reads).toEqual([]); expect(view.translator).not.toHaveBeenCalled();
    });
    it("an unavailable SDK client keeps the original item intent without provider calls", async () => {
      const view = actionFixture({ noClient: true }); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("database_unavailable");
      expect(url.searchParams.get("retryOperation")).toBe(operationId); expect(view.rpcCalls).toEqual([]); expect(view.translator).not.toHaveBeenCalled();
    });
    it.each(["9223372036854775806", "9223372036854775807", "9223372036854775808"])("a maximum job version %s cannot admit the two durable retry transitions", async expected_job_version => {
      const view = actionFixture(); const url = await view.run(view.form({ expected_job_version }));
      expect(url.searchParams.get("errorCode")).toBe(expected_job_version === "9223372036854775808" ? "invalid_input" : "write_conflict");
      expect(view.rpcCalls.every(call => call.name === "get_article_translation_item_retry")).toBe(true); expect(view.translator).not.toHaveBeenCalled();
      const adapter = view.modules.load(adapterFile); const rpc = vi.fn();
      await expect(adapter.beginArticleTranslationItemRetry({ rpc }, { jobId, itemId, operationId, expectedJobVersion: expected_job_version,
        expectedAttemptCount: 1, expectedSourceHash: view.originalSourceHash, expectedSourceUpdatedAt: revision,
        expectedEnglishUpdatedAt: englishRevision, provider: "cloudflare" })).rejects.toMatchObject({ errorCode: "invalid_input" });
      expect(rpc).not.toHaveBeenCalled();
    });
    it.each(["manual_english", "author_draft_exists", "source_hash_missing", "operation_stopped", "attempt_limit", "job_not_sync"])("a blocked %s receipt never starts a paid attempt", async blockReason => {
      const view = actionFixture({ initialReceipt: receipt({ phase: "blocked", retryable: false, blockReason }) }); const url = await view.run();
      expect(url.searchParams.has("errorCode")).toBe(true); expect(view.translator).not.toHaveBeenCalled(); expect(view.rpcCalls).toHaveLength(1); expect(view.reads).toEqual([]); protectedPublic(view);
    });
    it.each([{ name: "missing retry migration", code: "PGRST202", expected: "translation_migration_required" },
      { name: "SQL missing retry capability", code: "42883", expected: "translation_migration_required" },
      { name: "denied access", code: "42501", expected: "translation_operation_stopped" }])("$name is explicit before model calls", async ({ code, expected }) => {
      const view = actionFixture({ receiptError: { code, message: privateError } }); const url = await view.run();
      expect(url.searchParams.get("errorCode")).toBe(expected); expect(view.translator).not.toHaveBeenCalled(); expect(view.gate).not.toHaveBeenCalled(); protectedPublic(view);
    });
    it.each([null, [], {}, { ...receipt(), jobId: otherItemId }, { ...receipt(), canExecute: true }, { ...receipt(), extra: true }])("a damaged initial receipt %s never grants generation", async receiptData => {
      const view = actionFixture({ receiptData }); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed");
      expect(view.translator).not.toHaveBeenCalled(); expect(view.reads).toEqual([]); expect(view.rpcCalls).toHaveLength(1); protectedPublic(view);
    });
    it.each([{ key: "expected_job_version", value: "8" }, { key: "expected_attempt_count", value: "0" }, { key: "source_hash", value: hash("other source") }])(
      "a changed $key is refused against the receipt before a provider or BEGIN", async ({ key, value }) => {
        const view = actionFixture(); const url = await view.run(view.form({ [key]: value })); expect(url.searchParams.get("errorCode")).toBe("write_conflict");
        expect(view.rpcCalls).toHaveLength(1); expect(view.translator).not.toHaveBeenCalled(); protectedPublic(view);
      },
    );
    it.each([{ name: "runtime disabled", options: { runtimeAllowed: false } }, { name: "changed configured provider", options: { provider: "openai" } }])(
      "$name blocks admission without expense", async ({ options }) => {
        const view = actionFixture(options); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_not_configured");
        expect(view.rpcCalls).toHaveLength(1); expect(view.translator).not.toHaveBeenCalled(); protectedPublic(view);
      },
    );
    it.each([{ name: "fresh RU changed", options: { sourceChanged: true } }, { name: "manual EN takeover", options: { manualEnglish: true } },
      { name: "existing authored working copy", options: { privateDraft: { article_id: articleId, version: 3, english_payload: { title: authored.en } } } }])(
      "$name is checked by the actual helper before BEGIN", async ({ options }) => {
        const view = actionFixture(options); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(true);
        expect(view.rpcCalls).toHaveLength(1); expect(view.translator).not.toHaveBeenCalled(); expect(view.attempts).toEqual([]);
        expect(view.getPrivateDraft()).toEqual(view.originalPrivateDraft); protectedPublic(view);
      },
    );
    it.each([false, true])("an unknown BEGIN (committed=%s) reconciles with GET and never invokes the model", async committed => {
      const view = actionFixture({ beginLost: true, beginLostCommitted: committed }); const url = await view.run();
      expect(url.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed"); expect(view.rpcCalls.map(call => call.name)).toEqual(["get_article_translation_item_retry", "begin_article_translation_item_retry", "get_article_translation_item_retry"]);
      expect(view.translator).not.toHaveBeenCalled(); expect(view.journal).toEqual([]); protectedPublic(view);
      if (committed) { await view.run(); expect(view.translator).not.toHaveBeenCalled(); expect(view.attempts).toHaveLength(1); }
    });
    it("a known BEGIN conflict does not become an admitted generation", async () => {
      const view = actionFixture({ beginError: { code: "40001", message: privateError } }); const url = await view.run();
      expect(url.searchParams.get("errorCode")).toBe("write_conflict"); expect(view.translator).not.toHaveBeenCalled(); expect(view.attempts).toEqual([]); protectedPublic(view);
    });
    it.each([
      { name: "foreign article", values: { articleId: otherItemId } }, { name: "foreign job", values: { jobId: otherItemId } },
      { name: "foreign item", values: { itemId: otherItemId } }, { name: "foreign operation", values: { operationId: otherItemId } },
      { name: "different source hash", values: { sourceHash: hash("foreign RU source") } }, { name: "different source revision", values: { sourceUpdatedAt: englishRevision } },
      { name: "different EN token", values: { englishUpdatedAt: null } }, { name: "different provider", values: { provider: "openai" } },
      { name: "finished job with execute authority", values: { jobStatus: "completed" } }, { name: "completed item with execute authority", values: { itemStatus: "succeeded" } },
      { name: "premature attempt counter", values: { attemptCount: 2 } }, { name: "wrong admitted cap", values: { maxAttempts: 5 } },
      { name: "wrong version", values: { jobVersion: "99" } }, { name: "replay claiming execute authority", values: { replayed: true } },
    ])("a malformed admitted BEGIN receipt $name grants no model call", async ({ values }) => {
      const view = actionFixture({ beginOverrides: values }); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed");
      expect(view.translator).not.toHaveBeenCalled(); expect(view.journal).toEqual([]); expect(view.getPrivateDraft()).toBeNull();
      expect(view.rpcCalls.map(call => call.name)).toEqual(["get_article_translation_item_retry", "begin_article_translation_item_retry", "get_article_translation_item_retry"]); protectedPublic(view);
    });
    it("a lost FINISH response with a durable success receipt is reconciled without regenerating", async () => {
      const view = actionFixture({ finishLostCommitted: true }); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(false);
      expect(view.rpcCalls.map(call => call.name)).toEqual([...successfulRpcNames, "get_article_translation_item_retry", "get_article_translation_item_retry_candidate"]);
      await view.run(); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.attempts).toHaveLength(1); expect(view.journal).toHaveLength(1); protectedPublic(view);
    });
    it("an unconfirmed FINISH leaves a running receipt and repeated submit does only GET", async () => {
      const view = actionFixture({ finishLost: true }); const first = await view.run(); expect(first.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed");
      const callCount = view.rpcCalls.length; await view.run(); expect(view.rpcCalls.slice(callCount).map(call => call.name)).toEqual(["get_article_translation_item_retry"]);
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getPrivateDraft()).toMatchObject({ version: 7, draft_scope: "english-only" });
      expect(view.currentReceipt().phase).toBe("running"); expect(view.journal).toEqual([]); protectedPublic(view);
    });
    it("a failed atomic journal FINISH retains the staged candidate without inventing completion or repeating the model", async () => {
      const view = actionFixture({ finishError: { code: "42501", message: "Controlled attempt audit insertion refused" } });
      const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed"); await view.run();
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getPrivateDraft()).toMatchObject({ version: 7, draft_scope: "english-only" });
      expect(view.currentReceipt().phase).toBe("running"); expect(view.journal).toEqual([]); protectedPublic(view);
    });
    it("a provider request already admitted but rejected remains running and has no blind retry", async () => {
      const view = actionFixture({ modelError: new Error(privateError) }); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_retry_unconfirmed"); await view.run();
      expect(view.rpcCalls.filter(call => call.name.startsWith("finish_"))).toHaveLength(0); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.journal).toEqual([]); protectedPublic(view);
    });
    it("a known refusal before any provider call records the same attempt with zero calls", async () => {
      const view = actionFixture({ modelBeforeProviderError: new Error("Controlled no-request admission stop") }); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(true);
      expect(view.rpcCalls.at(-2)?.name).toBe("finish_article_translation_item_retry"); expect(view.rpcCalls.find(call => call.name.startsWith("finish_"))?.input).toMatchObject({ p_outcome: { status: "dead_letter", providerCalls: 0 }, p_english_payload: null });
      expect(view.journal).toEqual([{ itemId, operationId, outcome: "dead_letter" }]); expect(view.getPrivateDraft()).toBeNull(); protectedPublic(view);
    });
    it("a cancellation after staging preserves the private candidate and public EN without claiming success", async () => {
      const view = actionFixture({ cancelledDuringProvider: true }); const url = await view.run(); expect(url.searchParams.get("errorCode")).toBe("translation_operation_stopped");
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getPrivateDraft()).toMatchObject({ version: 7, draft_scope: "english-only" });
      expect(view.currentReceipt().result).toMatchObject({ outcome: "cancelled", persistence: "none", humanReview: "unchanged" }); protectedPublic(view);
    });
    it.each(["get", "begin", "finish"] as const)("preserves fulfilled/rejected actual Next control flow at %s", async nativeAt => {
      for (const fulfilledNative of [false, true]) {
        const view = actionFixture({ nativeAt, fulfilledNative }); const url = await view.run(); expect(url.pathname).toBe("/item-retry-native-signal");
        if (nativeAt !== "finish") expect(view.translator).not.toHaveBeenCalled(); protectedPublic(view);
      }
    });
    it("preserves a native Next model signal after admission without converting it to a failed receipt", async () => {
      const view = actionFixture({ nativeAt: "model" }); const url = await view.run(); expect(url.pathname).toBe("/item-retry-native-signal");
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.rpcCalls.map(call => call.name)).toEqual(["get_article_translation_item_retry",
        "begin_article_translation_item_retry", "get_article_translation_item_retry_candidate", "record_article_translation_item_retry_dispatch"]);
      expect(view.journal).toEqual([]); protectedPublic(view);
    });
    it.each(["job_id", "item_id", "operation_id", "expected_job_version", "expected_attempt_count", "source_hash"])("duplicate submitted %s is rejected before any DB work", async name => {
      const view = actionFixture(); const data = view.form(); data.append(name, String(data.get(name))); const url = await view.run(data);
      expect(url.searchParams.get("errorCode")).toBe("invalid_input"); expect(view.rpcCalls).toEqual([]); expect(view.translator).not.toHaveBeenCalled();
    });
  });

  describe("M07 actual continuation actions wait for the reviewing item", () => {
    it.each(["batch", "resume"] as const)("%s continuation does not scan or pay while that job has an unresolved item retry", async kind => {
      const rpc = vi.fn(async (_name?: string, _input?: Row) => ({ data: { id: jobId, kind: "article", status: "reviewing", resumeCursor }, error: null }));
      const domainReads: Row[] = [];
      const routedRpc = async (name: string, input: Row) => {
        if (name === "get_article_translation_sync_run") {
          domainReads.push({ name, input });
          return { data: null, error: { code: "P0002", message: "ordinary article job not found" } };
        }
        return rpc(name, input);
      };
      const from = vi.fn(() => { throw new Error("Reviewing continuation attempted a corpus scan"); });
      const translator = vi.fn(() => { throw new Error("Reviewing continuation attempted generation"); });
      const gate = vi.fn(); const otherAction = vi.fn();
      const modules = actualModules({ "next/cache": { revalidatePath: vi.fn() }, "@/lib/auth": { requireStaff: async () => ({ user: { id: actorId } }) },
        "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ rpc: routedRpc, from }) },
        "@/lib/auto-translate-published-article-premium": { ensurePublishedArticlePremiumEnglish: translator },
        "@/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: gate },
        "@/lib/publication": { requestPublicBuild: vi.fn() },
        "apps/admin/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review" } },
        "./actions": { translatePremiumLibraryBatchAction: otherAction, translatePremiumSiteCopyBatchAction: otherAction, translatePremiumWriterBatchAction: otherAction },
        "./country-actions": { translatePremiumCountryBatchAction: otherAction } });
      const data = new FormData(); data.set(kind === "batch" ? "articleJob" : "job_id", jobId);
      const action = modules.load(`apps/admin/app/(dashboard)/translations/${kind === "batch" ? "article-actions" : "resume-action"}.ts`)[kind === "batch" ? "translatePremiumArticleBatchAction" : "resumeTranslationJobAction"];
      let caught: unknown; try { await action(data); } catch (error) { caught = error; }
      expect((caught as Row).digest).toMatch(/^NEXT_REDIRECT;/u);
      expect(new URL(nativeRedirect.getURLFromRedirectError(caught), "https://site.invalid").searchParams.get("errorCode")).toBe("translation_retry_pending");
      expect(rpc).toHaveBeenCalledExactlyOnceWith("get_translation_job_resume", { p_job_id: jobId }); expect(from).not.toHaveBeenCalled();
      expect(domainReads).toEqual(kind === "batch" ? [{ name: "get_article_translation_sync_run", input: { p_job_id: jobId } }] : []);
      expect(translator).not.toHaveBeenCalled(); expect(gate).not.toHaveBeenCalled(); expect(otherAction).not.toHaveBeenCalled();
    });
  });

  describe("M07 installed Supabase SDK preserves the item retry RPC contract", () => {
    it("serializes GET/BEGIN/FINISH with exact IDs, source revision and private envelope using only custom local fetch", async () => {
      const observed: Row[] = [];
      const client = createClient("https://m07-fixture.invalid", "synthetic-local-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        db: { retry: false }, global: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init); const body = JSON.parse(await request.text()); const url = new URL(request.url); observed.push({ method: request.method, path: url.pathname, body });
          const value = url.pathname.endsWith("/get_article_translation_item_retry") ? receipt()
            : url.pathname.endsWith("/begin_article_translation_item_retry") ? runningReceipt({ canExecute: true, replayed: false }) : finishedReceipt();
          return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
        } } });
      const view = actionFixture(); await view.run(); const englishEnvelope = view.rpcCalls.find(call => call.name.startsWith("finish_"))!.input.p_english_payload;
      const adapter = actualModules({}).load(adapterFile);
      const target = { jobId, itemId, operationId }; const intent = { ...target, expectedJobVersion: "7", expectedAttemptCount: 1,
        expectedSourceHash: readySourceHash, expectedSourceUpdatedAt: revision, expectedEnglishUpdatedAt: englishRevision, provider: "cloudflare" };
      const reboundEnvelope = structuredClone(englishEnvelope); reboundEnvelope.payload.source_content_hash = readySourceHash;
      await adapter.getArticleTranslationItemRetry(client, target); await adapter.beginArticleTranslationItemRetry(client, intent);
      await adapter.finishArticleTranslationItemRetry(client, intent, { status: "succeeded", providerCalls: 2 }, reboundEnvelope);
      expect(observed.map(call => call.path)).toEqual(["/rest/v1/rpc/get_article_translation_item_retry", "/rest/v1/rpc/begin_article_translation_item_retry", "/rest/v1/rpc/finish_article_translation_item_retry"]);
      expect(observed.every(call => call.method === "POST")).toBe(true);
      expect(Object.keys(observed[1].body).sort()).toEqual(["p_job_id", "p_item_id", "p_operation_id", "p_expected_job_version", "p_expected_attempt_count", "p_expected_source_hash", "p_expected_article_updated_at", "p_expected_english_updated_at", "p_provider"].sort());
      expect(observed[1].body.p_expected_article_updated_at).toBe(revision); expect(observed[1].body.p_expected_english_updated_at).toBe(englishRevision);
      expect(observed[2].body).toEqual({ p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId, p_outcome: { status: "succeeded", providerCalls: 2 }, p_english_payload: reboundEnvelope });
      traces.push({ kind: "installed-SDK-custom-fetch", observed });
    });
    it("rejects an invalid entity/operation before any SDK HTTP and parses a missing capability explicitly", async () => {
      const fetch = vi.fn(async () => new Response(JSON.stringify({ code: "PGRST202", message: privateError, details: null, hint: null }), { status: 404, headers: { "Content-Type": "application/json" } }));
      const client = createClient("https://m07-fixture.invalid", "synthetic-local-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch } });
      const adapter = actualModules({}).load(adapterFile);
      await expect(adapter.getArticleTranslationItemRetry(client, { jobId, itemId: "invalid", operationId })).rejects.toMatchObject({ errorCode: "invalid_input" }); expect(fetch).not.toHaveBeenCalled();
      await expect(adapter.getArticleTranslationItemRetry(client, { jobId, itemId, operationId })).rejects.toMatchObject({ errorCode: "translation_migration_required" }); expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
}

afterAll(() => {
  if (process.env.M07_ITEM_RETRY_EVIDENCE) writeFileSync(process.env.M07_ITEM_RETRY_EVIDENCE, `${JSON.stringify({
    fixture: { module: path.relative(repoRoot, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()], traces,
    limitations: ["Actual page/action/helper/adapter/strict private parser/source hash/classifier/budget/Next/Zod execute",
      "Auth/read gate, SDK ledger, model and UI submit boundary are controlled; no real Auth/DB/RLS/provider",
      "Two installed SDK custom-fetch cases use real serialization/Response parsing without real network or GoTrue",
      "UI only before/current scopes register identical six page cases; new action tests are current-only"],
  }, null, 2)}\n`, { flag: "wx" });
});
