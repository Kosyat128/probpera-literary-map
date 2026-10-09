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
    const before = process.env.M07_ITEM_ADMISSION_BASELINE_ROOT;
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
      ? { data: null, error: { code: "57014", message: privateError } } : input?.p_operation_id !== null
        ? { data: null, error: { code: "P0002", message: "article retry operation not found" } } : { data: selected, error: null };
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

type ActionOptions = {
  specificResponse?: Row;
  fallbackResponse?: Row;
  fallbackOverrides?: Row;
  sdkTransport?: boolean;
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
  const providerCalls: Row[] = [], privateSaves: Row[] = [];
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
      if (currentReceipt.phase !== "ready") return { data: structuredClone(currentReceipt), error: null };
      const response = input.p_operation_id !== null
        ? options.specificResponse ?? { data: null, error: { code: "P0002", message: "article retry operation not found" } }
        : options.fallbackResponse ?? { data: { ...structuredClone(currentReceipt), ...options.fallbackOverrides }, error: null };
      if (Object.hasOwn(response, "reject")) throw response.reject;
      return response;
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
      privateSaves.push(structuredClone(privateDraft));
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
  const sdkWire: Row[] = [];
  if (options.sdkTransport) {
    const ledgerRpc = client.rpc.bind(client);
    const sdk = createClient("https://admission-fixture.invalid", "synthetic-local-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false },
      global: { fetch: async (url: string, init: Row) => {
        const target = new URL(String(url)), body = JSON.parse(init.body);
        sdkWire.push({ method: init.method, path: target.pathname, body });
        const result = await ledgerRpc(target.pathname.split("/").at(-1), body);
        return new Response(JSON.stringify(result.error ?? result.data), {
          status: result.error ? result.error.code === "P0002" ? 404 : 500 : 200,
          headers: { "Content-Type": "application/json" },
        });
      } },
    });
    client.rpc = sdk.rpc.bind(sdk);
  }
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
      traces.push({ kind: "actual-item-action", options, originalArticle, originalEnglish, originalPrivateDraft, sdkWire, article: structuredClone(article), english: structuredClone(english),
        privateDraft: structuredClone(privateDraft), receipt: structuredClone(currentReceipt), rpcCalls, domainReads, reads, legacyWrites, attempts, journal, providerCalls, privateSaves,
        translatorCalls: translator.mock.calls, redirect: url.pathname + url.search });
      return url;
    }
  }
  return { run, form, modules, client, article, originalArticle, originalEnglish, originalPrivateDraft, getEnglish: () => english,
    getPrivateDraft: () => privateDraft, rpcCalls, domainReads, reads, legacyWrites, attempts, journal, translator, gate, session, revalidatePath, build,
    sdkWire, providerCalls, privateSaves, originalSourceHash, currentReceipt: () => currentReceipt };
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


const missing = { data: null, error: { code: "P0002", message: "article retry operation not found" } };
function noExpense(view: ReturnType<typeof actionFixture>) {
  expect(view.translator).not.toHaveBeenCalled(); expect(view.attempts).toEqual([]); expect(view.journal).toEqual([]);
  expect(view.rpcCalls.every(call => call.name === "get_article_translation_item_retry")).toBe(true); protectedPublic(view);
}
describe("M07 fresh operation admission matches specific GET SQL not-found semantics", () => {
  const successfulRpcNames = ["get_article_translation_item_retry", "get_article_translation_item_retry", "begin_article_translation_item_retry",
    "get_article_translation_item_retry_candidate", "record_article_translation_item_retry_dispatch", "record_article_translation_item_retry_response",
    "record_article_translation_item_retry_dispatch", "record_article_translation_item_retry_response", "stage_article_translation_item_retry_candidate",
    "finish_article_translation_item_retry"];
  it("actual explicit fresh-operation page reads null-operation eligibility and keeps one stable form without generation", async () => {
    const view = uiFixture(); const { $ } = await view.render({ retryOperation: operationId }); const section = retrySection($);
    expect(section.find("form")).toHaveLength(1); expect(section.find('input[name="operation_id"]').val()).toBe(operationId);
    expect(section.find('input[name="item_id"]').val()).toBe(itemId);
    expect(view.rpc.mock.calls.filter(call => call[0] === "get_article_translation_item_retry").map(call => call[1]?.p_operation_id)).toEqual([operationId, null]);
    expect(view.rpc.mock.calls.every(call => !String(call[0]).startsWith("begin_") && !String(call[0]).startsWith("finish_"))).toBe(true);
  });
  it("actual fresh POST reaches strict BEGIN and private FINISH after confirmed specific P0002 and null GET ready", async () => {
    const view = actionFixture(); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(false);
    expect(view.rpcCalls.map(call => call.name)).toEqual(successfulRpcNames);
    expect(view.rpcCalls.slice(0, 2).map(call => call.input.p_operation_id)).toEqual([operationId, null]);
    expect(view.rpcCalls[2].input).toMatchObject({ p_job_id: jobId, p_item_id: itemId, p_operation_id: operationId,
      p_expected_job_version: "7", p_expected_attempt_count: 1, p_expected_source_hash: view.originalSourceHash,
      p_expected_article_updated_at: revision, p_expected_english_updated_at: englishRevision });
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.attempts).toHaveLength(1); expect(view.journal).toHaveLength(1);
    expect(view.providerCalls.map(call => call.pass)).toEqual(["translation", "review"]);
    expect(view.providerCalls.every(call => call.responseReceivedAt === revision)).toBe(true); expect(view.privateSaves).toHaveLength(1);
    expect(view.rpcCalls[8].input.p_outcome).toEqual(view.rpcCalls[9].input.p_outcome);
    expect(view.rpcCalls[8].input.p_english_payload).toEqual(view.rpcCalls[9].input.p_english_payload);
    expect(view.getPrivateDraft()).toEqual(view.privateSaves[0]);
    expect(view.getPrivateDraft()?.english_payload.payload).toMatchObject({ status: "draft", reviewed_at: null, approved_at: null, published_at: null });
    expect(view.article).toEqual(view.originalArticle); protectedPublic(view);
  });
  it("duplicate completed operation uses only specific GET with no eligibility fallback or renewed expense", async () => {
    const view = actionFixture({ initialReceipt: finishedReceipt() }); const url = await view.run();
    expect(url.searchParams.has("errorCode")).toBe(false); expect(view.rpcCalls).toHaveLength(1);
    expect(view.rpcCalls[0].input.p_operation_id).toBe(operationId); noExpense(view); expect(view.gate).not.toHaveBeenCalled();
  });
  it("duplicate active operation checks only its bound receipt without eligibility fallback", async () => {
    const view = actionFixture({ initialReceipt: runningReceipt() }); await view.run(); expect(view.rpcCalls).toHaveLength(1); noExpense(view);
  });
  it.each([
    { name: "contradictory data and P0002", response: { data: receipt(), error: missing.error } },
    { name: "rejected P0002", response: { reject: missing.error } },
    { name: "missing data field", response: { error: missing.error } },
    { name: "wrong-shaped data", response: { data: [], error: missing.error } },
    { name: "permission loss", response: { data: null, error: { code: "42501", message: privateError } } },
    { name: "HTTP-looking forbidden code", response: { data: null, error: { code: "403", message: privateError } } },
    { name: "intent conflict", response: { data: null, error: { code: "40001", message: privateError } } },
    { name: "case-mismatched SQL code", response: { data: null, error: { code: "p0002", message: privateError } } },
    { name: "padded SQL code", response: { data: null, error: { code: "P0002 ", message: privateError } } },
    { name: "transient read failure", response: { data: null, error: { code: "57014", message: privateError } } },
    { name: "malformed success", response: { data: {}, error: null } },
    { name: "null success", response: { data: null, error: null } },
    { name: "generic rejected lookup", response: { reject: new Error(privateError) } },
  ])("$name cannot turn a failed specific GET into an eligible new operation", async ({ response }) => {
    const view = actionFixture({ specificResponse: response }); const url = await view.run();
    expect(url.searchParams.has("errorCode")).toBe(true); expect(view.rpcCalls).toHaveLength(1); noExpense(view); expect(view.gate).not.toHaveBeenCalled();
  });
  it.each([
    { name: "nonready running", overrides: runningReceipt() },
    { name: "nonready finished", overrides: finishedReceipt() },
    { name: "manual English blocked", overrides: receipt({ phase: "blocked", retryable: false, blockReason: "manual_english" }) },
    { name: "different job version", overrides: { jobVersion: "8" } },
    { name: "different attempt", overrides: { attemptCount: 0 } },
    { name: "different source hash", overrides: { sourceHash: hash("different RU") } },
  ])("null-operation fallback $name is never provider authority", async ({ overrides }) => {
    const view = actionFixture({ fallbackOverrides: overrides }); const url = await view.run();
    expect(url.searchParams.has("errorCode")).toBe(overrides.phase !== "finished"); expect(view.rpcCalls.slice(0, 2).map(call => call.input.p_operation_id)).toEqual([operationId, null]); noExpense(view);
  });
  it.each([
    { name: "null receipt", response: { data: null, error: null } },
    { name: "malformed receipt", response: { data: [], error: null } },
    { name: "second confirmed P0002", response: missing },
    { name: "read failure", response: { data: null, error: { code: "57014", message: privateError } } },
    { name: "rejected P0002", response: { reject: missing.error } },
  ])("fallback $name never loops or admits generation", async ({ response }) => {
    const view = actionFixture({ fallbackResponse: response }); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(true);
    expect(view.rpcCalls).toHaveLength(2); noExpense(view);
  });
  it.each([
    { name: "manual EN takeover", options: { manualEnglish: true } },
    { name: "authored private copy", options: { privateDraft: { article_id: articleId, version: 3, payload: { title: authored.ru } } } },
    { name: "source revision changed", options: { sourceChanged: true } },
    { name: "runtime kill switch", options: { runtimeAllowed: false } },
  ])("fresh eligibility does not bypass $name before actual BEGIN", async ({ options }) => {
    const view = actionFixture(options); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(true);
    expect(view.rpcCalls).toHaveLength(2); noExpense(view); expect(view.getPrivateDraft()).toEqual(view.originalPrivateDraft);
  });
  it("installed real SDK maps a fresh-operation 404/P0002 response then serializes the null eligibility GET and exact BEGIN/FINISH", async () => {
    const view = actionFixture({ sdkTransport: true }); const url = await view.run(); expect(url.searchParams.has("errorCode")).toBe(false);
    expect(view.sdkWire).toHaveLength(12); expect(view.sdkWire.every(call => call.method === "POST" && call.path.startsWith("/rest/v1/rpc/"))).toBe(true);
    expect(view.sdkWire.slice(0, 2).map(call => call.path.split("/").at(-1))).toEqual(["get_article_translation_sync_run", "get_translation_job_resume"]);
    expect(view.sdkWire.slice(0, 2).map(call => call.body)).toEqual([{ p_job_id: jobId }, { p_job_id: jobId }]);
    const attemptWire = view.sdkWire.slice(2);
    expect(attemptWire).toHaveLength(10); expect(attemptWire.map(call => call.path.split("/").at(-1))).toEqual(successfulRpcNames);
    expect(attemptWire.slice(0, 2).map(call => call.body.p_operation_id)).toEqual([operationId, null]);
    expect(attemptWire[2].body.p_operation_id).toBe(operationId); expect(attemptWire[3].body.p_operation_id).toBe(operationId);
    expect(attemptWire[8].body.p_english_payload.mode).toBe("save"); expect(attemptWire[9].body.p_english_payload).toEqual(attemptWire[8].body.p_english_payload);
    expect(attemptWire[9].body.p_outcome).toEqual(attemptWire[8].body.p_outcome); expect(view.privateSaves).toHaveLength(1);
    expect(view.translator).toHaveBeenCalledTimes(1); protectedPublic(view);
  });
  it("strict direct GET with null operation P0002 remains failure and never performs a second SDK HTTP", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(missing.error), { status: 404, headers: { "Content-Type": "application/json" } }));
    const sdk = createClient("https://admission-fixture.invalid", "synthetic-local-key", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, db: { retry: false }, global: { fetch } });
    const adapter = actualModules({}).load(adapterFile);
    await expect(adapter.getArticleTranslationItemRetry(sdk, { jobId, itemId, operationId: null })).rejects.toMatchObject({ errorCode: "database_read_failed" });
    expect(fetch).toHaveBeenCalledTimes(1); traces.push({ kind: "strict-null-SDK-GET", method: "POST", nullOperation: true, requestCount: fetch.mock.calls.length });
  });
});
afterAll(() => {
  if (process.env.M07_ITEM_ADMISSION_EVIDENCE) writeFileSync(process.env.M07_ITEM_ADMISSION_EVIDENCE, JSON.stringify({
    fixture: { module: path.relative(repoRoot, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()], traces,
    limitations: ["Actual captured/current existing action/page/adapter/helper/strictparser/sourcehash/budget and installed Next/Zod execute on SAME fixture",
      "SQLSTATE/message P0002 follows actual isolated native SQL export; SDK/Auth/provider/persistence ledger remain controlled",
      "Real SDK custom-fetch/Response serialization uses no network or GoTrue; canonical/rights/source values synthetic", "No managed Auth/PostgREST/DB/RLS/provider/production acceptance"],
  }, null, 2) + "\n", { flag: "wx" });
});
