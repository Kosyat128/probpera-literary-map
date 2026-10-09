import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

// Actual action/helper/hash/draft validators, installed SDK and CF transport.
// Staff identity, database ledger, CF binding/output and cache are controlled.
// These tests do not exercise PostgreSQL, live Auth, a provider or HTTP Next.
type Row = Record<string, any>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nativeRequire = createRequire(import.meta.url);
const { createClient } = nativeRequire("@supabase/supabase-js");
const nextRedirect = nativeRequire("next/dist/client/components/redirect");
const nextErrors = nativeRequire("next/dist/client/components/redirect-error");
vi.stubEnv("PREMIUM_TRANSLATION_PROVIDER", "cloudflare");
vi.stubEnv("OPENAI_AUTO_TRANSLATE_ARTICLES", "true");
vi.stubEnv("OPENAI_PREMIUM_TRANSLATION_REVIEW", "true");
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stamp = "2026-10-08T10:00:00.123456+00:00", savedStamp = "2026-10-08T10:01:00.123456+00:00";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown) => sha(JSON.stringify(value) ?? "undefined");
const graph = new Map<string, Row>(), proofs: Row[] = [];
const request = new AsyncLocalStorage<{ id: string; articleId?: string }>();
const articleId = (index = 1) => `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`;
const image = '<img src="https://media.fixture.invalid/permitted.jpg" alt="Author permitted literary illustration" data-media-id="dddddddd-dddd-4ddd-8ddd-dddddddddddd" data-credit="Exact author permission" data-source="https://sources.fixture.invalid/permission" data-license="Author-permitted use" data-license-url="https://sources.fixture.invalid/license" data-decorative="false" />';
const ruText = "Авторский литературный текст сохраняет точные источники права автора и редакционную последовательность. ".repeat(48).trim();
const enText = "This literary article preserves exact sources author rights and the original editorial sequence. ".repeat(48).trim();
const enDescription = "This faithful literary description preserves the author's sources, exact rights, original facts and editorial sequence without adding claims.";
const translated = { title: "Author literary article", subtitle: "Original author subtitle", excerpt: enDescription,
  content_html: `<h2>Original literary context</h2><p>${enText}</p>${image}`, cover_alt: "Author permitted literary illustration",
  seo_title: "Author literary article", seo_description: enDescription, seo_keywords: ["literature"], og_title: "Author literary article",
  og_description: enDescription, sources: ["https://sources.fixture.invalid/original"], bibliography: ["Original author bibliography"] };
function source(index: number): Row {
  return { id: articleId(index), title: `Авторский материал ${index}`, subtitle: "Авторский подзаголовок",
    excerpt: "Авторское описание сохраняет точные источники, права автора, проверенные факты и редакционную последовательность без добавления утверждений.",
    slug: `authored-article-${index}`, content_html: `<h2>Литературный контекст</h2><p>${ruText}</p>${image}`,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: ruText }] }],
      authorMetadata: { author: "Ручные авторские данные \u2014 ё", permission: "Exact original consent" } },
    cover_external_url: "https://media.fixture.invalid/permitted.jpg", cover_alt: "Author permitted literary illustration",
    category_id: null, legacy_path: null, canonical_url: `https://site.fixture.invalid/articles/authored-article-${index}`,
    allow_indexing: true, featured: false, show_on_homepage: true, pinned: false, status: "published", updated_at: stamp, deleted_at: null,
    seo_title: `Авторский материал ${index}`, seo_description: "Авторское подробное описание сохраняет права автора, точные источники, проверенные факты и редакционную последовательность.",
    seo_keywords: ["литература"], og_title: `Авторский материал ${index}`, og_description: "Авторские источники и права сохранены.",
    sources: [{ text: "  https://sources.fixture.invalid/original  " }], bibliography: [{ text: "Original author bibliography" }],
    categories: { slug: "literature" }, rights: { holder: "Original author", permission: "Exact original permission" } };
}
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file), actual = process.env.M07_ORDINARY_ADMISSION_BASELINE_ROOT
      ? path.join(process.env.M07_ORDINARY_ADMISSION_BASELINE_ROOT, file) : filename;
    const bytes = readFileSync(actual), sourceHash = sha(bytes);
    const existing = graph.get(file);
    if (existing && existing.sha256 !== sourceHash) throw new Error(`Executed source drift: ${file}`);
    graph.set(file, { module: file, source: path.relative(root, actual).replaceAll("\\", "/"), sha256: sourceHash });
    const output = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row }; cache.set(file, module.exports);
    const require = (name: string): any => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(root, "apps/admin", name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!target) return nativeRequire(name);
      const relative = path.relative(root, target).replaceAll("\\", "/");
      for (const extension of [".ts", ".tsx", "/index.ts"]) {
        const sourceRoot = process.env.M07_ORDINARY_ADMISSION_BASELINE_ROOT ?? root;
        if (existsSync(path.join(sourceRoot, relative + extension))) return load(relative + extension);
      }
      throw new Error(`Actual dependency absent: ${name} from ${file}`);
    };
    new Function("require", "module", "exports", output)(require, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  return { load };
}
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
function setup(options: Row = {}) {
  const articles = Array.from({ length: options.size ?? 1 }, (_, index) => source(index + 1));
  const english = new Map<string, Row>(), drafts = new Map<string, Row>();
  const jobs = new Map<string, Row>(), items = new Map<string, Row>(), operations = new Map<string, Row>(), oldRuns = new Map<string, Row>();
  const trace: Row[] = [], entries: Row[] = [], rpcCalls: Row[] = [], sdkWire: Row[] = [], writes: Row[] = [];
  const preflights = deferred(), saveBarrier = deferred(); let englishReads = 0, saveCount = 0, loaded!: ReturnType<typeof modules>;
  let role = options.role ?? "owner", gate = true;
  let afterRace: Row | null = null, stagedPrivateHash: string | null = null;
  const who = () => request.getStore()?.id ?? "outside";
  const activeArticle = () => request.getStore()?.articleId ?? articles[0].id;
  const row = (id: string) => articles.find(article => article.id === id)!;
  const sameRevision = (a: unknown, b: unknown) => loaded.load("apps/admin/lib/article-retry-revision.ts").sameArticleRetryRevision(a, b);
  const sourceHash = (article: Row) => loaded.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash({
    title: article.title, subtitle: article.subtitle, excerpt: article.excerpt, slug: article.slug,
    contentHtml: article.content_html, contentJson: article.content_json, coverAlt: article.cover_alt,
    sources: article.sources, bibliography: article.bibliography, seoTitle: article.seo_title,
    seoDescription: article.seo_description, seoKeywords: article.seo_keywords, ogTitle: article.og_title, ogDescription: article.og_description });
  const sourceSnapshot = (article: Row) => loaded.load("apps/admin/lib/article-private-retry-draft.ts").articlePrivateRetrySourceSnapshot({
    article, sourceUpdatedAt: article.updated_at, expectedEnglishUpdatedAt: english.get(article.id)?.updated_at ?? null });
  const refused = (code: string, message = "Controlled database refusal") => ({ data: null, error: { code, message } });
  const success = (data: unknown) => ({ data: structuredClone(data), error: null });
  function context(args: Row): Row {
    const article = row(args.p_article_id), en = english.get(article.id);
    const blockReason = !sameRevision(args.p_source_updated_at, article.updated_at) || args.p_source_hash !== sourceHash(article) ||
      !isDeepStrictEqual(args.p_source_snapshot, sourceSnapshot(article)) ? "source_changed"
      : !sameRevision(args.p_expected_english_updated_at, en?.updated_at ?? null) ? "english_changed"
      : en && loaded.load("apps/admin/lib/published-article-english-state.ts").publishedArticleEnglishState({ sourceHash: sourceHash(article), sourceUpdatedAt: article.updated_at, translation: en }).ownership === "manual" ? "manual_english"
      : drafts.has(article.id) ? "draft_exists" : null;
    return { version: 1, articleId: article.id, sourceHash: args.p_source_hash, sourceUpdatedAt: args.p_source_updated_at,
      englishUpdatedAt: args.p_expected_english_updated_at, canGenerate: blockReason === null, blockReason };
  }
  function mutateAtAdmission(article: Row) {
    if (options.race === "source") article.updated_at = "2026-10-08T10:00:00.123457+00:00";
    if (options.race === "body") article.content_html += "<p>Concurrent authored addition</p>";
    if (options.race === "manual") setManual(article.id);
    if (options.race === "draft") drafts.set(article.id, { article_id: article.id, version: 9, payload: { title: "Concurrent author draft" } });
    if (options.race === "role") role = "editor";
  }
  function setManual(id: string) {
    english.set(id, { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", article_id: id, locale: "en", updated_at: stamp, slug: "manual-en",
      canonical_url: "https://site.fixture.invalid/manual-en", status: "published", deleted_at: null, source_content_hash: sourceHash(row(id)),
      source_article_updated_at: stamp, content_html: `<p>Manual English \u2014 exact rights</p>${image}`,
      content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Manual English \u2014 exact rights" }] }], authorMetadata: { consent: "Original EN consent" } },
      sources: [{ text: "Original manual EN source" }], bibliography: [{ text: "Original EN bibliography" }], rights: { permission: "Original manual permission" },
      reviewed_at: stamp, approved_at: stamp, published_at: stamp });
  }
  function drift(operation: Row, kind: string) {
    if (options.driftApplied) return; options.driftApplied = true;
    const article = row(operation.articleId);
    if (kind === "source") article.updated_at = "2026-10-08T10:00:00.123457+00:00";
    if (kind === "body") article.content_html += "<p>Concurrent author's exact Russian addition</p>";
    if (kind === "english") setManual(article.id);
    stagedPrivateHash = digest(drafts.get(article.id));
    afterRace = { articles: structuredClone(articles), english: structuredClone([...english]) };
    trace.push({ kind: "post-stage-canonical-drift", kindOfDrift: kind, articleId: article.id });
  }
  function candidateReason(operation: Row) {
    const article = row(operation.articleId), en = english.get(article.id);
    if (!sameRevision(article.updated_at, operation.sourceUpdatedAt) || sourceHash(article) !== operation.sourceHash ||
      !isDeepStrictEqual(sourceSnapshot(article), operation.snapshot)) return "source_changed";
    if (!sameRevision(en?.updated_at ?? null, operation.englishUpdatedAt) || en && loaded.load("apps/admin/lib/published-article-english-state.ts").publishedArticleEnglishState({
      sourceHash: sourceHash(article), sourceUpdatedAt: article.updated_at, translation: en }).ownership === "manual") return "english_changed";
    return null;
  }
  const receipt = (operation: Row, boundary: string, replayed = false): Row => {
    const item = items.get(operation.itemId)!, job = jobs.get(operation.jobId)!;
    return { version: 1, jobId: job.id, itemId: item.id, articleId: item.articleId, provider: "cloudflare", sourceHash: operation.sourceHash,
      sourceUpdatedAt: operation.sourceUpdatedAt, englishUpdatedAt: operation.englishUpdatedAt, jobVersion: String(job.version),
      attemptCount: item.attemptCount, maxAttempts: 3, jobStatus: job.status, itemStatus: item.status, operationId: operation.id,
      phase: operation.result ? "finished" : "running", canExecute: boundary === "begin" && !replayed && !operation.result,
      replayed, retryable: false, blockReason: null, result: operation.result ?? null };
  };
  const run = (job: Row, replayed = false): Row => {
    const selected = [...items.values()].filter(item => item.jobId === job.id);
    return { version: 1, jobId: job.id, provider: "cloudflare", actorId, jobVersion: String(job.version), status: job.status,
      totalItems: selected.length + job.observed.length, succeededItems: selected.filter(item => item.status === "succeeded").length,
      failedItems: selected.filter(item => ["dead_letter", "conflict", "stale", "not-configured"].includes(item.status)).length,
      activeItems: selected.filter(item => item.status === "reviewing").length, pendingItems: 0,
      resumeCursor: job.cursor, replayed };
  };
  const progress = (operation: Row, canDispatch = false, replayed = false): Row => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId,
    articleId: operation.articleId, operationId: operation.id, provider: "cloudflare", phase: operation.result ? "finished" : "running",
    startedAt: operation.calls.length ? stamp : null, updatedAt: savedStamp, providerCalls: operation.calls.length,
    canDispatch, replayed, calls: operation.calls });
  const candidate = (operation: Row): Row => ({ version: 1, jobId: operation.jobId, itemId: operation.itemId, articleId: operation.articleId,
    operationId: operation.id, provider: "cloudflare", sourceHash: operation.sourceHash, sourceUpdatedAt: operation.sourceUpdatedAt,
    englishUpdatedAt: operation.englishUpdatedAt, phase: operation.result ? "finished" : "running",
    candidateState: operation.candidate ? operation.result ? "finished" : "staged" : "missing",
    candidateHash: operation.candidate?.hash ?? null, preparedAt: operation.candidate ? savedStamp : null,
    workingDraftVersion: operation.candidate ? 1 : null, workingDraftUpdatedAt: operation.candidate ? savedStamp : null,
    providerCalls: operation.calls.length, canRecover: Boolean(operation.candidate && !operation.result && !candidateReason(operation)), replayed: Boolean(operation.result),
    blockReason: operation.candidate ? candidateReason(operation) : "candidate_missing" });
  async function privateSave(article: Row, snapshot: Row, envelope: Row, expectedEnglish: string | null) {
    saveCount++;
    if (saveCount === 2) saveBarrier.resolve();
    if (options.concurrent) await saveBarrier.promise;
    if (drafts.has(article.id)) return false;
    const parser = loaded.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts");
    const checked = parser.articleWorkingDraftEnglishEnvelope(envelope.payload);
    assert.equal(checked.mode, "save"); assert.equal(checked.payload.status, "draft");
    assert.equal(checked.payload.source_content_hash, sourceHash(article));
    for (const field of ["reviewed_at", "approved_at", "published_at", "deleted_at"]) assert.equal(checked.payload[field], null);
    if (options.stageRollback) throw new Error("Controlled private stage rolled back");
    drafts.set(article.id, parser.parseArticleWorkingDraft({ article_id: article.id, base_article_updated_at: article.updated_at,
      payload: snapshot, english_payload: checked, expected_english_updated_at: expectedEnglish,
      draft_scope: "english-only", draft_english_enabled: true, version: 1, updated_at: savedStamp }));
    trace.push({ kind: "private-commit", articleId: article.id, requestId: who(), version: 1, envelopeHash: digest(envelope) });
    return true;
  }
  async function ledgerRpc(api: string, args: Row): Promise<Row> {
    rpcCalls.push({ api, requestId: who(), args: structuredClone(args) }); trace.push({ kind: "rpc", api, requestId: who() });
    if (options.signal && api === options.signalApi) { if (options.signalRejected) throw options.signal; return { data: null, error: options.signal }; }
    if (api === "article_translation_sync_ready") {
      if (options.ready === "42883") return refused("42883");
      if (options.ready === "contradictory") return { data: true, error: { code: "40001", message: "Controlled contradictory readiness" } };
      return success(options.ready !== false);
    }
    if (api === "get_article_machine_english_draft_context") {
      mutateAtAdmission(row(args.p_article_id));
      if (options.capability) return refused(options.capability);
      const dto = context(args); trace.push({ kind: "preflight-context", requestId: who(), articleId: args.p_article_id, canGenerate: dto.canGenerate });
      return success(dto);
    }
    if (api === "save_article_machine_english_draft") {
      if (!context(args).canGenerate) return refused("40001");
      if (!(await privateSave(row(args.p_article_id), args.p_source_snapshot, args.p_english_payload, args.p_expected_english_updated_at))) return refused("40001");
      if (options.stageLost) throw new Error("Controlled committed private save ACK lost");
      return success({ version: 1, articleId: args.p_article_id, sourceHash: args.p_source_hash, sourceUpdatedAt: args.p_source_updated_at,
        englishUpdatedAt: args.p_expected_english_updated_at, workingDraftVersion: 1, workingDraftUpdatedAt: savedStamp,
        scope: "english-only", publication: "unchanged", humanReview: "pending", persistence: "working-draft" });
    }
    if (api === "record_translation_sync_run") {
      const id = `eeeeeeee-eeee-4eee-8eee-${String(oldRuns.size + 1).padStart(12, "0")}`;
      oldRuns.set(id, { id, kind: "article", status: args.p_outcomes.some((value: Row) => value.status === "dead_letter") ? "partial" : "completed",
        resumeCursor: structuredClone(args.p_resume_cursor), items: structuredClone(args.p_items), outcomes: structuredClone(args.p_outcomes) });
      for (let index = 0; index < args.p_items.length; index++) {
        const input = args.p_items[index], outcome = args.p_outcomes[index];
        const itemId = `ffffffff-ffff-4fff-8fff-${String(items.size + 1).padStart(12, "0")}`;
        items.set(itemId, { id: itemId, jobId: id, articleId: input.entityId, status: outcome.status, attemptCount: 1,
          sourceHash: input.sourceHash, sourceUpdatedAt: row(input.entityId).updated_at, englishUpdatedAt: english.get(input.entityId)?.updated_at ?? null, legacy: true });
      }
      return success(id);
    }
    if (api === "get_translation_job_resume") {
      const old = oldRuns.get(args.p_job_id); if (!old) return refused("P0002");
      return success({ id: old.id, kind: "article", status: old.status, resumeCursor: old.resumeCursor });
    }
    if (api === "begin_article_translation_sync_item") {
      assert.deepEqual(Object.keys(args).sort(), ["p_job_id", "p_item_id", "p_operation_id", "p_article_id", "p_expected_job_version", "p_expected_source_hash", "p_expected_article_updated_at", "p_expected_english_updated_at", "p_provider", "p_expected_cursor", "p_resume_cursor", "p_expected_source_snapshot"].sort());
      const article = row(args.p_article_id); mutateAtAdmission(article);
      if (options.capability) return refused(options.capability);
      if (!["owner", "admin"].includes(role)) return refused("42501");
      if (!context({ p_article_id: article.id, p_source_hash: args.p_expected_source_hash, p_source_updated_at: args.p_expected_article_updated_at,
        p_expected_english_updated_at: args.p_expected_english_updated_at, p_source_snapshot: args.p_expected_source_snapshot }).canGenerate) return refused("40001");
      const replay = operations.get(args.p_operation_id); if (replay) return success(receipt(replay, "begin", true));
      if ([...operations.values()].some(operation => operation.articleId === article.id && !operation.result)) return refused("40001", "Controlled article already has active admission");
      let job = jobs.get(args.p_job_id);
      if (!job) {
        if (args.p_expected_job_version !== "0" || Object.keys(args.p_expected_cursor).length) return refused("40001");
        job = { id: args.p_job_id, version: 0, status: "reviewing", cursor: {}, observed: [] }; jobs.set(job.id, job);
      }
      if (String(job.version) !== args.p_expected_job_version || !isDeepStrictEqual(job.cursor, args.p_expected_cursor)) return refused("40001");
      if ([...items.values()].filter(item => item.jobId === job!.id).length + job.observed.length >= 500) return refused("40001", "ordinary article is already recorded or run is full");
      job.version++; job.status = "reviewing"; job.cursor = structuredClone(args.p_resume_cursor);
      items.set(args.p_item_id, { id: args.p_item_id, jobId: job.id, articleId: article.id, status: "reviewing", attemptCount: 0 });
      const operation: Row = { id: args.p_operation_id, jobId: job.id, itemId: args.p_item_id, articleId: article.id,
        sourceHash: args.p_expected_source_hash, sourceUpdatedAt: args.p_expected_article_updated_at, englishUpdatedAt: args.p_expected_english_updated_at,
        snapshot: structuredClone(args.p_expected_source_snapshot), calls: [], result: null, candidate: null };
      operations.set(operation.id, operation); trace.push({ kind: "durable-admission", requestId: who(), operationId: operation.id, articleId: article.id, calls: 0 });
      const dto = receipt(operation, "begin");
      if (options.beginLost) throw new Error("Controlled committed BEGIN ACK lost");
      if (options.beginMalformed) dto[options.beginMalformed] = options.beginValue;
      if (options.beginContradictory) return { data: dto, error: { code: "40001", message: "Controlled contradictory reply" } };
      return success(dto);
    }
    if (api === "get_article_translation_sync_run") {
      const job = jobs.get(args.p_job_id); return job ? success(run(job)) : refused("P0002");
    }
    if (api === "checkpoint_article_translation_sync_run") {
      let job = jobs.get(args.p_job_id);
      if (!job) { job = { id: args.p_job_id, version: 0, status: "completed", cursor: {}, observed: [] }; jobs.set(job.id, job); }
      if (String(job.version) !== args.p_expected_job_version || !isDeepStrictEqual(job.cursor, args.p_expected_cursor)) return refused("40001");
      if ([...items.values()].filter(item => item.jobId === job!.id).length + job.observed.length + args.p_observed_items.length > 500) return refused("40001");
      job.version++; job.cursor = structuredClone(args.p_resume_cursor); job.observed.push(...structuredClone(args.p_observed_items));
      return success(run(job));
    }
    if (api === "begin_article_translation_item_retry") {
      const item = items.get(args.p_item_id); if (!item || item.jobId !== args.p_job_id) return refused("P0002");
      const job = jobs.get(item.jobId) ?? { id: item.jobId, version: 1, status: "partial", cursor: oldRuns.get(item.jobId)?.resumeCursor ?? {}, observed: [] };
      jobs.set(job.id, job);
      if (String(job.version) !== args.p_expected_job_version || item.attemptCount !== args.p_expected_attempt_count ||
        sourceHash(row(item.articleId)) !== args.p_expected_source_hash) return refused("40001");
      const previous = operations.get(args.p_operation_id); if (previous) return success(receipt(previous, "begin", true));
      if ([...operations.values()].some(value => value.articleId === item.articleId && !value.result)) return refused("40001");
      item.status = "reviewing"; job.status = "reviewing"; job.version++;
      const created: Row = { id: args.p_operation_id, jobId: item.jobId, itemId: item.id, articleId: item.articleId,
        sourceHash: args.p_expected_source_hash, sourceUpdatedAt: args.p_expected_article_updated_at, englishUpdatedAt: args.p_expected_english_updated_at,
        snapshot: sourceSnapshot(row(item.articleId)), calls: [], result: null, candidate: null };
      operations.set(created.id, created); const dto = receipt(created, "begin"); if (item.legacy) dto.maxAttempts = item.attemptCount + 1;
      return success(dto);
    }
    const operation = operations.get(args.p_operation_id);
    if (api === "get_article_translation_item_retry") {
      if (operation) { const dto = receipt(operation, "get", true); if (items.get(operation.itemId)?.legacy) dto.maxAttempts = Math.max(2, items.get(operation.itemId)!.attemptCount); return success(dto); }
      if (args.p_operation_id !== null) return refused("P0002", "article retry operation not found");
      const item = items.get(args.p_item_id); if (!item || item.jobId !== args.p_job_id) return refused("P0002");
      const job = jobs.get(item.jobId);
      return success({ version: 1, jobId: item.jobId, itemId: item.id, articleId: item.articleId, provider: "cloudflare",
        sourceHash: sourceHash(row(item.articleId)), sourceUpdatedAt: row(item.articleId).updated_at, englishUpdatedAt: english.get(item.articleId)?.updated_at ?? null,
        jobVersion: String(job?.version ?? 1), attemptCount: item.attemptCount, maxAttempts: item.legacy ? item.attemptCount : 3,
        jobStatus: job?.status ?? "partial", itemStatus: item.status, operationId: null, phase: "ready", canExecute: false,
        replayed: false, retryable: true, blockReason: null, result: null });
    }
    if (!operation) throw new Error(`Unexpected actual RPC or unknown operation: ${api}`);
    if (api === "get_article_translation_item_retry_candidate") return success(candidate(operation));
    if (api === "get_article_translation_item_retry_progress") return success(progress(operation));
    if (api === "record_article_translation_item_retry_dispatch") {
      if (!["owner", "admin"].includes(role)) return refused("42501");
      if (!gate || options.dispatchFailure) return refused(options.dispatchFailure ?? "42501");
      if (operation.result || operation.candidate || operation.calls.at(-1)?.responseReceivedAt === null) return refused("40001");
      operation.calls.push({ callId: args.p_call_id, provider: args.p_provider, model: args.p_model, pass: args.p_pass, dispatchRecordedAt: stamp,
        responseReceivedAt: null, httpStatus: null, requestId: null, responseId: null, inputTokens: null, outputTokens: null });
      trace.push({ kind: "dispatch-ack", requestId: who(), callId: args.p_call_id, operationId: operation.id });
      if (options.dispatchLost) throw new Error("Controlled dispatch ACK lost");
      return success(progress(operation, true));
    }
    if (api === "record_article_translation_item_retry_response") {
      const call = operation.calls.find((value: Row) => value.callId === args.p_metadata.callId); assert.ok(call);
      Object.assign(call, args.p_metadata, { responseReceivedAt: savedStamp });
      if (options.responseLost) throw new Error("Controlled response metadata ACK lost");
      return success(progress(operation));
    }
    if (api === "stage_article_translation_item_retry_candidate") {
      assert.equal(args.p_outcome.providerCalls, operation.calls.length);
      assert.ok(operation.calls.every((value: Row) => value.responseReceivedAt !== null));
      if (!(await privateSave(row(operation.articleId), operation.snapshot, args.p_english_payload, operation.englishUpdatedAt))) return refused("40001");
      operation.candidate = { hash: digest(args.p_english_payload), envelope: structuredClone(args.p_english_payload), finishFingerprint: digest([args.p_outcome, args.p_english_payload]) };
      const stageAck = candidate(operation);
      if (options.stageRace) drift(operation, options.stageRace);
      if (options.stageLost) throw new Error("Controlled STAGE commit ACK lost");
      return success(options.stageAckReportsRace ? candidate(operation) : stageAck);
    }
    if (api === "finish_article_translation_item_retry" || api === "recover_article_translation_item_retry_candidate") {
      if (operation.result) return success(receipt(operation, "finish", true));
      if (api.startsWith("recover") && args.p_expected_candidate_hash !== operation.candidate?.hash) return refused("40001");
      if (options.lateRace) drift(operation, options.lateRace);
      if (api === "finish_article_translation_item_retry" && operation.candidate &&
        operation.candidate.finishFingerprint !== digest([args.p_outcome, args.p_english_payload])) return refused("40001");
      let outcome = api.startsWith("recover") ? { status: "succeeded", providerCalls: operation.calls.length } : args.p_outcome;
      if (outcome.status === "succeeded" && operation.candidate) {
        const reason = candidateReason(operation);
        if (reason) outcome = { ...outcome, status: reason === "source_changed" ? "stale" : "conflict", errorCode: reason === "source_changed" ? "source_changed" : "write_conflict" };
      }
      if (operation.calls.some((value: Row) => value.responseReceivedAt === null) || outcome.providerCalls !== operation.calls.length) return refused("40001");
      if (outcome.status === "succeeded") { assert.ok(operation.candidate); assert.ok(drafts.has(operation.articleId)); }
      const item = items.get(operation.itemId)!, job = jobs.get(operation.jobId)!;
      item.attemptCount++; item.status = outcome.status; job.version++;
      const others = [...items.values()].filter(value => value.jobId === job.id);
      job.status = others.some(value => value.status === "reviewing") ? "reviewing" : others.some(value => value.status !== "succeeded") ? "partial" : "completed";
      operation.result = { outcome: outcome.status, errorCode: outcome.errorCode ?? null, persistence: outcome.status === "succeeded" ? "working-draft" : "none",
        workingDraftVersion: outcome.status === "succeeded" ? 1 : null, workingDraftUpdatedAt: outcome.status === "succeeded" ? savedStamp : null,
        publication: "unchanged", humanReview: outcome.status === "succeeded" ? "pending" : "unchanged", providerCalls: operation.calls.length };
      if (options.finishLost) throw new Error("Controlled FINISH ACK lost");
      const dto = receipt(operation, "finish"); if (item.legacy) dto.maxAttempts = item.attemptCount; return success(dto);
    }
    throw new Error(`Unexpected actual RPC: ${api}`);
  }
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), method = init.method ?? "GET";
    assert.equal(url.origin, "https://ordinary.fixture.invalid");
    const body = init.body ? JSON.parse(String(init.body)) : null;
    sdkWire.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), requestId: who(), bodyHash: digest(body) });
    const parts = url.pathname.split("/").filter(Boolean); let response: Row;
    if (parts[2] === "rpc") response = await ledgerRpc(parts[3], body);
    else {
      const table = parts[2], columns = url.searchParams.get("select");
      trace.push({ kind: "sdk-read", table, columns, requestId: who(), query: Object.fromEntries(url.searchParams) });
      if (method !== "GET") { assert.equal(table, "admin_audit_log", "Canonical and alternate-store writes forbidden"); writes.push({ table, method, hash: digest(body) }); response = { data: null, error: null }; }
      else if (table === "translation_provider_self_tests") response = { data: [{
        provider: "cloudflare", configured: true, binding_found: true, test_in_progress: false,
        test_passed: gate, model: loaded.load("apps/admin/lib/env.ts").adminEnv.cloudflareTranslationModel,
        last_test_at: new Date(Date.now() - 1000).toISOString(), latency_ms: 0, cooldown_until: null,
        last_error_code: gate ? null : "provider_unavailable",
        configuration_identity: await loaded.load("apps/admin/lib/premium-translation-probe.ts").premiumTranslationConfigurationIdentity(),
      }], error: null };
      else if (table === "articles") {
        let selected = articles.filter(article => article.status === "published" && article.deleted_at === null);
        for (const [key, value] of url.searchParams) {
          if (value.startsWith("eq.")) selected = selected.filter(article => String(article[key]) === value.slice(3));
          if (value.startsWith("gt.")) selected = selected.filter(article => article[key] > value.slice(3));
          if (value.startsWith("lte.")) selected = selected.filter(article => article[key] <= value.slice(4));
          if (value.startsWith("in.(")) { const ids = value.slice(4, -1).split(",").map(id => id.replaceAll('"', "")); selected = selected.filter(article => ids.includes(article[key])); }
        }
        selected.sort((a, b) => a.id.localeCompare(b.id)); if (url.searchParams.get("order")?.includes("desc")) selected.reverse();
        const count = selected.length, limit = Number(url.searchParams.get("limit") ?? count);
        response = { data: selected.slice(0, limit).map(article => columns === "id" ? { id: article.id } : structuredClone(article)), error: null, count };
      } else if (table === "article_translations") {
        const id = url.searchParams.get("article_id")!.slice(3); request.getStore()!.articleId = id;
        const value = english.get(id); response = { data: value ? [structuredClone(value)] : [], error: null };
        if (options.concurrent && englishReads++ < 2) { if (englishReads === 2) preflights.resolve(); await preflights.promise; }
      } else if (table === "article_working_drafts") {
        const id = url.searchParams.get("article_id")!.slice(3), value = drafts.get(id);
        response = { data: value ? [structuredClone(value)] : [], error: null };
      } else throw new Error(`Unexpected controlled table ${table}`);
    }
    const headers: Row = { "Content-Type": "application/json" };
    if (response.count !== undefined) headers["Content-Range"] = `0-${Math.max(0, response.data.length - 1)}/${response.count}`;
    return new Response(JSON.stringify(response.error ?? response.data), { status: response.error ? 409 : 200, headers });
  };
  const sdk = createClient("https://ordinary.fixture.invalid", "controlled-no-live-auth", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } });
  // Native Next signals are objects, not a JSON wire contract; inject only at
  // this explicit SDK-call boundary for fulfilled/rejected signal tests.
  const client = options.signal || options.beginContradictory || options.ready === "contradictory" ? { from: sdk.from.bind(sdk), rpc: async (api: string, args: Row) => {
    if (options.signal && api === options.signalApi) return options.signalRejected ? Promise.reject(options.signal) : { data: null, error: options.signal };
    if (options.beginContradictory && api === "begin_article_translation_sync_item" || options.ready === "contradictory" && api === "article_translation_sync_ready") return ledgerRpc(api, args);
    return sdk.rpc(api, args);
  } } : sdk;
  const ai = { async run(model: string, input: Row) {
    const user = JSON.parse(input.messages[1].content), pass = Object.hasOwn(user, "INVALID_DRAFT_TRANSLATION") ? "repair" : Object.hasOwn(user, "DRAFT_TRANSLATION") ? "review" : "translation";
    const id = activeArticle(), event = { requestId: who(), articleId: id, model, pass, inputHash: digest(user) };
    entries.push(event); trace.push({ kind: "ai-binding-entry", ...event });
    const operation = [...operations.values()].find(value => value.articleId === id && !value.result);
    if (operation) { assert.ok(operation.calls.at(-1)); assert.equal(operation.calls.at(-1).responseReceivedAt, null); assert.equal(operation.calls.at(-1).pass, pass); }
    if (options.heldResponse && entries.length === 1) {
      trace.push({ kind: "accepted-response-pending", ...event });
      options.heldResponse.entered.resolve();
      await options.heldResponse.release.promise;
      trace.push({ kind: "accepted-response-released", ...event });
    }
    if (options.unknown && who() === "A") throw new Error("Controlled accepted provider call with unknown response");
    if (options.roleAfterFirst && entries.length === 1) role = "editor";
    if (options.gateAfterFirst && entries.length === 1) gate = false;
    const invalid = options.failedIds?.includes(id) && !options.retrySucceeded;
    return { id: `controlled-response-${entries.length}`, response: JSON.stringify(invalid ? { ...translated, title: "x" } : translated), usage: { prompt_tokens: 41, completion_tokens: 73 } };
  } };
  loaded = modules({ "@/lib/auth": { async requireStaff() { return { user: { id: actorId }, profile: { role } }; } },
    "@/lib/supabase/server": { async createServerSupabaseClient() { return client; } },
    "@opennextjs/cloudflare": { getCloudflareContext() { return { env: { AI: ai } }; } },
    "next/cache": { revalidatePath(value: string) { trace.push({ kind: "cache", value }); } } });
  if (options.manual) setManual(articles[0].id);
  if (options.authorDraft) drafts.set(articles[0].id, { article_id: articles[0].id, version: 3, payload: { title: "Original author draft" } });
  if (options.richSource) articles[0].sources[0].rights = { permission: "Do not discard" };
  for (const article of articles.slice(0, options.currentEnglishCount ?? 0)) {
    const hash = sourceHash(article);
    english.set(article.id, { id: "cccccccc-cccc-4ccc-8ccc-" + article.id.slice(-12), article_id: article.id, locale: "en", title: "Original current English " + article.id.slice(-12),
      slug: "original-current-en-" + article.id.slice(-12), canonical_url: "https://site.fixture.invalid/current-en-" + article.id.slice(-12), status: "published", updated_at: stamp, deleted_at: null,
      source_content_hash: hash, source_article_updated_at: stamp, content_html: translated.content_html,
      content_json: loaded.load("apps/admin/lib/article-translation-machine-ownership.ts").premiumArticleMachineContentJson({ sourceHash: hash, model: "original-model", reviewerModel: "original-review",
        translatorRequestId: "original-request", reviewerRequestId: "original-review-request", generatedAt: stamp }, translated.content_html),
      reviewed_at: stamp, approved_at: stamp, published_at: stamp, rights: { holder: "Original English author", permission: "Exact original consent" },
      sources: [{ text: "  Original current English source  " }], bibliography: [{ text: "Original current English bibliography" }] });
  }
  const originals = { articles: structuredClone(articles), english: structuredClone([...english]), drafts: structuredClone([...drafts]) };
  async function action(id: string, job?: string) {
    return request.run({ id }, async () => {
      const form = new FormData(); if (job) form.set("articleJob", job); else form.set("articleScanIntent", "fresh");
      try { await loaded.load("apps/admin/app/(dashboard)/translations/article-actions.ts").translatePremiumArticleBatchAction(form); throw new Error("Actual action failed to redirect"); }
      catch (error) { if (!nextErrors.isRedirectError(error)) throw error; const url = nextRedirect.getURLFromRedirectError(error), parsed = new URL(url, "https://admin.fixture.invalid");
        trace.push({ kind: "actual-next-redirect", requestId: id, url }); return { url, errorCode: parsed.searchParams.get("errorCode"), articleJob: parsed.searchParams.get("articleJob") }; }
      finally { saveBarrier.resolve(); }
    });
  }
  async function helper(id = "A") {
    return request.run({ id, articleId: articles[0].id }, async () => {
      const budget = loaded.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
      const result = await loaded.load("apps/admin/lib/auto-translate-published-article-premium.ts").ensurePublishedArticlePremiumEnglish({
        supabase: client, articleId: articles[0].id, actorId, runtimeApproved: true, operationBudget: budget,
        expectedSourceHash: sourceHash(articles[0]), expectedSourceUpdatedAt: articles[0].updated_at });
      return { result, budget: budget.snapshot() };
    });
  }
  async function retry(item: Row, id: string) {
    return request.run({ id, articleId: item.articleId }, async () => {
      const job = jobs.get(item.jobId), form = new FormData();
      const fields = { job_id: item.jobId, item_id: item.id, operation_id: `99999999-9999-4999-8999-${String(operations.size + 1).padStart(12, "0")}`,
        expected_job_version: String(job?.version ?? 1), expected_attempt_count: String(item.attemptCount), source_hash: sourceHash(row(item.articleId)) };
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      try { await loaded.load("apps/admin/app/(dashboard)/translations/article-item-retry-action.ts").retryArticleTranslationItemAction(form); throw new Error("Actual retry action failed to redirect"); }
      catch (error) { if (!nextErrors.isRedirectError(error)) throw error; const url = nextRedirect.getURLFromRedirectError(error); trace.push({ kind: "actual-next-retry-redirect", requestId: id, url }); return new URL(url, "https://admin.fixture.invalid"); }
    });
  }
  async function recover(operation: Row, id: string) {
    return request.run({ id, articleId: operation.articleId }, async () => {
      const form = new FormData();
      for (const [key, value] of Object.entries({ job_id: operation.jobId, item_id: operation.itemId, operation_id: operation.id, candidate_hash: operation.candidate.hash })) form.set(key, String(value));
      try { await loaded.load("apps/admin/app/(dashboard)/translations/article-item-retry-action.ts").recoverArticleTranslationItemCandidateAction(form); throw new Error("Actual recovery action failed to redirect"); }
      catch (error) { if (!nextErrors.isRedirectError(error)) throw error; const url = nextRedirect.getURLFromRedirectError(error); trace.push({ kind: "actual-next-recovery-redirect", requestId: id, url }); return new URL(url, "https://admin.fixture.invalid"); }
    });
  }
  async function readCandidate(operation: Row) {
    return request.run({ id: "reload-original-candidate", articleId: operation.articleId }, async () => loaded.load("apps/admin/lib/article-translation-item-retry.ts")
      .getArticleTranslationItemRetryCandidate(client, { jobId: operation.jobId, itemId: operation.itemId, operationId: operation.id, articleId: operation.articleId }));
  }
  async function readOrdinary(operation: Row) {
    return request.run({ id: "reload-original-ordinary", articleId: operation.articleId }, async () => {
      const target = { jobId: operation.jobId, itemId: operation.itemId, operationId: operation.id, articleId: operation.articleId };
      const ordinary = loaded.load("apps/admin/lib/article-translation-ordinary-rpc.ts");
      const receipt = await ordinary.getArticleTranslationOrdinaryItem(client, target);
      const run = await ordinary.getArticleTranslationSyncRun(client, operation.jobId, actorId);
      const progress = await loaded.load("apps/admin/lib/article-translation-item-retry.ts").getArticleTranslationItemRetryProgress(client, target);
      return { receipt, run, progress };
    });
  }
  function setGate(value: boolean) {
    gate = value;
    trace.push({ kind: "controlled-persisted-probe-gate", testPassed: value });
  }
  function record(name: string) {
    proofs.push({ name, entries, rpcCalls: rpcCalls.map(call => ({ api: call.api, requestId: call.requestId, keys: Object.keys(call.args).sort(), argsHash: digest(call.args) })), sdkWire,
      trace, writes, canonicalPreserved: isDeepStrictEqual(originals.articles, articles) && isDeepStrictEqual(originals.english, [...english]),
      draftVersions: [...drafts].map(([id, draft]) => ({ id, version: draft.version, payloadHash: digest(draft.payload), englishHash: digest(draft.english_payload) })) });
  }
  return { action, helper, retry, recover, readCandidate, articles, english, drafts, jobs, items, operations, oldRuns, sourceHash, sourceSnapshot, entries, rpcCalls, sdkWire, trace, writes, originals, loaded, options, record,
    drift, afterRace: () => afterRace, stagedPrivateHash: () => stagedPrivateHash, readOrdinary, setGate };
}
function publicUnchanged(view: ReturnType<typeof setup>) {
  expect(view.articles).toEqual(view.originals.articles); expect([...view.english]).toEqual(view.originals.english);
  expect(view.writes.every(write => write.table === "admin_audit_log")).toBe(true);
}

describe("ordinary durable article admission with actual premium transport", () => {
  it("two preflights for one exact RU/EN context admit one translation/review pair", async () => {
    const view = setup({ concurrent: true }); await Promise.all([view.action("A"), view.action("B")]); view.record("concurrent-admission");
    publicUnchanged(view); expect(view.drafts.size).toBe(1); expect(view.entries.map(entry => entry.pass).sort()).toEqual(["review", "translation"]);
    expect(view.rpcCalls.filter(call => call.api === "begin_article_translation_sync_item")).toHaveLength(2);
  });
  it("accepted unknown response retains admission and a fresh POST adds zero provider entries", async () => {
    const view = setup({ unknown: true }); await view.action("A"); const first = view.entries.length; await view.action("B"); view.record("unknown-response-fresh-post");
    publicUnchanged(view); expect(first).toBe(1); expect(view.entries).toHaveLength(1); expect(view.drafts.size).toBe(0);
    expect([...view.operations.values()].filter(operation => !operation.result)).toHaveLength(1);
  });
  it("successful model output stays a complete private draft with no human approval or canonical write", async () => {
    const view = setup(); const outcome = await view.helper(); view.record("private-success"); publicUnchanged(view);
    expect(outcome.result.state).toBe("translated"); expect(outcome.result.publication).toBe("draft"); expect(outcome.result.humanReview).toBe("pending");
    const draft = view.drafts.get(articleId())!; expect(draft.payload).toEqual(view.sourceSnapshot(view.articles[0])); expect(draft.draft_scope).toBe("english-only");
    expect(draft.english_payload.payload.content_html).toContain(enText); expect(draft.english_payload.payload.content_html).toContain("Exact author permission");
    for (const field of ["reviewed_at", "approved_at", "published_at", "deleted_at"]) expect(draft.english_payload.payload[field]).toBeNull();
    expect(view.entries.map(entry => entry.pass)).toEqual(["translation", "review"]); expect(outcome.budget.providerCalls).toBe(2);
  });
  it.each(["source", "body", "manual", "draft", "role"])("%s changes before durable BEGIN prevent any model invocation", async race => {
    const view = setup({ race }); await view.action("A"); view.record(`admission-${race}`); expect(view.entries).toHaveLength(0);
    expect(view.rpcCalls.filter(call => call.api === "stage_article_translation_item_retry_candidate")).toHaveLength(0);
  });
  it.each(["42883", "PGRST202"])("missing admission capability %s does not fall back to unjournaled generation", async capability => {
    const view = setup({ capability }); await view.action("A"); view.record(`capability-${capability}`); publicUnchanged(view); expect(view.entries).toHaveLength(0);
  });
  it.each([false, "42883", "contradictory"])("readiness %s is not admission or permission to call a model", async ready => {
    const view = setup({ ready }); await view.action("A"); view.record(`readiness-${ready}`); publicUnchanged(view);
    expect(view.entries).toHaveLength(0); expect(view.rpcCalls.filter(call => call.api === "begin_article_translation_sync_item")).toHaveLength(0);
  });
  it.each([["canExecute", "true"], ["articleId", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"], ["maxAttempts", 1], ["attemptCount", 1]])("damaged BEGIN %s is not provider authority", async (field, value) => {
    const view = setup({ beginMalformed: field, beginValue: value }); await view.action("A"); view.record(`damaged-begin-${field}`); publicUnchanged(view); expect(view.entries).toHaveLength(0);
  });
  it("contradictory BEGIN data plus error grants no dispatch", async () => {
    const view = setup({ beginContradictory: true }); await view.action("A"); view.record("contradictory-begin"); publicUnchanged(view); expect(view.entries).toHaveLength(0);
  });
  it("lost committed BEGIN acknowledgement reconciles by reads and never dispatches", async () => {
    const view = setup({ beginLost: true }); await view.action("A"); await view.action("B"); view.record("begin-ack-lost"); publicUnchanged(view); expect(view.entries).toHaveLength(0);
    expect([...view.operations.values()].filter(operation => !operation.result)).toHaveLength(1);
  });
  it("role loss after a known first response forbids the review transport", async () => {
    const view = setup({ roleAfterFirst: true }); await view.action("A"); view.record("role-loss-before-review"); publicUnchanged(view); expect(view.entries).toHaveLength(1); expect(view.drafts.size).toBe(0);
  });
  it("runtime gate loss after a known first response forbids the review transport", async () => {
    const view = setup({ gateAfterFirst: true }); await view.action("A"); view.record("gate-loss-before-review"); publicUnchanged(view); expect(view.entries).toHaveLength(1); expect(view.drafts.size).toBe(0);
  });
  it.each(["dispatchLost", "responseLost"])("%s keeps an unknown operation and fresh POST incurs no new expense", async failure => {
    const view = setup({ [failure]: true }); await view.action("A"); const before = view.entries.length; await view.action("B"); view.record(failure); publicUnchanged(view);
    expect(before).toBe(failure === "dispatchLost" ? 0 : 1); expect(view.entries).toHaveLength(before); expect(view.drafts.size).toBe(0);
  });
  it("committed STAGE acknowledgement loss preserves complete private text and fresh scan uses zero models", async () => {
    const view = setup({ stageLost: true }); await view.action("A"); const initial = digest(view.drafts.get(articleId())); await view.action("B"); view.record("stage-ack-lost"); publicUnchanged(view);
    expect(view.entries).toHaveLength(2); expect(view.drafts.size).toBe(1); expect(digest(view.drafts.get(articleId()))).toBe(initial);
    const staged = [...view.operations.values()].filter(operation => operation.candidate); expect(staged).toHaveLength(1);
    expect(staged[0].result).toBeNull(); const savedCount = view.trace.filter(event => event.kind === "private-commit").length;
    expect((await view.recover(staged[0], "recover-original")).searchParams.get("errorCode")).toBeNull();
    expect((await view.recover(staged[0], "recover-replay")).searchParams.get("errorCode")).toBeNull();
    view.record("stage-explicit-recovery-replay"); expect(view.entries).toHaveLength(2); expect(digest(view.drafts.get(articleId()))).toBe(initial);
    expect(view.trace.filter(event => event.kind === "private-commit")).toHaveLength(savedCount);
    expect(staged[0].result.outcome).toBe("succeeded");
    const call = view.rpcCalls.find(value => value.api === "recover_article_translation_item_retry_candidate")!;
    expect(Object.keys(call.args).sort()).toEqual(["p_job_id", "p_item_id", "p_operation_id", "p_expected_candidate_hash"].sort());
  });
  it("a rolled back candidate remains pending and a fresh intent cannot pay again", async () => {
    const view = setup({ stageRollback: true }); await view.action("A"); await view.action("B"); view.record("stage-rollback-pending"); publicUnchanged(view);
    expect(view.entries).toHaveLength(2); expect(view.drafts.size).toBe(0); expect([...view.operations.values()].filter(operation => !operation.result)).toHaveLength(1);
  });
  it.each(["manual", "authorDraft", "richSource"])("%s is preserved and stopped before provider dispatch", async guard => {
    const view = setup({ [guard]: true }); await view.action("A"); view.record(`preserve-${guard}`); publicUnchanged(view); expect(view.entries).toHaveLength(0);
    expect([...view.drafts]).toEqual(view.originals.drafts);
  });
  it("installed SDK serializes complete twelve-argument intent before dispatch and stores body only once", async () => {
    const view = setup(); await view.action("A"); view.record("installed-sdk-wire"); publicUnchanged(view);
    const begin = view.rpcCalls.find(call => call.api === "begin_article_translation_sync_item")!;
    expect(begin).toBeDefined(); expect(begin.args.p_expected_job_version).toBe("0"); expect(begin.args.p_expected_source_snapshot).toEqual(view.sourceSnapshot(view.articles[0]));
    const first = view.trace.findIndex(event => event.kind === "ai-binding-entry"); expect(view.trace.slice(0, first).some(event => event.kind === "durable-admission")).toBe(true);
    expect(view.trace.slice(0, first).some(event => event.kind === "dispatch-ack")).toBe(true);
    expect(view.rpcCalls.filter(call => call.api === "save_article_machine_english_draft")).toHaveLength(0);
    expect(view.rpcCalls.filter(call => call.api === "stage_article_translation_item_retry_candidate")).toHaveLength(1);
    expect(view.sdkWire.every(wire => wire.path.startsWith("/rest/v1/"))).toBe(true);
  });
  it.each([false, true])("native Next redirect survives %s rejected ordinary admission replies", async signalRejected => {
    let signal: unknown; try { nextRedirect.redirect("/login?fixture=native-signal"); } catch (error) { signal = error; }
    const view = setup({ signal, signalRejected, signalApi: "begin_article_translation_sync_item" });
    const result = await view.action("A"); view.record(`native-signal-${signalRejected}`);
    expect(result.url).toBe("/login?fixture=native-signal"); expect(view.entries).toHaveLength(0); publicUnchanged(view);
  });
  it("ten real candidates keep the two-item cap, continue only the remaining scan and retry only the two failed items", async () => {
    const view = setup({ size: 10, failedIds: [articleId(9), articleId(10)] });
    let job: string | undefined;
    for (let intent = 0; intent < 10; intent++) {
      const before = view.entries.length, result = await view.action(`batch-${intent}`, job); job = result.articleJob ?? job;
      expect(view.entries.length - before).toBeLessThanOrEqual(8);
      const selected = view.entries.slice(before).map(entry => entry.articleId);
      expect(new Set(selected).size).toBeLessThanOrEqual(2);
      if ([...view.items.values()].filter(item => item.status === "dead_letter").length === 2) break;
      expect(job).toBeTruthy();
    }
    const succeeded = view.entries.filter(entry => entry.articleId < articleId(9));
    expect(view.drafts.size).toBe(8); expect(new Set(succeeded.map(entry => entry.articleId)).size).toBe(8);
    expect(succeeded).toHaveLength(16);
    const failed = [...view.items.values()].filter(item => item.status === "dead_letter"); expect(failed).toHaveLength(2);
    const beforeRetry = view.entries.length; view.options.retrySucceeded = true;
    for (const [index, item] of failed.entries()) await view.retry(item, `selected-${index}`);
    view.record("ten-candidate-continue-selected-retry"); publicUnchanged(view);
    expect(view.drafts.size).toBe(10); expect(view.entries.slice(beforeRetry).map(entry => entry.articleId)).toEqual([articleId(9), articleId(9), articleId(10), articleId(10)]);
    expect(view.entries.filter(entry => entry.articleId < articleId(9))).toEqual(succeeded);
    const admissions = view.rpcCalls.filter(call => call.api === "begin_article_translation_sync_item");
    expect(new Set(admissions.map(call => call.args.p_job_id)).size).toBe(1);
    expect(view.rpcCalls.filter(call => call.api === "record_translation_sync_run")).toHaveLength(0);
  });
  it.each([["source", "stale", "source_changed"], ["body", "stale", "source_changed"], ["english", "conflict", "write_conflict"]])(
    "canonical %s change after acknowledged STAGE finishes the original attempt without replacing its private candidate", async (stageRace, status, code) => {
      const view = setup({ stageRace }); const result = await view.helper();
      const operation = [...view.operations.values()][0]; expect(operation.result?.outcome).toBe(status); expect(operation.result?.errorCode).toBe(code);
      expect(operation.result?.persistence).toBe("none"); expect(operation.result?.humanReview).toBe("unchanged");
      expect(result.result.ordinaryOperation?.receipt?.phase).toBe("finished"); expect(result.result.state).not.toBe("translated");
      expect(view.entries).toHaveLength(2); expect(digest(view.drafts.get(articleId()))).toBe(view.stagedPrivateHash());
      expect(view.drafts.get(articleId())!.payload).toEqual(view.loaded.load("apps/admin/lib/article-private-retry-draft.ts").articlePrivateRetrySourceSnapshot({
        article: view.originals.articles[0], sourceUpdatedAt: stamp, expectedEnglishUpdatedAt: null }));
      expect(view.articles).toEqual(view.afterRace()!.articles); expect([...view.english]).toEqual(view.afterRace()!.english);
      const before = view.entries.length; await view.action("fresh-after-known-refusal"); expect(view.entries).toHaveLength(before);
      expect([...view.operations.values()].every(value => value.result !== null)).toBe(true);
      expect(view.trace.filter(event => event.kind === "private-commit")).toHaveLength(1);
      const finish = view.rpcCalls.find(call => call.api === "finish_article_translation_item_retry")!;
      expect(finish.args.p_outcome.status).toBe("succeeded"); expect(digest(finish.args.p_english_payload)).toBe(operation.candidate.hash);
      view.record(`post-stage-${stageRace}`);
    });
  it("a one-microsecond RU change between latest GET and FINISH is confirmed terminal instead of remaining pending", async () => {
    const view = setup({ lateRace: "source" }); const result = await view.helper(); view.record("between-latest-get-finish");
    const operation = [...view.operations.values()][0]; expect(operation.result?.outcome).toBe("stale"); expect(operation.result?.errorCode).toBe("source_changed");
    expect(result.result.ordinaryOperation?.receipt?.phase).toBe("finished"); expect(result.result.state).not.toBe("translated");
    const latest = view.trace.findIndex(event => event.kind === "sdk-read" && event.table === "articles" && event.columns === "updated_at");
    const drift = view.trace.findIndex(event => event.kind === "post-stage-canonical-drift"); expect(latest).toBeGreaterThanOrEqual(0); expect(drift).toBeGreaterThan(latest);
    expect(view.entries).toHaveLength(2); expect(digest(view.drafts.get(articleId()))).toBe(view.stagedPrivateHash());
    expect(view.articles).toEqual(view.afterRace()!.articles); expect([...view.english]).toEqual(view.afterRace()!.english);
    expect([...view.operations.values()].every(value => value.result !== null)).toBe(true);
  });
  it.each([["source", "stale", "source_changed"], ["english", "conflict", "write_conflict"]])(
    "explicit stored-candidate recovery after %s drift and reload confirms refusal without a new model or body save", async (kind, status, code) => {
      const view = setup({ stageLost: true }); await view.action("A"); const operation = [...view.operations.values()][0];
      expect(operation.result).toBeNull(); view.drift(operation, kind); const body = digest(view.drafts.get(articleId())), expense = view.entries.length;
      const loaded = await view.readCandidate(operation);
      expect(loaded.canRecover).toBe(false); expect(loaded.blockReason).toBe(kind === "source" ? "source_changed" : "english_changed");
      const first = await view.recover(operation, "recover-known-refusal"), replay = await view.recover(operation, "recover-known-refusal-replay");
      expect(first.searchParams.get("errorCode")).toBe(code); expect(replay.searchParams.get("errorCode")).toBe(code);
      expect(operation.result?.outcome).toBe(status); expect(operation.result?.persistence).toBe("none"); expect(operation.result?.humanReview).toBe("unchanged");
      expect(view.entries).toHaveLength(expense); expect(digest(view.drafts.get(articleId()))).toBe(body); expect(view.trace.filter(event => event.kind === "private-commit")).toHaveLength(1);
      expect(view.articles).toEqual(view.afterRace()!.articles); expect([...view.english]).toEqual(view.afterRace()!.english);
      await view.action("fresh-after-recovery-refusal"); expect(view.entries).toHaveLength(expense); expect([...view.operations.values()].every(value => value.result !== null)).toBe(true);
      view.record(`recover-after-${kind}-drift`);
    });
  it("501 genuinely current English rows continue in a new one-item run after the full 500-item run", async () => {
    const view = setup({ size: 501, currentEnglishCount: 501 }); const first = await view.action("current-window"); expect(first.articleJob).toBeTruthy();
    const historical = structuredClone(view.jobs.get(first.articleJob!)!), before = digest(historical); expect(historical.observed).toHaveLength(500);
    const second = await view.action("current-remaining", first.articleJob!); view.record("full-current-run-rotates"); publicUnchanged(view);
    expect(second.articleJob).toBeTruthy(); expect(second.articleJob).not.toBe(first.articleJob); expect(view.jobs.size).toBe(2);
    expect(digest(view.jobs.get(first.articleJob!))).toBe(before); expect(view.jobs.get(second.articleJob!)!.observed).toHaveLength(1);
    expect(view.entries).toHaveLength(0); expect(view.drafts.size).toBe(0);
    expect([...view.jobs.values()].every(job => job.observed.length + [...view.items.values()].filter(item => item.jobId === job.id).length <= 500)).toBe(true);
  }, 30_000);
  it("499 current observations plus two missing translations use the last slot then a new run without mutating the full job", async () => {
    const view = setup({ size: 501, currentEnglishCount: 499 }); const first = await view.action("499-plus-first"); expect(first.articleJob).toBeTruthy();
    expect(view.entries.map(entry => entry.articleId)).toEqual([articleId(500), articleId(500)]); expect(view.drafts.size).toBe(1);
    const historical = digest(view.jobs.get(first.articleJob!)); const second = await view.action("last-slot-rotation", first.articleJob!); view.record("499-two-generation-slots"); publicUnchanged(view);
    expect(second.articleJob).not.toBe(first.articleJob); expect(digest(view.jobs.get(first.articleJob!))).toBe(historical);
    expect(view.entries.map(entry => entry.articleId)).toEqual([articleId(500), articleId(500), articleId(501), articleId(501)]); expect(view.drafts.size).toBe(2);
    expect(view.jobs.size).toBe(2); expect([...view.jobs.values()].every(job => job.observed.length + [...view.items.values()].filter(item => item.jobId === job.id).length <= 500)).toBe(true);
  }, 30_000);
});

describe("M07-T04 active ordinary response and durable stop accounting", () => {
  const remainingCursor = () => ({ articleScan: { version: 1, order: "id", upperId: articleId(2), afterId: null,
    pendingIds: [articleId(), articleId(2)], nextIndex: 1, lastWindow: true, exhausted: false } });
  function preserveIndependentPrivateDraft(view: ReturnType<typeof setup>) {
    view.drafts.set(articleId(99), { article_id: articleId(99), version: 7, payload: structuredClone(view.sourceSnapshot(view.articles[1])),
      english_payload: { mode: "save", payload: structuredClone(translated) }, rights: { permission: "Independent author's exact private consent" } });
    return structuredClone([...view.drafts]);
  }
  function originalAdmission(view: ReturnType<typeof setup>) {
    expect(view.operations.size).toBe(1); expect(view.items.size).toBe(1); expect(view.jobs.size).toBe(1);
    const operation = [...view.operations.values()][0];
    expect(operation.articleId).toBe(articleId());
    expect([...view.items.values()].map(item => item.articleId)).toEqual([articleId()]);
    expect(view.entries.map(entry => [entry.articleId, entry.pass])).toEqual([[articleId(), "translation"]]);
    return operation;
  }

  function recordStopState(view: ReturnType<typeof setup>, name: string, stopState: Row) {
    view.record(name);
    Object.assign(proofs.at(-1)!, { stopState, privateDraftsHash: digest([...view.drafts]),
      operations: [...view.operations.values()].map(operation => ({ operationId: operation.id, jobId: operation.jobId,
        itemId: operation.itemId, articleId: operation.articleId, calls: structuredClone(operation.calls), result: structuredClone(operation.result) })),
      jobs: [...view.jobs.values()].map(job => ({ jobId: job.id, version: job.version, status: job.status, cursor: structuredClone(job.cursor) })) });
  }
  it("known accepted response survives gate loss with one ACK, terminal original item and exact remaining cursor", async () => {
    const heldResponse = { entered: deferred(), release: deferred() }, view = setup({ size: 2, heldResponse });
    const privateBefore = preserveIndependentPrivateDraft(view), running = view.action("A");
    await heldResponse.entered.promise;
    const operation = originalAdmission(view), originalCallId = operation.calls[0].callId;
    expect(operation.result).toBeNull(); expect(operation.calls[0].responseReceivedAt).toBeNull();
    view.setGate(false); heldResponse.release.resolve();
    const result = await running, persisted = await view.readOrdinary(operation);
    expect(persisted.receipt).toMatchObject({ jobId: operation.jobId, itemId: operation.itemId, operationId: operation.id,
      articleId: articleId(), phase: "finished", itemStatus: "not-configured", attemptCount: 1, canExecute: false,
      result: { outcome: "not-configured", errorCode: "translation_not_configured", providerCalls: 1, persistence: "none",
        publication: "unchanged", humanReview: "unchanged", workingDraftVersion: null, workingDraftUpdatedAt: null } });
    expect(persisted.progress).toMatchObject({ operationId: operation.id, phase: "finished", providerCalls: 1, canDispatch: false });
    expect(persisted.progress.calls).toEqual([{ callId: originalCallId, provider: "cloudflare", model: view.entries[0].model,
      pass: "translation", dispatchRecordedAt: stamp, responseReceivedAt: savedStamp, httpStatus: null, requestId: null,
      responseId: "controlled-response-1", inputTokens: 41, outputTokens: 73 }]);
    const responses = view.rpcCalls.filter(call => call.api === "record_article_translation_item_retry_response");
    expect(responses).toHaveLength(1);
    expect(responses[0].args).toMatchObject({ p_job_id: operation.jobId, p_item_id: operation.itemId, p_operation_id: operation.id,
      p_metadata: { callId: originalCallId, responseId: "controlled-response-1", pass: "translation", inputTokens: 41, outputTokens: 73 } });
    const finishes = view.rpcCalls.filter(call => call.api === "finish_article_translation_item_retry");
    expect(finishes).toHaveLength(1);
    expect(finishes[0].args).toMatchObject({ p_job_id: operation.jobId, p_item_id: operation.itemId, p_operation_id: operation.id,
      p_outcome: { status: "not-configured", providerCalls: 1, errorCode: "translation_not_configured" } });
    expect(persisted.run).toMatchObject({ jobId: operation.jobId, status: "partial", totalItems: 1, succeededItems: 0,
      failedItems: 1, activeItems: 0, pendingItems: 0 });
    expect(persisted.run.resumeCursor).toEqual(remainingCursor());
    expect(view.jobs.get(operation.jobId)!.cursor).toEqual(remainingCursor());
    expect(result.articleJob).toBe(operation.jobId); expect(result.errorCode).toBe("translation_not_configured");
    originalAdmission(view); publicUnchanged(view); expect([...view.drafts]).toEqual(privateBefore);
    expect(view.rpcCalls.filter(call => call.api === "stage_article_translation_item_retry_candidate")).toHaveLength(0);
    const summary = new URL(result.url, "https://admin.fixture.invalid").searchParams.get("success");
    const operationBefore = digest(operation), jobBefore = digest(view.jobs.get(operation.jobId));
    expect((await view.action("continue-gate-off", operation.jobId)).errorCode).toBe("translation_not_configured");
    expect((await view.action("fresh-gate-off")).errorCode).toBe("translation_not_configured");
    expect(digest(operation)).toBe(operationBefore); expect(digest(view.jobs.get(operation.jobId))).toBe(jobBefore);
    originalAdmission(view); publicUnchanged(view); expect([...view.drafts]).toEqual(privateBefore);
    recordStopState(view, "t04-known-pending-response-gate-loss", { summary, receipt: persisted.receipt, progress: persisted.progress, run: persisted.run });
    expect(summary).toContain("попыток 1, запросов провайдера 1");
  });

  it.each([
    { name: "unknown provider response", options: { unknown: true }, acknowledged: false },
    { name: "lost response metadata ACK", options: { responseLost: true }, acknowledged: true },
  ])("$name during gate loss retains the same active admission and never issues new expense", async ({ name, options, acknowledged }) => {
    const heldResponse = { entered: deferred(), release: deferred() }, view = setup({ size: 2, ...options, heldResponse });
    const privateBefore = preserveIndependentPrivateDraft(view), running = view.action("A");
    await heldResponse.entered.promise;
    const operation = originalAdmission(view), originalCallId = operation.calls[0].callId;
    view.setGate(false); heldResponse.release.resolve();
    const result = await running, persisted = await view.readOrdinary(operation);
    expect(result.errorCode).toBe("translation_retry_pending"); expect(result.articleJob).toBe(operation.jobId);
    expect(persisted.receipt).toMatchObject({ jobId: operation.jobId, itemId: operation.itemId, operationId: operation.id,
      articleId: articleId(), phase: "running", itemStatus: "reviewing", attemptCount: 0, result: null, canExecute: false });
    expect(persisted.progress).toMatchObject({ operationId: operation.id, phase: "running", providerCalls: 1, canDispatch: false });
    expect(persisted.progress.calls).toHaveLength(1); expect(persisted.progress.calls[0].callId).toBe(originalCallId);
    expect(persisted.progress.calls[0].pass).toBe("translation");
    expect(persisted.progress.calls[0].responseReceivedAt).toBe(acknowledged ? savedStamp : null);
    expect(persisted.progress.calls[0].responseId).toBe(acknowledged ? "controlled-response-1" : null);
    expect(operation.result).toBeNull(); expect(operation.candidate).toBeNull();
    expect(persisted.run).toMatchObject({ jobId: operation.jobId, status: "reviewing", totalItems: 1, succeededItems: 0,
      failedItems: 0, activeItems: 1, pendingItems: 0 });
    expect(persisted.run.resumeCursor).toEqual(remainingCursor());
    expect(view.jobs.get(operation.jobId)!.cursor).toEqual(remainingCursor());
    expect(view.rpcCalls.filter(call => call.api === "finish_article_translation_item_retry" || call.api === "stage_article_translation_item_retry_candidate")).toHaveLength(0);
    const operationBefore = digest(operation), jobBefore = digest(view.jobs.get(operation.jobId));
    expect((await view.action("continue-gate-off", operation.jobId)).errorCode).toBe("translation_retry_pending");
    expect((await view.action("fresh-gate-off")).errorCode).toBe("translation_not_configured");
    expect(digest(operation)).toBe(operationBefore); expect(digest(view.jobs.get(operation.jobId))).toBe(jobBefore);
    originalAdmission(view); publicUnchanged(view); expect([...view.drafts]).toEqual(privateBefore);
    recordStopState(view, name === "unknown provider response" ? "t04-unknown-response-gate-loss" : "t04-lost-response-ack-gate-loss", { receipt: persisted.receipt, progress: persisted.progress, run: persisted.run });
  });
});
afterAll(() => {
  vi.unstubAllEnvs();
  const output = process.env.M07_ORDINARY_ADMISSION_EVIDENCE;
  if (!output) return;
  writeFileSync(output, JSON.stringify({ fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: sha(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()].sort((a, b) => a.module.localeCompare(b.module)), sourceUnchanged: [...graph.values()].every(row => sha(readFileSync(path.join(root, row.source))) === row.sha256),
    proofs, scope: { actual: ["Next server actions/FormData/redirect machinery", "ordinary helper/hash/strict snapshot/draft parser", "premium article/core validators/CF translation-review transports", "installed Supabase SDK custom fetch serialization"],
      controlled: ["staff Auth identity", "database admission/transaction ledger", "CF binding/output", "Next cache"], notVerified: ["Next HTTP/browser", "PostgreSQL/RLS", "managed Auth/PostgREST", "real provider acceptance/charges", "production"] } }, null, 2) + "\n", { flag: "wx" });
});
