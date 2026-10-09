import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const helperFile = "apps/admin/lib/auto-translate-published-article-premium.ts";
type Row = Record<string, any>;
const graph = new Map<string, { module: string; source: string; sha256: string }>();
const traces: unknown[] = [];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

// Before means the actual captured helper and its existing dependencies.
// The original helper ignores privateRetry and performs its canonical EN
// mutation. This compares that real behavior with the private contract;
// missing newly introduced exports are never used as a baseline failure.
function actualModules(mocks: Record<string, unknown>) {
  const modules = new Map<string, Row>();
  function load(file: string): Row {
    const filename = path.join(repoRoot, file);
    if (modules.has(filename)) return modules.get(filename)!;
    const source = file === helperFile && process.env.M07_ITEM_PRIVATE_BASELINE_HELPER
      ? path.resolve(process.env.M07_ITEM_PRIVATE_BASELINE_HELPER)
      : process.env.M07_ITEM_PRIVATE_BASELINE_ROOT ? path.join(process.env.M07_ITEM_PRIVATE_BASELINE_ROOT, file) : filename;
    if (!existsSync(source)) throw new Error(`Uncaptured actual dependency: ${file}`);
    const bytes = readFileSync(source);
    graph.set(file, { module: file, source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} as Row };
    modules.set(filename, module.exports);
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

const articleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const englishId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const categoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const mediaId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const revision = "2026-10-08T10:00:00.123456+00:00";
const olderRevision = "2026-10-07T10:00:00.654321+00:00";
const authored = { ru: "Ручной оригинал \u2014 ё, права и источники", en: "Existing English \u2014 author rights retained" };
const imageHtml = `<img src="https://media.invalid/original.jpg" data-media-id="${mediaId}" alt="Original cover" data-license="CC BY" data-credit="Original photographer" data-source="https://source.invalid/image">`;

type Options = {
  english?: "stale" | "missing" | "manual" | "current";
  articleOverrides?: Row;
  privateDraft?: Row | null;
  readError?: "article" | "english" | "draft";
  readReject?: "article" | "english" | "draft";
  admission?: unknown;
  admissionError?: unknown;
  persistResult?: unknown;
  persistError?: unknown;
  modelError?: unknown;
  englishUpdatedAt?: string;
  lateRussianChange?: boolean;
  lateManualEnglish?: boolean;
  configured?: boolean;
  feature?: boolean;
};
function setup(options: Options = {}) {
  const article: Row = {
    id: articleId, title: authored.ru, subtitle: "Original subtitle", excerpt: "Original excerpt", slug: "original-ru",
    content_html: `<p>${authored.ru}</p>${imageHtml}`,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.ru }] },
      { type: "image", attrs: { src: "https://media.invalid/original.jpg", mediaId, alt: "Original cover", license: "CC BY", credit: "Original photographer", source: "https://source.invalid/image" } }] },
    cover_alt: "Original photographer, CC BY", cover_external_url: "https://media.invalid/original.jpg",
    category_id: categoryId, status: "published", scheduled_at: null, published_at: olderRevision,
    legacy_path: "/original-ru", sources: [{ text: "https://source.invalid/authored" }], bibliography: [{ text: "Original bibliography" }],
    seo_title: "Original SEO", seo_description: "Original description", seo_keywords: ["Original author"],
    canonical_url: "https://site.invalid/culture/original-ru", og_title: "Original OG", og_description: "Original OG description",
    allow_indexing: true, featured: true, show_on_homepage: true, pinned: false, updated_at: revision, deleted_at: null,
    categories: { slug: "culture" }, rights: { holder: "RU author", license: "Author consent" }, ...options.articleOverrides,
  };
  let english: Row | null = null;
  let privateDraft: Row | null = options.privateDraft ? structuredClone(options.privateDraft) : null;
  const writes: Row[] = [], events: Row[] = [];
  const rejection = new Error("Controlled SDK read rejection");
  const audit = vi.fn(async (row: Row) => { events.push({ kind: "legacy-audit", row: structuredClone(row) }); return { data: null, error: null }; });
  const client = { from(table: string) {
    if (table === "admin_audit_log") return { insert: audit };
    if (!["articles", "article_translations", "article_working_drafts"].includes(table)) throw new Error(`Unexpected controlled table ${table}`);
    const filters: Row[] = []; let operation = "read", columns = "", payload: Row;
    const matches = (row: Row | null) => row && filters.every(filter => row[filter.column] === filter.value);
    const query: Row = {
      select(value: string) { columns = value; return query; }, eq(column: string, value: unknown) { filters.push({ column, value }); return query; },
      is(column: string, value: unknown) { filters.push({ column, value }); return query; },
      update(value: Row) { operation = "update"; payload = value; return query; }, insert(value: Row) { operation = "insert"; payload = value; return query; },
      async maybeSingle() {
        if (operation !== "read") {
          writes.push({ table, operation, payload: structuredClone(payload), filters: structuredClone(filters) });
          if (operation === "update" && !matches(english)) return { data: null, error: null };
          english = { ...(english ?? {}), ...structuredClone(payload), id: englishId, updated_at: revision };
          return { data: { id: englishId }, error: null };
        }
        const phase = table === "articles" ? columns === "updated_at" ? "latest" : "article"
          : table === "article_translations" ? "english" : "draft";
        events.push({ kind: "SDK-read", phase, table, columns, filters: structuredClone(filters) });
        if (options.readReject === phase) throw rejection;
        if (options.readError === phase) return { data: null, error: { code: "57014", message: "Controlled read failure" } };
        const row = table === "articles" ? article : table === "article_translations" ? english : privateDraft;
        return { data: matches(row) ? structuredClone(row) : null, error: null };
      },
    };
    return query;
  } };
  const gate = vi.fn(async () => options.configured !== false);
  const translator = vi.fn(async (input: Row, call: Row) => {
    events.push({ kind: "controlled-model", input: structuredClone(input) });
    call.operationBudget?.beforeProviderCall();
    if (Object.hasOwn(options, "modelError")) throw options.modelError;
    call.operationBudget?.beforeProviderCall();
    if (options.lateRussianChange) article.updated_at = "2026-10-08T11:00:00.123456+00:00";
    if (options.lateManualEnglish) english = { ...english!, updated_at: revision,
      content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.en }] }] } };
    return { title: "Controlled private English", subtitle: "Private subtitle", excerpt: "Private excerpt", content_html: `<p>Controlled private English</p>${imageHtml}`,
      cover_alt: "Original photographer, CC BY", sources: [...input.sources], bibliography: [...input.bibliography],
      seo_title: "Private SEO", seo_description: "Private description", seo_keywords: ["original author"], og_title: "Private OG", og_description: "Private OG description",
      model: "local-model", reviewModel: "local-review", requestId: "local-request", reviewRequestId: "local-review-request", inputTokens: 30, outputTokens: 20, reviewInputTokens: 20, reviewOutputTokens: 20 };
  });
  const modules = actualModules({
    "apps/admin/lib/auto-translate-article": { translateArticleSourceToEnglish: translator },
    "apps/admin/lib/env": { adminEnv: { openAiAutoTranslateArticles: options.feature !== false, publicSiteUrl: "https://site.invalid",
      premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: "local-model", cloudflareTranslationReviewModel: "local-review", openAiPremiumTranslationReview: true } },
    "apps/admin/lib/translation-runtime-gate": { premiumTranslationRuntimeGate: gate },
  });
  const sourceHash = modules.load("apps/admin/lib/article-translations.ts").articleTranslationSourceHash;
  const rowHash = () => sourceHash({ title: article.title, subtitle: article.subtitle || "", excerpt: article.excerpt || "",
    contentJson: article.content_json || { type: "doc", content: [] }, contentHtml: article.content_html || "", coverAlt: article.cover_alt || "",
    slug: article.slug, sources: article.sources || [], bibliography: article.bibliography || [], seoTitle: article.seo_title || article.title,
    seoDescription: article.seo_description || article.excerpt || "", seoKeywords: article.seo_keywords || [], ogTitle: article.og_title || article.seo_title || article.title,
    ogDescription: article.og_description || article.seo_description || article.excerpt || "" });
  const kind = options.english ?? "stale";
  if (kind !== "missing") {
    const persistedHash = kind === "current" ? rowHash() : hash("Original older Russian revision");
    const ownership = modules.load("apps/admin/lib/article-translation-machine-ownership.ts");
    english = { id: englishId, article_id: articleId, locale: "en", title: authored.en, content_html: `<p>${authored.en}</p>${imageHtml}`,
      updated_at: options.englishUpdatedAt ?? olderRevision, slug: "existing-english", canonical_url: "https://site.invalid/existing-english", status: "published",
      source_content_hash: persistedHash, source_article_updated_at: kind === "current" ? revision : olderRevision, deleted_at: null,
      content_json: kind === "manual" ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: authored.en }] }] }
        : ownership.premiumArticleMachineContentJson({ sourceHash: persistedHash, model: "original-model", reviewerModel: null,
          translatorRequestId: "original-request", reviewerRequestId: null, generatedAt: olderRevision }, `<p>${authored.en}</p>${imageHtml}`),
      reviewed_at: olderRevision, reviewed_by: actorId, approved_at: olderRevision, approved_by: actorId, published_at: olderRevision,
      sources: [{ text: "https://source.invalid/original-en" }], bibliography: [{ text: "Original EN bibliography" }], rights: { holder: "EN author", license: "Original licence" } };
  }
  const originalArticle = structuredClone(article), originalEnglish = structuredClone(english), originalPrivateDraft = structuredClone(privateDraft);
  const budget = modules.load("apps/admin/lib/translation-operation-budget.ts").createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300000 });
  const admit = vi.fn(async (source: Row) => {
    events.push({ kind: "private-admission", source: structuredClone(source), budget: budget.snapshot() });
    if (Object.hasOwn(options, "admissionError")) throw options.admissionError;
    return Object.hasOwn(options, "admission") ? options.admission : true;
  });
  const persist = vi.fn(async (candidate: Row) => {
    events.push({ kind: "private-persist", candidate: structuredClone(candidate), budget: budget.snapshot() });
    if (Object.hasOwn(options, "persistError")) throw options.persistError;
    if (Object.hasOwn(options, "persistResult")) return options.persistResult;
    if (options.lateManualEnglish) return { confirmed: false };
    privateDraft = { article_id: articleId, version: 7, english_payload: { mode: "save", payload: structuredClone(candidate.englishPayload) } };
    return { confirmed: true, draftVersion: 7 };
  });
  const helper = modules.load(helperFile).ensurePublishedArticlePremiumEnglish;
  async function run(overrides: Row = {}, runtimeApproved = true) {
    const input = { supabase: client, actorId, articleId, runtimeApproved, operationBudget: budget,
      expectedSourceHash: rowHash(), expectedSourceUpdatedAt: article.updated_at,
      privateRetry: { expectedEnglishUpdatedAt: english?.updated_at ?? null, admit, persist }, ...overrides };
    try {
      const result = await helper(input);
      traces.push({ originalArticle, originalEnglish, originalPrivateDraft, article: structuredClone(article), english: structuredClone(english),
        privateDraft: structuredClone(privateDraft), result, writes, events, budget: budget.snapshot() });
      return result;
    } catch (error) {
      traces.push({ originalArticle, originalEnglish, originalPrivateDraft, article: structuredClone(article), english: structuredClone(english),
        privateDraft: structuredClone(privateDraft), thrown: error instanceof Error ? { message: error.message, digest: (error as Row).digest } : error,
        writes, events, budget: budget.snapshot() }); throw error;
    }
  }
  return { run, modules, article, originalArticle, originalEnglish, originalPrivateDraft, getEnglish: () => english, getPrivateDraft: () => privateDraft,
    rowHash, translator, audit, writes, events, budget, gate, admit, persist, rejection };
}
function noExpense(view: ReturnType<typeof setup>) {
  expect(view.translator).not.toHaveBeenCalled(); expect(view.writes).toEqual([]); expect(view.audit).not.toHaveBeenCalled();
  expect(view.budget.snapshot()).toMatchObject({ attempts: 0, providerCalls: 0 });
  expect(view.getEnglish()).toEqual(view.originalEnglish); expect(view.getPrivateDraft()).toEqual(view.originalPrivateDraft);
}
function noCanonicalWrite(view: ReturnType<typeof setup>) {
  expect(view.writes).toEqual([]); expect(view.audit).not.toHaveBeenCalled();
  expect(view.getEnglish()).toEqual(view.originalEnglish); expect(view.article).toEqual(view.originalArticle);
}

describe("M07 actual private item retry helper preserves public and author state", () => {
  it.each(["stale", "missing"] as const)("stores %s EN only through private persistence without publication or human review", async english => {
    const view = setup({ english }); const result = await view.run();
    expect(result).toMatchObject({ state: "translated", ownership: "machine", publication: "draft", workingDraftVersion: 7 });
    expect(view.admit).toHaveBeenCalledExactlyOnceWith({ sourceHash: view.rowHash(), sourceUpdatedAt: revision, expectedEnglishUpdatedAt: english === "missing" ? null : olderRevision });
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.persist).toHaveBeenCalledTimes(1); noCanonicalWrite(view);
    const candidate = view.persist.mock.calls[0][0];
    expect(candidate).toMatchObject({ model: "local-model", reviewerModel: "local-review", requestId: "local-request", inputTokens: 30, outputTokens: 20, durationMs: expect.any(Number) });
    expect(candidate.englishPayload).toMatchObject({ status: "draft", source_content_hash: view.rowHash(), reviewed_at: null, approved_at: null, published_at: null, deleted_at: null,
      content_html: `<p>Controlled private English</p>${imageHtml}`, sources: [{ text: "https://source.invalid/authored" }], bibliography: [{ text: "Original bibliography" }] });
    expect(candidate.englishPayload).not.toHaveProperty("reviewed_by"); expect(candidate.englishPayload).not.toHaveProperty("approved_by");
    expect(candidate.englishPayload.content_json.__probperaPremiumTranslation).toMatchObject({ method: "machine-translation", sourceHash: view.rowHash(), model: "local-model" });
    expect(candidate.englishPayload.content_json.__probperaMediaReferences).toEqual(expect.arrayContaining([expect.objectContaining({ mediaId })]));
    const envelope = view.modules.load("apps/admin/app/(dashboard)/articles/article-working-draft.ts").articleWorkingDraftEnglishEnvelope(candidate.englishPayload);
    expect(envelope).toEqual({ mode: "save", payload: candidate.englishPayload });
    expect(view.events.findIndex(event => event.kind === "private-admission")).toBeLessThan(view.events.findIndex(event => event.kind === "controlled-model"));
    expect(view.events.find(event => event.kind === "private-admission")?.budget).toMatchObject({ attempts: 0, providerCalls: 0 });
    expect(view.budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 2 });
  });
  it("a deduplicated or rejected admission spends no attempt and does not invoke persistence", async () => {
    const view = setup({ admission: false }); expect((await view.run()).state).not.toBe("translated");
    expect(view.admit).toHaveBeenCalledTimes(1); expect(view.persist).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each([null, 0, "true", {}, []])("a malformed admission %s grants no provider authority", async admission => {
    const view = setup({ admission }); expect((await view.run()).state).not.toBe("translated");
    expect(view.admit).toHaveBeenCalledTimes(1); expect(view.persist).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each(["manual", "current"] as const)("retains %s EN without allowing item admission to bypass protection", async english => {
    const view = setup({ english }); expect((await view.run()).state).toBe(english === "manual" ? "manual" : "current");
    expect(view.admit).not.toHaveBeenCalled(); expect(view.persist).not.toHaveBeenCalled(); noExpense(view);
  });
  it("keeps an existing author working draft and blocks paid retry before admission", async () => {
    const privateDraft = { article_id: articleId, version: 4, payload: { title: authored.ru, rights: "Author consent" }, english_payload: { mode: "save", payload: { title: authored.en } } };
    const view = setup({ privateDraft }); expect((await view.run()).state).not.toBe("translated");
    expect(view.admit).not.toHaveBeenCalled(); expect(view.persist).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each([
    { name: "missing source hash", expectedSourceHash: undefined }, { name: "missing source revision", expectedSourceUpdatedAt: undefined },
    { name: "both source tokens missing", expectedSourceHash: undefined, expectedSourceUpdatedAt: undefined },
  ])("refuses private $name before admission", async ({ name: _name, ...input }) => {
    const view = setup(); expect((await view.run(input)).state).not.toBe("translated");
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each([null, revision, "invalid-token"])("refuses changed or invalid EN token %s before admission", async expectedEnglishUpdatedAt => {
    const view = setup(); expect((await view.run({ privateRetry: { expectedEnglishUpdatedAt, admit: view.admit, persist: view.persist } })).state).not.toBe("translated");
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  const unsupported = [
    { name: "absent canonical URL", values: { canonical_url: null } }, { name: "invalid canonical URL", values: { canonical_url: "broken-url" } },
    { name: "invalid category UUID", values: { category_id: "category" } }, { name: "missing HTML", values: { content_html: undefined } },
    { name: "missing JSON", values: { content_json: null } }, { name: "array JSON", values: { content_json: [] } },
    { name: "nonboolean indexing", values: { allow_indexing: null } }, { name: "nonboolean featured", values: { featured: "false" } },
    { name: "nonboolean homepage", values: { show_on_homepage: null } }, { name: "nonboolean pinned", values: { pinned: 0 } },
    { name: "source with extra author fields", values: { sources: [{ text: "Original source", author: "Do not silently strip me" }] } },
    { name: "string source item", values: { sources: ["Original source"] } }, { name: "bibliography with unsupported fields", values: { bibliography: [{ text: "Original book", rights: "Author consent" }] } },
  ];
  it.each(unsupported)("does not pay on unsupported strict RU snapshot: $name", async ({ values }) => {
    const view = setup({ articleOverrides: values }); expect((await view.run()).state).not.toBe("translated");
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each(["article", "english", "draft"] as const)("does not pay on failed %s preflight read", async readError => {
    const view = setup({ readError }); expect((await view.run()).state).not.toBe("translated");
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each(["article", "english", "draft"] as const)("does not convert rejected %s preflight read to permission or a fresh retry", async readReject => {
    const view = setup({ readReject }); await expect(view.run()).rejects.toBe(view.rejection);
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each([{ name: "feature off", feature: false }, { name: "runtime denied", configured: false }])("retains $name guard before admission", async input => {
    const view = setup(input); expect((await view.run({}, false)).state).not.toBe("translated"); expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it("an ordinary admission rejection remains observable before any provider call", async () => {
    const error = new Error("Unknown begin outcome"); const view = setup({ admissionError: error });
    await expect(view.run()).rejects.toBe(error); noExpense(view);
  });
  it("does not claim success when private persistence cannot confirm the receipt", async () => {
    const view = setup({ persistResult: { confirmed: false } }); expect((await view.run()).state).not.toBe("translated");
    expect(view.persist).toHaveBeenCalledTimes(1); noCanonicalWrite(view); expect(view.getPrivateDraft()).toBeNull();
  });
  it.each([
    { name: "missing draft version", value: { confirmed: true } },
    { name: "zero draft version", value: { confirmed: true, draftVersion: 0 } },
    { name: "negative draft version", value: { confirmed: true, draftVersion: -1 } },
    { name: "coerced draft version", value: { confirmed: true, draftVersion: "7" } },
    { name: "unsafe draft version", value: { confirmed: true, draftVersion: Number.MAX_SAFE_INTEGER + 1 } },
    { name: "false confirmation", value: { confirmed: false, draftVersion: 7 } },
    { name: "string confirmation", value: { confirmed: "true", draftVersion: 7 } },
    { name: "object confirmation", value: { confirmed: {}, draftVersion: 7 } },
  ])("does not call an invalid private receipt successful: $name", async ({ value }) => {
    const view = setup({ persistResult: value }); expect((await view.run()).state).not.toBe("translated");
    expect(view.persist).toHaveBeenCalledTimes(1); noCanonicalWrite(view); expect(view.getPrivateDraft()).toBeNull();
  });
  it.each([null, undefined])("a completely absent private receipt %s stays observable without public fallback", async persistResult => {
    const view = setup({ persistResult }); await expect(view.run()).rejects.toBeInstanceOf(TypeError);
    expect(view.persist).toHaveBeenCalledTimes(1); noCanonicalWrite(view); expect(view.getPrivateDraft()).toBeNull();
  });
  it("existing nullable editor fields form a complete strict RU snapshot without changing canonical data", async () => {
    const values = { subtitle: null, excerpt: null, cover_alt: null, seo_title: null, seo_description: null, seo_keywords: null,
      og_title: null, og_description: null, sources: null, bibliography: null, category_id: null, cover_external_url: null, legacy_path: null };
    const view = setup({ articleOverrides: values }); expect((await view.run()).publication).toBe("draft"); noCanonicalWrite(view);
    const payload = view.modules.load("apps/admin/lib/article-private-retry-draft.ts").articlePrivateRetrySourceSnapshot({
      article: view.article, sourceUpdatedAt: revision, expectedEnglishUpdatedAt: olderRevision,
    });
    expect(payload).toMatchObject({ title: authored.ru, content_html: view.originalArticle.content_html, content_json: view.originalArticle.content_json,
      category_id: null, cover_external_url: null, legacy_path: null, subtitle: "", excerpt: "", cover_alt: "", seo_title: "", seo_description: "",
      seo_keywords: [], og_title: "", og_description: "", sources: [], bibliography: [], allow_indexing: true, featured: true, show_on_homepage: true, pinned: false });
  });
  // Values are the actual isolated SQL v2 export spellings, used as timestamp
  // data only. The authored source and SDK callbacks remain controlled fixtures.
  const nativeTimes = { sourceUtc: "2026-10-01T12:00:00+00:00", sourceTable: "2026-10-01T15:00:00+03:00",
    englishUtc: "2026-10-01T13:00:00+00:00", englishTable: "2026-10-01T16:00:00+03:00" };
  it("native UTC receipt and +03:00 table spellings of the same instant admit one private generation without replacing the frozen intent strings", async () => {
    const view = setup({ articleOverrides: { updated_at: nativeTimes.sourceTable }, englishUpdatedAt: nativeTimes.englishTable });
    const result = await view.run({ expectedSourceUpdatedAt: nativeTimes.sourceUtc,
      privateRetry: { expectedEnglishUpdatedAt: nativeTimes.englishUtc, admit: view.admit, persist: view.persist } });
    expect(result).toMatchObject({ state: "translated", publication: "draft", workingDraftVersion: 7 });
    expect(view.admit).toHaveBeenCalledExactlyOnceWith({ sourceHash: view.rowHash(), sourceUpdatedAt: nativeTimes.sourceUtc, expectedEnglishUpdatedAt: nativeTimes.englishUtc });
    expect(view.translator).toHaveBeenCalledTimes(1); noCanonicalWrite(view);
  });
  it("six fractional timestamp digits remain exact across UTC and +03:00 spellings", async () => {
    const sourceUtc = "2026-10-01T12:00:00.123456+00:00", englishUtc = "2026-10-01T13:00:00.654321+00:00";
    const view = setup({ articleOverrides: { updated_at: "2026-10-01T15:00:00.123456+03:00" }, englishUpdatedAt: "2026-10-01T16:00:00.654321+03:00" });
    expect((await view.run({ expectedSourceUpdatedAt: sourceUtc, privateRetry: { expectedEnglishUpdatedAt: englishUtc, admit: view.admit, persist: view.persist } })).publication).toBe("draft");
    expect(view.admit).toHaveBeenCalledExactlyOnceWith({ sourceHash: view.rowHash(), sourceUpdatedAt: sourceUtc, expectedEnglishUpdatedAt: englishUtc }); noCanonicalWrite(view);
  });
  it.each(["2026-10-01T12:00:00.000001+00:00", "2026-10-01T12:00:01+00:00"])("a different RU instant %s stays stale before admission or a provider call", async expectedSourceUpdatedAt => {
    const view = setup({ articleOverrides: { updated_at: nativeTimes.sourceTable }, englishUpdatedAt: nativeTimes.englishTable });
    expect((await view.run({ expectedSourceUpdatedAt, privateRetry: { expectedEnglishUpdatedAt: nativeTimes.englishUtc, admit: view.admit, persist: view.persist } })).state).toBe("stale");
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it.each(["2026-10-01T13:00:00.000001+00:00", "2026-10-01T13:00:01+00:00"])("a different EN instant %s stays conflicting before admission or a provider call", async expectedEnglishUpdatedAt => {
    const view = setup({ articleOverrides: { updated_at: nativeTimes.sourceTable }, englishUpdatedAt: nativeTimes.englishTable });
    expect((await view.run({ expectedSourceUpdatedAt: nativeTimes.sourceUtc, privateRetry: { expectedEnglishUpdatedAt, admit: view.admit, persist: view.persist } })).state).toBe("conflict");
    expect(view.admit).not.toHaveBeenCalled(); noExpense(view);
  });
  it("an unknown private finish stays observable after the model without fallback canonical writes or legacy audit", async () => {
    const error = new Error("Unknown finish outcome"); const view = setup({ persistError: error }); await expect(view.run()).rejects.toBe(error);
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.persist).toHaveBeenCalledTimes(1); noCanonicalWrite(view);
  });
  it("an unknown provider outcome is not caught as a safe new item retry", async () => {
    const error = new Error("Provider result unknown after accepted request"); const view = setup({ modelError: error }); await expect(view.run()).rejects.toBe(error);
    expect(view.admit).toHaveBeenCalledTimes(1); expect(view.persist).not.toHaveBeenCalled(); noCanonicalWrite(view);
    expect(view.budget.snapshot()).toMatchObject({ attempts: 1, providerCalls: 1 });
  });
  it("a changed RU revision after the model does not write a private or public completion", async () => {
    const view = setup({ lateRussianChange: true }); expect((await view.run()).state).not.toBe("translated");
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.persist).not.toHaveBeenCalled(); expect(view.writes).toEqual([]);
    expect(view.getEnglish()).toEqual(view.originalEnglish); expect(view.getPrivateDraft()).toBeNull();
  });
  it("a concurrent manual EN takeover rejected by private persistence is retained", async () => {
    const view = setup({ lateManualEnglish: true }); expect((await view.run()).state).not.toBe("translated");
    expect(view.translator).toHaveBeenCalledTimes(1); expect(view.persist).toHaveBeenCalledTimes(1); expect(view.writes).toEqual([]);
    expect(view.getEnglish()?.content_json.content[0].content[0].text).toBe(authored.en); expect(view.getPrivateDraft()).toBeNull();
  });
});

afterAll(() => {
  if (process.env.M07_ITEM_PRIVATE_EVIDENCE) writeFileSync(process.env.M07_ITEM_PRIVATE_EVIDENCE, `${JSON.stringify({
    fixture: { module: path.relative(repoRoot, fileURLToPath(import.meta.url)).replaceAll("\\", "/"), sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
    sourceGraph: [...graph.values()], traces,
    limitations: ["Actual helper/hash/classifier/ownership/budget/strict private envelope/Next/Zod code execute",
      "SDK reads, controlled two-pass model and admission/persistence callbacks are synthetic; no real Auth/DB/RLS or provider",
      "Baseline executes original canonical-writing helper; new undefined exports are not reproduction evidence"],
  }, null, 2)}\n`, { flag: "wx" });
});
