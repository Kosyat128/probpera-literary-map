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
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sourceRevision = "2026-10-08T10:00:00.000Z";
const olderRevision = "2026-10-07T10:00:00.000Z";
const authored = { ru: "Ручной RU \u2014 ё, права и источник", en: "Authored EN \u2014 rights and source" };

// Captured and current runs execute the same assertions. SDK/Auth/job/build
// transports, durable state and the expensive translator are controlled.
// Hashing, ownership, helper, action, typed RPC validation and native Next are actual.
function actualModules(mocks: Record<string, unknown>) {
  const modules = new Map<string, Record<string, any>>();
  function load(file: string): Record<string, any> {
    const filename = path.join(repoRoot, file);
    if (modules.has(filename)) return modules.get(filename)!;
    const before = process.env.M07_ARTICLE_BATCH_BASELINE_ROOT;
    const captured = before ? path.join(before, file) : filename;
    const source = before && existsSync(captured) ? captured : filename;
    const bytes = readFileSync(source);
    sourceGraph.set(`${file}:${source}`, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
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
  onStage?: (row: Row, index: number) => void;
  onTranslate?: (input: Row, options: Row | undefined) => void | Promise<void>;
};
function setup(options: Options = {}) {
  const kinds = options.kinds ?? ["missing"];
  const articles = (options.articles ?? kinds.map((_, index) => article(index))).map(row => structuredClone(row));
  const english = new Map<string, Row>();
  const drafts = new Map<string, Row>();
  const jobs = new Map<string, Row>();
  const operations = new Map<string, Row>();
  const events: unknown[] = [];
  const writes: { table: string; operation: string; payload: unknown; filters: unknown[] }[] = [];
  const sdkError = { code: "LOCAL_SDK_FAILURE", message: "database read failed" };
  const audit = vi.fn(async (_payload: unknown) => ({ data: null, error: null }));
  const translator = vi.fn(async (input: Row, translateOptions?: Row) => {
    const row = articles.find(entry => entry.title === input.title)!;
    events.push({ kind: "expensive-translation-start", articleId: row?.id, input: structuredClone(input) });
    if (options.signalAt === "model") navigation.redirect("/local-native-signal");
    if (options.onTranslate) await options.onTranslate(input, translateOptions);
    else {
      // This controlled translator acknowledges the two responses it returns.
      // The actual coordinator persists each dispatch before this local response.
      for (const pass of ["translation", "review"]) {
        translateOptions?.operationBudget?.beforeProviderCall();
        const call = { provider: "cloudflare", model: pass === "review" ? "mock-reviewer" : "mock-translator", pass };
        const callId = await translateOptions?.providerJournal?.beforeDispatch(call);
        if (callId) await translateOptions?.providerJournal?.responseReceived({ ...call, callId, httpStatus: options.modelError ? 502 : 200,
          requestId: pass === "review" ? "local-review-request" : "local-translation-request", responseId: `local-${pass}-response`, inputTokens: pass === "review" ? 20 : 30, outputTokens: 20 });
        if (options.modelError) throw new Error(options.modelError);
      }
    }
    options.onModel?.(row, translator.mock.calls.length);
    return translatedValue();
  });
  const modelCount = (id: string) => translator.mock.calls.filter(call => call[0].title === articles.find(row => row.id === id)?.title).length;
  const ok = (data: unknown) => ({ data: structuredClone(data), error: null });
  const refused = (code: string) => ({ data: null, error: { code, message: "Controlled database refusal" } });
  const receipt = (operation: Row, canExecute = false): Row => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId,
    articleId: operation.articleId, provider: "cloudflare", sourceHash: operation.sourceHash, sourceUpdatedAt: operation.sourceUpdatedAt,
    englishUpdatedAt: operation.englishUpdatedAt, jobVersion: String(jobs.get(operation.jobId)!.version), attemptCount: operation.result ? 1 : 0,
    maxAttempts: 3, jobStatus: jobs.get(operation.jobId)!.status, itemStatus: operation.result?.outcome ?? "reviewing", operationId: operation.id,
    phase: operation.result ? "finished" : "running", canExecute, replayed: false, retryable: false, blockReason: null, result: operation.result });
  const run = (job: Row): Row => {
    const selected = [...operations.values()].filter(operation => operation.jobId === job.id);
    return { version: 1, jobId: job.id, provider: "cloudflare", actorId, jobVersion: String(job.version), status: job.status,
      totalItems: selected.length + job.observed.length, succeededItems: selected.filter(operation => operation.result?.outcome === "succeeded").length,
      failedItems: selected.filter(operation => ["dead_letter", "conflict", "stale", "not-configured"].includes(operation.result?.outcome)).length,
      activeItems: selected.filter(operation => !operation.result).length, pendingItems: 0, resumeCursor: job.cursor, replayed: false };
  };
  const progress = (operation: Row, canDispatch = false): Row => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId,
    articleId: operation.articleId, operationId: operation.id, provider: "cloudflare", phase: operation.result ? "finished" : "running",
    startedAt: operation.calls.length ? sourceRevision : null, updatedAt: sourceRevision, providerCalls: operation.calls.length,
    canDispatch, replayed: false, calls: operation.calls });
  const candidate = (operation: Row): Row => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId: operation.articleId,
    operationId: operation.id, provider: "cloudflare", sourceHash: operation.sourceHash, sourceUpdatedAt: operation.sourceUpdatedAt,
    englishUpdatedAt: operation.englishUpdatedAt, phase: operation.result ? "finished" : "running",
    candidateState: operation.envelope ? operation.result ? "finished" : "staged" : "missing", candidateHash: operation.envelope ? hash(JSON.stringify(operation.envelope)) : null,
    preparedAt: operation.envelope ? sourceRevision : null, workingDraftVersion: operation.envelope ? 1 : null,
    workingDraftUpdatedAt: operation.envelope ? sourceRevision : null, providerCalls: operation.calls.length,
    canRecover: !!operation.envelope && !operation.result, replayed: false, blockReason: operation.envelope ? null : "candidate_missing" });
  const rpc = vi.fn(async (name: string, args: Row) => {
    if (name === "article_translation_sync_ready") return ok(true);
    if (name === "begin_article_translation_sync_item") {
      expect(Object.keys(args).sort()).toEqual(["p_job_id", "p_item_id", "p_operation_id", "p_article_id", "p_expected_job_version", "p_expected_source_hash",
        "p_expected_article_updated_at", "p_expected_english_updated_at", "p_provider", "p_expected_cursor", "p_resume_cursor", "p_expected_source_snapshot"].sort());
      const existingJob = jobs.get(args.p_job_id);
      expect(args.p_expected_job_version).toBe(String(existingJob?.version ?? 0));
      expect(args.p_expected_cursor).toEqual(existingJob?.cursor ?? {});
      const source = articles.find(row => row.id === args.p_article_id)!;
      expect(args.p_expected_source_hash).toBe(rowHash(source));
      expect(args.p_expected_source_snapshot).toEqual(modules.load("apps/admin/lib/article-private-retry-draft.ts").articlePrivateRetrySourceSnapshot({
        article: source, sourceUpdatedAt: args.p_expected_article_updated_at, expectedEnglishUpdatedAt: args.p_expected_english_updated_at }));
      const job = existingJob ?? { id: args.p_job_id, version: 0, status: "reviewing", cursor: {}, observed: [] };
      jobs.set(job.id, job); job.version++; job.status = "reviewing"; job.cursor = structuredClone(args.p_resume_cursor);
      const operation = { id: args.p_operation_id, jobId: job.id, itemId: args.p_item_id, articleId: args.p_article_id,
        sourceHash: args.p_expected_source_hash, sourceUpdatedAt: args.p_expected_article_updated_at, englishUpdatedAt: args.p_expected_english_updated_at,
        snapshot: structuredClone(args.p_expected_source_snapshot), calls: [], result: null, envelope: null, outcome: null };
      operations.set(operation.id, operation); events.push({ kind: "durable-admission", name, args: structuredClone(args) });
      return ok(receipt(operation, true));
    }
    if (name === "checkpoint_article_translation_sync_run") {
      expect(Object.keys(args).sort()).toEqual(["p_job_id", "p_expected_job_version", "p_expected_cursor", "p_resume_cursor", "p_observed_items", "p_provider"].sort());
      expect(args.p_observed_items.every((item: Row) => ["current", "manual", "skipped"].includes(item.state))).toBe(true);
      const job = jobs.get(args.p_job_id) ?? { id: args.p_job_id, version: 0, status: "completed", cursor: {}, observed: [] };
      expect(args.p_expected_job_version).toBe(String(job.version)); expect(args.p_expected_cursor).toEqual(job.cursor);
      jobs.set(job.id, job); job.version++; job.cursor = structuredClone(args.p_resume_cursor); job.observed.push(...structuredClone(args.p_observed_items));
      events.push({ kind: "checkpoint", name, args: structuredClone(args) });
      if (options.errorAt === "record") return { data: null, error: sdkError };
      return ok(Object.hasOwn(options, "recordData") ? options.recordData : run(job));
    }
    const operation = operations.get(args.p_operation_id);
    if (operation) {
      if (name === "get_article_translation_item_retry") return ok(receipt(operation));
      if (name === "get_article_translation_item_retry_candidate") return ok(candidate(operation));
      if (name === "get_article_translation_item_retry_progress") return ok(progress(operation));
      if (name === "record_article_translation_item_retry_dispatch") {
        expect(operation.calls.at(-1)?.responseReceivedAt).not.toBeNull();
        operation.calls.push({ callId: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass,
          dispatchRecordedAt: sourceRevision, responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null });
        events.push({ kind: "dispatch-ack", operationId: operation.id, callId: args.p_call_id }); return ok(progress(operation, true));
      }
      if (name === "record_article_translation_item_retry_response") {
        const call = operation.calls.find((value: Row) => value.callId === args.p_metadata.callId); expect(call).toBeDefined();
        Object.assign(call, args.p_metadata, { responseReceivedAt: sourceRevision });
        events.push({ kind: "response-ack", operationId: operation.id, callId: call.callId }); return ok(progress(operation));
      }
      if (name === "stage_article_translation_item_retry_candidate") {
        events.push({ kind: "private-draft-rpc", name, args: structuredClone(args) });
        expect(operation.calls.every((call: Row) => call.responseReceivedAt !== null)).toBe(true);
        expect(args.p_outcome.providerCalls).toBe(operation.calls.length);
        const row = articles.find(value => value.id === operation.articleId)!;
        if (options.errorAt === "save") return { data: null, error: { ...sdkError, message: "database write failed" } };
        if (row.updated_at !== operation.sourceUpdatedAt) return refused("40001");
        const draft = { article_id: row.id, version: 1, updated_at: sourceRevision, base_article_updated_at: operation.sourceUpdatedAt,
          expected_english_updated_at: operation.englishUpdatedAt, payload: structuredClone(operation.snapshot),
          english_payload: structuredClone(args.p_english_payload), draft_scope: "english-only", draft_english_enabled: true, actor_id: actorId };
        drafts.set(row.id, draft); writes.push({ table: "article_working_drafts", operation: "insert", payload: structuredClone(draft), filters: [] });
        operation.envelope = structuredClone(args.p_english_payload); operation.outcome = structuredClone(args.p_outcome);
        const staged = candidate(operation);
        if (options.conflict) row.updated_at = "2026-10-08T11:00:00.000Z";
        options.onStage?.(row, drafts.size);
        return ok(Object.hasOwn(options, "saveData") ? options.saveData : staged);
      }
      if (name === "finish_article_translation_item_retry") {
        events.push({ kind: "finish", name, args: structuredClone(args) });
        expect(args.p_outcome.providerCalls).toBe(operation.calls.length);
        expect(operation.calls.every((call: Row) => call.responseReceivedAt !== null)).toBe(true);
        const row = articles.find(value => value.id === operation.articleId)!;
        const changed = row.updated_at !== operation.sourceUpdatedAt;
        if (operation.envelope) { expect(args.p_english_payload).toEqual(operation.envelope); expect(args.p_outcome).toEqual(operation.outcome); }
        const status = changed && operation.envelope ? "stale" : args.p_outcome.status;
        const succeeded = status === "succeeded";
        if (succeeded) expect(drafts.get(row.id)?.english_payload).toEqual(args.p_english_payload);
        operation.result = { outcome: status, errorCode: changed && operation.envelope ? "source_changed" : args.p_outcome.errorCode ?? null,
          persistence: succeeded ? "working-draft" : "none", workingDraftVersion: succeeded ? 1 : null,
          workingDraftUpdatedAt: succeeded ? sourceRevision : null, publication: "unchanged", humanReview: succeeded ? "pending" : "unchanged", providerCalls: operation.calls.length };
        const job = jobs.get(operation.jobId)!; job.version++; job.status = [...operations.values()].some(value => value.jobId === job.id && !value.result)
          ? "reviewing" : [...operations.values()].some(value => value.jobId === job.id && value.result?.outcome !== "succeeded") ? "partial" : "completed";
        return ok(receipt(operation));
      }
    }
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
    if (name !== "record_translation_sync_run") throw new Error(`Unexpected mock RPC ${name}`);
    return options.errorAt === "record" ? { data: null, error: sdkError }
      : { data: Object.hasOwn(options, "recordData") ? options.recordData : "cccccccc-cccc-4ccc-8ccc-cccccccccccc", error: null };
  });
  const from = vi.fn((table: string) => {
    if (table === "admin_audit_log") return { insert: audit };
    if (!["articles", "article_translations", "article_working_drafts"].includes(table)) throw new Error(`Unexpected mock table ${table}`);
    const filters: { column: string; value: unknown; operation: string }[] = [];
    let columns = "", head = false, countRequested = false, range: number[] | undefined, limit: number | undefined;
    let operation = "read", payload: Row | undefined;
    const orders: { column: string; ascending: boolean }[] = [];
    const matches = (row: Row) => filters.every(filter => filter.operation === "in"
      ? (filter.value as unknown[]).includes(row[filter.column])
      : filter.operation === "gt" ? row[filter.column] > (filter.value as any)
      : filter.operation === "lte" ? row[filter.column] <= (filter.value as any)
      : filter.operation === "or" ? true
      : row[filter.column] === filter.value);
    const response = (single = false) => {
      const id = filters.find(filter => filter.column === (table === "articles" ? "id" : "article_id"))?.value as string | undefined;
      const errorAt = table === "articles"
        ? head || countRequested ? "count" : single ? "article" : "page"
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
      if (options.errorAt === errorAt) return { data: null, error: sdkError, count: null };
      let values = (table === "articles" ? articles : table === "article_working_drafts" ? [...drafts.values()] : [...english.values()]).filter(matches);
      const exactCount = values.length;
      if (single && table === "articles" && columns === "updated_at" && options.conflict && id && modelCount(id)) {
        values = [{ ...values[0], updated_at: "2026-10-08T11:00:00.000Z" }];
      }
      values = [...values].sort((left, right) => {
        for (const order of orders) {
          const difference = left[order.column] < right[order.column] ? -1 : left[order.column] > right[order.column] ? 1 : 0;
          if (difference) return order.ascending ? difference : -difference;
        }
        return 0;
      });
      if (range) values = values.slice(range[0], range[1] + 1);
      if (limit !== undefined) values = values.slice(0, limit);
      events.push({ kind: "sdk-read", table, columns, head, filters: structuredClone(filters), range, rows: values.length });
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
    "apps/admin/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: gate },
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
  const trace = (scope: string, result: unknown) => traces.push({ scope, result, options: { ...options, onModel: !!options.onModel, onStage: !!options.onStage }, translatorCalls: translator.mock.calls, writes, audit: audit.mock.calls, job: rpc.mock.calls,
    durableJobs: structuredClone([...jobs.values()]), durableOperations: structuredClone([...operations.values()]),
    build: build.mock.calls.map(call => ({ ...call[0] as Row, supabase: "mock-sdk" })), events });
  async function runBatch(cursor = 0) {
    const form = new FormData(); form.set("articleCursor", String(cursor));
    try { await action(form); throw new Error("Expected actual Next redirect"); }
    catch (error) {
      if (!isRedirectError(error)) throw error;
      const destination = redirectErrors.getURLFromRedirectError(error);
      const result = { destination, params: new URL(destination, "https://local.invalid").searchParams };
      trace("actual-batch", { destination }); return result;
    }
  }
  async function runHelper(index = 0) {
    try { const result = await helper({ supabase: client, actorId, articleId: articles[index].id, runtimeApproved: true }); trace("actual-helper", result); return result; }
    catch (error) { trace("actual-helper-thrown", error instanceof Error ? { message: error.message, digest: (error as Row).digest } : error); throw error; }
  }
  return { runBatch, runHelper, articles, english, drafts, jobs, operations, originalArticles, originalEnglish, translator, audit, rpc, build, revalidate, gate, writes, events, requireStaff, rowHash };
}
function outcome(view: ReturnType<typeof setup>) {
  const checkpoint = view.rpc.mock.calls.find(call => call[0] === "checkpoint_article_translation_sync_run")?.[1] as Row | undefined;
  expect(view.rpc.mock.calls.some(call => call[0] === "record_translation_sync_run")).toBe(false);
  const rows = view.articles.flatMap<{ item: Row; result: Row }>(article => {
    const operation = [...view.operations.values()].find(value => value.articleId === article.id);
    const observed = [...view.jobs.values()].flatMap<Row>(job => job.observed).find(item => item.entityId === article.id);
    if (operation) return [{ item: { entityType: "article", entityId: article.id, sourceHash: operation.sourceHash },
      result: operation.result ? { status: operation.result.outcome, ...(operation.result.errorCode ? { errorCode: operation.result.errorCode } : {}),
        ...(operation.result.outcome === "succeeded" ? { model: operation.outcome.model } : {}) } : { status: "reviewing" } }];
    return observed ? [{ item: { entityType: "article", entityId: article.id, ...(observed.sourceHash ? { sourceHash: observed.sourceHash } : {}) }, result: { status: "skipped" } }] : [];
  });
  return { items: rows.map(row => row.item), results: rows.map(row => row.result), resumeCursor: checkpoint?.p_resume_cursor ?? [...view.jobs.values()].at(-1)?.cursor };
}
function noAutomaticChanges(view: ReturnType<typeof setup>) { expect(view.translator).not.toHaveBeenCalled(); expect(view.writes).toEqual([]); expect(view.build).not.toHaveBeenCalled(); }

describe("M07 actual bounded article batch freshness and ownership", () => {
  it("reaches actual helper and translates stale published machine EN", async () => {
    const view = setup({ kinds: ["machine-stale"] }); const result = await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toHaveLength(1);
    expect(view.writes[0]).toMatchObject({ table: "article_working_drafts", operation: "insert", payload: { article_id: view.articles[0].id, base_article_updated_at: sourceRevision, expected_english_updated_at: view.originalEnglish[0].updated_at, english_payload: { payload: { status: "draft", source_content_hash: view.rowHash(view.articles[0]), reviewed_at: null, approved_at: null, published_at: null } } } });
    expect(outcome(view).results).toEqual([{ status: "succeeded", model: "mock-translator" }]);
    expect(result.params.get("success")).toContain("EN сохранено в рабочие черновики 1"); expect(view.build).not.toHaveBeenCalled();
    expect([...view.english.values()]).toEqual(view.originalEnglish); expect(result.params.has("publication")).toBe(false);
    expect(view.articles).toEqual(view.originalArticles);
  });
  it("confirms matching hash and source revision without a model call", async () => {
    const view = setup({ kinds: ["machine-current"] }); const result = await view.runBatch();
    noAutomaticChanges(view); expect(outcome(view).results).toEqual([{ status: "skipped" }]);
    expect(result.params.get("success")).toContain("актуальных 1");
    expect(view.english.get(view.articles[0].id)).toEqual(view.originalEnglish[0]);
  });
  it.each(["machine-wrong-revision", "machine-missing-revision"] as Kind[])("keeps %s freshness unknown without a model call", async kind => {
    const view = setup({ kinds: [kind] }); const result = await view.runBatch();
    noAutomaticChanges(view); expect(result.params.get("success")).toContain("актуальных 0");
    expect(outcome(view).results).toEqual([{ status: "skipped" }]);
  });
  it.each(["manual-current", "manual-stale"] as Kind[])("preserves published %s as a separate manual result", async kind => {
    const view = setup({ kinds: [kind] }); const result = await view.runBatch();
    noAutomaticChanges(view); expect(result.params.get("success")).toContain("ручных 1");
    expect(result.params.get("success")).toContain("актуальных 0");
    expect(view.english.get(view.articles[0].id)).toEqual(view.originalEnglish[0]);
  });
  it("keeps mixed current/stale machine/manual/missing axes truthful", async () => {
    const view = setup({ kinds: ["machine-current", "manual-current", "manual-stale", "machine-stale", "missing"] });
    const result = await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(2); expect(view.writes).toHaveLength(2);
    expect(result.params.get("success")).toContain("EN сохранено в рабочие черновики 2, актуальных 1, ручных 2");
    expect(outcome(view).items.map((row: Row) => row.entityId)).toEqual(view.articles.map(row => row.id));
    expect(outcome(view).results).toEqual([{ status: "skipped" }, { status: "skipped" }, { status: "skipped" }, { status: "succeeded", model: "mock-translator" }, { status: "succeeded", model: "mock-translator" }]);
    expect(view.english.get(view.articles[1].id)).toEqual(view.originalEnglish[1]); expect(view.english.get(view.articles[2].id)).toEqual(view.originalEnglish[2]);
    expect(view.build).not.toHaveBeenCalled(); expect([...view.english.values()]).toEqual(view.originalEnglish);
  });
  it("translates absent EN with full source values and records real outcome before release", async () => {
    const view = setup(); await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.translator.mock.calls[0][0]).toMatchObject({ title: view.articles[0].title, contentHtml: view.articles[0].content_html, sources: ["https://source.invalid/original"], bibliography: ["Original bibliography"] });
    expect(view.writes[0]).toMatchObject({ table: "article_working_drafts", operation: "insert", payload: { actor_id: actorId, base_article_updated_at: sourceRevision, expected_english_updated_at: null, english_payload: { payload: { source_content_hash: view.rowHash(view.articles[0]) } } } });
    expect(view.english.has(view.articles[0].id)).toBe(false);
    expect(outcome(view).items).toEqual([{ entityType: "article", entityId: view.articles[0].id, sourceHash: view.rowHash(view.articles[0]) }]);
    const events = view.events as Row[];
    const admission = events.findIndex(row => row.kind === "durable-admission");
    const dispatch = events.findIndex(row => row.kind === "dispatch-ack");
    const stage = events.findIndex(row => row.kind === "private-draft-rpc" && row.name === "stage_article_translation_item_retry_candidate");
    const finish = events.findIndex(row => row.kind === "finish");
    expect(admission).toBeGreaterThanOrEqual(0); expect(admission).toBeLessThan(dispatch); expect(dispatch).toBeLessThan(stage); expect(stage).toBeLessThan(finish);
    expect(view.rpc.mock.calls.filter(call => call[0] === "record_article_translation_item_retry_response")).toHaveLength(2);
    expect(view.build).not.toHaveBeenCalled();
  });
  it("limits actually started translations after two post-stage RU revision conflicts while retaining both private candidates", async () => {
    const view = setup({ kinds: Array(500).fill("machine-stale-draft"), conflict: true }); const result = await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(2); expect(view.writes).toHaveLength(2); expect(view.build).not.toHaveBeenCalled();
    expect(outcome(view).items).toHaveLength(2); expect(outcome(view).results).toEqual([{ status: "stale", errorCode: "source_changed" }, { status: "stale", errorCode: "source_changed" }]);
    expect(view.drafts.size).toBe(2); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect([...view.operations.values()].every(operation => operation.result.persistence === "none" && operation.result.humanReview === "unchanged")).toBe(true);
    expect(outcome(view).resumeCursor).toMatchObject({ articleScan: { nextIndex: 2, pendingIds: view.articles.map(row => row.id) } });
    expect(result.params.get("articleJob")).toBe([...view.jobs.keys()][0]); expect(result.params.has("articleCursor")).toBe(false);
    expect(result.params.get("success")).toContain("EN сохранено в рабочие черновики 0");
    expect(result.params.get("success")).toContain("ошибок 2");
    expect(result.params.get("success")).toContain("попыток 2, запросов провайдера 4");
  });
  it("counts a post-stage source conflict and success as two expensive attempts and stops before a third", async () => {
    const view = setup({ kinds: ["missing", "missing", "missing"], onStage: (row, index) => { if (index === 1) row.updated_at = "2026-10-08T11:00:00.000Z"; } });
    const result = await view.runBatch(); expect(view.translator).toHaveBeenCalledTimes(2); expect(outcome(view).items).toHaveLength(2);
    expect(outcome(view).results).toEqual([{ status: "stale", errorCode: "source_changed" }, { status: "succeeded", model: "mock-translator" }]);
    expect(view.drafts.size).toBe(2); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect(result.params.get("success")).toContain("EN сохранено в рабочие черновики 1");
    expect(result.params.get("success")).toContain("попыток 2, запросов провайдера 4");
    expect(view.rpc.mock.calls.filter(call => call[0] === "begin_article_translation_sync_item")).toHaveLength(2);
  });
  it("counts a confirmed pre-stage conflict and success as two expensive attempts and stops before a third", async () => {
    const view = setup({ kinds: ["missing", "missing", "missing"], onModel: (row, index) => { if (index === 1) row.updated_at = "2026-10-08T11:00:00.000Z"; } });
    const result = await view.runBatch(); expect(view.translator).toHaveBeenCalledTimes(2); expect(outcome(view).items).toHaveLength(2);
    expect(outcome(view).results).toEqual([{ status: "conflict", errorCode: "write_conflict" }, { status: "succeeded", model: "mock-translator" }]);
    expect(view.writes).toHaveLength(1); expect(view.drafts.size).toBe(1); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect(view.rpc.mock.calls.filter(call => call[0] === "finish_article_translation_item_retry")).toHaveLength(2);
    expect(result.params.get("success")).toContain("EN сохранено в рабочие черновики 1");
    expect(result.params.get("success")).toContain("ошибок 1");
    expect(result.params.get("success")).toContain("попыток 2, запросов провайдера 4");
  });
  it("uses the existing scan bound while no translation is required", async () => {
    const view = setup({ kinds: Array(600).fill("machine-current") }); const result = await view.runBatch();
    noAutomaticChanges(view); expect(outcome(view).items).toHaveLength(500);
    expect(outcome(view).resumeCursor).toMatchObject({ articleScan: { afterId: view.articles[499].id, pendingIds: [], nextIndex: 0, lastWindow: false, exhausted: false } });
    expect(result.params.get("articleJob")).toBe([...view.jobs.keys()][0]);
    expect(result.params.get("success")).toContain("актуальных 500");
  });
  it("refuses a legacy nonzero cursor while preserving previous manual/current candidates", async () => {
    const view = setup({ kinds: ["manual-current", "machine-current", "missing", "missing", "missing"] }); const result = await view.runBatch(2);
    noAutomaticChanges(view); expect(view.rpc).not.toHaveBeenCalled();
    expect(result.params.get("errorCode")).toBe("translation_resume_stale"); expect(view.english.get(view.articles[0].id)).toEqual(view.originalEnglish[0]);
  });
  it("keeps retained deleted versions out of current/manual progress without restoring them", async () => {
    const view = setup({ kinds: ["machine-deleted-current", "machine-deleted-stale", "manual-deleted", "machine-current"] }); const result = await view.runBatch();
    noAutomaticChanges(view); expect(result.params.get("success")).toContain("актуальных 1, ручных 0");
    expect(result.params.get("success")).toContain("пропущено 3"); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect(outcome(view).results).toEqual([{ status: "skipped" }, { status: "skipped" }, { status: "skipped" }, { status: "skipped" }]);
  });
});

describe("M07 actual helper classifies before the expensive translator", () => {
  it.each(["manual-current", "manual-stale"] as Kind[])("returns manual for %s even when publication/hash is present", async kind => {
    const view = setup({ kinds: [kind] }); const result = await view.runHelper(); expect(result.state).toBe("manual");
    noAutomaticChanges(view); expect(view.english.get(view.articles[0].id)).toEqual(view.originalEnglish[0]);
  });
  it("returns current for published machine with both source hash and source revision", async () => {
    const view = setup({ kinds: ["machine-current"] }); expect((await view.runHelper()).state).toBe("current"); noAutomaticChanges(view);
  });
  it.each(["machine-wrong-revision", "machine-missing-revision"] as Kind[])("handles %s without a blind regeneration", async kind => {
    const view = setup({ kinds: [kind] }); const result = await view.runHelper(); expect(result).toMatchObject({ state: "skipped", ownership: "machine", freshness: "unknown" }); noAutomaticChanges(view);
  });
  it("keeps fresh machine draft publication separate and avoids regeneration", async () => {
    const view = setup({ kinds: ["machine-draft"] }); const result = await view.runHelper(); expect(result).toMatchObject({ state: "skipped", ownership: "machine", freshness: "current", publication: "draft" }); noAutomaticChanges(view);
  });
  it("does not take ownership of a broken marker with an empty source hash", async () => {
    const view = setup({ kinds: ["machine-empty-hash"] }); const result = await view.runHelper(); expect(result).toMatchObject({ state: "manual", ownership: "manual", freshness: "unknown" }); noAutomaticChanges(view);
  });
  it("exposes manual freshness independently of ownership", async () => {
    const current = setup({ kinds: ["manual-current"] }), stale = setup({ kinds: ["manual-stale"] });
    expect(await current.runHelper()).toMatchObject({ state: "manual", ownership: "manual", freshness: "current", publication: "published" });
    expect(await stale.runHelper()).toMatchObject({ state: "manual", ownership: "manual", freshness: "stale", publication: "published" }); noAutomaticChanges(current); noAutomaticChanges(stale);
  });
  it.each([
    { kind: "missing", revision: "", name: "missing EN and empty RU revision" },
    { kind: "missing", revision: "2026-99-99T25:99:99Z", name: "missing EN and malformed RU revision" },
    { kind: "machine-current", revision: "", name: "machine EN and empty RU revision" },
    { kind: "machine-current", revision: "2026-99-99T25:99:99Z", name: "machine EN and malformed RU revision" },
  ])("keeps $name unknown without translation", async ({ kind, revision }) => {
    const row = article(0); row.updated_at = revision;
    const view = setup({ kinds: [kind as Kind], articles: [row] });
    expect(await view.runHelper()).toMatchObject({ state: "skipped", freshness: "unknown" }); noAutomaticChanges(view);
  });
  it("accepts identical PostgreSQL microsecond and offset source revisions as current", async () => {
    const row = article(0); row.updated_at = "2026-10-08T10:00:00.123456+03:00";
    const view = setup({ kinds: ["machine-current"], articles: [row] });
    expect(await view.runHelper()).toMatchObject({ state: "current", ownership: "machine", freshness: "current", publication: "published" }); noAutomaticChanges(view);
  });
  it.each(["missing", "machine-stale"] as Kind[])("returns the persisted post-write machine/current/publication axes after %s", async kind => {
    const view = setup({ kinds: [kind] });
    expect(await view.runHelper()).toMatchObject({ state: "translated", ownership: "machine", freshness: "current", publication: "draft", translationPersistence: "working-draft", humanReview: "pending", workingDraftVersion: 1, workingDraftUpdatedAt: sourceRevision, sourceHash: view.rowHash(view.articles[0]) });
    expect(view.writes).toHaveLength(1); expect(view.drafts.get(view.articles[0].id)?.english_payload.payload).toMatchObject({ status: "draft", source_content_hash: view.rowHash(view.articles[0]), reviewed_at: null, approved_at: null, published_at: null });
    expect(view.drafts.get(view.articles[0].id)).toMatchObject({ base_article_updated_at: sourceRevision, expected_english_updated_at: kind === "missing" ? null : view.originalEnglish[0].updated_at });
    expect([...view.english.values()]).toEqual(view.originalEnglish);
  });
  it.each(["machine-deleted-current", "machine-deleted-stale", "manual-deleted"] as Kind[])("preserves retained %s and its locale slot without paying or undeleting", async kind => {
    const view = setup({ kinds: [kind] }); expect(await view.runHelper()).toMatchObject({ state: "skipped", publication: null });
    noAutomaticChanges(view); expect(view.english.get(view.articles[0].id)).toEqual(view.originalEnglish[0]); expect(view.audit).not.toHaveBeenCalled();
  });
  it("does not acknowledge a foreign selected ID as success for an existing EN update", async () => {
    const view = setup({ kinds: ["machine-stale"], saveData: { id: "ffffffff-ffff-4fff-8fff-ffffffffffff" } });
    expect(await view.runHelper()).toMatchObject({ state: "failed", error: "Ordinary article translation result was not confirmed", ordinaryOperation: { receipt: { phase: "running", result: null } } });
    expect(view.audit.mock.calls.some(call => (call[0] as Row).action.endsWith("succeeded"))).toBe(false); expect(view.build).not.toHaveBeenCalled();
  });
  it("retains nil existing-update CAS as conflict without claiming post-write current", async () => {
    const view = setup({ kinds: ["machine-stale"], saveData: null });
    expect(await view.runHelper()).toMatchObject({ state: "failed", freshness: "stale" });
    expect(view.audit.mock.calls.some(call => (call[0] as Row).action.endsWith("succeeded"))).toBe(false);
  });
  it("preserves manual metadata, image and source fields when stale", async () => {
    const view = setup({ kinds: ["manual-stale"] }); await view.runHelper(); expect(view.english.get(view.articles[0].id)).toEqual(view.originalEnglish[0]); expect(view.audit).not.toHaveBeenCalled();
  });
  it("does not replace canonical source rows while translating machine EN", async () => {
    const view = setup({ kinds: ["machine-stale"] }); await view.runHelper(); expect(view.articles).toEqual(view.originalArticles);
    expect(view.writes.every(row => row.table === "article_working_drafts")).toBe(true); expect([...view.english.values()]).toEqual(view.originalEnglish);
  });
});

describe("M07 actual batch failure boundaries preserve truthful outcomes", () => {
  it.each(["count", "page"] as const)("does not translate or release after %s read failure", async errorAt => {
    const view = setup({ errorAt }); const result = await view.runBatch(); expect(result.params.get("errorCode")).toBe("database_read_failed"); noAutomaticChanges(view); expect(view.rpc).not.toHaveBeenCalled();
  });
  it.each(["article", "english"] as const)("does not report success or call translator after %s helper read failure", async errorAt => {
    const view = setup({ errorAt }); const result = await view.runBatch(); noAutomaticChanges(view); expect(result.params.get("success")).toContain("ошибок 1");
    expect(outcome(view).results).toEqual([]); expect(view.operations.size).toBe(0);
    expect(result.params.get("errorCode")).toBe("database_read_failed");
  });
  it("stops after provider rejection and does not manufacture a saved translation", async () => {
    const view = setup({ kinds: ["missing", "missing", "missing"], modelError: "provider request failed locally" }); const result = await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]); expect(view.build).not.toHaveBeenCalled();
    expect(result.params.get("errorCode")).toBe("provider_request_failed"); expect(outcome(view).results[0].status).toBe("dead_letter");
  });
  it("records SDK save failure without releasing a missing result", async () => {
    const view = setup({ errorAt: "save" }); const result = await view.runBatch(); expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.build).not.toHaveBeenCalled(); expect(view.writes).toEqual([]); expect(outcome(view).results[0].status).toBe("reviewing");
    expect(result.params.get("errorCode")).toBe("translation_retry_pending"); expect(result.params.get("success")).toBeNull();
  });
  it.each([
    { name: "invalid UUID row", value: { id: "not-a-translation-uuid" } },
    { name: "scalar UUID", value: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    { name: "row array", value: [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }] },
    { name: "null row identity", value: { id: null } }, { name: "nil insert receipt", value: null },
  ])("does not release or audit success from a successful SDK save with $name", async ({ value }) => {
    const view = setup({ saveData: value }); const result = await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toHaveLength(1); expect(view.build).not.toHaveBeenCalled();
    expect(view.audit.mock.calls.some(call => (call[0] as Row).action.endsWith("succeeded"))).toBe(false);
    expect(outcome(view).results[0].status).toBe("reviewing"); expect(result.params.get("success")).toBeNull();
    expect(result.params.get("errorCode")).toBe("translation_retry_pending");
    expect(view.drafts.size).toBe(1); expect([...view.english.values()]).toEqual(view.originalEnglish);
    expect(view.rpc.mock.calls.some(call => call[0] === "finish_article_translation_item_retry")).toBe(false);
  });
  it("does not claim a completed run or dispatch after durable record rejection", async () => {
    const view = setup({ errorAt: "record" }); const result = await view.runBatch(); expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.writes).toHaveLength(1); expect(view.build).not.toHaveBeenCalled(); expect(result.params.get("errorCode")).toBe("translation_retry_unconfirmed"); expect(result.params.get("success")).toBeNull();
    expect([...view.operations.values()][0].result.outcome).toBe("succeeded");
  });
  it.each([
    { name: "non UUID string", value: "not-a-run-uuid" }, { name: "empty string", value: "" },
    { name: "revision object", value: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } },
    { name: "revision array", value: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"] }, { name: "null", value: null },
  ])("refuses successful SDK record with $name before publication or success redirect", async ({ value }) => {
    const view = setup({ recordData: value }); const result = await view.runBatch(); expect(view.translator).toHaveBeenCalledTimes(1);
    expect(view.writes).toHaveLength(1); expect(view.build).not.toHaveBeenCalled(); expect(view.revalidate).not.toHaveBeenCalled();
    expect(result.params.get("errorCode")).toBe("translation_retry_unconfirmed"); expect(result.params.get("success")).toBeNull();
    expect([...view.operations.values()][0].result.outcome).toBe("succeeded");
  });
  it.each(["stopped", "deadline"] as const)("records %s after an accepted first pass without starting a review or next item", async stop => {
    let clock = 1_700_000_000_000, acceptedCalls = 0;
    const clockSpy = vi.spyOn(Date, "now").mockImplementation(() => clock);
    try {
      const view = setup({ kinds: ["missing", "missing"], onTranslate: async (_input, options) => {
        const budget = options?.operationBudget;
        if (!budget) throw new Error("Expected shared operation budget for an admitted translation");
        budget.beforeProviderCall();
        const call = { provider: "cloudflare", model: "mock-translator", pass: "translation" };
        const callId = await options?.providerJournal?.beforeDispatch(call); acceptedCalls += 1;
        await options?.providerJournal?.responseReceived({ ...call, callId, httpStatus: 200, requestId: "local-translation-request", responseId: "accepted-first-pass", inputTokens: 20, outputTokens: 20 });
        if (stop === "stopped") budget.stop(); else clock += 300_000;
        budget.beforeProviderCall(); acceptedCalls += 1;
      } });
      const result = await view.runBatch();
      expect(view.translator).toHaveBeenCalledTimes(1); expect(acceptedCalls).toBe(1);
      expect(view.writes).toEqual([]); expect(view.build).not.toHaveBeenCalled();
      expect(outcome(view).items).toHaveLength(1);
      expect(outcome(view).results).toEqual([{ status: "skipped" }]);
      expect([...view.operations.values()][0].result).toMatchObject({ outcome: "skipped", errorCode: null, providerCalls: 1, persistence: "none" });
      expect(result.params.get("errorCode")).toBeNull();
      expect(result.params.get("success")).toContain("EN сохранено в рабочие черновики 0");
      expect(result.params.get("success")).toContain("попыток 1, запросов провайдера 1");
      expect(outcome(view).resumeCursor).toMatchObject({ articleScan: { nextIndex: 1, pendingIds: view.articles.map(row => row.id) } });
      expect(result.params.get("articleJob")).toBe([...view.jobs.keys()][0]);
    } finally { clockSpy.mockRestore(); }
  });
  it("kill switch gate prevents candidates, translator and release", async () => {
    const view = setup({ gate: false }); const result = await view.runBatch(); expect(result.params.get("errorCode")).toBe("translation_not_configured"); noAutomaticChanges(view); expect(view.rpc).not.toHaveBeenCalled();
  });
  it("rechecks the kill switch before issuing a second expensive translation", async () => {
    const view = setup({ kinds: ["missing", "missing", "missing"], gateResponses: [true, true, true, true, false, false] }); await view.runBatch();
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.writes).toHaveLength(1);
    expect(view.gate.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(outcome(view).results.filter((row: Row) => row.status === "succeeded")).toHaveLength(1);
  });
  it("missing SDK prevents translator and release", async () => {
    const view = setup({ clientMissing: true }); const result = await view.runBatch(); expect(result.params.get("errorCode")).toBe("database_unavailable"); noAutomaticChanges(view);
  });
  it("missing staff session reaches actual login redirect without translator", async () => {
    const view = setup({ session: null }); expect((await view.runBatch()).destination).toBe("/login"); noAutomaticChanges(view);
  });
});

afterAll(() => {
  if (!process.env.M07_ARTICLE_BATCH_EVIDENCE) return;
  writeFileSync(process.env.M07_ARTICLE_BATCH_EVIDENCE, JSON.stringify({ fixture: { file: "apps/admin/app/(dashboard)/translations/article-batch.integration.test.ts", sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...sourceGraph.values()], traces,
    actualDependencies: { next: nativeRequire("next/package.json").version, typescript: nativeRequire("typescript/package.json").version, cheerio: nativeRequire("cheerio/package.json").version },
    limitations: ["Actual batch/helper/hash/ownership/typed RPC validation and native Next control flow", "Auth, SDK, durable state, runtime gate, expensive translator, publication and revalidation are local mocks", "No paid/model/real HTTP requests, no real GoTrue/PostgREST/DB/RLS or production verification", "Controlled journal responses do not establish real provider acceptance or native SQL admission/lease behavior"] }, null, 2) + "\n", { flag: "wx" });
});
