import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureFile = "apps/admin/lib/article-retry-source.integration.test.ts";
const helperFile = "apps/admin/lib/auto-translate-published-article-premium.ts";
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
type Row = Record<string, any>;
const articleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const englishId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const revision = "2026-10-08T10:00:00.000Z";
const olderRevision = "2026-10-07T10:00:00.000Z";
const authored = { ru: "Авторский RU \u2014 ё, права и источник", en: "Authored EN \u2014 rights and source" };

// This loader executes captured/current helper, hash, classifier, ownership,
// budget and route code. Only SDK/provider/env/runtime gate are controlled.
function actualModules(mocks: Record<string, unknown>) {
  const modules = new Map<string, Row>();
  function load(file: string): Row {
    const filename = path.join(repoRoot, file);
    if (modules.has(filename)) return modules.get(filename)!;
    const before = process.env.M07_RETRY_SOURCE_BASELINE_ROOT;
    const source = before ? path.join(before, file) : filename;
    if (!existsSync(source)) throw new Error(`Uncaptured actual dependency: ${file}`);
    const bytes = readFileSync(source);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} as Row };
    modules.set(filename, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const resolved = name.startsWith("@/") ? path.join(repoRoot, "apps/admin", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (resolved) {
        const relative = path.relative(repoRoot, resolved).replaceAll("\\", "/");
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of [".ts", ".tsx", "/index.ts"]) if (existsSync(resolved + extension)) return load(relative + extension);
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    modules.set(filename, module.exports);
    return module.exports;
  }
  return { load };
}

type Kind = "missing" | "current" | "stale" | "manual" | "manual-stale" | "draft" | "deleted" | "unknown";
type Options = {
  kind?: Kind; actualRevision?: unknown; published?: boolean; deletedArticle?: boolean;
  configured?: boolean; feature?: boolean; readError?: "article" | "english";
  readReject?: "article" | "english"; signalAt?: "article" | "english" | "latest" | "save" | "audit" | "model";
  fulfilledSignalAt?: "article" | "english" | "latest" | "save" | "audit";
  modelError?: unknown; lateRussianChange?: boolean; lateManualEnglish?: boolean;
  saveError?: boolean; saveData?: unknown;
  refusedStageCandidate?: "rejected" | "malformed" | "staged" | "wrong-provider" | "wrong-cas" | "wrong-target" | "wrong-call-count";
};
function setup(options: Options = {}) {
  const article: Row = { id: articleId, title: authored.ru, subtitle: "Авторский подзаголовок", excerpt: "Авторский анонс", slug: "original-ru",
    content_html: `<p>${authored.ru}</p>`, content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.ru }] }] },
    cover_alt: "Авторская подпись", status: options.published === false ? "draft" : "published", sources: [{ text: "https://source.invalid/authored" }],
    bibliography: [{ text: "Original bibliography" }], seo_title: "Авторский SEO", seo_description: "Авторское описание", seo_keywords: ["Автор"],
    og_title: "Авторский OG", og_description: "Авторское OG описание", updated_at: Object.hasOwn(options, "actualRevision") ? options.actualRevision : revision,
    categories: { slug: "culture" }, category_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", cover_external_url: "https://media.invalid/original.jpg",
    legacy_path: "/original-ru", canonical_url: "https://site.invalid/original-ru", allow_indexing: true, featured: false, show_on_homepage: false, pinned: false,
    deleted_at: options.deletedArticle ? olderRevision : null, rights: { holder: "RU author", license: "Author consent" } };
  let english: Row | null = null, privateDraft: Row | null = null, operation: Row | null = null;
  const writes: Row[] = [], events: Row[] = [];
  function nativeSignal() { try { navigation.redirect("/local-retry-source-signal"); } catch (error) { return error; } }
  const audit = vi.fn(async (value: Row) => {
    events.push({ kind: "audit", value: structuredClone(value) });
    if (options.signalAt === "audit") navigation.redirect("/local-retry-source-signal");
    return { data: null, error: options.fulfilledSignalAt === "audit" ? nativeSignal() : null };
  });
  let budget: Row;
  const translator = vi.fn(async (_input: Row, callOptions: Row) => {
    events.push({ kind: "controlled-expensive-translator", input: structuredClone(_input) });
    const firstCall = await callOptions.providerJournal?.beforeDispatch({ provider: "cloudflare", model: "local-model", pass: "translation" });
    callOptions.operationBudget?.beforeProviderCall();
    if (options.signalAt === "model") navigation.redirect("/local-retry-source-signal");
    if (firstCall) await callOptions.providerJournal.responseReceived({ callId: firstCall, provider: "cloudflare", model: "local-model", pass: "translation",
      httpStatus: Object.hasOwn(options, "modelError") ? 503 : 200, requestId: "local-request", responseId: null, inputTokens: 30, outputTokens: 20 });
    if (Object.hasOwn(options, "modelError")) throw options.modelError;
    const secondCall = await callOptions.providerJournal?.beforeDispatch({ provider: "cloudflare", model: "local-review", pass: "review" });
    callOptions.operationBudget?.beforeProviderCall();
    if (secondCall) await callOptions.providerJournal.responseReceived({ callId: secondCall, provider: "cloudflare", model: "local-review", pass: "review",
      httpStatus: 200, requestId: "local-review-request", responseId: null, inputTokens: 20, outputTokens: 20 });
    if (options.lateRussianChange) article.updated_at = "2026-10-08T11:00:00.000Z";
    if (options.lateManualEnglish) english = { ...english!, content_html: `<p>${authored.en}: manual takeover</p>`, content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.en }] }] }, updated_at: revision };
    return { title: "Controlled machine EN", subtitle: "English subtitle", excerpt: "English excerpt", content_html: "<p>Controlled machine EN</p>", cover_alt: "Original image",
      sources: ["https://source.invalid/authored"], bibliography: ["Original bibliography"], seo_title: "English SEO", seo_description: "English description", seo_keywords: ["author"],
      og_title: "English OG", og_description: "English OG description", model: "local-model", reviewModel: "local-review", requestId: "local-request", reviewRequestId: "local-review-request",
      inputTokens: 30, outputTokens: 20, reviewInputTokens: 20, reviewOutputTokens: 20 };
  });
  const rejection = new Error("controlled ordinary SDK rejection");
  function ordinaryReceipt(canExecute = false): Row {
    if (!operation) throw new Error("Missing admitted ordinary operation");
    return { version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId, provider: "cloudflare", sourceHash: operation.sourceHash,
      sourceUpdatedAt: operation.sourceUpdatedAt, englishUpdatedAt: operation.englishUpdatedAt, jobVersion: operation.result ? "2" : "1",
      attemptCount: operation.result ? 1 : 0, maxAttempts: 3, jobStatus: operation.result ? operation.result.outcome === "succeeded" ? "completed" : "partial" : "reviewing",
      itemStatus: operation.result?.outcome ?? "reviewing", operationId: operation.operationId, phase: operation.result ? "finished" : "running",
      canExecute, replayed: false, retryable: false, blockReason: null, result: operation.result };
  }
  function ordinaryCandidate(): Row {
    if (!operation) throw new Error("Missing admitted ordinary operation");
    return { version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId, operationId: operation.operationId, provider: "cloudflare",
      sourceHash: operation.sourceHash, sourceUpdatedAt: operation.sourceUpdatedAt, englishUpdatedAt: operation.englishUpdatedAt,
      phase: operation.result ? "finished" : "running", candidateState: operation.candidateHash ? operation.result ? "finished" : "staged" : "missing",
      candidateHash: operation.candidateHash, preparedAt: operation.candidateHash ? revision : null, workingDraftVersion: operation.candidateHash ? 1 : null,
      workingDraftUpdatedAt: operation.candidateHash ? revision : null, providerCalls: operation.calls.length,
      canRecover: Boolean(operation.candidateHash && !operation.result), replayed: Boolean(operation.result), blockReason: operation.candidateHash ? null : "candidate_missing" };
  }
  function ordinaryProgress(canDispatch = false): Row {
    if (!operation) throw new Error("Missing admitted ordinary operation");
    return { version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId, operationId: operation.operationId, provider: "cloudflare",
      phase: "running", startedAt: operation.calls.length ? revision : null, updatedAt: revision, providerCalls: operation.calls.length,
      canDispatch, replayed: false, calls: structuredClone(operation.calls) };
  }
  const client = { async rpc(name: string, args: Row) {
    events.push({ kind: "controlled-SDK-rpc", name, args: structuredClone(args) });
    const identity = { version: 1, articleId: args.p_article_id, sourceHash: args.p_source_hash,
      sourceUpdatedAt: args.p_source_updated_at, englishUpdatedAt: args.p_expected_english_updated_at };
    if (name === "get_article_machine_english_draft_context") {
      return { data: { ...identity, canGenerate: true, blockReason: null }, error: null };
    }
    if (name === "article_translation_sync_ready") return { data: true, error: null };
    if (name === "begin_article_translation_sync_item") {
      expect(translator).not.toHaveBeenCalled(); expect(privateDraft).toBeNull();
      expect(Object.keys(args).sort()).toEqual(["p_job_id", "p_item_id", "p_operation_id", "p_article_id", "p_expected_job_version", "p_expected_source_hash",
        "p_expected_article_updated_at", "p_expected_english_updated_at", "p_provider", "p_expected_cursor", "p_resume_cursor", "p_expected_source_snapshot"].sort());
      expect(args.p_expected_source_hash).toBe(rowHash()); expect(args.p_expected_article_updated_at).toBe(article.updated_at);
      expect(args.p_expected_english_updated_at).toBe(english?.updated_at ?? null); expect(args.p_expected_job_version).toBe("0");
      operation = { jobId: args.p_job_id, itemId: args.p_item_id, operationId: args.p_operation_id, sourceHash: args.p_expected_source_hash,
        sourceUpdatedAt: args.p_expected_article_updated_at, englishUpdatedAt: args.p_expected_english_updated_at,
        sourceSnapshot: structuredClone(args.p_expected_source_snapshot), candidateHash: null, calls: [], result: null };
      return { data: ordinaryReceipt(true), error: null };
    }
    if (name === "get_article_translation_item_retry") return { data: ordinaryReceipt(), error: null };
    if (name === "get_article_translation_item_retry_candidate") {
      const value = ordinaryCandidate();
      if (operation!.stageRefused && options.refusedStageCandidate) {
        if (options.refusedStageCandidate === "rejected") throw new Error("Controlled candidate read result unknown after refused STAGE");
        if (options.refusedStageCandidate === "malformed") value.workingDraftVersion = "1";
        if (options.refusedStageCandidate === "staged") { value.canRecover = false; value.blockReason = "source_changed"; }
        if (options.refusedStageCandidate === "wrong-provider") value.provider = "openai";
        if (options.refusedStageCandidate === "wrong-cas") value.englishUpdatedAt = "2026-10-07T10:00:00.000001Z";
        if (options.refusedStageCandidate === "wrong-target") value.articleId = actorId;
        if (options.refusedStageCandidate === "wrong-call-count") value.providerCalls = operation!.calls.length - 1;
      }
      return { data: value, error: null };
    }
    if (name === "record_article_translation_item_retry_dispatch") {
      expect(operation!.calls.at(-1)?.responseReceivedAt).not.toBeNull();
      operation!.calls.push({ callId: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass,
        dispatchRecordedAt: revision, responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null });
      return { data: ordinaryProgress(true), error: null };
    }
    if (name === "record_article_translation_item_retry_response") {
      const call = operation!.calls.find((row: Row) => row.callId === args.p_metadata.callId); expect(call).toBeDefined();
      Object.assign(call, args.p_metadata, { responseReceivedAt: revision }); return { data: ordinaryProgress(), error: null };
    }
    if (name === "finish_article_translation_item_retry") {
      expect(args.p_outcome.providerCalls).toBe(operation!.calls.length);
      expect(operation!.calls.every((row: Row) => row.responseReceivedAt !== null)).toBe(true);
      if (args.p_outcome.status === "succeeded") {
        expect(args.p_english_payload).toEqual(operation!.finishEnvelope); expect(args.p_outcome).toEqual(operation!.finishOutcome); expect(privateDraft).not.toBeNull();
      }
      const auditResult = await audit({ action: args.p_outcome.status === "succeeded" ? "article.premium_translation.backfill.succeeded" : "article.premium_translation.backfill.failed",
        actor_id: actorId, operation_id: operation!.operationId });
      if (auditResult.error) return { data: null, error: auditResult.error };
      operation!.result = { outcome: args.p_outcome.status, errorCode: args.p_outcome.errorCode ?? null,
        persistence: args.p_outcome.status === "succeeded" ? "working-draft" : "none", workingDraftVersion: args.p_outcome.status === "succeeded" ? 1 : null,
        workingDraftUpdatedAt: args.p_outcome.status === "succeeded" ? revision : null, publication: "unchanged",
        humanReview: args.p_outcome.status === "succeeded" ? "pending" : "unchanged", providerCalls: operation!.calls.length };
      return { data: ordinaryReceipt(), error: null };
    }
    const stage = name === "stage_article_translation_item_retry_candidate";
    if (!stage && name !== "save_article_machine_english_draft") throw new Error(`Unexpected controlled RPC ${name}`);
    if (stage) {
      expect(args.p_outcome.providerCalls).toBe(operation!.calls.length);
      expect(operation!.calls.every((row: Row) => row.responseReceivedAt !== null)).toBe(true);
      args = { ...args, p_article_id: articleId, p_source_hash: operation!.sourceHash, p_source_updated_at: operation!.sourceUpdatedAt,
        p_expected_english_updated_at: operation!.englishUpdatedAt, p_source_snapshot: operation!.sourceSnapshot };
    }
    if (options.signalAt === "latest") navigation.redirect("/local-retry-source-signal");
    if (options.fulfilledSignalAt === "latest") return { data: null, error: nativeSignal() };
    if (article.updated_at !== args.p_source_updated_at || (english?.updated_at ?? null) !== args.p_expected_english_updated_at) {
      if (stage) {
        operation!.stageRefused = true;
        if (options.refusedStageCandidate === "staged") {
          // The local database already retains a full candidate from the same
          // admitted operation. A refusal cannot prove that body is absent.
          privateDraft = { article_id: articleId, version: 1, updated_at: revision, base_article_updated_at: operation!.sourceUpdatedAt,
            expected_english_updated_at: operation!.englishUpdatedAt, payload: structuredClone(operation!.sourceSnapshot),
            english_payload: structuredClone(args.p_english_payload), draft_scope: "english-only", draft_english_enabled: true };
          operation!.candidateHash = hash(JSON.stringify(args.p_english_payload)); operation!.finishEnvelope = structuredClone(args.p_english_payload);
          operation!.finishOutcome = structuredClone(args.p_outcome);
          writes.push({ table: "article_working_drafts", operation: "retained-stage", payload: structuredClone(args.p_english_payload.payload),
            sourceSnapshot: structuredClone(operation!.sourceSnapshot) });
        }
      }
      return { data: null, error: { code: "40001", message: "controlled source/EN conflict" } };
    }
    writes.push({ table: "article_working_drafts", operation: "rpc-save", payload: structuredClone(args.p_english_payload.payload),
      sourceSnapshot: structuredClone(args.p_source_snapshot) });
    if (options.signalAt === "save") navigation.redirect("/local-retry-source-signal");
    if (options.saveError) return { data: null, error: { code: "08006", message: "controlled database write failure" } };
    privateDraft = { article_id: articleId, version: 1, updated_at: revision, base_article_updated_at: args.p_source_updated_at,
      expected_english_updated_at: args.p_expected_english_updated_at, payload: structuredClone(args.p_source_snapshot),
      english_payload: structuredClone(args.p_english_payload), draft_scope: "english-only", draft_english_enabled: true };
    if (options.fulfilledSignalAt === "save") return { data: null, error: nativeSignal() };
    if (stage) {
      operation!.candidateHash = hash(JSON.stringify(args.p_english_payload)); operation!.finishEnvelope = structuredClone(args.p_english_payload);
      operation!.finishOutcome = structuredClone(args.p_outcome);
      return { data: Object.hasOwn(options, "saveData") ? options.saveData : ordinaryCandidate(), error: null };
    }
    const auditResult = await audit({ action: "article.premium_translation.backfill.succeeded", actor_id: actorId });
    if (auditResult.error) return { data: null, error: auditResult.error };
    return { data: Object.hasOwn(options, "saveData") ? options.saveData : { ...identity, workingDraftVersion: 1,
      workingDraftUpdatedAt: revision, scope: "english-only", publication: "unchanged", humanReview: "pending", persistence: "working-draft" }, error: null };
  }, from(table: string) {
    if (table === "admin_audit_log") return { insert: audit };
    if (!["articles", "article_translations", "article_working_drafts"].includes(table)) throw new Error(`Unexpected controlled table ${table}`);
    const filters: Row[] = []; let operation = "read", columns = "", payload: Row;
    const matches = (value: Row | null) => value && filters.every(filter => value[filter.column] === filter.value);
    const query: Row = {
      select(value: string) { columns = value; return query; }, eq(column: string, value: unknown) { filters.push({ column, value }); return query; },
      is(column: string, value: unknown) { filters.push({ column, value }); return query; },
      update(value: Row) { operation = "update"; payload = value; return query; }, insert(value: Row) { operation = "insert"; payload = value; return query; },
      async maybeSingle() {
        if (operation !== "read") {
          writes.push({ table, operation, payload: structuredClone(payload), filters: structuredClone(filters) });
          if (options.signalAt === "save") navigation.redirect("/local-retry-source-signal");
          if (options.saveError) return { data: null, error: { message: "controlled database write failure" } };
          if (operation === "update" && !matches(english)) return { data: null, error: null };
          english = { ...(english ?? {}), ...structuredClone(payload), id: englishId, updated_at: revision };
          if (options.fulfilledSignalAt === "save") return { data: null, error: nativeSignal() };
          return { data: Object.hasOwn(options, "saveData") ? options.saveData : { id: englishId }, error: null };
        }
        const phase = table === "articles" ? columns === "updated_at" ? "latest" : "article" : "english";
        events.push({ kind: "controlled-SDK-read", table, columns, filters: structuredClone(filters) });
        if (options.signalAt === phase) navigation.redirect("/local-retry-source-signal");
        if (options.fulfilledSignalAt === phase) return { data: null, error: nativeSignal() };
        if (options.readReject === phase) throw rejection;
        if (options.readError === phase) return { data: null, error: { message: "controlled database read failure" } };
        const result = table === "articles" ? article : table === "article_translations" ? english : privateDraft;
        return { data: matches(result) ? structuredClone(result) : null, error: null };
      },
    };
    return query;
  } };
  const gate = vi.fn(async () => options.configured !== false);
  const modules = actualModules({
    "apps/admin/lib/auto-translate-article": { translateArticleSourceToEnglish: translator },
    "apps/admin/lib/env": { adminEnv: { openAiAutoTranslateArticles: options.feature !== false, publicSiteUrl: "https://site.invalid", premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review", openAiPremiumTranslationReview: true } },
    "apps/admin/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: gate },
  });
  const sourceHash = modules.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash;
  const validRevision = modules.load("apps/admin/lib/published-article-english-state.ts").validPublishedArticleSourceRevision;
  const rowHash = () => sourceHash({ title: article.title, subtitle: article.subtitle || "", excerpt: article.excerpt || "", contentJson: article.content_json || { type: "doc", content: [] }, contentHtml: article.content_html || "",
    coverAlt: article.cover_alt || "", slug: article.slug, sources: article.sources || [], bibliography: article.bibliography || [], seoTitle: article.seo_title || article.title,
    seoDescription: article.seo_description || article.excerpt || "", seoKeywords: article.seo_keywords || [], ogTitle: article.og_title || article.seo_title || article.title, ogDescription: article.og_description || article.seo_description || article.excerpt || "" });
  const kind = options.kind ?? "missing";
  if (kind !== "missing") {
    const persistedHash = ["stale", "manual-stale"].includes(kind) ? hash("older Russian source") : rowHash();
    const manual = kind.startsWith("manual");
    const ownership = modules.load("apps/admin/lib/article-translation-machine-ownership.ts");
    english = { id: englishId, article_id: articleId, locale: "en", updated_at: olderRevision, title: authored.en, content_html: `<p>${authored.en}</p>`, slug: "authored-english", canonical_url: "https://site.invalid/original",
      status: kind === "draft" ? "draft" : "published", source_content_hash: persistedHash, source_article_updated_at: kind === "unknown" ? null : kind === "stale" ? olderRevision : article.updated_at,
      content_json: manual ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.en }] }] }
        : ownership.premiumArticleMachineContentJson({ sourceHash: persistedHash, model: "old-model", reviewerModel: null, translatorRequestId: "old-request", reviewerRequestId: null, generatedAt: olderRevision }, `<p>${authored.en}</p>`),
      deleted_at: kind === "deleted" ? olderRevision : null, sources: [{ text: "https://source.invalid/manual" }], rights: { holder: "EN author", license: "Original licence" } };
  }
  const originalArticle = structuredClone(article), originalEnglish = structuredClone(english);
  budget = modules.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
  const helper = modules.load(helperFile).ensurePublishedArticlePremiumEnglish;
  async function run(intent: Row = {}, runtimeApproved = true) {
    try {
      const result = await helper({ supabase: client, actorId, articleId, runtimeApproved, operationBudget: budget, ...intent });
      traces.push(JSON.parse(JSON.stringify({ intent, options, result, originalArticle, originalEnglish, article, english, privateDraft,
        candidateHash: operation?.candidateHash ?? null, writes, translatorCalls: translator.mock.calls, events, budget: budget.snapshot() })));
      return result;
    } catch (error) {
      traces.push(JSON.parse(JSON.stringify({ intent, options, thrown: error instanceof Error ? { message: error.message, digest: (error as Row).digest } : error, originalArticle, originalEnglish, article, english, privateDraft,
        candidateHash: operation?.candidateHash ?? null, writes, translatorCalls: translator.mock.calls, events, budget: budget.snapshot() })));
      throw error;
    }
  }
  return { run, article, getEnglish: () => english, getPrivateDraft: () => privateDraft, originalArticle, originalEnglish, rowHash, validRevision, translator, audit, writes, events, budget, gate, rejection };
}
function intent(view: ReturnType<typeof setup>) { return { expectedSourceHash: view.rowHash(), expectedSourceUpdatedAt: view.article.updated_at }; }
function unchanged(view: ReturnType<typeof setup>) {
  expect(view.article).toEqual(view.originalArticle); expect(view.getEnglish()).toEqual(view.originalEnglish);
  expect(view.translator).not.toHaveBeenCalled(); expect(view.writes).toEqual([]); expect(view.audit).not.toHaveBeenCalled();
  expect(view.budget.snapshot()).toMatchObject({ attempts: 0, providerCalls: 0 });
}
async function stale(view: ReturnType<typeof setup>, expected: Row) {
  const result = await view.run(expected);
  expect(result).toMatchObject({ state: "stale", error: "Russian source no longer matches retry intent", sourceHash: view.rowHash() });
  expect(result.sourceUpdatedAt).toEqual(view.validRevision(view.article.updated_at) ? view.article.updated_at : undefined); unchanged(view);
}

describe("M07 article retry intent is checked inside the actual helper before an expensive attempt", () => {
  it("refuses a changed hash at the same valid RU revision", async () => { const view = setup(); await stale(view, { ...intent(view), expectedSourceHash: hash("prior authored RU") }); });
  it("refuses the same source hash at a newer RU revision", async () => { const view = setup(); await stale(view, { ...intent(view), expectedSourceUpdatedAt: olderRevision }); });
  it("refuses both changed source identity fields", async () => { const view = setup(); await stale(view, { expectedSourceHash: hash("prior authored RU"), expectedSourceUpdatedAt: olderRevision }); });
  it.each([
    { name: "missing revision", patch: (_hash: string) => ({ expectedSourceHash: _hash }) },
    { name: "missing hash", patch: () => ({ expectedSourceUpdatedAt: revision }) },
    { name: "null hash", patch: () => ({ expectedSourceHash: null, expectedSourceUpdatedAt: revision }) },
    { name: "empty hash", patch: () => ({ expectedSourceHash: "", expectedSourceUpdatedAt: revision }) },
    { name: "short hash", patch: (_hash: string) => ({ expectedSourceHash: _hash.slice(1), expectedSourceUpdatedAt: revision }) },
    { name: "nonhex hash", patch: () => ({ expectedSourceHash: "g".repeat(64), expectedSourceUpdatedAt: revision }) },
    { name: "uppercase hash", patch: (_hash: string) => ({ expectedSourceHash: _hash.toUpperCase(), expectedSourceUpdatedAt: revision }) },
    { name: "numeric hash", patch: () => ({ expectedSourceHash: 123, expectedSourceUpdatedAt: revision }) },
    { name: "null revision", patch: (_hash: string) => ({ expectedSourceHash: _hash, expectedSourceUpdatedAt: null }) },
    { name: "empty revision", patch: (_hash: string) => ({ expectedSourceHash: _hash, expectedSourceUpdatedAt: "" }) },
    { name: "invalid revision", patch: (_hash: string) => ({ expectedSourceHash: _hash, expectedSourceUpdatedAt: "not-a-date" }) },
    { name: "date-only revision", patch: (_hash: string) => ({ expectedSourceHash: _hash, expectedSourceUpdatedAt: "2026-10-08" }) },
    { name: "offset-free revision", patch: (_hash: string) => ({ expectedSourceHash: _hash, expectedSourceUpdatedAt: "2026-10-08T10:00:00" }) },
    { name: "numeric revision", patch: (_hash: string) => ({ expectedSourceHash: _hash, expectedSourceUpdatedAt: 123 }) },
  ])("fails closed on $name in a supplied retry pair", async ({ patch }) => { const view = setup(); await stale(view, patch(view.rowHash())); });
  it.each([null, undefined, "not-a-date", "2026-10-08"])("fails closed on actual RU revision %s", async actualRevision => {
    const view = setup({ actualRevision }); await stale(view, { expectedSourceHash: view.rowHash(), expectedSourceUpdatedAt: revision });
  });
  it("admits one correctly bound missing-English attempt", async () => {
    const view = setup(); const result = await view.run(intent(view));
    expect(result).toMatchObject({ state: "translated", sourceHash: view.rowHash() }); expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 2 }); expect(view.writes).toHaveLength(1);
    expect(result).toMatchObject({ publication: "draft", workingDraftVersion: 1, humanReview: "pending" });
    expect(view.getEnglish()).toBeNull();
    expect(view.getPrivateDraft()).toMatchObject({ article_id: articleId, base_article_updated_at: revision,
      draft_scope: "english-only", english_payload: { payload: { source_content_hash: view.rowHash(), status: "draft", reviewed_at: null, approved_at: null, published_at: null } } });
    expect(view.article).toEqual(view.originalArticle);
  });
  it("retains generation for old batch calls that omit both optional fields", async () => {
    const view = setup(); expect((await view.run()).state).toBe("translated"); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.article).toEqual(view.originalArticle);
  });
});

describe("M07 matched retry intent retains actual ownership, publication and runtime guards", () => {
  it.each([
    { kind: "current", state: "current" }, { kind: "manual", state: "manual" }, { kind: "manual-stale", state: "manual" },
    { kind: "draft", state: "skipped" }, { kind: "deleted", state: "skipped" }, { kind: "unknown", state: "skipped" },
  ] as const)("preserves $kind English and returns $state", async ({ kind, state }) => {
    const view = setup({ kind }); expect((await view.run(intent(view))).state).toBe(state); unchanged(view);
  });
  it("skips an unpublished RU source without an attempt", async () => { const view = setup({ published: false }); expect((await view.run(intent(view))).state).toBe("skipped"); unchanged(view); });
  it("does not restore a deleted RU source", async () => { const view = setup({ deletedArticle: true }); expect((await view.run(intent(view))).state).toBe("failed"); unchanged(view); });
  it("retains the feature-off guard", async () => { const view = setup({ feature: false }); expect((await view.run(intent(view))).state).toBe("skipped"); unchanged(view); });
  it("retains the runtime capability guard", async () => { const view = setup({ configured: false }); expect((await view.run(intent(view), false)).state).toBe("not-configured"); unchanged(view); expect(view.gate).toHaveBeenCalledTimes(1); });
});

describe("M07 retry foundation retains truthful reads, conflicts and receipts", () => {
  it.each(["article", "english"] as const)("does not pay on an ordinary %s read error", async readError => {
    const view = setup({ readError }); expect((await view.run(intent(view))).state).toBe("failed"); unchanged(view);
  });
  it.each(["article", "english"] as const)("keeps an ordinary thrown %s read rejection observable", async readReject => {
    const view = setup({ readReject }); await expect(view.run(intent(view))).rejects.toBe(view.rejection); unchanged(view);
  });
  it.each(["article", "english"] as const)("preserves a thrown native Next %s read signal", async signalAt => {
    const view = setup({ signalAt }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); unchanged(view);
  });
  it.each(["article", "english"] as const)("preserves a fulfilled native Next %s read error", async fulfilledSignalAt => {
    const view = setup({ fulfilledSignalAt }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); unchanged(view);
  });
  it("preserves a provider native Next signal through the actual helper catch", async () => {
    const view = setup({ signalAt: "model" }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]); expect(view.audit).not.toHaveBeenCalled();
  });
  it.each(["thrown", "fulfilled"] as const)("preserves a %s atomic RU-guard native Next signal", async mode => {
    const view = setup(mode === "thrown" ? { signalAt: "latest" } : { fulfilledSignalAt: "latest" }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]); expect(view.audit).not.toHaveBeenCalled();
  });
  it.each(["thrown", "fulfilled"] as const)("preserves a %s save native Next signal without claiming rollback", async mode => {
    const view = setup(mode === "thrown" ? { signalAt: "save" } : { fulfilledSignalAt: "save" }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toHaveLength(1); expect(view.audit).not.toHaveBeenCalled();
    expect(view.getPrivateDraft() === null).toBe(mode === "thrown"); expect(view.getEnglish()).toBeNull(); expect(view.article).toEqual(view.originalArticle);
  });
  it.each(["thrown", "fulfilled"] as const)("preserves a %s audit native Next signal after the controlled private EN write", async mode => {
    const view = setup(mode === "thrown" ? { signalAt: "audit" } : { fulfilledSignalAt: "audit" }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.audit).toHaveBeenCalledTimes(1);
    expect(view.getPrivateDraft()).not.toBeNull(); expect(view.getEnglish()).toBeNull(); expect(view.article).toEqual(view.originalArticle);
  });
  it("preserves a fulfilled failure-audit native Next signal", async () => {
    const view = setup({ modelError: new Error("controlled provider error before audit"), fulfilledSignalAt: "audit" }); let caught: unknown;
    try { await view.run(intent(view)); } catch (error) { caught = error; }
    expect(isRedirectError(caught)).toBe(true); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]); expect(view.getEnglish()).toBeNull();
  });
  it("returns a failed outcome for an ordinary provider rejection", async () => {
    const view = setup({ modelError: new Error("controlled provider request failure") });
    expect(await view.run(intent(view))).toMatchObject({ state: "failed", sourceHash: view.rowHash() }); expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.writes).toEqual([]); expect(view.article).toEqual(view.originalArticle); expect(view.getEnglish()).toEqual(view.originalEnglish);
  });
  it("retains the generic error for an unknown provider rejection", async () => {
    const view = setup({ modelError: { local: "unknown rejection" } });
    const result = await view.run(intent(view));
    expect(result).toMatchObject({ state: "failed", error: "Ordinary article translation result was not confirmed", ordinaryErrorCode: "unexpected",
      ordinaryOperation: { receipt: { phase: "finished", result: { outcome: "dead_letter", persistence: "none", publication: "unchanged", humanReview: "unchanged" } } } });
    expect(JSON.stringify(result)).not.toContain("unknown rejection"); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]);
  });
  it("refuses an EN write after RU changed during the admitted attempt", async () => {
    const view = setup({ lateRussianChange: true }); const result = await view.run(intent(view)); expect(result.state).toBe("conflict");
    expect(result).toMatchObject({ ordinaryErrorCode: "write_conflict", ordinaryOperation: { receipt: { phase: "finished", attemptCount: 1,
      result: { outcome: "conflict", persistence: "none", providerCalls: 2, publication: "unchanged", humanReview: "unchanged" } } } });
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]); expect(view.getEnglish()).toBeNull();
    expect(view.article).toEqual({ ...view.originalArticle, updated_at: "2026-10-08T11:00:00.000Z" });
  });
  it("retains CAS protection when a manual editor takes over EN during translation", async () => {
    const view = setup({ kind: "stale", lateManualEnglish: true }); const result = await view.run(intent(view)); expect(result.state).toBe("conflict");
    expect(result).toMatchObject({ ordinaryErrorCode: "write_conflict", ordinaryOperation: { receipt: { phase: "finished", attemptCount: 1,
      result: { outcome: "conflict", persistence: "none", providerCalls: 2, publication: "unchanged", humanReview: "unchanged" } } } });
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getEnglish()).toMatchObject({ content_html: `<p>${authored.en}: manual takeover</p>`, rights: view.originalEnglish!.rights, sources: view.originalEnglish!.sources });
    expect(view.article).toEqual(view.originalArticle);
  });
  it.each(["rejected", "malformed", "staged", "wrong-provider", "wrong-cas", "wrong-target", "wrong-call-count"] as const)(
    "confirmed STAGE refusal with %s candidate evidence keeps accounting open", async refusedStageCandidate => {
      const view = setup({ kind: "stale", lateRussianChange: true, refusedStageCandidate });
      const result = await view.run(intent(view));
      expect(result).toMatchObject({ state: "failed", ordinaryErrorCode: "translation_retry_pending",
        ordinaryOperation: { receipt: { phase: "running", attemptCount: 0, itemStatus: "reviewing", result: null } } });
      expect(view.translator).toHaveBeenCalledTimes(1); expect(view.budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 2 });
      const rpc = view.events.filter(row => row.kind === "controlled-SDK-rpc");
      expect(rpc.filter(row => row.name === "stage_article_translation_item_retry_candidate")).toHaveLength(1);
      expect(rpc.filter(row => row.name === "finish_article_translation_item_retry")).toEqual([]); expect(view.audit).not.toHaveBeenCalled();
      expect(view.article).toEqual({ ...view.originalArticle, updated_at: "2026-10-08T11:00:00.000Z" }); expect(view.getEnglish()).toEqual(view.originalEnglish);
      expect(view.writes.filter(write => ["articles", "article_translations"].includes(write.table))).toEqual([]);
      if (refusedStageCandidate === "staged") {
        const stage = rpc.find(row => row.name === "stage_article_translation_item_retry_candidate")!;
        expect(view.writes).toHaveLength(1); expect(view.getPrivateDraft()).toMatchObject({ version: 1, base_article_updated_at: revision,
          expected_english_updated_at: olderRevision, english_payload: stage.args.p_english_payload });
        expect(view.getPrivateDraft()!.payload.content_html).toBe(view.originalArticle.content_html);
        expect(view.getPrivateDraft()!.payload.sources).toEqual(view.originalArticle.sources);
      } else { expect(view.writes).toEqual([]); expect(view.getPrivateDraft()).toBeNull(); }
    });
  it("does not claim translation success after an ordinary save failure", async () => {
    const view = setup({ saveError: true }); expect((await view.run(intent(view))).state).toBe("failed"); expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getEnglish()).toBeNull();
  });
  it("treats an invalid post-write receipt as failed without pretending the local accepted write rolled back", async () => {
    const view = setup({ saveData: { id: "not-a-uuid" } }); expect((await view.run(intent(view))).state).toBe("failed");
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.getPrivateDraft()).not.toBeNull(); expect(view.getEnglish()).toBeNull(); expect(view.article).toEqual(view.originalArticle);
  });
});

afterAll(() => {
  if (!process.env.M07_RETRY_SOURCE_EVIDENCE) return;
  writeFileSync(process.env.M07_RETRY_SOURCE_EVIDENCE, JSON.stringify({ fixture: { file: fixtureFile, sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...graph.values()], traces,
    actualDependencies: { next: nativeRequire("next/package.json").version, zod: nativeRequire("zod/package.json").version, typescript: nativeRequire("typescript/package.json").version },
    limitations: ["Actual helper, source hash, classification, ownership, operation budget and native Next execute; SDK/provider/env/runtime gate are controlled local boundaries",
      "Controlled translator simulates two provider passes and dispatch/response ACKs; actual ordinary coordinator and strict adapters bind admission, STAGE and FINISH",
      "Source/EN persistence, CAS and atomic FINISH audit are an explicit local SDK emulator; no DB/Auth/RLS/production acceptance",
      "This is helper retry-intent foundation only, not full T13 retry UI/server/worker acceptance",
      "Native Next tests execute installed real redirect signals in SDK reads, fulfilled error DTOs, provider/save/audit paths; controlled transport failures do not establish real HTTP behavior"] }, null, 2) + "\n", { flag: "wx" });
});
