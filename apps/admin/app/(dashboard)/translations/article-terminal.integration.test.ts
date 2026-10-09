import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
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
    const before = process.env.M07_ARTICLE_TERMINAL_BASELINE_ROOT;
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
  terminalError?: Row;
  terminalReject?: boolean;
  terminalData?: unknown;
  terminalSignal?: "thrown" | "fulfilled";
  onTerminal?: (job: Row, rows: Row[]) => void;
  actualTerminalRpc?: boolean;
  fullResumeOverride?: (receipt: Row) => unknown;
  fullResumeReject?: boolean;
  fullResumeError?: Row;
  fullResumeSignal?: "thrown" | "fulfilled";
};
function setup(options: Options = {}) {
  const kinds = options.kinds ?? ["missing"];
  const articles = (options.articles ?? kinds.map((_, index) => article(index))).map(row => structuredClone(row));
  const english = new Map<string, Row>();
  const drafts = new Map<string, Row>();
  const events: unknown[] = [];
  const jobs = new Map<string, Row>();
  const checkpoints: Row[] = [];
  let domainLookup = false;
  const terminalAudits: Row[] = [];
  const sdkHttpCalls: Row[] = [];
  let articlePageReads = 0;
  let eligibilityReads = 0, selectionReads = 0;
  const writes: { table: string; operation: string; payload: unknown; filters: unknown[] }[] = [];
  const sdkError = { code: "LOCAL_SDK_FAILURE", message: "database read failed" };
  const audit = vi.fn(async (_payload: unknown) => ({ data: null, error: null }));
  const translator = vi.fn(async (input: Row, translateOptions?: Row) => {
    const row = articles.find(entry => entry.title === input.title)!;
    events.push({ kind: "expensive-translation-start", articleId: row?.id, input: structuredClone(input) });
    if (options.signalAt === "model") navigation.redirect("/local-native-signal");
    if (options.modelError) throw new Error(options.modelError);
    options.onModel?.(row, translator.mock.calls.length);
    options.onTranslate?.(input, translateOptions);
    return translatedValue();
  });
  const modelCount = (id: string) => translator.mock.calls.filter(call => call[0].title === articles.find(row => row.id === id)?.title).length;
  const terminalRpcName = "complete_article_translation_scan";
  function jobReceipt(job: Row) {
    return { id: job.id, kind: job.kind, status: job.status, resumeCursor: structuredClone(job.resumeCursor) };
  }
  async function executeTerminal(args: Row) {
    if (options.terminalSignal) {
      try { navigation.redirect("/local-terminal-native-signal"); }
      catch (signal) { if (options.terminalSignal === "thrown") throw signal; return { data: null, error: signal }; }
    }
    if (options.terminalReject) throw new Error("terminal transport rejected locally");
    if (options.terminalError) return { data: null, error: structuredClone(options.terminalError) };
    const job = [...jobs.values()].find(row => row.id.toLowerCase() === args.p_job_id.toLowerCase());
    if (!job) return { data: null, error: { code: "P0002", message: "job missing locally" } };
    options.onTerminal?.(job, articles);
    if (["cancelled", "cancelling"].includes(job.status)) return { data: null, error: { code: "42501", message: "terminal operation stopped" } };
    const expected = args.p_expected_cursor;
    const source = expected?.articleScan;
    if (!source || source.pendingIds?.length !== 0 || source.nextIndex !== 0 || !source.afterId || source.exhausted || source.lastWindow) {
      return { data: null, error: { code: "22023", message: "invalid terminal cursor locally" } };
    }
    const terminal = { ...structuredClone(expected), articleScan: { ...structuredClone(source), lastWindow: true, exhausted: true } };
    if (isDeepStrictEqual(job.resumeCursor, terminal)) return { data: jobReceipt(job), error: null };
    if (!isDeepStrictEqual(job.resumeCursor, expected)) return { data: null, error: { code: "40001", message: "cursor CAS conflict locally" } };
    if (articles.some(row => row.status === "published" && row.deleted_at === null && row.id.toLowerCase() > source.afterId.toLowerCase() && row.id.toLowerCase() <= source.upperId.toLowerCase())) {
      return { data: null, error: { code: "40001", message: "eligible candidate appeared locally" } };
    }
    job.resumeCursor = terminal;
    job.version = (job.version ?? 0) + 1;
    terminalAudits.push({ jobId: job.id, expected: structuredClone(expected), terminal: structuredClone(terminal) });
    return { data: Object.hasOwn(options, "terminalData") ? structuredClone(options.terminalData) : jobReceipt(job), error: null };
  }
  const sdk = options.actualTerminalRpc ? nativeRequire("@supabase/supabase-js").createClient("https://local-terminal.invalid", "local-fake-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input: unknown, init: Row = {}) => {
      const body = JSON.parse(String(init.body)); sdkHttpCalls.push({ url: String(input), method: init.method, body: structuredClone(body) });
      const response = await executeTerminal(body);
      return new Response(JSON.stringify(response.error || response.data), { status: response.error ? 500 : 200, headers: { "content-type": "application/json" } });
    } },
  }) : null;
  function ordinaryRun(job: Row) {
    const { articleOrdinary: _privateMarker, ...scanCursor } = job.resumeCursor;
    return { version: 1, jobId: job.id, provider: "cloudflare", actorId, jobVersion: String(job.version), status: job.status,
      totalItems: job.totalItems, succeededItems: job.succeededItems, failedItems: job.failedItems, activeItems: 0, pendingItems: 0,
      resumeCursor: structuredClone(scanCursor), replayed: false };
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
      const job = [...jobs.values()].find(row => row.id.toLowerCase() === args.p_job_id.toLowerCase());
      domainLookup = !job?.ordinary;
      return job?.ordinary ? { data: ordinaryRun(job), error: null }
        : { data: null, error: { code: "P0002", message: "No ordinary marker on this actual legacy job" } };
    }
    if (name === "checkpoint_article_translation_sync_run") {
      if (options.recordSignal) navigation.redirect("/local-native-signal");
      if (options.errorAt === "record") return { data: null, error: sdkError };
      let job = jobs.get(args.p_job_id);
      if (!job) {
        if (args.p_expected_job_version !== "0" || Object.keys(args.p_expected_cursor).length) throw new Error("Invalid first checkpoint CAS");
        job = { id: args.p_job_id, kind: "article", status: "completed", totalItems: 0, succeededItems: 0, failedItems: 0,
          resumeCursor: {}, createdAt: sourceRevision, updatedAt: sourceRevision, version: 0, ordinary: true };
        jobs.set(job.id, job);
      }
      expect(args.p_expected_job_version).toBe(String(job.version));
      const { articleOrdinary: oldMarker, ...oldScanCursor } = job.resumeCursor;
      expect(args.p_expected_cursor).toEqual(oldScanCursor);
      expect(args.p_observed_items.every((row: Row) => ["current", "manual", "skipped"].includes(row.state))).toBe(true);
      // The public sync-run view deliberately strips this persisted marker.
      // The terminal CAS still needs every byte of the actual saved cursor.
      const marker = oldMarker ?? { version: 1, actorId, provider: "cloudflare", initialCursorHash: hash(JSON.stringify(args.p_expected_cursor)), lastCheckpointHash: null };
      marker.lastCheckpointHash = hash(JSON.stringify(args));
      job.version++; job.totalItems += args.p_observed_items.length;
      job.resumeCursor = { ...structuredClone(args.p_resume_cursor), articleOrdinary: marker };
      checkpoints.push({ p_items: args.p_observed_items.map((row: Row) => ({ entityId: row.entityId, ...(row.sourceHash ? { sourceHash: row.sourceHash } : {}) })),
        p_outcomes: args.p_observed_items.map(() => ({ status: "skipped" })), p_resume_cursor: structuredClone(args.p_resume_cursor) });
      return { data: Object.hasOwn(options, "recordData") ? options.recordData : ordinaryRun(job), error: null };
    }
    if (name === "get_translation_job_resume") {
      if (options.resumeSignal) navigation.redirect("/local-native-signal");
      const job = [...jobs.values()].find(row => row.id.toLowerCase() === args.p_job_id.toLowerCase());
      if (job?.ordinary && !domainLookup) {
        if (options.fullResumeReject) throw new Error("Controlled full cursor transport failure");
        if (options.fullResumeError) return { data: null, error: options.fullResumeError };
        if (options.fullResumeSignal) {
          try { navigation.redirect("/local-full-cursor-native-signal"); }
          catch (signal) { if (options.fullResumeSignal === "thrown") throw signal; return { data: null, error: signal }; }
        }
      }
      const value = Object.hasOwn(options, "resumeData") ? structuredClone(options.resumeData) : job ? jobReceipt(job) : null;
      const data = domainLookup && value && typeof value === "object" && !Array.isArray(value)
        ? { id: (value as Row).id, kind: (value as Row).kind, status: (value as Row).status, resumeCursor: (value as Row).resumeCursor } : value;
      domainLookup = false;
      return options.resumeError ? { data: null, error: sdkError }
        : { data: job?.ordinary && options.fullResumeOverride ? options.fullResumeOverride(structuredClone(data as Row)) : data, error: null };
    }
    if (name === "translation_operations_ready" || name === "premium_machine_translation_ready") return { data: true, error: null };
    if (name === "get_translation_operations_status") return { data: { queued: 0, running: 0, completed: 0, attention: 0, deadLetterItems: 0, recent: options.recentJobs ?? [...jobs.values()] }, error: null };
    if (name === terminalRpcName) return sdk ? sdk.rpc(name, args) : executeTerminal(args);
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
  const trace = (scope: string, result: unknown) => traces.push(JSON.parse(JSON.stringify({ scope, result, options: { ...options, onModel: !!options.onModel }, translatorCalls: translator.mock.calls, writes, audit: audit.mock.calls, job: rpc.mock.calls, jobs: [...jobs.values()], build: build.mock.calls.map(call => ({ ...call[0] as Row, supabase: "mock-sdk" })), events })));
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
  return { runBatch, runHelper, resume, render, articles, english, originalArticles, originalEnglish, translator, audit, rpc, build, revalidate, gate, writes, events, requireStaff, rowHash, jobs, checkpoints, options, client, terminalAudits, sdkHttpCalls };
}
// These are projections of acknowledged ordinary checkpoints, not invented calls
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

const terminalRpc = "complete_article_translation_scan";
function terminalCalls(view: ReturnType<typeof setup>) { return view.rpc.mock.calls.filter(call => call[0] === terminalRpc); }
function seedTerminal(options: Options = {}, cursorFields: Row = {}) {
  const rows = [article(0), article(1), article(2)];
  const view = setup({ kinds: ["machine-current"], articles: rows, ...options });
  const cursor = { ...cursorFields, articleScan: { version: 1, order: "id", upperId: article(599).id, afterId: article(499).id, pendingIds: [], nextIndex: 0, lastWindow: false, exhausted: false } };
  view.jobs.set(jobUuid, { id: jobUuid, kind: "article", status: "completed", totalItems: 500, succeededItems: 0, failedItems: 0, resumeCursor: cursor, createdAt: sourceRevision, updatedAt: sourceRevision });
  return { view, expectedCursor: structuredClone(cursor) };
}
function completeReceipt(cursorFields: Row = {}) {
  const { view, expectedCursor } = seedTerminal({}, cursorFields);
  return { id: jobUuid, kind: "article", status: "completed", resumeCursor: { ...expectedCursor, articleScan: { ...expectedCursor.articleScan, lastWindow: true, exhausted: true } } };
}
function preservesAuthoredRows(view: ReturnType<typeof setup>, expectedArticles = view.originalArticles) {
  expect(view.articles).toEqual(expectedArticles); expect([...view.english.values()]).toEqual(view.originalEnglish);
  noAutomaticChanges(view); expect(view.audit).not.toHaveBeenCalled();
}
function seedOrdinaryTerminal(options: Options = {}, totalItems = 500) {
  const { view, expectedCursor } = seedTerminal(options);
  const job = view.jobs.get(jobUuid)!;
  job.ordinary = true; job.version = 3; job.totalItems = totalItems;
  job.resumeCursor = { ...expectedCursor, articleOrdinary: { version: 1, actorId, provider: "cloudflare",
    initialCursorHash: hash(JSON.stringify({})), lastCheckpointHash: hash("Original acknowledged checkpoint") } };
  return { view, expectedCursor: structuredClone(job.resumeCursor) };
}

describe("M07 ordinary empty-tail completion binds the full private marker to the saved run", () => {
  it.each([499, 500])("seals the original %i-item run without opening a zero-item replacement", async totalItems => {
    const { view, expectedCursor } = seedOrdinaryTerminal({}, totalItems);
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBeNull(); expect(result.params.get("articleJob")).toBe(jobUuid);
    expect(terminalCalls(view)).toEqual([[terminalRpc, { p_job_id: jobUuid, p_expected_cursor: expectedCursor }]]);
    expect(view.jobs.size).toBe(1); expect(records(view)).toEqual([]); expect(view.terminalAudits).toHaveLength(1);
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual({ ...expectedCursor, articleScan: { ...expectedCursor.articleScan, lastWindow: true, exhausted: true } });
    expect(view.jobs.get(jobUuid)).toMatchObject({ totalItems, succeededItems: 0, failedItems: 0 }); preservesAuthoredRows(view);
    const repeated = await view.runBatch({ articleJob: jobUuid });
    expect(repeated.params.get("errorCode")).toBe("translation_scan_complete");
    expect(terminalCalls(view)).toHaveLength(1); expect(view.terminalAudits).toHaveLength(1); preservesAuthoredRows(view);
  });
  const badFullReceipts: { name: string; alter: (value: Row) => unknown }[] = [
    { name: "null full receipt", alter: () => null },
    { name: "missing private marker", alter: value => { delete value.resumeCursor.articleOrdinary; return value; } },
    { name: "foreign actor", alter: value => { value.resumeCursor.articleOrdinary.actorId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"; return value; } },
    { name: "other provider", alter: value => { value.resumeCursor.articleOrdinary.provider = "openai"; return value; } },
    { name: "malformed checkpoint hash", alter: value => { value.resumeCursor.articleOrdinary.lastCheckpointHash = "bad"; return value; } },
    { name: "changed scan cursor", alter: value => { value.resumeCursor.articleScan.afterId = article(498).id; return value; } },
    { name: "extra public field", alter: value => ({ ...value, unexpected: 1 }) },
    { name: "changed status", alter: value => ({ ...value, status: "cancelled" }) },
  ];
  it.each(badFullReceipts)("refuses $name before atomic completion and retains the actual job", async ({ alter }) => {
    const { view, expectedCursor } = seedOrdinaryTerminal({ fullResumeOverride: alter });
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("translation_retry_unconfirmed");
    expect(result.params.get("success")).toBeNull(); expect(result.params.get("articleJob")).toBe(jobUuid);
    expect(terminalCalls(view)).toEqual([]); expect(records(view)).toEqual([]); expect(view.jobs.size).toBe(1);
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor); expect(view.terminalAudits).toEqual([]); preservesAuthoredRows(view);
  });
  it.each([{ fullResumeReject: true }, { fullResumeError: { code: "LOCAL_READ_UNKNOWN", message: "Controlled unknown read" } }])(
    "retains the same job after unknown full cursor transport %j", async options => {
      const { view, expectedCursor } = seedOrdinaryTerminal(options); const result = await view.runBatch({ articleJob: jobUuid });
      expect(result.params.get("errorCode")).toBe("translation_retry_unconfirmed"); expect(result.params.get("success")).toBeNull();
      expect(result.params.get("articleJob")).toBe(jobUuid); expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor);
      expect(terminalCalls(view)).toEqual([]); expect(view.jobs.size).toBe(1); expect(records(view)).toEqual([]); preservesAuthoredRows(view);
    }
  );
  it.each(["thrown", "fulfilled"] as const)("preserves a %s full cursor native Next signal", async fullResumeSignal => {
    const { view, expectedCursor } = seedOrdinaryTerminal({ fullResumeSignal }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.destination).toBe("/local-full-cursor-native-signal"); expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor);
    expect(terminalCalls(view)).toEqual([]); expect(view.terminalAudits).toEqual([]); preservesAuthoredRows(view);
  });
  it("rechecks a newly appearing publication inside the ordinary atomic seal", async () => {
    const later = article(550);
    const { view, expectedCursor } = seedOrdinaryTerminal({ onTerminal: (_job, rows) => rows.push(structuredClone(later)) });
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("write_conflict"); expect(result.params.get("success")).toBeNull(); expect(result.params.get("articleJob")).toBe(jobUuid);
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor); expect(view.terminalAudits).toEqual([]); expect(view.jobs.size).toBe(1);
    expect(view.english.has(later.id)).toBe(false); expect(records(view)).toEqual([]); noAutomaticChanges(view);
  });
});

describe("M07 terminal checkpoint persists the empty tail of an actual bounded scan", () => {
  it.each(["unpublished", "deleted", "soft-deleted", "mixed"] as const)("records one terminal transition after actual first500 and a %s tail", async mutation => {
    const rows = Array.from({ length: 600 }, (_, index) => article(index));
    const view = setup({ kinds: ["machine-current"], articles: rows });
    await view.runBatch(); const firstJob = lastJob(view); const firstRecord = records(view)[0];
    const expectedCursor = structuredClone(view.jobs.get(firstJob)!.resumeCursor);
    expect(firstRecord.p_items).toHaveLength(500);
    expect(expectedCursor.articleScan).toMatchObject({ afterId: rows[499].id, upperId: rows[599].id, lastWindow: false, exhausted: false });
    if (mutation === "deleted") view.articles.splice(500);
    else view.articles.slice(500).forEach((row, index) => {
      if (mutation === "soft-deleted" || mutation === "mixed" && index % 2) row.deleted_at = olderRevision;
      else row.status = "draft";
    });
    const changedFixture = structuredClone(view.articles);
    const terminal = await view.resume(firstJob);
    expect(terminal.params.get("articleJob")).toBe(firstJob);
    expect(terminal.params.get("errorCode")).toBeNull();
    expect(view.jobs.get(firstJob)!.resumeCursor).toEqual({ ...expectedCursor, articleScan: { ...expectedCursor.articleScan, lastWindow: true, exhausted: true } });
    expect(terminalCalls(view)).toEqual([[terminalRpc, { p_job_id: firstJob, p_expected_cursor: expectedCursor }]]);
    expect(records(view)).toHaveLength(1); expect(view.jobs.size).toBe(1); expect(view.terminalAudits).toHaveLength(1);
    expect(view.jobs.get(firstJob)).toMatchObject({ totalItems: 500, succeededItems: 0, failedItems: 0 });
    preservesAuthoredRows(view, changedFixture);
    const repeated = await view.resume(firstJob);
    expect(repeated.params.get("errorCode")).toBe("translation_scan_complete");
    expect(terminalCalls(view)).toHaveLength(1); expect(view.terminalAudits).toHaveLength(1); expect(records(view)).toHaveLength(1);
    preservesAuthoredRows(view, changedFixture);
  });
  it("preserves the complete original cursor and authored outer metadata in the terminal CAS", async () => {
    const extra = { note: authored.ru, englishNote: authored.en, rights: { holder: "Original author", license: "Author consent" }, originalSources: ["https://source.invalid/manual"] };
    const { view, expectedCursor } = seedTerminal({}, extra);
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("articleJob")).toBe(jobUuid); expect(result.params.get("errorCode")).toBeNull();
    expect(terminalCalls(view)[0][1]).toEqual({ p_job_id: jobUuid, p_expected_cursor: expectedCursor });
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual({ ...expectedCursor, articleScan: { ...expectedCursor.articleScan, lastWindow: true, exhausted: true } });
    preservesAuthoredRows(view); expect(records(view)).toEqual([]);
  });
  it("installed Supabase SDK serializes the real terminal named RPC and retains JSON cursor bytes", async () => {
    const { view, expectedCursor } = seedTerminal({ actualTerminalRpc: true }, { author: authored });
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("articleJob")).toBe(jobUuid); expect(result.params.get("errorCode")).toBeNull();
    expect(view.sdkHttpCalls).toHaveLength(1);
    expect(view.sdkHttpCalls[0]).toEqual({ url: `https://local-terminal.invalid/rest/v1/rpc/${terminalRpc}`, method: "POST", body: { p_job_id: jobUuid, p_expected_cursor: expectedCursor } });
    expect(view.sdkHttpCalls.some(request => request.url.includes("/auth/"))).toBe(false);
    expect(view.terminalAudits).toHaveLength(1); preservesAuthoredRows(view);
  });
  it("fresh empty scans do not call terminal completion or invent a zero-item job", async () => {
    const view = setup({ articles: [] }); const result = await view.runBatch();
    expect(result.params.get("success")).toContain("нет"); expect(terminalCalls(view)).toEqual([]); expect(records(view)).toEqual([]);
    expect(view.jobs.size).toBe(0); expect(view.terminalAudits).toEqual([]); noAutomaticChanges(view);
  });
  it("still uses ordinary item recording when stored pending IDs disappear before processing", async () => {
    const { view } = seedTerminal();
    const row = view.jobs.get(jobUuid)!;
    row.resumeCursor.articleScan = { ...row.resumeCursor.articleScan, afterId: null, pendingIds: [article(500).id, article(501).id], lastWindow: true };
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBeNull(); expect(terminalCalls(view)).toEqual([]);
    expect(records(view)).toHaveLength(1); expect(records(view)[0].p_outcomes).toEqual([{ status: "skipped" }, { status: "skipped" }]);
    expect(records(view)[0].p_items.map((row: Row) => row.entityId)).toEqual([article(500).id, article(501).id]);
    preservesAuthoredRows(view);
  });
});

describe("M07 terminal failures keep the original job available without a fabricated success", () => {
  it.each([
    { code: "42883", expected: "translation_migration_required" },
    { code: "PGRST202", expected: "translation_migration_required" },
    { code: "40001", expected: "write_conflict" },
    { code: "42501", expected: "translation_operation_stopped" },
    { code: "22023", expected: "translation_resume_stale" },
    { code: "P0002", expected: "database_read_failed" },
    { code: "XX000", expected: "translation_scan_unconfirmed" },
    { code: "402", expected: "translation_scan_unconfirmed" },
  ])("maps terminal $code to $expected without starting a provider or a new job", async ({ code, expected }) => {
    const { view, expectedCursor } = seedTerminal({ terminalError: { code, message: "controlled local terminal failure" } });
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe(expected); expect(result.params.get("success")).toBeNull(); expect(result.params.get("articleJob")).toBe(jobUuid);
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor); expect(view.terminalAudits).toEqual([]);
    expect(records(view)).toEqual([]); expect(view.jobs.size).toBe(1); preservesAuthoredRows(view);
  });
  it("retains the receipt after an ordinary terminal transport rejection", async () => {
    const { view, expectedCursor } = seedTerminal({ terminalReject: true }); const result = await view.resume(jobUuid);
    expect(result.params.get("errorCode")).toBe("translation_scan_unconfirmed"); expect(result.params.get("articleJob")).toBe(jobUuid); expect(result.params.get("success")).toBeNull();
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor); expect(view.terminalAudits).toEqual([]); preservesAuthoredRows(view);
  });
  it.each(["cancelled", "cancelling"] as const)("a %s race after the scan read prevents terminal mutation", async status => {
    const { view, expectedCursor } = seedTerminal({ onTerminal: job => { job.status = status; } }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("translation_operation_stopped"); expect(result.params.get("success")).toBeNull();
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor); expect(view.jobs.get(jobUuid)!.status).toBe(status); expect(view.terminalAudits).toEqual([]);
    preservesAuthoredRows(view);
  });
  it("a CAS race retains the newer cursor and refuses to claim terminal completion", async () => {
    const { view } = seedTerminal({ onTerminal: job => { job.resumeCursor.articleScan.afterId = article(498).id; } }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("write_conflict"); expect(result.params.get("success")).toBeNull();
    expect(view.jobs.get(jobUuid)!.resumeCursor.articleScan).toMatchObject({ afterId: article(498).id, lastWindow: false, exhausted: false });
    expect(view.terminalAudits).toEqual([]); preservesAuthoredRows(view);
  });
  it("a publication appearing after the empty read is a conflict and remains unprocessed", async () => {
    const later = article(550);
    const { view, expectedCursor } = seedTerminal({ onTerminal: (_job, rows) => { rows.push(structuredClone(later)); } });
    const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("write_conflict"); expect(result.params.get("success")).toBeNull();
    expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor); expect(view.english.has(later.id)).toBe(false); expect(view.terminalAudits).toEqual([]); noAutomaticChanges(view);
  });
  it.each(["thrown", "fulfilled"] as const)("preserves a %s native Next terminal signal without recoding it", async terminalSignal => {
    const { view, expectedCursor } = seedTerminal({ terminalSignal }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.destination).toBe("/local-terminal-native-signal"); expect(view.jobs.get(jobUuid)!.resumeCursor).toEqual(expectedCursor);
    expect(view.terminalAudits).toEqual([]); preservesAuthoredRows(view);
  });
});

describe("M07 terminal DTO confirmation does not assume a failed receipt rolled back a write", () => {
  const complete = completeReceipt();
  it.each([
    { name: "null", value: null }, { name: "scalar UUID", value: jobUuid }, { name: "array", value: [complete] },
    { name: "missing cursor", value: { id: jobUuid, kind: "article", status: "completed" } },
    { name: "wrong job", value: { ...complete, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } },
    { name: "wrong kind", value: { ...complete, kind: "writer" } }, { name: "unknown status", value: { ...complete, status: "imaginary" } },
    { name: "cursor array", value: { ...complete, resumeCursor: [] } },
    ...[
      { exhausted: false }, { lastWindow: false }, { nextIndex: 1 }, { pendingIds: [article(501).id] },
      { afterId: article(498).id }, { upperId: article(600).id }, { order: "updated_at" }, { version: 2 },
    ].map((patch, index) => ({ name: `invalid terminal scan ${index}`, value: { ...complete, resumeCursor: { articleScan: { ...complete.resumeCursor.articleScan, ...patch } } } })),
  ])("reports $name as unconfirmed while preserving the actual durable job identity", async ({ value }) => {
    const { view } = seedTerminal({ terminalData: value }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("translation_scan_unconfirmed"); expect(result.params.get("success")).toBeNull(); expect(result.params.get("articleJob")).toBe(jobUuid);
    // The controlled server accepted its guarded write before its bad receipt.
    // The action must not claim that the already accepted write was rolled back.
    expect(view.jobs.get(jobUuid)!.resumeCursor.articleScan.exhausted).toBe(true);
    expect(view.terminalAudits).toHaveLength(1); expect(records(view)).toEqual([]); preservesAuthoredRows(view);
  });
});

describe("M07 actual SSR uses the reloaded terminal cursor", () => {
  it("successful empty-tail completion disables journal and primary continuation but preserves fresh scan", async () => {
    const { view } = seedTerminal(); await view.runBatch({ articleJob: jobUuid }); const { $ } = await view.render({ articleJob: jobUuid });
    const journal = $('input[name="job_id"]').closest('form'); expect(journal.find('button').attr('disabled')).toBeDefined();
    const primary = $('button[name="articleScanIntent"][value="fresh"]').closest('form');
    expect(primary.find('button').filter((_index: number, element: unknown) => !$(element).attr('name')).attr('disabled')).toBeDefined();
    expect(primary.find('button[name="articleScanIntent"][value="fresh"]').attr('disabled')).toBeUndefined();
    expect(primary.find('input[name="articleJob"]').attr('value')).toBe(jobUuid); expect(primary.find('input[name="articleCursor"]')).toHaveLength(0);
    expect(journal.text()).toContain("Технически выполнено 0 из 500 просмотренных"); preservesAuthoredRows(view);
  });
  it("unconfirmed terminal receipt is resolved from the actual reloaded cursor, without a new model call", async () => {
    const { view } = seedTerminal({ terminalData: null }); const result = await view.runBatch({ articleJob: jobUuid });
    expect(result.params.get("errorCode")).toBe("translation_scan_unconfirmed");
    const { $ } = await view.render({ articleJob: jobUuid, errorCode: "translation_scan_unconfirmed" });
    expect($('input[name="job_id"]').closest('form').find('button').attr('disabled')).toBeDefined();
    expect($('button[name="articleScanIntent"][value="fresh"]').attr('disabled')).toBeUndefined();
    preservesAuthoredRows(view);
  });
});

afterAll(() => {
  if (!process.env.M07_ARTICLE_TERMINAL_EVIDENCE) return;
  writeFileSync(process.env.M07_ARTICLE_TERMINAL_EVIDENCE, JSON.stringify({ fixture: { file: "apps/admin/app/(dashboard)/translations/article-terminal.integration.test.ts", sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...sourceGraph.values()], traces,
    actualDependencies: { next: nativeRequire("next/package.json").version, typescript: nativeRequire("typescript/package.json").version, cheerio: nativeRequire("cheerio/package.json").version, react: nativeRequire("react/package.json").version, reactDom: nativeRequire("react-dom/package.json").version, supabase: nativeRequire("@supabase/supabase-js/package.json").version },
    limitations: ["Actual batch/helper/hash/ownership/job mapping/resume action/SSR/submit component/completion helper/native Next execute", "SDK table reads are an in-memory emulator with actual filter, order, count, range and limit semantics", "Terminal RPC guards, cursor persistence and audit are explicit local JSON transport mocks, not actual SQL/Auth/RLS evidence", "One test executes installed Supabase SDK RPC using a controlled fetch and Response, with zero real HTTP/Auth calls", "Auth, runtime gate, expensive translator, publication and revalidation are mocks; submit pending hook is controlled false", "No paid/model/provider/social/production requests; no lease, worker, failed-item retry or hydration acceptance"] }, null, 2) + "\n", { flag: "wx" });
});
