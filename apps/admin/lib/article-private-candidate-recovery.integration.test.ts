import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const graph = new Map<string, Row>(), traces: Row[] = [];
const articleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stamp = "2026-10-08T03:00:00.123456+00:00";
const oldStamp = "2026-10-07T03:00:00.654321+00:00";
const authored = "Author original \u2014 exact rights and consent";
function modules(mocks: Row) {
  const cache = new Map<string, Row>();
  function load(file: string): Row {
    if (cache.has(file)) return cache.get(file)!;
    const filename = path.join(root, file);
    const actual = process.env.M07_CANDIDATE_BASELINE_ROOT ? path.join(process.env.M07_CANDIDATE_BASELINE_ROOT, file) : filename;
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
  const body = Array.from({ length: 260 }, (_v, i) => "originalword" + i).join(" ");
  const mediaId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const image = `<img src="https://media.invalid/original.jpg" data-media-id="${mediaId}" alt="Original photographer" data-license="CC BY" data-credit="Original photographer" data-source="https://source.invalid/image">`;
  const html = "<h2>Original heading</h2><p>" + body + "</p>" + image;
  const excerpt = "Original authored description with faithful editorial context. ".repeat(3);
  const article: Row = { id: articleId, title: "Ручной русский оригинал", subtitle: "Original subtitle", excerpt, slug: "original-article", content_html: html,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored }] }], rights: { author: authored, consent: "Exact original permission" } },
    category_id: null, cover_external_url: "https://media.invalid/original.jpg", cover_alt: "Original photographer", legacy_path: "/original-article",
    seo_title: "Original authored title", seo_description: excerpt, seo_keywords: ["original author"], canonical_url: "https://site.invalid/ru/original-article",
    og_title: "Original authored title", og_description: excerpt, allow_indexing: false, featured: true, show_on_homepage: false, pinned: true,
    sources: [{ text: "https://sources.invalid/original" }], bibliography: [{ text: "Original bibliography" }], status: "published", updated_at: stamp, deleted_at: null,
    categories: { slug: "culture" }, rights: { holder: authored, consent: "Original permission" } };
  const translated = { title: "Complete English article", subtitle: "Original subtitle", excerpt, content_html: options.changedProtectedUrl ? html.replace("media.invalid/original.jpg", "media.invalid/replaced.jpg") : html,
    cover_alt: "Original photographer", seo_title: "Complete English article", seo_description: excerpt, seo_keywords: ["original author"], og_title: "Complete English article", og_description: excerpt,
    sources: ["https://sources.invalid/original"], bibliography: ["Original bibliography"] };
  const events: Row[] = [], writes: Row[] = [];
  let clock = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  const runModel = vi.fn(async () => {
    const index = runModel.mock.calls.length;
    events.push({ kind: "model", index });
    return { id: "cf-response-" + index, response: JSON.stringify(translated), usage: { input_tokens: 20, output_tokens: 10 } };
  });
  const loaded = modules({ "apps/admin/lib/env": { adminEnv: { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-translator", cloudflareTranslationReviewModel: "local-reviewer",
    openAiPremiumTranslationReview: true, openAiAutoTranslateArticles: true, publicSiteUrl: "https://site.invalid" } },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: runModel } } }) } });
  const rowHash = () => loaded.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash({ title: article.title, subtitle: article.subtitle, excerpt, slug: article.slug,
    contentHtml: article.content_html, contentJson: article.content_json, coverAlt: article.cover_alt, sources: article.sources, bibliography: article.bibliography,
    seoTitle: article.seo_title, seoDescription: excerpt, seoKeywords: article.seo_keywords, ogTitle: article.og_title, ogDescription: excerpt });
  const english: Row = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", article_id: articleId, locale: "en", title: authored, content_html: "<p>" + authored + "</p>",
    slug: "original-english", canonical_url: "https://site.invalid/original-english", status: "published", updated_at: oldStamp, deleted_at: null,
    source_content_hash: hash("old source"), source_article_updated_at: oldStamp,
    content_json: options.manualEnglish ? { type: "doc", content: [] } : loaded.load("apps/admin/lib/article-translation-machine-ownership.ts").premiumArticleMachineContentJson({ sourceHash: hash("old source"), model: "old-model", reviewerModel: null, translatorRequestId: null, reviewerRequestId: null, generatedAt: oldStamp }),
    reviewed_at: oldStamp, approved_at: oldStamp, published_at: oldStamp, rights: { holder: authored } };
  const originalArticle = structuredClone(article), originalEnglish = structuredClone(english);
  let stored: Row | null = null;
  const latestFault = { code: "57014", message: "Controlled latest source read unavailable" };
  const latestReject = new Error("Controlled latest source read rejection");
  const client = { from(table: string) {
    let columns = ""; const filters: Row[] = [];
    const query: Row = { select(value: string) { columns = value; return query; }, eq(key: string, value: unknown) { filters.push({ key, value }); return query; }, is(key: string, value: unknown) { filters.push({ key, value }); return query; },
      insert(payload: Row) { writes.push({ table, payload }); throw new Error("Unexpected public/audit write"); }, update(payload: Row) { writes.push({ table, payload }); throw new Error("Unexpected public write"); },
      async maybeSingle() {
        const phase = table === "articles" ? columns === "updated_at" ? "latest" : "article" : table === "article_translations" ? "english" : "draft";
        events.push({ kind: "read", phase, table, columns, filters: structuredClone(filters) });
        if (phase === "latest") {
          if (options.latest === "error") return { data: null, error: latestFault };
          if (options.latest === "contradictory") return { data: { updated_at: article.updated_at }, error: latestFault };
          if (options.latest === "missing-error") return { data: null };
          if (options.latest === "reject") throw latestReject;
          if (options.latest === "signal") throw options.signal;
          if (options.latest === "malformed") return { data: { updated_at: "invalid-revision" }, error: null };
          if (options.latest === "changed") { article.updated_at = "2026-10-08T03:00:00.123457+00:00"; article.title = "New manual Russian title"; }
          if (options.latest === "absent") return { data: null, error: null };
          return { data: { updated_at: article.updated_at }, error: null };
        }
        if (phase === "draft") return { data: options.authorDraft ? { article_id: articleId, version: 3 } : null, error: null };
        return { data: structuredClone(phase === "article" ? article : english), error: null };
      } };
    return query;
  } };
  const providerJournal = { beforeDispatch: vi.fn(async (metadata: Row) => { events.push({ kind: "dispatch-ack", metadata }); return ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"][runModel.mock.calls.length]; }),
    responseReceived: vi.fn(async (metadata: Row) => { events.push({ kind: "response-ack", metadata }); }) };
  const stageCandidate = vi.fn(async (candidate: Row) => {
    events.push({ kind: "stage", candidate: structuredClone(candidate) });
    if (options.stageRollback) throw options.stageFault;
    stored = structuredClone(candidate);
    clock += 300;
    if (options.stageFault) throw options.stageFault;
  });
  const persist = vi.fn(async (candidate: Row) => {
    events.push({ kind: "persist", candidate: structuredClone(candidate) });
    if (options.persistFault) throw options.persistFault;
    return { confirmed: true, draftVersion: 7 };
  });
  const admit = vi.fn(async () => options.admission !== false);
  const budget = loaded.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000, now: () => clock });
  async function run() {
    let result: Row | undefined, failure: unknown;
    try { result = await loaded.load("apps/admin/lib/auto-translate-published-article-premium.ts").ensurePublishedArticlePremiumEnglish({ supabase: client,
      actorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", articleId, runtimeApproved: true, operationBudget: budget, expectedSourceHash: rowHash(), expectedSourceUpdatedAt: stamp,
      privateRetry: { expectedEnglishUpdatedAt: oldStamp, providerJournal, admit, persist, ...(options.noStage ? {} : { stageCandidate }) } }); }
    catch (error) { failure = error; }
    traces.push({ options, events, writes, originalArticle, originalEnglish, article, english, stored, result, providerCalls: runModel.mock.calls.length, budget: budget.snapshot(),
      failure: failure instanceof Error ? { name: failure.name, message: failure.message, digest: (failure as Row).digest } : failure });
    return { result, failure };
  }
  return { run, loaded, article, english, originalArticle, originalEnglish, runModel, events, writes, providerJournal, stageCandidate, persist, admit, budget,
    stored: () => stored, rowHash, image, latestFault, latestReject };
}
function publicPreserved(view: ReturnType<typeof setup>) {
  expect(view.writes).toEqual([]); expect(view.english).toEqual(view.originalEnglish); expect(view.article).toEqual(view.originalArticle);
}
function noExpense(view: ReturnType<typeof setup>) {
  expect(view.runModel).not.toHaveBeenCalled(); expect(view.stageCandidate).not.toHaveBeenCalled(); expect(view.persist).not.toHaveBeenCalled();
  expect(view.budget.snapshot()).toMatchObject({ attempts: 0, providerCalls: 0 }); publicPreserved(view);
}
afterEach(() => vi.restoreAllMocks());

describe("M07 actual validated private translation candidate survives post-model loss", () => {
  it("stages the complete strict EN envelope before final RU read and reuses its exact object and frozen duration", async () => {
    const view = setup(); const { result, failure } = await view.run(); expect(failure).toBeUndefined();
    expect(result).toMatchObject({ state: "translated", publication: "draft", workingDraftVersion: 7 });
    expect(view.runModel).toHaveBeenCalledTimes(2); expect(view.stageCandidate).toHaveBeenCalledTimes(1); expect(view.persist).toHaveBeenCalledTimes(1);
    const candidate = view.stageCandidate.mock.calls[0][0]; expect(view.persist.mock.calls[0][0]).toBe(candidate); expect(candidate.durationMs).toBe(0);
    expect(view.events.map(event => event.kind === "read" ? "read-" + event.phase : event.kind)).toEqual(["read-article", "read-english", "read-draft", "dispatch-ack", "model", "response-ack", "dispatch-ack", "model", "response-ack", "stage", "read-latest", "persist"]);
    expect(candidate.englishPayload).toMatchObject({ status: "draft", slug: "original-english", canonical_url: "https://site.invalid/original-english", source_content_hash: view.rowHash(),
      reviewed_at: null, approved_at: null, published_at: null, deleted_at: null, sources: [{ text: "https://sources.invalid/original" }], bibliography: [{ text: "Original bibliography" }] });
    expect(candidate.englishPayload.content_html).toContain("data-license=\"CC BY\""); expect(candidate.englishPayload.content_html).toContain("https://media.invalid/original.jpg");
    expect(candidate.englishPayload.content_json.__probperaPremiumTranslation).toMatchObject({ sourceHash: view.rowHash(), translatorRequestId: "cf-response-1", reviewerRequestId: "cf-response-2" });
    expect(candidate.englishPayload).not.toHaveProperty("reviewed_by"); expect(candidate.englishPayload).not.toHaveProperty("approved_by");
    expect(view.loaded.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts").articleWorkingDraftEnglishEnvelope(candidate.englishPayload)).toEqual({ mode: "save", payload: candidate.englishPayload });
    expect(view.stored()).toEqual(candidate); publicPreserved(view);
  });
  it("unknown FINISH after validation preserves the complete candidate without public write or another provider call", async () => {
    const marker = new Error("Controlled FINISH ACK lost"), view = setup({ persistFault: marker }); const { result, failure } = await view.run();
    expect(failure).toBe(marker); expect(result).toBeUndefined(); expect(view.runModel).toHaveBeenCalledTimes(2);
    expect(view.stored()?.englishPayload.content_html).toContain("originalword259"); expect(view.persist.mock.calls[0][0]).toBe(view.stageCandidate.mock.calls[0][0]); publicPreserved(view);
  });
  it("committed stage with lost ACK retains body and prevents final read and FINISH", async () => {
    const marker = new Error("Controlled stage ACK lost"), view = setup({ stageFault: marker }); const { result, failure } = await view.run();
    expect(failure).toBe(marker); expect(result).toBeUndefined(); expect(view.stored()?.englishPayload.status).toBe("draft"); expect(view.runModel).toHaveBeenCalledTimes(2);
    expect(view.persist).not.toHaveBeenCalled(); expect(view.events.some(event => event.phase === "latest")).toBe(false); publicPreserved(view);
  });
  it("failed or rolled-back stage stops before final read and cannot report a saved draft", async () => {
    const marker = new Error("Controlled stage rollback"), view = setup({ stageFault: marker, stageRollback: true }); const { result, failure } = await view.run();
    expect(failure).toBe(marker); expect(result).toBeUndefined(); expect(view.stored()).toBeNull(); expect(view.runModel).toHaveBeenCalledTimes(2);
    expect(view.persist).not.toHaveBeenCalled(); expect(view.events.some(event => event.phase === "latest")).toBe(false); publicPreserved(view);
  });
  it.each(["error", "contradictory", "missing-error", "reject", "malformed"])("post-stage source %s remains unknown with candidate retained and no FINISH", async latest => {
    const view = setup({ latest }); const { result, failure } = await view.run(); expect(result).toBeUndefined();
    if (latest === "error" || latest === "contradictory") expect(failure).toBe(view.latestFault); else if (latest === "reject") expect(failure).toBe(view.latestReject); else expect(failure).toBeInstanceOf(Error);
    expect(view.stored()?.englishPayload.content_html).toContain("originalword259"); expect(view.runModel).toHaveBeenCalledTimes(2); expect(view.persist).not.toHaveBeenCalled(); publicPreserved(view);
  });
  it("a confirmed different microsecond revision is a known conflict while candidate and concurrent authored RU remain private", async () => {
    const view = setup({ latest: "changed" }); const { result, failure } = await view.run(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "conflict" });
    expect(view.stored()?.englishPayload.status).toBe("draft"); expect(view.persist).not.toHaveBeenCalled(); expect(view.article.title).toBe("New manual Russian title");
    expect(view.english).toEqual(view.originalEnglish); expect(view.writes).toEqual([]); expect(view.runModel).toHaveBeenCalledTimes(2);
  });
  it("confirmed deleted source leaves retained private candidate and known conflict", async () => {
    const view = setup({ latest: "absent" }); const { result, failure } = await view.run(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "conflict" });
    expect(view.stored()?.englishPayload.status).toBe("draft"); expect(view.persist).not.toHaveBeenCalled(); publicPreserved(view);
  });
  it.each(["stage", "latest", "persist"])("native Next redirect thrown at %s keeps its exact signal and staged data", async boundary => {
    const signal = nativeRequire("next/dist/client/components/redirect.js").getRedirectError("/admin/translations", "replace", 303);
    const view = setup(boundary === "stage" ? { stageFault: signal } : boundary === "latest" ? { latest: "signal", signal } : { persistFault: signal });
    const { result, failure } = await view.run(); expect(result).toBeUndefined(); expect(failure).toBe(signal); expect(view.stored()?.englishPayload.status).toBe("draft"); publicPreserved(view);
  });
  it.each(["manualEnglish", "authorDraft", "admission"])("%s blocks staging and actual transports before any provider expense", async blocker => {
    const view = setup({ [blocker]: blocker === "admission" ? false : true }); const { failure } = await view.run(); expect(failure).toBeUndefined(); noExpense(view);
  });
  it("real protected-media validation rejects modified rights URL before stage or persistence", async () => {
    const view = setup({ changedProtectedUrl: true }); const { result, failure } = await view.run(); expect(result).toBeUndefined(); expect(failure).toMatchObject({ message: expect.stringContaining("protected") });
    expect(view.runModel).toHaveBeenCalledTimes(2); expect(view.stageCandidate).not.toHaveBeenCalled(); expect(view.persist).not.toHaveBeenCalled(); publicPreserved(view);
  });
  it("without optional stage hook preserves existing private ordering and two-pass result", async () => {
    const view = setup({ noStage: true }); const { result, failure } = await view.run(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "translated", publication: "draft" });
    expect(view.stageCandidate).not.toHaveBeenCalled(); expect(view.runModel).toHaveBeenCalledTimes(2); expect(view.persist).toHaveBeenCalledTimes(1); expect(view.stored()).toBeNull(); publicPreserved(view);
  });
  it("without optional stage hook preserves existing source-read-error conflict behavior", async () => {
    const view = setup({ noStage: true, latest: "error" }); const { result, failure } = await view.run(); expect(failure).toBeUndefined(); expect(result).toMatchObject({ state: "conflict" });
    expect(view.stageCandidate).not.toHaveBeenCalled(); expect(view.persist).not.toHaveBeenCalled(); expect(view.runModel).toHaveBeenCalledTimes(2); publicPreserved(view);
  });
});

afterAll(() => {
  if (process.env.M07_CANDIDATE_EVIDENCE) writeFileSync(process.env.M07_CANDIDATE_EVIDENCE, JSON.stringify({
    fixture: { file: path.relative(root, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) }, sourceGraph: [...graph.values()], traces,
    scope: "Actual captured/current published helper, real editorial/media validator, strict private draft parser, actual CF premium two-pass transport and budget; controlled SDK, Auth approval, AI output and stage/FINISH callbacks",
    limitations: ["Stage/FINISH callbacks are controlled storage/ACK boundaries, not actual SQL transaction acceptance", "Retained candidate alone does not prove actor-bound recovery API", "No paid calls, managed Auth/DB/PostgREST/RLS or production"],
  }, null, 2) + "\n", { flag: "wx" });
});
