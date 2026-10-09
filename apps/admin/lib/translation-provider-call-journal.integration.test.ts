import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const graph = new Map<string, Row>(), traces: Row[] = [];
const callIds = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
const privateProse = "PRIVATE original author \u2014 preserved text and rights";
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file), baseline = process.env.M07_PROVIDER_JOURNAL_BASELINE_ROOT;
    const primary = baseline ? path.join(baseline, file) : filename;
    const actual = baseline && !existsSync(primary) && process.env.M07_PROVIDER_JOURNAL_SUPPLEMENTAL_ROOT ? path.join(process.env.M07_PROVIDER_JOURNAL_SUPPLEMENTAL_ROOT, file) : primary;
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
const env = { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-translator", cloudflareTranslationReviewModel: "local-reviewer", openAiPremiumTranslationReview: true,
  openAiTranslationModel: "local-translator", openAiTranslationReviewModel: "local-reviewer", openAiTranslationReasoningEffort: "none", openAiTranslationReasoningMode: "standard",
  openAiTranslationReviewReasoningEffort: "none", openAiTranslationReviewReasoningMode: "standard", openAiDirectApiKey: "synthetic-key", openAiAutoTranslateArticles: true, publicSiteUrl: "https://site.invalid" };
const schema = { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } };
function publishedFixture(options: Row = {}) {
  const articleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", stamp = "2026-10-01T12:00:00.123456+00:00";
  const body = Array.from({ length: 260 }, (_value, index) => "authorword" + index).join(" ");
  const html = "<h2>Original heading</h2><p>" + body + "</p>", excerpt = "Original authored card description. ".repeat(4);
  const article: Row = { id: articleId, title: "Original article title", subtitle: "Original subtitle", excerpt, slug: "original-article",
    content_html: html, content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] },
    category_id: null, cover_external_url: "https://site.invalid/original-cover", cover_alt: "Original author cover description", legacy_path: null,
    seo_title: "Original title", seo_description: excerpt, seo_keywords: ["author"], canonical_url: "https://site.invalid/ru/original-article",
    og_title: "Original title", og_description: excerpt, allow_indexing: false, featured: false, show_on_homepage: false, pinned: true,
    sources: [{ text: "https://sources.invalid/original" }], bibliography: [{ text: "Original bibliography" }], status: "published", updated_at: stamp, deleted_at: null,
    categories: { slug: "culture" }, rights: { holder: privateProse, consent: "Original permission" } };
  const translated = { title: "Complete English article", subtitle: "Original subtitle", excerpt, content_html: html,
    cover_alt: "Original author cover description", seo_title: "Complete English article", seo_description: excerpt, seo_keywords: ["author"],
    og_title: "Complete English article", og_description: excerpt, sources: ["https://sources.invalid/original"], bibliography: ["Original bibliography"] };
  const events: Row[] = [], reads: Row[] = [], writes: Row[] = [];
  const run = vi.fn(async () => { events.push({ kind: "dispatch" }); return { id: "cf-private-response", response: JSON.stringify(translated), usage: { input_tokens: 20, output_tokens: 10 } }; });
  const loaded = modules({ "apps/admin/lib/env": { adminEnv: env }, "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run } } }) } });
  const sourceHash = loaded.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash({ title: article.title, subtitle: article.subtitle, excerpt: article.excerpt, slug: article.slug,
    contentHtml: html, contentJson: article.content_json, coverAlt: article.cover_alt, sources: article.sources, bibliography: article.bibliography,
    seoTitle: article.seo_title, seoDescription: excerpt, seoKeywords: article.seo_keywords, ogTitle: article.og_title, ogDescription: excerpt });
  const originalArticle = structuredClone(article);
  const english = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", article_id: articleId, locale: "en", title: privateProse, status: "published", updated_at: stamp, deleted_at: null, source_content_hash: hash("old source"),
    content_json: loaded.load("apps/admin/lib/article-translation-machine-ownership.ts").premiumArticleMachineContentJson({ sourceHash: hash("old source"), model: "old-model", reviewerModel: null, translatorRequestId: null, reviewerRequestId: null, generatedAt: stamp }) };
  const originalEnglish = structuredClone(english);
  let journalIndex = 0;
  const beforeDispatch = vi.fn(async (metadata: Row) => { events.push({ kind: "before", metadata }); if (options.beforeThrows) throw options.beforeThrows; return callIds[journalIndex++]; });
  const responseReceived = vi.fn(async (metadata: Row) => { events.push({ kind: "response", metadata }); if (options.responseThrows) throw options.responseThrows; });
  const persist = vi.fn(async (candidate: Row) => { events.push({ kind: "persist" }); return { confirmed: true, draftVersion: 7 }; });
  const budget = loaded.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
  const supabase = { from(table: string) {
    const filters: Row[] = [], query: Row = { select: () => query, eq: (key: string, value: unknown) => { filters.push({ key, value }); return query; }, is: (key: string, value: unknown) => { filters.push({ key, value }); return query; },
      insert: (payload: Row) => { writes.push({ table, payload }); throw new Error("Unexpected canonical/audit write"); },
      update: (payload: Row) => { writes.push({ table, payload }); throw new Error("Unexpected canonical write"); },
      maybeSingle: async () => { reads.push({ table, filters }); return { data: table === "articles" ? structuredClone(article) : table === "article_translations" ? structuredClone(english) : null, error: null }; } };
    return query;
  } };
  async function translate() {
    let result: Row | undefined, failure: unknown;
    try { result = await loaded.load("apps/admin/lib/auto-translate-published-article-premium.ts").ensurePublishedArticlePremiumEnglish({ supabase, articleId, actorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", runtimeApproved: true, operationBudget: budget,
      expectedSourceHash: sourceHash, expectedSourceUpdatedAt: stamp, privateRetry: { expectedEnglishUpdatedAt: stamp, admit: async () => true, persist, ...(options.noHook ? {} : { providerJournal: { beforeDispatch, responseReceived } }) } }); }
    catch (error) { failure = error; }
    traces.push({ kind: "actual-private-published-transport", options, events, reads, writes, originalArticle, originalEnglish, article, english, result, providerCalls: run.mock.calls.length, persisted: persist.mock.calls.length, budget: budget.snapshot(), failure: failure instanceof Error ? { name: failure.name, message: failure.message } : failure });
    return { result, failure };
  }
  return { translate, run, beforeDispatch, responseReceived, persist, article, english, originalArticle, originalEnglish, writes };
}
function fixture(provider: "openai" | "cloudflare", options: Row = {}) {
  const events: Row[] = [], headers: Row[] = [], bodies: Row[] = [];
  let dispatched = 0, clock = 0, journalIndex = 0;
  const loaded = modules({ "apps/admin/lib/env": { adminEnv: env }, "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: {} }) } });
  const budget = loaded.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: options.maxCalls ?? 4, deadlineMs: 100, now: () => clock });
  const journal = {
    beforeDispatch: vi.fn(async (metadata: Row) => {
      const index = journalIndex++; events.push({ kind: "before", metadata: structuredClone(metadata) });
      if (options.beforeThrows) throw options.beforeThrows;
      if (options.expireBefore) clock = 100;
      if (options.stopBefore) budget.stop();
      return Object.hasOwn(options, "callId") ? options.callId : callIds[index];
    }),
    responseReceived: vi.fn(async (metadata: Row) => {
      events.push({ kind: "response", metadata: structuredClone(metadata) });
      if (options.responseThrows) throw options.responseThrows;
    }),
  };
  const valueAt = (index: number) => options.values?.[index] ?? { text: "Complete English" };
  const run = vi.fn(async (model: string, request: Row) => {
    const index = dispatched++; events.push({ kind: "dispatch", model }); bodies.push(request);
    if (options.transportThrows) throw options.transportThrows;
    return { id: "cf-response-" + index, response: JSON.stringify(valueAt(index)), usage: { prompt_tokens: 11 + index, completion_tokens: 7 + index } };
  });
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const index = dispatched++; events.push({ kind: "dispatch", model: JSON.parse(String(init.body)).model });
    bodies.push(JSON.parse(String(init.body))); headers.push(init.headers as Row);
    if (options.transportThrows) throw options.transportThrows;
    const response = new Response(options.badJson ? "not-json" : options.payloadNull ? "null" : JSON.stringify({ id: "oa-response-" + index, output_text: JSON.stringify(valueAt(index)), usage: { input_tokens: 11 + index, output_tokens: 7 + index }, ...(options.status ? { error: { message: privateProse } } : {}) }), {
      status: options.status ?? 200, headers: options.noRequestHeader ? {} : { "x-request-id": "oa-request-" + index },
    });
    if (options.bodyReadThrows) response.json = async () => { throw options.bodyReadThrows; };
    return response;
  });
  const validate = (value: Row) => { events.push({ kind: "validate" }); if (value?.text !== "Complete English") throw new Error("invalid editorial draft"); return value; };
  async function translate() {
    const input = { source: { text: privateProse }, schema, schemaName: "journal_fixture", validate, provider, apiKey: "synthetic-key", model: "local-translator", reviewerModel: "local-reviewer", review: options.review !== false,
      aiBinding: provider === "cloudflare" ? { run } : undefined, fetchImpl: fetchImpl as typeof fetch, operationBudget: budget,
      ...(options.noHook ? {} : { providerJournal: options.journal ?? journal }) };
    let result: Row | undefined, failure: unknown;
    try { result = await loaded.load("apps/admin/lib/premium-english-translation.ts").premiumTranslateToEnglish(input); }
    catch (error) { failure = error; }
    traces.push({ provider, options, events, bodies, budget: budget.snapshot(), beforeCalls: journal.beforeDispatch.mock.calls, responseCalls: journal.responseReceived.mock.calls, result, failure: failure instanceof Error ? { name: failure.name, message: failure.message } : failure });
    return { result, failure };
  }
  return { translate, journal, budget, run, fetchImpl, events, headers, bodies };
}

describe("M07 optional journal guards actual provider dispatch and metadata response boundaries", () => {
  it.each(["openai", "cloudflare"] as const)("%s awaits per-pass ACK before dispatch and response metadata ACK before editorial validation", async provider => {
    const view = fixture(provider); const { result, failure } = await view.translate(); expect(failure).toBeUndefined(); expect(result?.value.text).toBe("Complete English");
    expect(view.events.map(row => row.kind)).toEqual(["before", "dispatch", "response", "validate", "before", "dispatch", "response", "validate"]);
    expect(view.journal.beforeDispatch.mock.calls.map(call => call[0].pass)).toEqual(["translation", "review"]);
    const metadata = view.journal.responseReceived.mock.calls.map(call => call[0]); expect(metadata).toHaveLength(2);
    for (let i = 0; i < metadata.length; i++) expect(metadata[i]).toEqual({ callId: callIds[i], provider, model: i ? "local-reviewer" : "local-translator", pass: i ? "review" : "translation", httpStatus: provider === "openai" ? 200 : null,
      requestId: provider === "openai" ? "oa-request-" + i : null, responseId: (provider === "openai" ? "oa-response-" : "cf-response-") + i, inputTokens: 11 + i, outputTokens: 7 + i });
    expect(JSON.stringify(view.journal.beforeDispatch.mock.calls)).not.toContain(privateProse); expect(JSON.stringify(metadata)).not.toContain(privateProse);
    expect(view.budget.snapshot().providerCalls).toBe(2);
  });
  it.each(["openai", "cloudflare"] as const)("%s journals translation repair review and final repair separately", async provider => {
    const view = fixture(provider, { values: [{ wrong: true }, { text: "Complete English" }, { text: "not valid" }, { text: "Complete English" }] });
    const { result, failure } = await view.translate(); expect(failure).toBeUndefined(); expect(result?.value.text).toBe("Complete English");
    expect(view.journal.beforeDispatch.mock.calls.map(call => call[0].pass)).toEqual(["translation", "repair", "review", "repair"]);
    expect(view.journal.responseReceived.mock.calls.map(call => call[0].callId)).toEqual(callIds); expect(view.budget.snapshot().providerCalls).toBe(4);
  });
  it.each(["openai", "cloudflare"] as const)("%s cannot dispatch after journal reservation refusal", async provider => {
    const marker = new Error("journal reservation refused"), view = fixture(provider, { beforeThrows: marker }); const { failure } = await view.translate();
    expect(failure).toBe(marker); expect(view.run).not.toHaveBeenCalled(); expect(view.fetchImpl).not.toHaveBeenCalled(); expect(view.journal.responseReceived).not.toHaveBeenCalled();
  });
  it.each([null, undefined, "", "not-uuid", 123, {}, []])("malformed journal call ID %s never becomes a transport invocation", async callId => {
    const view = fixture("openai", { callId }); const { failure } = await view.translate(); expect(failure).toBeInstanceOf(Error);
    expect(view.fetchImpl).not.toHaveBeenCalled(); expect(view.journal.responseReceived).not.toHaveBeenCalled();
  });
  it.each(["openai", "cloudflare"] as const)("%s response ACK failure prevents review repair and successful result", async provider => {
    const marker = new Error("journal response ACK unavailable"), view = fixture(provider, { responseThrows: marker, values: [{ wrong: true }] }); const { result, failure } = await view.translate();
    expect(failure).toBe(marker); expect(result).toBeUndefined(); expect(view.journal.beforeDispatch).toHaveBeenCalledTimes(1); expect(view.journal.responseReceived).toHaveBeenCalledTimes(1);
    expect(view.events.filter(row => row.kind === "dispatch")).toHaveLength(1); expect(view.events.some(row => row.kind === "validate")).toBe(false);
  });
  it.each(["openai", "cloudflare"] as const)("%s transport rejection remains unknown without fabricated response metadata", async provider => {
    const view = fixture(provider, { transportThrows: new Error("provider unknown rejection 4006") }); const { result, failure } = await view.translate(); expect(result).toBeUndefined(); expect(failure).toBeInstanceOf(Error);
    expect(view.journal.beforeDispatch).toHaveBeenCalledTimes(1); expect(view.journal.responseReceived).not.toHaveBeenCalled(); expect(view.events.filter(row => row.kind === "dispatch")).toHaveLength(1);
  });
  it.each(["openai", "cloudflare"] as const)("%s deadline expiry during awaited journal ACK blocks reserved dispatch", async provider => {
    const view = fixture(provider, { expireBefore: true }); const { failure } = await view.translate(); expect(failure).toMatchObject({ reason: "deadline" });
    expect(view.run).not.toHaveBeenCalled(); expect(view.fetchImpl).not.toHaveBeenCalled(); expect(view.budget.snapshot().providerCalls).toBe(1);
  });
  it.each(["openai", "cloudflare"] as const)("%s stop during awaited journal ACK blocks reserved dispatch", async provider => {
    const view = fixture(provider, { stopBefore: true }); const { failure } = await view.translate(); expect(failure).toMatchObject({ reason: "stopped" }); expect(view.run).not.toHaveBeenCalled(); expect(view.fetchImpl).not.toHaveBeenCalled();
  });
  it("final allowed call at provider cap remains dispatchable after ACK", async () => {
    const view = fixture("openai", { review: false, maxCalls: 1 }); const { result, failure } = await view.translate(); expect(failure).toBeUndefined(); expect(result?.value.text).toBe("Complete English"); expect(view.fetchImpl).toHaveBeenCalledTimes(1); expect(view.journal.responseReceived).toHaveBeenCalledTimes(1);
  });
  it("HTTP error ACK records status and IDs without provider error prose or a subsequent pass", async () => {
    const view = fixture("openai", { status: 429 }); const { result, failure } = await view.translate(); expect(result).toBeUndefined(); expect(failure).toBeInstanceOf(Error);
    expect(view.journal.responseReceived).toHaveBeenCalledTimes(1); expect(view.journal.responseReceived.mock.calls[0][0]).toMatchObject({ httpStatus: 429, requestId: "oa-request-0", responseId: "oa-response-0" });
    expect(JSON.stringify(view.journal.responseReceived.mock.calls)).not.toContain(privateProse); expect(view.fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("OpenAI payload ID stays a response identity when x-request-id header is absent", async () => {
    const view = fixture("openai", { noRequestHeader: true, review: false }); const { result, failure } = await view.translate(); expect(failure).toBeUndefined(); expect(result?.translatorRequestId).toBe("oa-response-0");
    expect(view.journal.responseReceived.mock.calls[0][0]).toMatchObject({ requestId: null, responseId: "oa-response-0" });
  });
  it.each(["invalid-json", "read-rejected"])("OpenAI %s body remains unknown without response ACK repair or editorial validation", async failureMode => {
    const marker = new Error("controlled response body read failed");
    const view = fixture("openai", failureMode === "invalid-json" ? { badJson: true } : { bodyReadThrows: marker });
    const { result, failure } = await view.translate(); expect(result).toBeUndefined(); expect(failure).toBeInstanceOf(Error);
    if (failureMode === "read-rejected") expect(failure).toBe(marker);
    expect(view.journal.beforeDispatch).toHaveBeenCalledTimes(1); expect(view.journal.responseReceived).not.toHaveBeenCalled();
    expect(view.fetchImpl).toHaveBeenCalledTimes(1); expect(view.events.some(row => row.kind === "validate")).toBe(false);
  });
  it("OpenAI fulfilled JSON null records known empty envelope metadata before output validation fails", async () => {
    const view = fixture("openai", { payloadNull: true }); const { result, failure } = await view.translate();
    expect(result).toBeUndefined(); expect(failure).toBeInstanceOf(Error); expect(view.fetchImpl).toHaveBeenCalledTimes(1);
    expect(view.journal.responseReceived).toHaveBeenCalledTimes(1);
    expect(view.journal.responseReceived.mock.calls[0][0]).toEqual({ callId: callIds[0], provider: "openai", model: "local-translator", pass: "translation", httpStatus: 200, requestId: "oa-request-0", responseId: null, inputTokens: null, outputTokens: null });
    expect(view.events.some(row => row.kind === "validate")).toBe(false);
  });
  it("OpenAI without hook preserves legacy invalid JSON output error", async () => {
    const view = fixture("openai", { noHook: true, badJson: true }); const { result, failure } = await view.translate();
    expect(result).toBeUndefined(); expect(failure).toMatchObject({ message: "OpenAI returned no translation output" });
    expect(view.fetchImpl).toHaveBeenCalledTimes(1); expect(view.journal.beforeDispatch).not.toHaveBeenCalled(); expect(view.journal.responseReceived).not.toHaveBeenCalled();
  });
  it.each(["openai", "cloudflare"] as const)("%s without hook preserves legacy result request IDs and provider count", async provider => {
    const view = fixture(provider, { noHook: true }); const { result, failure } = await view.translate(); expect(failure).toBeUndefined();
    expect(result?.translatorRequestId).toBe(provider === "openai" ? "oa-request-0" : "cf-response-0"); expect(result?.reviewerRequestId).toBe(provider === "openai" ? "oa-request-1" : "cf-response-1");
    expect(view.journal.beforeDispatch).not.toHaveBeenCalled(); expect(view.journal.responseReceived).not.toHaveBeenCalled(); expect(view.budget.snapshot().providerCalls).toBe(2);
  });
  it("actual private published helper propagates optional journal through article translator to both provider passes before private persistence", async () => {
    const view = publishedFixture(); const { result, failure } = await view.translate(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "translated", publication: "draft", workingDraftVersion: 7 });
    expect(view.beforeDispatch.mock.calls.map(call => call[0].pass)).toEqual(["translation", "review"]); expect(view.responseReceived).toHaveBeenCalledTimes(2); expect(view.run).toHaveBeenCalledTimes(2); expect(view.persist).toHaveBeenCalledTimes(1);
    expect(view.persist.mock.calls[0][0].englishPayload).toMatchObject({ status: "draft", reviewed_at: null, approved_at: null, published_at: null });
    expect(view.article).toEqual(view.originalArticle); expect(view.english).toEqual(view.originalEnglish); expect(view.writes).toEqual([]);
  });
  it("actual private published helper cannot generate or persist when dispatch ACK is refused", async () => {
    const marker = new Error("private dispatch ACK refused"), view = publishedFixture({ beforeThrows: marker }); const { failure } = await view.translate(); expect(failure).toBe(marker);
    expect(view.run).not.toHaveBeenCalled(); expect(view.persist).not.toHaveBeenCalled(); expect(view.writes).toEqual([]);
  });
  it("actual private published helper cannot run reviewer or persist after response ACK failure", async () => {
    const marker = new Error("private metadata ACK refused"), view = publishedFixture({ responseThrows: marker }); const { failure } = await view.translate(); expect(failure).toBe(marker);
    expect(view.run).toHaveBeenCalledTimes(1); expect(view.persist).not.toHaveBeenCalled(); expect(view.article).toEqual(view.originalArticle); expect(view.english).toEqual(view.originalEnglish); expect(view.writes).toEqual([]);
  });
  it("actual private published helper without hook keeps legacy two-pass private behavior", async () => {
    const view = publishedFixture({ noHook: true }); const { result, failure } = await view.translate(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "translated", publication: "draft" });
    expect(view.beforeDispatch).not.toHaveBeenCalled(); expect(view.responseReceived).not.toHaveBeenCalled(); expect(view.run).toHaveBeenCalledTimes(2); expect(view.persist).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]);
  });
});

afterAll(() => {
  if (process.env.M07_PROVIDER_JOURNAL_EVIDENCE) writeFileSync(process.env.M07_PROVIDER_JOURNAL_EVIDENCE, JSON.stringify({
    fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...graph.values()], traces,
    scope: "Actual captured/current existing premium translation exports, all passes, installed Response and actual budget; controlled fetch/AI/journal, no external calls",
    limitations: ["Transport reservation count does not prove provider acceptance", "No managed Auth/DB/PostgREST/provider/production"],
  }, null, 2) + "\n", { flag: "wx" });
});
