import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const redirectErrors = nativeRequire("next/dist/client/components/redirect");
const { isRedirectError } = nativeRequire("next/dist/client/components/redirect-error");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const sourceGraph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const actionFile = "apps/admin/app/(dashboard)/translations/article-actions.ts";
const helperFile = "apps/admin/lib/auto-translate-published-article-premium.ts";
const resumeFile = "apps/admin/app/(dashboard)/translations/resume-action.ts";
const pageFile = "apps/admin/app/(dashboard)/translations/page.tsx";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sourceRevision = "2026-10-08T10:00:00.000Z";
const olderRevision = "2026-10-07T10:00:00.000Z";
const authored = { ru: "Ручной RU \u2014 ё, права и источник", en: "Authored EN \u2014 rights and source" };

// Captured and current runs execute the same assertions. SDK/Auth/job/build
// transports and the expensive translator are local controlled boundaries.
// Hashing, ownership, helper, action, job mapping and native Next are actual.
function actualModules(mocks: Record<string, unknown>) {
  const modules = new Map<string, Record<string, any>>();
  function load(file: string): Record<string, any> {
    const filename = path.join(repoRoot, file);
    if (modules.has(filename)) return modules.get(filename)!;
    const before = process.env.M07_ARTICLE_SCAN_BASELINE_ROOT;
    const captured = before ? path.join(before, file) : filename;
    const source = before && existsSync(captured) ? captured : filename;
    const bytes = readFileSync(source);
    const sourceKey = `${file}:${source}`;
    const priorSource = sourceGraph.get(sourceKey);
    if (priorSource && priorSource.sha256 !== hash(bytes)) throw new Error(`Executed source changed during this fixture: ${file}`);
    sourceGraph.set(sourceKey, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} as Record<string, any> };
    modules.set(filename, module.exports);
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const resolved = name.startsWith("@/")
        ? path.join(repoRoot, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (resolved) {
        const relative = path.relative(repoRoot, resolved).replaceAll("\\", "/");
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        for (const extension of [".ts", ".tsx", "/index.ts"]) {
          if (existsSync(`${resolved}${extension}`)) return load(relative + extension);
        }
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    modules.set(filename, module.exports);
    return module.exports;
  }
  return { load };
}

type Row = Record<string, any>;
type Kind = "missing" | "machine-current" | "machine-stale" | "manual-current" | "manual-stale" | "machine-wrong-revision" | "machine-missing-revision" | "machine-draft" | "machine-stale-draft" | "machine-empty-hash" | "machine-deleted-current" | "machine-deleted-stale" | "manual-deleted";
function article(index: number): Row {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
    title: `Исходная статья ${index}: ${authored.ru}`, subtitle: "Авторский подзаголовок", excerpt: "Авторский анонс",
    slug: `original-${index}`, content_html: `<p>${authored.ru} ${index}</p>`,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.ru }] }] },
    cover_alt: "Авторская подпись", status: "published", sources: [{ text: "https://source.invalid/original" }],
    bibliography: [{ text: "Original bibliography" }], seo_title: "Авторский SEO", seo_description: "Авторское описание",
    seo_keywords: ["Автор"], og_title: "Авторский OG", og_description: "Авторское OG описание", updated_at: sourceRevision,
    categories: { slug: "culture" }, deleted_at: null,
    category_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", cover_external_url: "https://images.invalid/authored.jpg",
    legacy_path: "/authored-original/", canonical_url: "https://probpera.ru/authored-original/",
    allow_indexing: true, featured: false, show_on_homepage: true, pinned: false,
  };
}
function translatedValue() {
  return {
    title: authored.en, subtitle: "English subtitle", excerpt: "English excerpt", content_html: `<p>${authored.en}</p>`,
    cover_alt: "Original image", sources: ["https://source.invalid/original"], bibliography: ["Original bibliography"],
    seo_title: "English SEO", seo_description: "English description", seo_keywords: ["author"],
    og_title: "English OG", og_description: "English OG description", model: "mock-translator", reviewModel: "mock-reviewer",
    requestId: "local-translation-request", reviewRequestId: "local-review-request", inputTokens: 30, outputTokens: 20,
    reviewInputTokens: 20, reviewOutputTokens: 20,
  };
}
type Options = {
  kinds?: Kind[];
  articles?: Row[];
  gate?: boolean;
  gateResponses?: boolean[];
  session?: unknown;
  clientMissing?: boolean;
  conflict?: boolean;
  errorAt?: "count" | "page" | "english-page" | "article" | "english" | "save" | "record";
  modelError?: string;
  recordData?: unknown;
  saveData?: unknown;
  signalAt?: "article" | "english" | "model";
  onModel?: (row: Row, index: number) => void;
  onTranslate?: (input: Row, options: Row | undefined) => void;
  onPage?: (articles: Row[], readIndex: number) => void;
  resumeData?: unknown;
  resumeError?: boolean;
  recentJobs?: Row[];
  recordSignal?: boolean;
  resumeSignal?: boolean;
  candidateData?: unknown;
  eligibilityFailureAt?: number;
  selectionFailureAt?: number;
  readFailureMode?: "error" | "rejected" | "malformed";
};
function setup(options: Options = {}) {
  const kinds = options.kinds ?? ["missing"];
  const articles = (options.articles ?? kinds.map((_, index) => article(index))).map(row => structuredClone(row));
  const english = new Map<string, Row>();
  const drafts = new Map<string, Row>();
  const events: unknown[] = [];
  const jobs = new Map<string, Row>();
  const checkpoints: Row[] = [];
  const operations = new Map<string, Row>();
  let domainLookup = false;
  let articlePageReads = 0;
  let eligibilityReads = 0, selectionReads = 0;
  const writes: { table: string; operation: string; payload: unknown; filters: unknown[] }[] = [];
  const sdkError = { code: "LOCAL_SDK_FAILURE", message: "database read failed" };
  const audit = vi.fn(async (_payload: unknown) => ({ data: null, error: null }));
  const translator = vi.fn(async (input: Row, translateOptions?: Row) => {
    const row = articles.find(entry => entry.title === input.title)!;
    if (options.signalAt === "model") navigation.redirect("/local-native-signal");
    // This controlled translator participates in the actual coordinator's
    // dispatch/ACK protocol. A journal admission must exist before model work.
    expect([...operations.values()].some(value => value.articleId === row.id && value.result === null)).toBe(true);
    const dispatch = { provider: "cloudflare", model: "mock-translator", pass: "translation" };
    const callId = await translateOptions!.providerJournal.beforeDispatch(dispatch);
    translateOptions!.operationBudget.beforeProviderCall();
    events.push({ kind: "expensive-translation-start", articleId: row.id, input: structuredClone(input), callId });
    await translateOptions!.providerJournal.responseReceived({ ...dispatch, callId, httpStatus: options.modelError ? 500 : 200,
      requestId: "local-translation-request", responseId: "local-model-response", inputTokens: 30, outputTokens: 20 });
    if (options.modelError) throw new Error(options.modelError);
    options.onModel?.(row, translator.mock.calls.length);
    options.onTranslate?.(input, translateOptions);
    return translatedValue();
  });
  const modelCount = (id: string) => translator.mock.calls.filter(call => call[0].title === articles.find(row => row.id === id)?.title).length;
  const foundJob = (id: string) => [...jobs.values()].find(job => job.id.toLowerCase() === id.toLowerCase());
  const selectedOperations = (job: Row) => [...operations.values()].filter(value => value.jobId === job.id);
  function refreshJob(job: Row) {
    const selected = selectedOperations(job);
    job.totalItems = selected.length + job.observed.length;
    job.succeededItems = selected.filter(value => value.result?.outcome === "succeeded").length;
    job.failedItems = selected.filter(value => ["dead_letter", "conflict", "stale", "not-configured"].includes(value.result?.outcome)).length;
    job.status = selected.some(value => value.result === null) ? "reviewing" : job.failedItems ? "partial" : "completed";
  }
  function ordinaryItem(operation: Row, begin = false, replayed = false) {
    const job = foundJob(operation.jobId)!;
    return { version: 1, jobId: job.id, itemId: operation.itemId, articleId: operation.articleId, provider: "cloudflare",
      sourceHash: operation.sourceHash, sourceUpdatedAt: operation.sourceUpdatedAt, englishUpdatedAt: operation.englishUpdatedAt,
      jobVersion: String(job.version), attemptCount: operation.result ? 1 : 0, maxAttempts: 3, jobStatus: job.status,
      itemStatus: operation.result?.outcome ?? "reviewing", operationId: operation.id, phase: operation.result ? "finished" : "running",
      canExecute: begin && !replayed && !operation.result, replayed, retryable: false, blockReason: null, result: operation.result };
  }
  function candidate(operation: Row) {
    return { version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId: operation.articleId, operationId: operation.id,
      provider: "cloudflare", sourceHash: operation.sourceHash, sourceUpdatedAt: operation.sourceUpdatedAt, englishUpdatedAt: operation.englishUpdatedAt,
      phase: operation.result ? "finished" : "running", candidateState: operation.candidate ? operation.result ? "finished" : "staged" : "missing",
      candidateHash: operation.candidate?.hash ?? null, preparedAt: operation.candidate ? sourceRevision : null,
      workingDraftVersion: operation.candidate ? 1 : null, workingDraftUpdatedAt: operation.candidate ? sourceRevision : null,
      providerCalls: operation.calls.length, canRecover: Boolean(operation.candidate && !operation.result), replayed: Boolean(operation.result),
      blockReason: operation.candidate ? null : "candidate_missing" };
  }
  function progress(operation: Row, canDispatch = false) {
    return { version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId: operation.articleId, operationId: operation.id,
      provider: "cloudflare", phase: operation.result ? "finished" : "running", startedAt: operation.calls.length ? sourceRevision : null,
      updatedAt: sourceRevision, providerCalls: operation.calls.length, canDispatch, replayed: false, calls: structuredClone(operation.calls) };
  }
  function ordinaryRun(job: Row) {
    return { version: 1, jobId: job.id, provider: "cloudflare", actorId, jobVersion: String(job.version), status: job.status,
      totalItems: job.totalItems, succeededItems: job.succeededItems, failedItems: job.failedItems, activeItems: selectedOperations(job).filter(value => value.result === null).length, pendingItems: 0,
      resumeCursor: structuredClone(job.resumeCursor), replayed: false };
  }
  const rpc = vi.fn(async (name: string, args: Row = {}) => {
    if (name === "get_article_machine_english_draft_context" || name === "save_article_machine_english_draft") {
      const row = articles.find(value => value.id === args.p_article_id)!;
      const previous = english.get(args.p_article_id);
      const context = { version: 1, articleId: args.p_article_id, sourceHash: args.p_source_hash,
        sourceUpdatedAt: args.p_source_updated_at, englishUpdatedAt: args.p_expected_english_updated_at };
      events.push({ kind: "private-draft-rpc", name, args: structuredClone(args) });
      if (name === "get_article_machine_english_draft_context") return { data: { ...context, canGenerate: !drafts.has(row.id), blockReason: drafts.has(row.id) ? "draft_exists" : null }, error: null };
      if (options.errorAt === "save") return { data: null, error: { ...sdkError, message: "database write failed" } };
      if (options.conflict || row.updated_at !== args.p_source_updated_at || (previous?.updated_at ?? null) !== args.p_expected_english_updated_at || drafts.has(row.id)) {
        return { data: null, error: { code: "40001", message: "article machine English source changed" } };
      }
      const draft = { article_id: row.id, version: 1, updated_at: sourceRevision, base_article_updated_at: args.p_source_updated_at,
        expected_english_updated_at: args.p_expected_english_updated_at, payload: structuredClone(args.p_source_snapshot),
        english_payload: structuredClone(args.p_english_payload), draft_scope: "english-only", draft_english_enabled: true, actor_id: actorId };
      drafts.set(row.id, draft);
      writes.push({ table: "article_working_drafts", operation: "insert", payload: structuredClone(draft), filters: [] });
      return { data: Object.hasOwn(options, "saveData") ? options.saveData : { ...context, workingDraftVersion: 1,
        workingDraftUpdatedAt: sourceRevision, scope: "english-only", publication: "unchanged", humanReview: "pending", persistence: "working-draft" }, error: null };
    }
    events.push({ kind: "job-rpc", name, args: structuredClone(args) });
    if (name === "article_translation_sync_ready") return { data: true, error: null };
    if (name === "get_article_translation_sync_run") {
      const job = foundJob(args.p_job_id);
      domainLookup = !job?.ordinary;
      return job?.ordinary ? { data: ordinaryRun(job), error: null }
        : { data: null, error: { code: "P0002", message: "No ordinary marker on this actual legacy job" } };
    }
    if (name === "begin_article_translation_sync_item") {
      expect(Object.keys(args).sort()).toEqual(["p_job_id", "p_item_id", "p_operation_id", "p_article_id", "p_expected_job_version",
        "p_expected_source_hash", "p_expected_article_updated_at", "p_expected_english_updated_at", "p_provider", "p_expected_cursor",
        "p_resume_cursor", "p_expected_source_snapshot"].sort());
      const row = articles.find(row => row.id.toLowerCase() === args.p_article_id.toLowerCase())!;
      expect(args.p_expected_source_hash).toBe(rowHash(row));
      expect(args.p_expected_article_updated_at).toBe(row.updated_at);
      expect(args.p_expected_english_updated_at).toBe(english.get(row.id)?.updated_at ?? null);
      expect(args.p_expected_source_snapshot).toEqual(modules.load("apps/admin/lib/article-private-retry-draft.ts")
        .articlePrivateRetrySourceSnapshot({ article: row, sourceUpdatedAt: row.updated_at, expectedEnglishUpdatedAt: english.get(row.id)?.updated_at ?? null }));
      const existing = operations.get(args.p_operation_id);
      if (existing) return { data: ordinaryItem(existing, true, true), error: null };
      expect(drafts.has(row.id)).toBe(false);
      expect([...operations.values()].some(value => value.articleId === row.id && value.result === null)).toBe(false);
      let job = foundJob(args.p_job_id);
      if (!job) {
        expect(args.p_expected_job_version).toBe("0"); expect(args.p_expected_cursor).toEqual({});
        job = { id: args.p_job_id, kind: "article", status: "reviewing", totalItems: 0, succeededItems: 0, failedItems: 0,
          resumeCursor: {}, createdAt: sourceRevision, updatedAt: sourceRevision, version: 0, ordinary: true, observed: [], acknowledged: [] };
        jobs.set(job.id, job);
      }
      expect(args.p_expected_job_version).toBe(String(job.version)); expect(args.p_expected_cursor).toEqual(job.resumeCursor);
      expect(job.totalItems).toBeLessThan(500);
      job.version++; job.resumeCursor = structuredClone(args.p_resume_cursor);
      const operation = { id: args.p_operation_id, jobId: job.id, itemId: args.p_item_id, articleId: row.id,
        sourceHash: args.p_expected_source_hash, sourceUpdatedAt: args.p_expected_article_updated_at,
        englishUpdatedAt: args.p_expected_english_updated_at, snapshot: structuredClone(args.p_expected_source_snapshot),
        calls: [], candidate: null, result: null };
      operations.set(operation.id, operation); refreshJob(job);
      events.push({ kind: "ordinary-admitted-before-provider", operationId: operation.id, articleId: row.id, providerCalls: 0 });
      return { data: ordinaryItem(operation, true), error: null };
    }
    const operation = operations.get(args.p_operation_id);
    if (name === "get_article_translation_item_retry") {
      return operation ? { data: ordinaryItem(operation, false, true), error: null } : { data: null, error: { code: "P0002" } };
    }
    if (name === "get_article_translation_item_retry_candidate") {
      expect(operation).toBeDefined(); return { data: candidate(operation!), error: null };
    }
    if (name === "record_article_translation_item_retry_dispatch") {
      expect(operation).toBeDefined(); expect(operation!.result).toBeNull(); expect(operation!.calls.length).toBeLessThan(4);
      expect(operation!.calls.some((call: Row) => call.responseReceivedAt === null)).toBe(false);
      operation!.calls.push({ callId: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass,
        dispatchRecordedAt: sourceRevision, responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null });
      return { data: progress(operation!, true), error: null };
    }
    if (name === "record_article_translation_item_retry_response") {
      const call = operation!.calls.find((call: Row) => call.callId === args.p_metadata.callId); expect(call).toBeDefined();
      Object.assign(call, args.p_metadata, { responseReceivedAt: sourceRevision });
      return { data: progress(operation!), error: null };
    }
    if (name === "stage_article_translation_item_retry_candidate") {
      expect(operation!.calls.every((call: Row) => call.responseReceivedAt !== null)).toBe(true);
      expect(args.p_outcome.providerCalls).toBe(operation!.calls.length);
      const draft = modules.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts").parseArticleWorkingDraft({
        article_id: operation!.articleId, version: 1, updated_at: sourceRevision, base_article_updated_at: operation!.sourceUpdatedAt,
        expected_english_updated_at: operation!.englishUpdatedAt, payload: operation!.snapshot,
        english_payload: args.p_english_payload, draft_scope: "english-only", draft_english_enabled: true });
      drafts.set(operation!.articleId, structuredClone(draft));
      writes.push({ table: "article_working_drafts", operation: "insert", payload: structuredClone(draft), filters: [] });
      operation!.candidate = { hash: hash(JSON.stringify(args.p_english_payload)), outcome: structuredClone(args.p_outcome),
        envelope: structuredClone(args.p_english_payload) };
      return { data: candidate(operation!), error: null };
    }
    if (name === "finish_article_translation_item_retry") {
      expect(args.p_outcome.providerCalls).toBe(operation!.calls.length);
      expect(operation!.calls.every((call: Row) => call.responseReceivedAt !== null)).toBe(true);
      if (args.p_outcome.status === "succeeded") {
        expect(args.p_outcome).toEqual(operation!.candidate.outcome); expect(args.p_english_payload).toEqual(operation!.candidate.envelope);
        expect(drafts.has(operation!.articleId)).toBe(true);
      }
      const succeeded = args.p_outcome.status === "succeeded";
      operation!.result = { outcome: args.p_outcome.status, errorCode: args.p_outcome.errorCode ?? null,
        persistence: succeeded ? "working-draft" : "none", workingDraftVersion: succeeded ? 1 : null,
        workingDraftUpdatedAt: succeeded ? sourceRevision : null, publication: "unchanged", humanReview: succeeded ? "pending" : "unchanged",
        providerCalls: operation!.calls.length };
      const job = foundJob(operation!.jobId)!; job.version++; refreshJob(job);
      return { data: ordinaryItem(operation!), error: null };
    }
    if (name === "checkpoint_article_translation_sync_run") {
      if (options.recordSignal) navigation.redirect("/local-native-signal");
      if (options.errorAt === "record") return { data: null, error: sdkError };
      let job = jobs.get(args.p_job_id);
      if (!job) {
        if (args.p_expected_job_version !== "0" || Object.keys(args.p_expected_cursor).length) throw new Error("Invalid first checkpoint CAS");
        job = { id: args.p_job_id, kind: "article", status: "completed", totalItems: 0, succeededItems: 0, failedItems: 0,
          resumeCursor: {}, createdAt: sourceRevision, updatedAt: sourceRevision, version: 0, ordinary: true, observed: [], acknowledged: [] };
        jobs.set(job.id, job);
      }
      expect(args.p_expected_job_version).toBe(String(job.version));
      expect(args.p_expected_cursor).toEqual(job.resumeCursor);
      expect(args.p_observed_items.every((row: Row) => ["current", "manual", "skipped"].includes(row.state))).toBe(true);
      const completed = selectedOperations(job).filter(value => value.result !== null && !job.acknowledged.includes(value.id));
      const confirmed = [
        ...completed.map(value => ({ entityId: value.articleId, sourceHash: value.sourceHash,
          outcome: { status: value.result.outcome, ...(value.result.errorCode ? { errorCode: value.result.errorCode } : {}),
            ...(value.result.outcome === "succeeded" ? { model: value.candidate.outcome.model } : {}) } })),
        ...args.p_observed_items.map((row: Row) => ({ entityId: row.entityId, sourceHash: row.sourceHash, outcome: { status: "skipped" } })),
      ].sort((a, b) => a.entityId.toLowerCase().localeCompare(b.entityId.toLowerCase()));
      expect(new Set(confirmed.map(row => row.entityId.toLowerCase())).size).toBe(confirmed.length);
      job.acknowledged.push(...completed.map(value => value.id)); job.observed.push(...structuredClone(args.p_observed_items));
      job.version++; job.resumeCursor = structuredClone(args.p_resume_cursor); refreshJob(job);
      expect(job.totalItems).toBeLessThanOrEqual(500);
      checkpoints.push({ p_items: confirmed.map(row => ({ entityId: row.entityId, ...(row.sourceHash ? { sourceHash: row.sourceHash } : {}) })),
        p_outcomes: confirmed.map(row => row.outcome), p_resume_cursor: structuredClone(args.p_resume_cursor) });
      return { data: Object.hasOwn(options, "recordData") ? options.recordData : ordinaryRun(job), error: null };
    }
    if (name === "get_translation_job_resume") {
      if (options.resumeSignal) navigation.redirect("/local-native-signal");
      const job = [...jobs.values()].find(row => row.id.toLowerCase() === args.p_job_id.toLowerCase());
      const value = Object.hasOwn(options, "resumeData") ? structuredClone(options.resumeData)
        : job ? { id: job.id, kind: job.kind, status: job.status, resumeCursor: structuredClone(job.resumeCursor) } : null;
      const data = domainLookup && value && typeof value === "object" && !Array.isArray(value)
        ? { id: (value as Row).id, kind: (value as Row).kind, status: (value as Row).status, resumeCursor: (value as Row).resumeCursor } : value;
      domainLookup = false;
      return options.resumeError ? { data: null, error: sdkError } : { data, error: null };
    }
    if (name === "translation_operations_ready" || name === "premium_machine_translation_ready") return { data: true, error: null };
    if (name === "get_translation_operations_status") return { data: { queued: 0, running: 0, completed: 0, attention: 0, deadLetterItems: 0, recent: options.recentJobs ?? [...jobs.values()] }, error: null };
    if (name !== "record_translation_sync_run") throw new Error(`Unexpected mock RPC ${name}`);
    if (options.recordSignal) navigation.redirect("/local-native-signal");
    if (options.errorAt === "record") return { data: null, error: sdkError };
    const result = Object.hasOwn(options, "recordData") ? options.recordData : `cccccccc-cccc-4ccc-8ccc-${String(jobs.size + 1).padStart(12, "0")}`;
    if (typeof result === "string") jobs.set(result, { id: result, kind: args.p_kind, resumeCursor: structuredClone(args.p_resume_cursor), status: "partial", totalItems: args.p_items.length, succeededItems: args.p_outcomes.filter((row: Row) => row.status === "succeeded").length, failedItems: args.p_outcomes.filter((row: Row) => ["dead_letter", "conflict"].includes(row.status)).length, createdAt: sourceRevision, updatedAt: sourceRevision });
    return { data: result, error: null };
  });
  let providerProbeIdentity: unknown = null;
  const from = vi.fn((table: string) => {
    if (table === "admin_audit_log") return { insert: audit };
    if (table === "literary_work_translations" || table === "homepage_blocks" || table === "translation_provider_self_tests") {
      const result = { data: table === "translation_provider_self_tests" ? { provider: "cloudflare", configured: true, binding_found: true, test_passed: true, model: "mock-translator", latency_ms: 1, last_error_code: null, last_test_at: sourceRevision, cooldown_until: null, test_in_progress: false, configuration_identity: providerProbeIdentity } : [], error: null, count: 0 };
      const query: Row = { select() { return query; }, eq() { return query; }, in() { return query; }, contains() { return query; }, order() { return query; }, limit() { return query; }, maybeSingle() { return Promise.resolve(result); }, then(resolve: (value: unknown) => unknown, reject: (value: unknown) => unknown) { return Promise.resolve(result).then(resolve, reject); } };
      return query;
    }
    if (!["articles", "article_translations", "article_working_drafts"].includes(table)) throw new Error(`Unexpected mock table ${table}`);
    const filters: { column: string; value: unknown; operation: string }[] = [];
    let columns = "", head = false, countRequested = false, range: number[] | undefined, limit: number | undefined;
    let operation = "read", payload: Row | undefined;
    const orders: { column: string; ascending: boolean }[] = [];
    const comparable = (column: string, value: unknown) => ["id", "article_id"].includes(column) && typeof value === "string" ? value.toLowerCase() : value;
    const matches = (row: Row) => filters.every(filter => filter.operation === "in"
      ? (filter.value as unknown[]).some(value => comparable(filter.column, value) === comparable(filter.column, row[filter.column]))
      : filter.operation === "gt" ? (comparable(filter.column, row[filter.column]) as any) > comparable(filter.column, filter.value)!
      : filter.operation === "lte" ? (comparable(filter.column, row[filter.column]) as any) <= comparable(filter.column, filter.value)!
      : filter.operation === "or" ? true
      : comparable(filter.column, row[filter.column]) === comparable(filter.column, filter.value));
    const response = (single = false) => {
      const id = filters.find(filter => filter.column === (table === "articles" ? "id" : "article_id"))?.value as string | undefined;
      const errorAt = table === "articles"
        ? head ? "count" : single ? "article" : "page"
        : single ? "english" : "english-page";
      if ((options.signalAt === "article" && errorAt === "article") || (options.signalAt === "english" && errorAt === "english")) {
        navigation.redirect("/local-native-signal");
      }
      if (operation !== "read") {
        writes.push({ table, operation, payload: structuredClone(payload), filters: structuredClone(filters) });
        events.push({ kind: "translation-write", table, operation, articleId: payload?.article_id });
        if (options.errorAt === "save") return { data: null, error: { ...sdkError, message: "database write failed" } };
        const savedId = operation === "update" ? filters.find(filter => filter.column === "id")?.value : "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
        if (payload) english.set(payload.article_id, { ...(english.get(payload.article_id) ?? {}), ...structuredClone(payload), id: savedId });
        return { data: Object.hasOwn(options, "saveData") ? options.saveData : { id: savedId }, error: null };
      }
      const eligibility = table === "articles" && !head && !single && filters.some(filter => filter.column === "id" && filter.operation === "in");
      const selection = table === "articles" && !head && !single && countRequested;
      const failRead = eligibility && ++eligibilityReads === options.eligibilityFailureAt || selection && ++selectionReads === options.selectionFailureAt;
      if (failRead) {
        events.push({ kind: "controlled-scan-read-failure", eligibility, selection, eligibilityReads, selectionReads, mode: options.readFailureMode });
        if (options.readFailureMode === "rejected") throw new Error("database read failed locally");
        return options.readFailureMode === "malformed" ? { data: [{ id: "not-a-uuid" }], error: null, count: 1 } : { data: null, error: sdkError, count: null };
      }
      if (options.errorAt === errorAt) return { data: null, error: sdkError, count: null };
      let values = (table === "articles" ? articles : table === "article_working_drafts" ? [...drafts.values()] : [...english.values()]).filter(matches);
      const exactCount = values.length;
      if (single && table === "articles" && columns === "updated_at" && options.conflict && id && modelCount(id)) {
        values = [{ ...values[0], updated_at: "2026-10-08T11:00:00.000Z" }];
      }
      values = [...values].sort((left, right) => {
        for (const order of orders) {
          const leftValue = comparable(order.column, left[order.column]) as any, rightValue = comparable(order.column, right[order.column]) as any;
          const difference = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
          if (difference) return order.ascending ? difference : -difference;
        }
        return 0;
      });
      if (range) values = values.slice(range[0], range[1] + 1);
      if (limit !== undefined) values = values.slice(0, limit);
      events.push({ kind: "sdk-read", table, columns, head, filters: structuredClone(filters), range, limit, orders: structuredClone(orders), ids: values.map(row => row.id ?? row.article_id), rows: values.length });
      if (table === "articles" && !head && !single) options.onPage?.(articles, ++articlePageReads);
      if (table === "articles" && !head && !single && Object.hasOwn(options, "candidateData")) return { data: structuredClone(options.candidateData), error: null };
      return { data: head ? null : single ? values[0] ? structuredClone(values[0]) : null : structuredClone(values), error: null, count: countRequested ? exactCount : undefined };
    };
    const query: Row = {
      select(value: string, config?: Row) { columns = value; head = config?.head === true; countRequested = config?.count === "exact"; return query; },
      eq(column: string, value: unknown) { filters.push({ column, value, operation: "eq" }); return query; },
      is(column: string, value: unknown) { filters.push({ column, value, operation: "is" }); return query; },
      in(column: string, value: unknown[]) { filters.push({ column, value, operation: "in" }); return query; },
      gt(column: string, value: unknown) { filters.push({ column, value, operation: "gt" }); return query; },
      lte(column: string, value: unknown) { filters.push({ column, value, operation: "lte" }); return query; },
      or(value: unknown) { filters.push({ column: "or", value, operation: "or" }); return query; },
      order(column: string, config: Row = {}) { orders.push({ column, ascending: config.ascending !== false }); events.push({ kind: "order", table, column, config }); return query; },
      range(start: number, end: number) { range = [start, end]; return query; },
      limit(value: number) { limit = value; return query; },
      update(value: Row) { operation = "update"; payload = value; return query; },
      insert(value: Row) { operation = "insert"; payload = value; return query; },
      maybeSingle() { return Promise.resolve().then(() => response(true)); },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve().then(() => response()).then(resolve, reject); },
    };
    return query;
  });
  const client = { from, rpc };
  const build = vi.fn(async (input: unknown) => { events.push({ kind: "build", input: structuredClone(input && typeof input === "object" ? { ...(input as Row), supabase: "mock-sdk" } : input) }); return { state: "queued" }; });
  const revalidate = vi.fn();
  const gate = vi.fn(async () => options.gateResponses?.[gate.mock.calls.length - 1] ?? options.gate !== false);
  const requireStaff = vi.fn(async () => options.session === undefined ? { user: { id: actorId } } : options.session);
  const modules = actualModules({
    "@/lib/auth": { requireStaff }, "@/lib/supabase/server": { createServerSupabaseClient: vi.fn(async () => options.clientMissing ? null : client) },
    "@/lib/publication": { requestPublicBuild: build }, "next/cache": { revalidatePath: revalidate },
    "apps/admin/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: gate, premiumTranslationSelfTestFresh: () => true },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => ({ version: 1, countries: [] }) },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: async () => { throw Error("Read-only page must not dispatch the provider"); } } } }) },
    // Standalone React DOM 18 has no Next experimental useFormStatus export.
    // Execute the actual submit component with only its pending hook controlled.
    "react-dom": { ...nativeRequire("react-dom"), useFormStatus: () => ({ pending: false }) },
    "apps/admin/app/(dashboard)/translations/actions": { translatePremiumLibraryBatchAction: async () => {}, translatePremiumSiteCopyBatchAction: async () => {}, translatePremiumWriterBatchAction: async () => {} },
    "apps/admin/app/(dashboard)/translations/country-actions": { translatePremiumCountryBatchAction: async () => {} },
    "apps/admin/app/(dashboard)/translations/self-test-action": { runPremiumTranslationSelfTestAction: async () => {} },
    "apps/admin/lib/auto-translate-article": { translateArticleSourceToEnglish: translator },
    "apps/admin/lib/env": { adminEnv: { openAiAutoTranslateArticles: true, publicSiteUrl: "https://site.invalid", premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "mock-translator", cloudflareTranslationReviewModel: "mock-reviewer", openAiPremiumTranslationReview: true } },
  });
  const ownership = modules.load("apps/admin/lib/article-translation-machine-ownership.ts");
  const sourceHash = modules.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash;
  function rowHash(row: Row) {
    return sourceHash({ title: row.title, subtitle: row.subtitle || "", excerpt: row.excerpt || "", contentJson: row.content_json || { type: "doc", content: [] },
      contentHtml: row.content_html || "", coverAlt: row.cover_alt || "", slug: row.slug, sources: row.sources || [], bibliography: row.bibliography || [],
      seoTitle: row.seo_title || row.title, seoDescription: row.seo_description || row.excerpt || "", seoKeywords: row.seo_keywords || [],
      ogTitle: row.og_title || row.seo_title || row.title, ogDescription: row.og_description || row.seo_description || row.excerpt || "" });
  }
  articles.forEach((row, index) => {
    const kind = kinds[index] ?? kinds[0];
    if (kind === "missing") return;
    const current = ["machine-current", "manual-current", "machine-wrong-revision", "machine-missing-revision", "machine-draft", "machine-deleted-current", "manual-deleted"].includes(kind);
    const persistedHash = kind === "machine-empty-hash" ? "" : current ? rowHash(row) : hash(`older source ${row.id}`);
    const machine = kind.startsWith("machine-");
    english.set(row.id, { id: `eeeeeeee-eeee-4eee-8eee-${String(index + 1).padStart(12, "0")}`, article_id: row.id, locale: "en", updated_at: olderRevision,
      title: authored.en, content_html: `<p>${authored.en}</p>`, status: ["machine-draft", "machine-stale-draft"].includes(kind) ? "draft" : "published",
      slug: `english-${index}`, canonical_url: `https://site.invalid/english-${index}`, source_content_hash: persistedHash,
      source_article_updated_at: kind === "machine-missing-revision" ? null : ["machine-wrong-revision", "machine-stale", "machine-stale-draft", "manual-stale", "machine-deleted-stale"].includes(kind) ? olderRevision : row.updated_at,
      content_json: machine ? ownership.premiumArticleMachineContentJson({ sourceHash: persistedHash, model: "prior-model", reviewerModel: null, translatorRequestId: "prior-id", reviewerRequestId: null, generatedAt: olderRevision }, `<p>${authored.en}</p>`)
        : { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.en }] }] }, deleted_at: kind.includes("deleted") ? olderRevision : null,
      sources: [{ text: "https://source.invalid/manual" }], rights: { holder: "Manual editor", license: "Original licence" } });
  });
  const originalArticles = structuredClone(articles);
  const originalEnglish = structuredClone([...english.values()]);
  const helper = modules.load(helperFile).ensurePublishedArticlePremiumEnglish;
  const action = modules.load(actionFile).translatePremiumArticleBatchAction;
  const trace = (scope: string, result: unknown) => traces.push({ scope, result, options: { ...options, onModel: !!options.onModel }, translatorCalls: translator.mock.calls, writes, audit: audit.mock.calls, job: rpc.mock.calls, build: build.mock.calls.map(call => ({ ...call[0] as Row, supabase: "mock-sdk" })), events });
  async function runActual(actionToRun: (form: FormData) => Promise<unknown>, values: Record<string, unknown>) {
    const form = new FormData(); for (const [key, value] of Object.entries(values)) if (value !== undefined) form.set(key, String(value));
    try { await actionToRun(form); throw new Error("Expected actual Next redirect"); }
    catch (error) {
      if (!isRedirectError(error)) throw error;
      const destination = redirectErrors.getURLFromRedirectError(error);
      const result = { destination, params: new URL(destination, "https://local.invalid").searchParams };
      trace("actual-batch", { destination }); return result;
    }
  }
  async function runBatch(values: Record<string, unknown> = {}) { return runActual(action, values); }
  async function resume(jobId: string) { return runActual(modules.load(resumeFile).resumeTranslationJobAction, { job_id: jobId }); }
  async function render(query: Row = {}) {
    providerProbeIdentity = await modules.load("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity();
    const element = await modules.load(pageFile).default({ searchParams: Promise.resolve(query) });
    const markup = nativeRequire("react-dom/server").renderToStaticMarkup(element);
    const $ = nativeRequire("cheerio").load(markup);
    trace("actual-SSR", { query, markup });
    return { markup, $ };
  }
  async function runHelper(index = 0) {
    try { const result = await helper({ supabase: client, actorId, articleId: articles[index].id, runtimeApproved: true }); trace("actual-helper", result); return result; }
    catch (error) { trace("actual-helper-thrown", error instanceof Error ? { message: error.message, digest: (error as Row).digest } : error); throw error; }
  }
  return { runBatch, runHelper, resume, render, articles, english, originalArticles, originalEnglish, translator, audit, rpc, build, revalidate, gate, writes, events, requireStaff, rowHash, jobs, checkpoints, operations, options, client };
}
// These are projections of admitted/finished items plus acknowledged cheap
// observations at actual ordinary checkpoints, not invented calls
// to the retired post-provider record_translation_sync_run API.
function records(view: ReturnType<typeof setup>) { return view.checkpoints; }
function outcome(view: ReturnType<typeof setup>) { return records(view).at(-1)!; }
function noAutomaticChanges(view: ReturnType<typeof setup>) { expect(view.translator).not.toHaveBeenCalled(); expect(view.writes).toEqual([]); expect(view.build).not.toHaveBeenCalled(); }

const jobUuid = "cccccccc-cccc-4ccc-8ccc-000000000001";
function lastJob(view: ReturnType<typeof setup>) { return [...view.jobs.keys()].at(-1)!; }
function recordedIds(view: ReturnType<typeof setup>) { return records(view).flatMap(record => record.p_items.map((item: Row) => item.entityId)); }
function stateFor(rows: Row[], patch: Row = {}) {
  return { version: 1, order: "id", upperId: rows.at(-1)!.id, afterId: null, pendingIds: rows.map(row => row.id), nextIndex: 0, lastWindow: true, exhausted: false, ...patch };
}
function jobFor(rows: Row[], patch: Row = {}) {
  return { id: jobUuid, kind: "article", status: "partial", totalItems: 3, succeededItems: 1, failedItems: 1,
    resumeCursor: { articleScan: stateFor(rows) }, createdAt: sourceRevision, updatedAt: sourceRevision, ...patch };
}

describe("M07 actual article scan keeps a bounded deterministic work set", () => {
  it("the SDK fixture really applies both sort columns before OFFSET and limit", async () => {
    const rows = [article(2), article(0), article(1)];
    rows[1].updated_at = olderRevision;
    const view = setup({ articles: rows, kinds: ["machine-current"] });
    const result = await view.client.from("articles").select("id").order("updated_at", { ascending: true }).order("id", { ascending: false }).range(1, 2).limit(1);
    expect(result.data.map((row: Row) => row.id)).toEqual([rows[0].id]);
    expect(view.articles).toEqual(view.originalArticles);
  });
  it("equal timestamps and reversed storage produce UUID order, not incidental row order", async () => {
    const rows = Array.from({ length: 105 }, (_, index) => article(index)).reverse();
    const view = setup({ articles: rows, kinds: ["machine-current"] });
    await view.runBatch();
    expect(recordedIds(view)).toEqual(rows.map(row => row.id).sort());
    noAutomaticChanges(view);
    const queries = (view.events as Row[]).filter(event => event.kind === "sdk-read" && event.table === "articles" && !event.head && event.orders.length);
    expect(queries.every(query => query.range === undefined)).toBe(true);
    expect(queries.some(query => query.orders.some((order: Row) => order.column === "id"))).toBe(true);
  });
  it("changes to updated_at during the same scan cannot move IDs across OFFSET pages", async () => {
    const rows = Array.from({ length: 205 }, (_, index) => article(index));
    const view = setup({ articles: rows, kinds: ["machine-current"], onPage: (mutableRows, index) => {
      if (index === 1) mutableRows.slice(0, 100).forEach(row => { row.updated_at = "2026-10-09T10:00:00.000Z"; });
    } });
    await view.runBatch();
    expect(recordedIds(view)).toEqual(rows.map(row => row.id));
    expect(new Set(recordedIds(view)).size).toBe(205);
    noAutomaticChanges(view);
  });
  it("persists the selected window before a continuation and never repeats mutable earlier rows", async () => {
    const view = setup({ kinds: ["missing", "missing", "missing", "manual-current", "machine-current"] });
    const first = await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(2);
    const initialIds = view.originalArticles.map(row => row.id);
    const firstRecord = records(view)[0];
    const firstJob = lastJob(view);
    const encodedReceipt = JSON.parse(JSON.stringify(view.jobs.get(lastJob(view))));
    expect(encodedReceipt.resumeCursor).toEqual(firstRecord.p_resume_cursor);
    view.articles[0].updated_at = "2026-10-09T10:00:00.000Z";
    view.articles.splice(1, 1);
    view.articles.find(row => row.id === initialIds[3])!.status = "draft";
    const before = article(900); before.id = "bbbbbbbb-bbbb-4bbb-8bbb-000000000000";
    const after = article(901);
    view.articles.push(before, after);
    await view.resume(first.params.get("articleJob") || firstJob);
    expect(recordedIds(view)).toEqual(initialIds);
    expect(new Set(recordedIds(view)).size).toBe(initialIds.length);
    expect(view.translator.mock.calls.map(call => call[0].title)).toEqual(initialIds.slice(0, 3).map(id => view.originalArticles.find(row => row.id === id)!.title));
    expect(view.english.get(initialIds[3])).toEqual(view.originalEnglish[0]);
    expect(view.english.get(before.id)).toBeUndefined(); expect(view.english.get(after.id)).toBeUndefined();
    expect(firstRecord.p_resume_cursor).toMatchObject({ articleScan: { pendingIds: initialIds, nextIndex: 2, upperId: initialIds.at(-1) } });
    expect(first.params.get("articleJob")).toBe(firstJob);
    expect(first.params.has("articleCursor")).toBe(false);
    expect(outcome(view).p_resume_cursor.articleScan).toMatchObject({ pendingIds: [], nextIndex: 0, lastWindow: true, exhausted: true, upperId: initialIds.at(-1) });
  });
  it("bounds an all-current window at 500 and continues with gt(id) under the original upper bound", async () => {
    const rows = Array.from({ length: 605 }, (_, index) => article(index)).reverse();
    const view = setup({ kinds: ["machine-current"], articles: rows });
    const ids = rows.map(row => row.id).sort();
    const first = await view.runBatch();
    const firstRecord = records(view)[0];
    view.articles.find(row => row.id === ids[199])!.updated_at = "2026-10-09T10:00:00.000Z";
    const before = article(900); before.id = "bbbbbbbb-bbbb-4bbb-8bbb-000000000000";
    const after = article(901); view.articles.push(before, after);
    await view.resume(first.params.get("articleJob") || lastJob(view));
    expect(recordedIds(view)).toEqual(ids);
    expect(new Set(recordedIds(view)).size).toBe(605);
    expect(firstRecord.p_items.map((item: Row) => item.entityId)).toEqual(ids.slice(0, 500));
    expect(firstRecord.p_resume_cursor.articleScan).toMatchObject({ upperId: ids.at(-1), afterId: ids[499], pendingIds: [], nextIndex: 0, lastWindow: false, exhausted: false });
    noAutomaticChanges(view);
    const nextReads = (view.events as Row[]).filter(event => event.kind === "sdk-read" && event.table === "articles" && event.filters.some((filter: Row) => filter.operation === "gt"));
    expect(nextReads.length).toBeGreaterThan(0);
    expect(nextReads.some(read => read.filters.some((filter: Row) => filter.column === "id" && filter.value === ids[499]))).toBe(true);
    expect(nextReads.every(read => read.range === undefined)).toBe(true);
    expect(outcome(view).p_resume_cursor.articleScan.exhausted).toBe(true);
  });
  it("continuation advances past a failed item and does not pretend to retry it", async () => {
    const view = setup({ kinds: ["missing", "missing", "missing"], modelError: "provider request failed locally" });
    await view.runBatch();
    const failedId = view.articles[0].id;
    expect(records(view)[0].p_outcomes).toEqual([{ status: "dead_letter", errorCode: "provider_request_failed" }]);
    const failedJob = lastJob(view); delete view.options.modelError;
    await view.resume(failedJob);
    expect(recordedIds(view)).toEqual(view.articles.map(row => row.id));
    expect(view.translator.mock.calls.filter(call => call[0].title === view.articles[0].title)).toHaveLength(1);
    expect(view.english.has(failedId)).toBe(false);
    expect(outcome(view).p_items.map((item: Row) => item.entityId)).toEqual(view.articles.slice(1).map(row => row.id));
  });
  it("completed continuation does not silently open a new scan or call a model", async () => {
    const rows = [article(0), article(1)];
    const view = setup({ articles: rows, kinds: ["machine-current"], resumeData: jobFor(rows, { resumeCursor: { articleScan: stateFor(rows, { afterId: rows[1].id, pendingIds: [], nextIndex: 0, exhausted: true }) } }) });
    const result = await view.resume(jobUuid);
    expect(result.params.get("errorCode")).toBe("translation_scan_complete");
    noAutomaticChanges(view); expect(records(view)).toEqual([]);
    expect((view.events as Row[]).filter(row => row.kind === "sdk-read" && row.table === "articles")).toEqual([]);
  });
  it("the explicit fresh action after completion captures newly inserted IDs", async () => {
    const view = setup({ kinds: ["machine-current"] }); await view.runBatch();
    const completedJob = lastJob(view);
    const newRow = article(100); view.articles.push(newRow);
    await view.runBatch({ articleJob: completedJob, articleCursor: 99, articleScanIntent: "fresh" });
    expect(outcome(view).p_resume_cursor.articleScan.upperId).toBe(newRow.id);
    expect(outcome(view).p_items.map((item: Row) => item.entityId)).toContain(newRow.id);
    expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.calls.some(call => call[0] === "get_translation_job_resume")).toBe(false);
  });
  it.each(["error", "rejected", "malformed"] as const)("preserves the first100 items and resumes their unread tail after an eligibility %s", async readFailureMode => {
    const rows = Array.from({ length: 205 }, (_, index) => article(index));
    const view = setup({ kinds: ["machine-current"], articles: rows, eligibilityFailureAt: 2, readFailureMode });
    const result = await view.runBatch();
    expect(result.params.get("errorCode")).toBe("database_read_failed");
    expect(recordedIds(view)).toEqual(rows.slice(0, 100).map(row => row.id));
    expect(outcome(view).p_resume_cursor.articleScan).toMatchObject({ pendingIds: rows.map(row => row.id), nextIndex: 100, exhausted: false });
    const partialJob = lastJob(view); expect(result.params.get("articleJob")).toBe(partialJob);
    delete view.options.eligibilityFailureAt;
    await view.resume(partialJob);
    expect(recordedIds(view)).toEqual(rows.map(row => row.id)); expect(new Set(recordedIds(view)).size).toBe(205);
    expect(outcome(view).p_resume_cursor.articleScan.exhausted).toBe(true);
    noAutomaticChanges(view); expect(view.articles).toEqual(view.originalArticles); expect([...view.english.values()]).toEqual(view.originalEnglish);
  });
  it.each(["error", "rejected", "malformed"] as const)("retains the completed500 receipt without fabricating a second batch after next-window %s", async readFailureMode => {
    const rows = Array.from({ length: 605 }, (_, index) => article(index));
    const view = setup({ kinds: ["machine-current"], articles: rows, selectionFailureAt: 2, readFailureMode });
    await view.runBatch(); const completedWindowJob = lastJob(view);
    expect(recordedIds(view)).toHaveLength(500);
    const result = await view.resume(completedWindowJob);
    expect(result.params.get("errorCode")).toBe("database_read_failed");
    expect(result.params.get("articleJob")).toBe(completedWindowJob); expect(result.params.get("success")).toBeNull();
    expect(records(view)).toHaveLength(1); expect(recordedIds(view)).toEqual(rows.slice(0, 500).map(row => row.id));
    noAutomaticChanges(view); expect(view.articles).toEqual(view.originalArticles); expect([...view.english.values()]).toEqual(view.originalEnglish);
  });
  it("accepts PostgreSQL-equivalent uppercase job and pending UUIDs without losing candidates", async () => {
    const rows = [article(0), article(1), article(2)];
    const state = stateFor(rows, { upperId: rows[2].id.toUpperCase(), pendingIds: rows.map(row => row.id.toUpperCase()) });
    const view = setup({ articles: rows, kinds: ["machine-current"], resumeData: jobFor(rows, { resumeCursor: { articleScan: state } }) });
    await view.resume(jobUuid.toUpperCase());
    expect(recordedIds(view).map((id: string) => id.toLowerCase())).toEqual(rows.map(row => row.id));
    noAutomaticChanges(view); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect(outcome(view).p_resume_cursor.articleScan.exhausted).toBe(true);
  });
  it("an empty fresh scan confirms completion without a zero-offset restart", async () => {
    const view = setup({ articles: [] }); const result = await view.runBatch();
    expect(result.params.get("success")).toContain("кандидатов");
    expect(result.params.get("success")).toContain("нет");
    expect(result.params.has("articleCursor")).toBe(false);
    noAutomaticChanges(view); expect(records(view)).toEqual([]);
  });
  it.each([null, {}, [{ id: "not-a-uuid" }], [{ id: article(0).id }, { id: article(0).id }], [{ id: article(2).id }, { id: article(0).id }]])(
    "unconfirmed selected window %j stops before helper or provider work", async candidateData => {
      const view = setup({ kinds: ["missing", "missing", "missing"], candidateData }); const result = await view.runBatch();
      expect(result.params.get("errorCode")).toBe("database_read_failed");
      noAutomaticChanges(view); expect(records(view)).toEqual([]);
    }
  );
});

describe("M07 actual resume verifies a durable receipt before candidate or provider effects", () => {
  const rows = [article(0), article(1), article(2)];
  const badReceipts: { name: string; value: unknown; error: string }[] = [
    // A malformed server domain receipt is unconfirmed, while malformed form
    // input is still rejected as invalid_input before any RPC below.
    { name: "wrong job identity", value: jobFor(rows, { id: "cccccccc-cccc-4ccc-8ccc-000000000002" }), error: "translation_retry_unconfirmed" },
    { name: "wrong entity kind", value: jobFor(rows, { kind: "writer" }), error: "translation_retry_unconfirmed" },
    { name: "array receipt", value: [jobFor(rows)], error: "translation_retry_unconfirmed" },
    { name: "null receipt", value: null, error: "translation_retry_unconfirmed" },
    { name: "legacy nonzero cursor", value: jobFor(rows, { resumeCursor: { articleCursor: 2 } }), error: "translation_resume_stale" },
    { name: "legacy empty cursor", value: jobFor(rows, { resumeCursor: {} }), error: "translation_resume_stale" },
    { name: "missing cursor", value: { id: jobUuid, kind: "article" }, error: "translation_retry_unconfirmed" },
    ...[
      { version: 2 }, { order: "updated_at" }, { upperId: "bad" }, { nextIndex: 4 }, { nextIndex: -1 }, { nextIndex: 0.5 },
      { pendingIds: [rows[1].id, rows[0].id] }, { pendingIds: [rows[0].id, rows[0].id] }, { pendingIds: ["bad"] },
      { pendingIds: Array(501).fill(rows[0].id) }, { afterId: rows[2].id }, { exhausted: true }, { extraField: 1 },
    ].map((patch, index) => ({ name: `damaged scan ${index}`, value: jobFor(rows, { resumeCursor: { articleScan: stateFor(rows, patch) } }), error: "translation_resume_stale" })),
  ];
  it.each(badReceipts)("rejects $name before continuing the actual article action", async ({ value, error }) => {
    const view = setup({ kinds: ["missing"], resumeData: value });
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe(error);
    noAutomaticChanges(view); expect(records(view)).toEqual([]);
    expect((view.events as Row[]).filter(event => event.kind === "sdk-read" && event.table === "articles")).toEqual([]);
  });
  it.each(["bad", "", "cccccccc-cccc-4ccc-8ccc-000000000001.extra"])("rejects invalid articleJob %j without a resume lookup", async articleJob => {
    const view = setup(); const result = await view.runBatch({ articleJob });
    expect(result.params.get("errorCode")).toBe("invalid_input"); noAutomaticChanges(view);
    expect(view.rpc).not.toHaveBeenCalled();
  });
  it("rejects a naked nonzero legacy articleCursor without silently restarting", async () => {
    const view = setup(); const result = await view.runBatch({ articleCursor: 2 });
    expect(result.params.get("errorCode")).toBe("translation_resume_stale");
    noAutomaticChanges(view); expect(view.rpc).not.toHaveBeenCalled();
  });
  it("a resume read failure retains the exact job and stops before a candidate read", async () => {
    const view = setup({ resumeError: true }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("translation_retry_unconfirmed");
    expect(result.params.get("articleJob")).toBe(jobUuid); noAutomaticChanges(view);
    expect(records(view)).toEqual([]);
  });
  it("native Next signals from resume lookup retain their redirect and launch no work", async () => {
    const view = setup({ resumeSignal: true }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.destination).toBe("/local-native-signal"); noAutomaticChanges(view); expect(records(view)).toEqual([]);
  });
  it("native Next signals from durable record are not converted into ordinary write errors", async () => {
    const view = setup({ recordSignal: true }); const result = await view.runBatch();
    expect(result.destination).toBe("/local-native-signal"); expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.build).not.toHaveBeenCalled(); expect(view.revalidate).not.toHaveBeenCalled();
  });
  it("actual resume action rejects a foreign receipt identity before dispatching the article batch", async () => {
    const view = setup({ resumeData: jobFor(rows, { id: "cccccccc-cccc-4ccc-8ccc-000000000002" }) });
    const result = await view.resume(jobUuid);
    expect(result.params.get("errorCode")).toBe("invalid_input"); noAutomaticChanges(view);
    expect(records(view)).toEqual([]);
  });
  it.each([null, "not-a-uuid", { id: jobUuid }, [jobUuid]])("checkpoint receipt %j cannot manufacture confirmed progress or publication", async recordData => {
    const view = setup({ recordData }); const result = await view.runBatch();
    expect(result.params.get("errorCode")).toBe("translation_retry_unconfirmed");
    expect(result.params.get("success")).toBeNull(); expect(result.params.get("articleJob")).toBe(lastJob(view));
    // BEGIN and FINISH have already acknowledged the same real job. A bad
    // later checkpoint DTO cannot erase its identity or claim rollback.
    expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.operations.size).toBe(1);
    expect([...view.operations.values()][0].result).toMatchObject({ outcome: "succeeded", persistence: "working-draft", publication: "unchanged", humanReview: "pending" });
    expect(view.rpc.mock.calls.filter(call => call[0] === "begin_article_translation_sync_item")).toHaveLength(1);
    expect(view.rpc.mock.calls.filter(call => call[0] === "finish_article_translation_item_retry")).toHaveLength(1);
    expect(view.rpc.mock.calls.filter(call => call[0] === "checkpoint_article_translation_sync_run")).toHaveLength(1);
    expect(view.articles).toEqual(view.originalArticles); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect(view.build).not.toHaveBeenCalled();
  });
  it.each(["cancelled", "cancelling"] as const)("%s article job cannot launch the actual batch or resume action", async status => {
    const receipt = jobFor(rows, { status });
    const direct = setup({ resumeData: receipt }); const directResult = await direct.runBatch({ articleJob: jobUuid });
    expect(directResult.params.get("errorCode")).toBe("translation_operation_stopped"); noAutomaticChanges(direct); expect(records(direct)).toEqual([]);
    const resumed = setup({ resumeData: receipt }); const resumeResult = await resumed.resume(jobUuid);
    expect(resumeResult.params.get("errorCode")).toBe("translation_operation_stopped"); noAutomaticChanges(resumed); expect(records(resumed)).toEqual([]);
  });
});

describe("M07 actual SSR separates a completed batch from a complete scan", () => {
  const rows = [article(0), article(1), article(2)];
  it("pending completed batch remains resumable and transmits only the durable job UUID", async () => {
    const view = setup({ recentJobs: [jobFor(rows, { status: "completed", resumeCursor: { articleScan: stateFor(rows, { nextIndex: 1 }) } })] });
    const { $ } = await view.render();
    const form = $('form').filter((_index: number, element: unknown) => $(element).find('input[name="job_id"]').length > 0);
    expect(form).toHaveLength(1); expect(form.find('button').attr('disabled')).toBeUndefined();
    expect(form.find('input').toArray().map((element: unknown) => $(element).attr('name'))).toEqual(["job_id"]);
    expect(form.find('input').attr('value')).toBe(jobUuid);
    const primaryArticleForm = $('button[name="articleScanIntent"][value="fresh"]').closest('form');
    expect(primaryArticleForm.find('input[name="articleCursor"]')).toHaveLength(0);
    expect(primaryArticleForm.find('input[name="articleScan"]')).toHaveLength(0);
    expect(form.text()).toContain("Технически выполнено 1 из 3 просмотренных");
  });
  it("exhausted scan disables continuation while leaving the verified batch counts visible", async () => {
    const view = setup({ recentJobs: [jobFor(rows, { status: "completed", resumeCursor: { articleScan: stateFor(rows, { afterId: rows[2].id, pendingIds: [], nextIndex: 0, exhausted: true }) } })] });
    const { $ } = await view.render();
    const form = $('form').filter((_index: number, element: unknown) => $(element).find('input[name="job_id"]').length > 0);
    expect(form.find('button').attr('disabled')).toBeDefined();
    expect(form.text()).toContain("Технически выполнено 1 из 3 просмотренных");
    const fresh = $('button[name="articleScanIntent"][value="fresh"]');
    expect(fresh).toHaveLength(1); expect(fresh.attr('disabled')).toBeUndefined();
  });
  it("legacy cursor disables continuation without hiding historically confirmed batch counts", async () => {
    const view = setup({ recentJobs: [jobFor(rows, { resumeCursor: { articleCursor: 41 } })] });
    const { $ } = await view.render();
    const form = $('form').filter((_index: number, element: unknown) => $(element).find('input[name="job_id"]').length > 0);
    expect(form.find('button').attr('disabled')).toBeDefined(); expect(form.text()).toContain("Технически выполнено 1 из 3 просмотренных");
  });
  it("raw pending IDs are never copied into continuation URLs or hidden article form fields", async () => {
    const view = setup({ recentJobs: [jobFor(rows)] }); const { $ } = await view.render({ articleJob: jobUuid, articleCursor: "99" });
    const primaryArticleForm = $('button[name="articleScanIntent"][value="fresh"]').closest('form');
    const fields = primaryArticleForm.find('input').toArray().map((element: unknown) => ({ name: $(element).attr('name'), value: $(element).attr('value') }));
    expect(fields.some((field: Row) => field.name === "articleCursor" || field.name === "articleScan")).toBe(false);
    expect(fields.some((field: Row) => field.name === "articleJob" && field.value === jobUuid)).toBe(true);
    expect(fields.every((field: Row) => !rows.some(row => field.value?.includes(row.id)))).toBe(true);
  });
  it.each(["cancelled", "cancelling"] as const)("%s scan disables only its continuation and preserves an explicit new scan", async status => {
    const receipt = jobFor(rows, { status });
    const view = setup({ recentJobs: [receipt], resumeData: receipt }); const { $ } = await view.render({ articleJob: jobUuid });
    const journalForm = $('input[name="job_id"]').closest('form'); expect(journalForm.find('button').attr('disabled')).toBeDefined();
    const primary = $('button[name="articleScanIntent"][value="fresh"]').closest('form');
    expect(primary.find('button').filter((_index: number, element: unknown) => !$(element).attr('name')).attr('disabled')).toBeDefined();
    expect(primary.find('button[name="articleScanIntent"][value="fresh"]').attr('disabled')).toBeUndefined();
  });
});

afterAll(() => {
  if (!process.env.M07_ARTICLE_SCAN_EVIDENCE) return;
  writeFileSync(process.env.M07_ARTICLE_SCAN_EVIDENCE, JSON.stringify({ fixture: { file: "apps/admin/app/(dashboard)/translations/article-scan.integration.test.ts", sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...sourceGraph.values()], traces,
    actualDependencies: { next: nativeRequire("next/package.json").version, typescript: nativeRequire("typescript/package.json").version, cheerio: nativeRequire("cheerio/package.json").version, react: nativeRequire("react/package.json").version, reactDom: nativeRequire("react-dom/package.json").version },
    limitations: ["Actual batch/helper/hash/ownership/ordinary coordinator and DTO adapters/resume action/SSR page/submit component and native Next execute", "SDK is an in-memory emulator that actually applies filter, sort, range and limit before returning rows", "Atomic BEGIN, call journal, STAGE, FINISH and cheap checkpoints are guarded local state effects; Auth, runtime gate, expensive translator, publication and revalidation are mocks", "The controlled translator invokes actual coordinator dispatch/ACK hooks before and after its simulated provider entry; no actual provider transport is exercised", "The submit component uses a controlled useFormStatus pending=false hook under standalone React DOM; no client pending/hydration claim", "No paid/model/real HTTP requests, no real GoTrue/PostgREST/DB/RLS or production verification", "Continuation is not failed-item retry or a durable lease/concurrent worker proof"] }, null, 2) + "\n", { flag: "wx" });
});
