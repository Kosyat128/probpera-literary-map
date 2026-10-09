import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const graph = new Map<string, Row>(), traces: Row[] = [];
const articleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", actorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", englishId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const mediaId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const stamp = "2026-10-08T10:00:00.123456+00:00", oldStamp = "2026-10-07T10:00:00.654321+00:00";
const authorRu = "Ручной русский оригинал \u2014 ё, права и источники", authorEn = "Author original English \u2014 exact rights and sources";
const privateError = "PRIVATE_PROVIDER_SECRET=never_render_fixture";
const image = `<img src="https://media.invalid/original.jpg" data-media-id="${mediaId}" alt="Original photographer" data-license="CC BY" data-credit="Original photographer" data-source="https://source.invalid/image">`;
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file), actual = process.env.M07_ORDINARY_PRIVATE_BASELINE_ROOT ? path.join(process.env.M07_ORDINARY_PRIVATE_BASELINE_ROOT, file) : filename;
    if (!existsSync(actual)) throw new Error("Missing captured actual module: " + file);
    const source = readFileSync(actual);
    graph.set(file, { module: file, source: path.relative(root, actual).replaceAll("\\", "/"), sha256: hash(source) });
    const output = ts.transpileModule(source.toString(), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) {
        const relative = path.relative(root, target).replaceAll("\\", "/");
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of [".ts", ".tsx", "/index.ts"]) if (existsSync(target + extension)) return load(relative + extension);
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", output)(require, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return { load };
}
function setup(options: Row = {}) {
  const article: Row = { id: articleId, title: authorRu, subtitle: "Original subtitle", excerpt: "Original excerpt", slug: "original-ru", content_html: `<p>${authorRu}</p>${image}`,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authorRu }] }], rights: { author: authorRu, consent: "Exact original permission" } },
    category_id: null, cover_external_url: "https://media.invalid/original.jpg", cover_alt: "Original photographer, CC BY", legacy_path: "/original-ru",
    seo_title: "Original SEO", seo_description: "Original description", seo_keywords: ["original author"], canonical_url: "https://site.invalid/culture/original-ru",
    og_title: "Original OG", og_description: "Original context", allow_indexing: true, featured: true, show_on_homepage: false, pinned: true,
    sources: [{ text: "https://source.invalid/original" }], bibliography: [{ text: "Original bibliography" }], status: "published", updated_at: stamp, deleted_at: null,
    categories: { slug: "culture" }, rights: { holder: authorRu, consent: "Exact original permission" }, ...options.articleOverrides };
  const events: Row[] = [], writes: Row[] = [], rpcCalls: Row[] = [], budgets: Row[] = [];
  let operation: Row | null = null;
  const translated: Row = { title: "Complete private English", subtitle: "Original subtitle", excerpt: "Faithful English excerpt", content_html: `<p>Complete private English</p>${image}`,
    cover_alt: "Original photographer, CC BY", seo_title: "Complete private English", seo_description: "Faithful English description", seo_keywords: ["original author"], og_title: "Complete private English", og_description: "Faithful English context",
    sources: ["https://source.invalid/original"], bibliography: ["Original bibliography"], model: "local-model", reviewModel: "local-review", requestId: "local-request", reviewRequestId: "local-review-request",
    inputTokens: 30, outputTokens: 20, reviewInputTokens: 20, reviewOutputTokens: 20 };
  const translator = vi.fn(async (_source: Row, input: Row) => {
    events.push({ kind: "controlled-translator" });
    const firstCall = await input.providerJournal?.beforeDispatch({ provider: "cloudflare", model: "local-model", pass: "translation" });
    input.operationBudget?.beforeProviderCall();
    if (options.modelSignal) throw options.modelSignal;
    if (firstCall) await input.providerJournal.responseReceived({ callId: firstCall, provider: "cloudflare", model: "local-model", pass: "translation",
      httpStatus: 200, requestId: "local-request", responseId: null, inputTokens: 30, outputTokens: 20 });
    const secondCall = await input.providerJournal?.beforeDispatch({ provider: "cloudflare", model: "local-review", pass: "review" });
    input.operationBudget?.beforeProviderCall();
    if (secondCall) await input.providerJournal.responseReceived({ callId: secondCall, provider: "cloudflare", model: "local-review", pass: "review",
      httpStatus: 200, requestId: "local-review-request", responseId: null, inputTokens: 20, outputTokens: 20 });
    return structuredClone(translated);
  });
  const loaded = modules({ "apps/admin/lib/env": { adminEnv: { openAiAutoTranslateArticles: true, premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review",
    openAiPremiumTranslationReview: true, publicSiteUrl: "https://site.invalid" } },
    "apps/admin/lib/auto-translate-article": { translateArticleSourceToEnglish: translator },
    "apps/admin/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: async () => true } });
  const rowHash = () => loaded.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash({ title: article.title, subtitle: article.subtitle || "", excerpt: article.excerpt || "", slug: article.slug,
    contentHtml: article.content_html || "", contentJson: article.content_json || { type: "doc", content: [] }, coverAlt: article.cover_alt || "", sources: article.sources || [], bibliography: article.bibliography || [],
    seoTitle: article.seo_title || article.title, seoDescription: article.seo_description || article.excerpt || "", seoKeywords: article.seo_keywords || [], ogTitle: article.og_title || article.seo_title || article.title,
    ogDescription: article.og_description || article.seo_description || article.excerpt || "" });
  const originalHash = rowHash(), kind = options.english ?? "stale-machine";
  let english: Row | null = kind === "missing" ? null : { id: englishId, article_id: articleId, locale: "en", title: authorEn, content_html: `<p>${authorEn}</p>${image}`,
    slug: "original-en", canonical_url: "https://site.invalid/original-en", status: kind === "approved-manual" ? "approved" : "published", updated_at: oldStamp, deleted_at: kind === "deleted" ? oldStamp : null,
    source_content_hash: kind === "current" ? originalHash : hash("old source"), source_article_updated_at: kind === "current" ? stamp : oldStamp,
    content_json: ["manual", "approved-manual"].includes(kind) ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authorEn }] }] }
      : loaded.load("apps/admin/lib/article-translation-machine-ownership.ts").premiumArticleMachineContentJson({ sourceHash: kind === "current" ? originalHash : hash("old source"), model: "old-model", reviewerModel: "old-review",
        translatorRequestId: "old-request", reviewerRequestId: "old-review-request", generatedAt: oldStamp }, `<p>${authorEn}</p>${image}`),
    reviewed_at: oldStamp, reviewed_by: actorId, approved_at: oldStamp, approved_by: actorId, published_at: oldStamp,
    sources: [{ text: "https://source.invalid/original-en" }], bibliography: [{ text: "Original EN bibliography" }], rights: { holder: authorEn, consent: "Original permission" } };
  const expectedEnglishUpdatedAt = english?.updated_at ?? null;
  let privateDraft: Row | null = options.authorDraft ? { article_id: articleId, version: 3, payload: { title: authorRu }, english_payload: { mode: "save", payload: { title: authorEn } } } : null;
  const originalArticle = structuredClone(article), originalEnglish = structuredClone(english), originalDraft = structuredClone(privateDraft);
  let racedArticle: Row | null = null, racedEnglish: Row | null = null, raceApplied = false;
  const sameRevision = (a: unknown, b: unknown) => loaded.load("apps/admin/lib/article-retry-revision.ts").sameArticleRetryRevision(a, b);
  function race() {
    if (!options.race || raceApplied) return; raceApplied = true;
    if (options.race === "ru-revision") { article.updated_at = "2026-10-08T10:00:00.123457+00:00"; article.title = "New authored Russian title"; }
    if (options.race === "ru-body") article.content_html = `<p>New authored Russian body</p>${image}`;
    if (options.race === "en-manual") { english!.content_html = `<p>New manual English body</p>${image}`; english!.content_json = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New manual English body" }] }] }; }
    if (options.race === "en-revision") english!.updated_at = "2026-10-07T10:00:00.654322+00:00";
    if (options.race === "author-draft") privateDraft = { article_id: articleId, version: 9, payload: { title: "Concurrent author draft" } };
    racedArticle = structuredClone(article); racedEnglish = structuredClone(english); events.push({ kind: "persistence-boundary-race", race: options.race });
  }
  function sourceSnapshot() {
    return { title: article.title, subtitle: article.subtitle ?? "", excerpt: article.excerpt ?? "", slug: article.slug, content_html: article.content_html, content_json: article.content_json,
      category_id: article.category_id, status: "draft", scheduled_at: null, published_at: null, cover_external_url: article.cover_external_url, cover_alt: article.cover_alt ?? "", legacy_path: article.legacy_path,
      seo_title: article.seo_title ?? "", seo_description: article.seo_description ?? "", seo_keywords: article.seo_keywords ?? [], canonical_url: article.canonical_url,
      og_title: article.og_title ?? "", og_description: article.og_description ?? "", allow_indexing: article.allow_indexing, sources: article.sources ?? [], bibliography: article.bibliography ?? [],
      featured: article.featured, show_on_homepage: article.show_on_homepage, pinned: article.pinned };
  }
  function context(args: Row) {
    const ownership = english && loaded.load("apps/admin/lib/published-article-english-state.ts").publishedArticleEnglishState({ sourceHash: rowHash(), sourceUpdatedAt: article.updated_at, translation: english });
    const blockReason = !sameRevision(args.p_source_updated_at, article.updated_at) || args.p_source_hash !== rowHash() || !isDeepStrictEqual(args.p_source_snapshot, sourceSnapshot()) ? "source_changed"
      : !sameRevision(args.p_expected_english_updated_at, english?.updated_at ?? null) ? "english_changed"
      : ownership?.ownership === "manual" ? "manual_english" : privateDraft ? "draft_exists" : null;
    return { version: 1, articleId, sourceHash: args.p_source_hash, sourceUpdatedAt: options.offsetDto ? "2026-10-08T13:00:00.123456+03:00" : args.p_source_updated_at,
      englishUpdatedAt: options.offsetDto && args.p_expected_english_updated_at !== null ? "2026-10-07T13:00:00.654321+03:00" : args.p_expected_english_updated_at,
      canGenerate: blockReason === null, blockReason };
  }
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
      candidateHash: operation.candidateHash, preparedAt: operation.candidateHash ? stamp : null, workingDraftVersion: operation.candidateHash ? 1 : null,
      workingDraftUpdatedAt: operation.candidateHash ? stamp : null, providerCalls: operation.calls.length,
      canRecover: Boolean(operation.candidateHash && !operation.result), replayed: Boolean(operation.result), blockReason: operation.candidateHash ? null : "candidate_missing" };
  }
  function ordinaryProgress(canDispatch = false): Row {
    if (!operation) throw new Error("Missing admitted ordinary operation");
    return { version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId, operationId: operation.operationId, provider: "cloudflare",
      phase: "running", startedAt: operation.calls.length ? stamp : null, updatedAt: stamp, providerCalls: operation.calls.length,
      canDispatch, replayed: false, calls: structuredClone(operation.calls) };
  }
  const client: Row = { from(table: string) {
    let columns = "", operation = "read", payload: Row, executed = false; const filters: Row[] = [];
    async function execute() {
      if (operation === "read") {
        const phase = table === "articles" ? columns === "updated_at" ? "latest" : "article" : table === "article_translations" ? "english" : "draft";
        events.push({ kind: "read", table, columns, filters: structuredClone(filters), phase });
        const row = table === "articles" ? article : table === "article_translations" ? english : privateDraft;
        return { data: row ? structuredClone(row) : null, error: null };
      }
      if (!executed) {
        executed = true;
        if (table === "article_translations") race();
        writes.push({ table, operation, payload: structuredClone(payload), filters: structuredClone(filters) });
        if (table === "article_translations") {
          if (operation === "update" && (!english || filters.some(filter => english![filter.key] !== filter.value))) return { data: null, error: null };
          english = { ...(english ?? {}), ...structuredClone(payload), id: englishId, updated_at: stamp };
        }
      }
      return { data: table === "article_translations" ? { id: englishId } : null, error: null };
    }
    const query: Row = { select(value: string) { columns = value; return query; }, eq(key: string, value: unknown) { filters.push({ key, value }); return query; }, is(key: string, value: unknown) { filters.push({ key, value }); return query; },
      insert(value: Row) { operation = "insert"; payload = value; return query; }, update(value: Row) { operation = "update"; payload = value; return query; }, maybeSingle: execute,
      then(resolve: (value: unknown) => unknown, reject: (failure: unknown) => unknown) { return execute().then(resolve, reject); } };
    return query;
  }, async rpc(name: string, args: Row) {
    rpcCalls.push({ name, args: structuredClone(args) }); events.push({ kind: "rpc", name });
    if (name === "get_article_machine_english_draft_context") {
      if (options.contextSignal) { if (options.rejectSignal) throw options.contextSignal; return { data: null, error: options.contextSignal }; }
      if (options.contextFailure === "reject") throw new Error(privateError);
      if (options.contextFailure) return { data: null, error: { code: options.contextFailure, message: privateError } };
      const value = context(args);
      if (options.contextOverrides) Object.assign(value, options.contextOverrides);
      return { data: value, error: null };
    }
    if (name === "article_translation_sync_ready") return { data: true, error: null };
    if (name === "begin_article_translation_sync_item") {
      expect(Object.keys(args).sort()).toEqual(["p_job_id", "p_item_id", "p_operation_id", "p_article_id", "p_expected_job_version", "p_expected_source_hash",
        "p_expected_article_updated_at", "p_expected_english_updated_at", "p_provider", "p_expected_cursor", "p_resume_cursor", "p_expected_source_snapshot"].sort());
      expect(args.p_expected_source_snapshot).toEqual(sourceSnapshot()); expect(args.p_expected_job_version).toBe("0");
      expect(translator).not.toHaveBeenCalled(); expect(privateDraft).toBeNull();
      operation = { jobId: args.p_job_id, itemId: args.p_item_id, operationId: args.p_operation_id, sourceHash: args.p_expected_source_hash,
        sourceUpdatedAt: options.offsetDto ? "2026-10-08T13:00:00.123456+03:00" : args.p_expected_article_updated_at,
        englishUpdatedAt: options.offsetDto && args.p_expected_english_updated_at !== null ? "2026-10-07T13:00:00.654321+03:00" : args.p_expected_english_updated_at,
        sourceSnapshot: structuredClone(args.p_expected_source_snapshot), originalSourceUpdatedAt: args.p_expected_article_updated_at,
        originalEnglishUpdatedAt: args.p_expected_english_updated_at, candidateHash: null, calls: [], result: null };
      return { data: ordinaryReceipt(true), error: null };
    }
    if (name === "get_article_translation_item_retry") return { data: ordinaryReceipt(), error: null };
    if (name === "get_article_translation_item_retry_candidate") return { data: ordinaryCandidate(), error: null };
    if (name === "record_article_translation_item_retry_dispatch") {
      expect(operation).not.toBeNull(); expect(operation!.calls.at(-1)?.responseReceivedAt).not.toBeNull();
      operation!.calls.push({ callId: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass,
        dispatchRecordedAt: stamp, responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null });
      return { data: ordinaryProgress(true), error: null };
    }
    if (name === "record_article_translation_item_retry_response") {
      const call = operation!.calls.find((row: Row) => row.callId === args.p_metadata.callId); expect(call).toBeDefined();
      Object.assign(call, args.p_metadata, { responseReceivedAt: stamp }); return { data: ordinaryProgress(), error: null };
    }
    if (name === "stage_article_translation_item_retry_candidate") {
      expect(args.p_outcome.providerCalls).toBe(operation!.calls.length); expect(operation!.calls.every((row: Row) => row.responseReceivedAt !== null)).toBe(true);
      race();
      if (options.saveSignal) { if (options.rejectSignal) throw options.saveSignal; return { data: null, error: options.saveSignal }; }
      const check = context({ p_source_hash: operation!.sourceHash, p_source_updated_at: operation!.originalSourceUpdatedAt,
        p_expected_english_updated_at: operation!.originalEnglishUpdatedAt, p_source_snapshot: operation!.sourceSnapshot });
      if (!check.canGenerate) return { data: null, error: { code: "40001", message: "Article machine English context changed" } };
      const parser = loaded.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts"), envelope = parser.articleWorkingDraftEnglishEnvelope(args.p_english_payload.payload);
      expect(envelope).toMatchObject({ mode: "save", payload: { status: "draft", source_content_hash: operation!.sourceHash,
        reviewed_at: null, approved_at: null, published_at: null, deleted_at: null } });
      if (options.saveRollback) throw new Error("Controlled uncommitted stage acknowledgement lost");
      privateDraft = parser.parseArticleWorkingDraft({ article_id: articleId, base_article_updated_at: operation!.originalSourceUpdatedAt,
        payload: operation!.sourceSnapshot, english_payload: envelope, expected_english_updated_at: operation!.originalEnglishUpdatedAt,
        draft_scope: "english-only", draft_english_enabled: true, version: 1, updated_at: stamp });
      operation!.candidateHash = hash(JSON.stringify(envelope)); operation!.finishEnvelope = structuredClone(envelope); operation!.finishOutcome = structuredClone(args.p_outcome);
      if (options.saveLost) throw new Error("Controlled committed stage acknowledgement lost");
      if (options.saveNull) return { data: null, error: null };
      const value = ordinaryCandidate(); if (options.saveOverrides) Object.assign(value, options.saveOverrides);
      return { data: value, error: null };
    }
    if (name === "finish_article_translation_item_retry") {
      expect(args.p_outcome.providerCalls).toBe(operation!.calls.length);
      if (args.p_outcome.status === "succeeded") {
        expect(args.p_english_payload).toEqual(operation!.finishEnvelope); expect(args.p_outcome).toEqual(operation!.finishOutcome); expect(privateDraft).not.toBeNull();
      }
      operation!.result = { outcome: args.p_outcome.status, errorCode: args.p_outcome.errorCode ?? null,
        persistence: args.p_outcome.status === "succeeded" ? "working-draft" : "none", workingDraftVersion: args.p_outcome.status === "succeeded" ? 1 : null,
        workingDraftUpdatedAt: args.p_outcome.status === "succeeded" ? stamp : null, publication: "unchanged",
        humanReview: args.p_outcome.status === "succeeded" ? "pending" : "unchanged", providerCalls: operation!.calls.length };
      return { data: ordinaryReceipt(), error: null };
    }
    if (name === "save_article_machine_english_draft") {
      race();
      if (options.saveSignal) { if (options.rejectSignal) throw options.saveSignal; return { data: null, error: options.saveSignal }; }
      const check = context(args);
      if (!check.canGenerate) return { data: null, error: { code: "40001", message: "Article machine English context changed" } };
      const parser = loaded.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts");
      const englishEnvelope = parser.articleWorkingDraftEnglishEnvelope(args.p_english_payload.payload);
      if (englishEnvelope.mode !== "save" || englishEnvelope.payload.status !== "draft" || englishEnvelope.payload.source_content_hash !== args.p_source_hash ||
        ["reviewed_at", "approved_at", "published_at", "deleted_at"].some(field => englishEnvelope.payload[field] !== null)) throw new Error("Controlled atomic save rejected human marks or source binding");
      if (options.saveRollback) throw new Error("Controlled uncommitted save acknowledgement lost");
      privateDraft = parser.parseArticleWorkingDraft({ article_id: articleId, base_article_updated_at: args.p_source_updated_at, payload: args.p_source_snapshot,
        english_payload: englishEnvelope, expected_english_updated_at: args.p_expected_english_updated_at, draft_scope: "english-only", draft_english_enabled: true, version: 1, updated_at: stamp });
      if (options.saveLost) throw new Error("Controlled committed save acknowledgement lost");
      const value: Row = { version: 1, articleId, sourceHash: args.p_source_hash, sourceUpdatedAt: options.offsetDto ? "2026-10-08T13:00:00.123456+03:00" : args.p_source_updated_at,
        englishUpdatedAt: options.offsetDto && args.p_expected_english_updated_at !== null ? "2026-10-07T13:00:00.654321+03:00" : args.p_expected_english_updated_at,
        workingDraftVersion: 1, workingDraftUpdatedAt: stamp, scope: "english-only", publication: "unchanged", humanReview: "pending", persistence: "working-draft" };
      if (options.saveNull) return { data: null, error: null };
      if (options.saveOverrides) Object.assign(value, options.saveOverrides);
      return { data: value, error: null };
    }
    throw new Error("Unexpected ordinary translation RPC " + name);
  } };
  async function run() {
    const budget = loaded.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
    let result: Row | undefined, failure: unknown;
    try { result = await loaded.load("apps/admin/lib/auto-translate-published-article-premium.ts").ensurePublishedArticlePremiumEnglish({ supabase: client, articleId, actorId, runtimeApproved: true,
      operationBudget: budget, expectedSourceHash: rowHash(), expectedSourceUpdatedAt: article.updated_at }); }
    catch (error) { failure = error; }
    budgets.push(budget.snapshot()); traces.push({ options, originalArticle, originalEnglish, originalDraft, article: structuredClone(article), english: structuredClone(english), privateDraft: structuredClone(privateDraft),
      result, failure: failure instanceof Error ? { name: failure.name, message: failure.message, digest: (failure as Row).digest } : failure, rpcCalls, events, writes, budgets, translatorCalls: translator.mock.calls.length });
    return { result, failure, budget: budget.snapshot() };
  }
  return { run, loaded, article, originalArticle, originalEnglish, originalDraft, english: () => english, draft: () => privateDraft, translator, events, writes, rpcCalls, budgets,
    rowHash, originalHash, expectedEnglishUpdatedAt, racedArticle: () => racedArticle, racedEnglish: () => racedEnglish };
}
function unchangedPublic(view: ReturnType<typeof setup>) {
  expect(view.article).toEqual(view.originalArticle); expect(view.english()).toEqual(view.originalEnglish);
  expect(view.writes.filter(write => ["articles", "article_translations"].includes(write.table))).toEqual([]);
}
function noExpense(view: ReturnType<typeof setup>, budget: Row) {
  expect(view.translator).not.toHaveBeenCalled(); expect(budget).toMatchObject({ attempts: 0, providerCalls: 0 }); unchangedPublic(view);
}

describe("M07 SAME ordinary article generation saves private EN without public or human-review mutation", () => {
  it.each(["missing", "stale-machine"])("%s English produces full EN-only private draft and leaves canonical authorship/approval intact", async english => {
    const view = setup({ english }); const { result, failure, budget } = await view.run(); expect(failure).toBeUndefined();
    expect(result).toMatchObject({ state: "translated", publication: "draft", workingDraftVersion: 1 }); expect(budget).toMatchObject({ attempts: 1, providerCalls: 2 }); unchangedPublic(view);
    expect(view.rpcCalls.map(row => row.name)).toEqual(["get_article_machine_english_draft_context", "article_translation_sync_ready", "begin_article_translation_sync_item",
      "get_article_translation_item_retry_candidate", "record_article_translation_item_retry_dispatch", "record_article_translation_item_retry_response",
      "record_article_translation_item_retry_dispatch", "record_article_translation_item_retry_response", "stage_article_translation_item_retry_candidate", "finish_article_translation_item_retry"]);
    expect(view.rpcCalls[0].args).toMatchObject({ p_article_id: articleId, p_source_hash: view.originalHash, p_source_updated_at: stamp, p_expected_english_updated_at: english === "missing" ? null : oldStamp });
    const draft = view.draft()!; expect(draft).toMatchObject({ draft_scope: "english-only", draft_english_enabled: true, version: 1, base_article_updated_at: stamp, expected_english_updated_at: view.expectedEnglishUpdatedAt });
    expect(draft.english_payload.payload).toMatchObject({ status: "draft", reviewed_at: null, approved_at: null, published_at: null, deleted_at: null, source_content_hash: view.originalHash,
      sources: [{ text: "https://source.invalid/original" }], bibliography: [{ text: "Original bibliography" }] });
    expect(draft.english_payload.payload).not.toHaveProperty("reviewed_by"); expect(draft.english_payload.payload).not.toHaveProperty("approved_by");
    expect(draft.payload.content_json.rights).toEqual(view.originalArticle.content_json.rights); expect(draft.payload.cover_external_url).toBe(view.originalArticle.cover_external_url);
    expect(draft.english_payload.payload.content_html).toContain('data-license="CC BY"'); expect(draft.english_payload.payload.content_json.__probperaMediaReferences).toEqual(expect.arrayContaining([expect.objectContaining({ mediaId })]));
    const parser = view.loaded.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts");
    expect(parser.articleWithWorkingDraft(view.article, draft).content_html).toBe(view.originalArticle.content_html);
    expect(parser.englishTranslationWithWorkingDraft(view.english(), draft)).toMatchObject({ status: "draft", reviewed_at: null, approved_at: null, published_at: null });
  });
  it.each(["manual", "approved-manual", "current", "deleted"])("%s retained canonical EN skips paid generation and any private save", async english => {
    const view = setup({ english }); const { result, failure, budget } = await view.run(); expect(failure).toBeUndefined(); expect(result?.state).not.toBe("translated"); noExpense(view, budget); expect(view.draft()).toBeNull();
  });
  it("an existing authored RU/EN working copy blocks ordinary generation without altering its partial input", async () => {
    const view = setup({ authorDraft: true }); const { result, failure, budget } = await view.run(); expect(failure).toBeUndefined(); expect(result?.state).not.toBe("translated");
    noExpense(view, budget); expect(view.draft()).toEqual(view.originalDraft);
  });
  it.each(["PGRST202", "42883", "57014", "reject"])("context capability %s fails before any paid attempt and preserves all canonical text", async contextFailure => {
    const view = setup({ contextFailure }); const { result, budget } = await view.run(); expect(result?.state).not.toBe("translated"); noExpense(view, budget); expect(view.draft()).toBeNull();
  });
  it.each([
    { canGenerate: false, blockReason: "source_changed" }, { canGenerate: false, blockReason: "english_changed" }, { canGenerate: false, blockReason: "manual_english" }, { canGenerate: false, blockReason: "draft_exists" },
    { canGenerate: true, blockReason: "draft_exists" }, { canGenerate: "true", blockReason: null }, { articleId: actorId }, { sourceHash: "b".repeat(64) },
  ])("blocked or damaged context %s cannot authorize a model call", async contextOverrides => {
    const view = setup({ contextOverrides }); const { result, budget } = await view.run(); expect(result?.state).not.toBe("translated"); noExpense(view, budget);
  });
  it.each(["ru-revision", "ru-body", "en-manual", "en-revision", "author-draft"])("persistence-boundary %s race cannot overwrite concurrent author changes", async race => {
    const view = setup({ race }); const { result, failure, budget } = await view.run(); expect(failure).toBeUndefined(); expect(result?.state).not.toBe("translated"); expect(budget.providerCalls).toBe(2);
    expect(view.article).toEqual(view.racedArticle()); expect(view.english()).toEqual(view.racedEnglish());
    expect(view.writes.filter(write => ["articles", "article_translations"].includes(write.table))).toEqual([]);
    if (race === "author-draft") expect(view.draft()).toMatchObject({ version: 9, payload: { title: "Concurrent author draft" } }); else expect(view.draft()).toBeNull();
  });
  it.each([
    { workingDraftVersion: 0 }, { workingDraftVersion: "1" }, { articleId: actorId }, { sourceHash: "b".repeat(64) },
    { sourceUpdatedAt: "2026-10-08T10:00:00.123457+00:00" }, { englishUpdatedAt: "2026-10-07T10:00:00.654322+00:00" },
    { publication: "published" }, { humanReview: "approved" }, { englishPayload: { text: privateError } },
  ])("damaged committed save ACK %s never claims translation/publication and retains private body", async saveOverrides => {
    const view = setup({ saveOverrides }); const { result } = await view.run(); expect(result?.state).not.toBe("translated");
    expect(view.draft()?.english_payload.payload.content_html).toContain("Complete private English"); unchangedPublic(view);
  });
  it.each(["saveLost", "saveNull"])("%s after private commit preserves full draft and duplicate generation spends nothing", async fault => {
    const view = setup({ [fault]: true }); const { result } = await view.run(); expect(result?.state).not.toBe("translated");
    const saved = structuredClone(view.draft()); expect(saved?.english_payload.payload.content_html).toContain("Complete private English"); unchangedPublic(view);
    const calls = view.translator.mock.calls.length, rpcCount = view.rpcCalls.length; const second = await view.run();
    expect(second.result?.state).not.toBe("translated"); expect(second.budget).toMatchObject({ attempts: 0, providerCalls: 0 }); expect(view.translator).toHaveBeenCalledTimes(calls);
    expect(view.draft()).toEqual(saved); expect(view.rpcCalls.slice(rpcCount).map(row => row.name)).toEqual(["get_article_machine_english_draft_context"]);
  });
  it("save rollback stays unconfirmed and cannot claim private persistence or change canonical EN", async () => {
    const view = setup({ saveRollback: true }); const { result } = await view.run(); expect(result?.state).not.toBe("translated"); expect(view.draft()).toBeNull(); unchangedPublic(view);
  });
  it("same six-microsecond revision in UTC and +03 receipts confirms draft without rewriting intent strings", async () => {
    const view = setup({ offsetDto: true }); const { result, failure } = await view.run(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "translated", publication: "draft", workingDraftVersion: 1 });
    const begin = view.rpcCalls.find(row => row.name === "begin_article_translation_sync_item")!;
    expect(begin.args.p_expected_article_updated_at).toBe(stamp); expect(begin.args.p_expected_english_updated_at).toBe(oldStamp); unchangedPublic(view);
  });
  it.each(["context-fulfilled", "context-rejected", "save-fulfilled", "save-rejected", "model"])("actual native Next signal at %s is preserved and never converted into success", async boundary => {
    const signal = nativeRequire("next/dist/client/components/redirect.js").getRedirectError("/admin/translations", "replace", 303);
    const options = boundary === "model" ? { modelSignal: signal } : boundary.startsWith("context") ? { contextSignal: signal, rejectSignal: boundary.endsWith("rejected") } : { saveSignal: signal, rejectSignal: boundary.endsWith("rejected") };
    const view = setup(options); const { result, failure } = await view.run(); expect(result).toBeUndefined(); expect(failure).toBe(signal); unchangedPublic(view);
    if (boundary.startsWith("context")) expect(view.translator).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  if (process.env.M07_ORDINARY_PRIVATE_EVIDENCE) writeFileSync(process.env.M07_ORDINARY_PRIVATE_EVIDENCE, JSON.stringify({
    fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...graph.values()], traces,
    scope: "SAME actual captured/current published helper, source hash, ownership classifier, strict working-draft parser and ordinary adapter if imported. Controlled SDK ledger genuinely performs old canonical writes or new private atomic RPC contract; translator simulates two budgeted provider passes.",
    limitations: ["SDK/Auth/model/context/save transaction boundaries and races controlled; not native SQL transaction or managed Auth/PostgREST/RLS acceptance", "No provider transport, paid calls, production mutation or auto retry", "Private success is technical draft persistence, never public publication or human approval"],
  }, null, 2) + "\n", { flag: "wx" });
});
