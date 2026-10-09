import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load as parseHtml } from "cheerio";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function loadModule(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const before = process.env.M02_PRIVATE_EN_LOAD_BASELINE_DIR && path.join(process.env.M02_PRIVATE_EN_LOAD_BASELINE_DIR, relative);
  const compiled = ts.transpileModule(readFileSync(before && existsSync(before) ? before : filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  cache.set(filename, module.exports);
  const require = (name: string): any => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const file = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (file) return loadModule(path.relative(adminRoot, file), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const articleId = "11111111-1111-4111-8111-111111111111", categoryId = "22222222-2222-4222-8222-222222222222";
const oldCategoryId = "33333333-3333-4333-8333-333333333333", englishId = "44444444-4444-4444-8444-444444444444";
const ruStamp = "2026-10-07T12:00:00.123456+00:00", enStamp = "2026-10-07T11:00:00.654321+00:00";
const draftStamp = "2026-10-07T12:00:00.123457+00:00", secret = "PRIVATE_SYNTHETIC_DATABASE_TOKEN=route-fixture-secret";
const image = (locale: string) => ({ type: "editorialImage", attrs: { src: `https://fixture.invalid/${locale}-manual.jpg`,
  alt: `${locale} authored alt`, caption: `${locale} exact caption`, credit: `${locale} manual author`,
  sourceUrl: `https://fixture.invalid/${locale}-license`, license: `${locale} author-permitted use` } });
const document = (text: string, locale: string) => ({ type: "doc", content: [
  { type: "paragraph", content: [{ type: "text", text }] }, image(locale),
] });
const html = (text: string, locale: string) => `<p>${text}</p><figure data-license="${locale} author-permitted use"><img src="https://fixture.invalid/${locale}-manual.jpg" alt="${locale} authored alt"><figcaption>${locale} exact caption; ${locale} manual author</figcaption></figure>`;
const canonicalRuText = "  Канонический русский B \u2014 café.\nРучная вторая строка.  ";
const privateEnText = "  Private authored English A \u2014 café.\nManual second line.  ";
const canonicalEnText = "Canonical English E0 remains separate from private A";
const sources = (locale: string) => [{ text: `  ${locale} original source \u2014 exact  https://fixture.invalid/${locale}-source?a=1&b=2` }];
const bibliography = (locale: string) => [{ text: `${locale} manual bibliography.  Two spaces.` }];
function canonicalArticle(status = "published") {
  return { id: articleId, title: "Канонический русский B", subtitle: "  Канонический подзаголовок B  ", excerpt: "Канонический анонс B",
    slug: "canonical-ru-b", content_html: html(canonicalRuText, "RU-B"), content_json: document(canonicalRuText, "RU-B"),
    category_id: categoryId, categories: { name: "Canonical category B" }, status, updated_at: ruStamp,
    scheduled_at: status === "scheduled" ? "2027-01-01T10:00:00Z" : null,
    published_at: status === "published" ? "2026-10-01T10:00:00Z" : null,
    cover_external_url: "https://fixture.invalid/canonical-b-cover.jpg", cover_media_id: null, cover_alt: "RU B licensed cover",
    sources: sources("RU-B"), bibliography: bibliography("RU-B"), seo_title: "Canonical B SEO", seo_description: "Canonical B description",
    seo_keywords: ["manual B"], og_title: "Canonical B OG", og_description: "Canonical B OG description",
    canonical_url: "https://fixture.invalid/canonical-b", legacy_path: null, allow_indexing: true,
    featured: false, show_on_homepage: false, pinned: true };
}
const englishPayload = { title: "Private authored English A", subtitle: "  Private A subtitle  ", excerpt: "Private A excerpt",
  slug: "private-english-a", content_html: html(privateEnText, "EN-A"), content_json: document(privateEnText, "EN-A"),
  cover_alt: "EN A licensed cover", sources: sources("EN-A"), bibliography: bibliography("EN-A"), seo_title: "Private A SEO",
  seo_description: "Private A description", seo_keywords: ["manual A"], canonical_url: "https://fixture.invalid/private-a",
  og_title: "Private A OG", og_description: "Private A OG description", status: "draft", source_content_hash: "private-author-source-A",
  reviewed_at: null, approved_at: null, published_at: null, deleted_at: null };
const canonicalEnglish = { ...englishPayload, id: englishId, article_id: articleId, locale: "en", title: "Canonical English E0",
  content_html: html(canonicalEnText, "EN-E0"), content_json: document(canonicalEnText, "EN-E0"), sources: sources("EN-E0"),
  bibliography: bibliography("EN-E0"), updated_at: enStamp, source_content_hash: "canonical-source-E0", source_article_updated_at: ruStamp };
function workingDraft() {
  const { id: _id, categories: _categories, updated_at: _stamp, cover_media_id: _media, ...oldRu } = canonicalArticle();
  return { article_id: articleId, base_article_updated_at: ruStamp,
    payload: { ...oldRu, title: "Stale private Russian A must not replace canonical B", category_id: oldCategoryId, status: "draft",
      scheduled_at: null, published_at: null, content_html: html("Stale private Russian A", "RU-A"),
      content_json: document("Stale private Russian A", "RU-A"), sources: sources("RU-A"), bibliography: bibliography("RU-A"),
      cover_external_url: "https://fixture.invalid/stale-a-cover.jpg", cover_alt: "Old A licensed cover" },
    english_payload: { mode: "save", payload: englishPayload }, expected_english_updated_at: enStamp,
    version: 3, updated_at: draftStamp, draft_scope: "english-only", draft_english_enabled: false };
}
const categories = [{ id: categoryId, name: "Canonical category B", slug: "canonical-category-b" },
  { id: oldCategoryId, name: "Stale private category A", slug: "stale-private-a" }];
type EditorProps = { article: Record<string, any>; englishTranslation?: Record<string, any>; canonicalEnglishTranslation?: Record<string, any> | null; categories: unknown };
type BoundaryProps = { current: EditorProps | null; fallback?: ReactNode; before?: ReactNode; after?: ReactNode };
function fixture(options: { status?: string; draft?: unknown; english?: unknown; draftError?: unknown } = {}) {
  const article = canonicalArticle(options.status), currentProps: EditorProps[] = [], reads: Array<{ table: string; columns: string }> = [];
  const values: Record<string, unknown> = { articles: article,
    article_translations: Object.hasOwn(options, "english") ? options.english : canonicalEnglish,
    article_working_drafts: Object.hasOwn(options, "draft") ? options.draft : workingDraft(), categories,
    article_revisions: [], editor_templates: [], admin_audit_log: [] };
  const from = vi.fn((table: string) => {
    if (!Object.hasOwn(values, table)) throw Error(`Unexpected synthetic table ${table}`);
    let columns = "";
    const query = { select: (value: string) => { columns = value; return query; }, eq: () => query, is: () => query,
      order: () => query, limit: () => query, contains: () => query, in: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        reads.push({ table, columns });
        const value = values[table];
        // Model PostgREST projection so the preserved route cannot accidentally
        // receive newly added metadata that its SELECT did not request.
        const selected = new Set(columns.split(","));
        const data = table === "article_working_drafts" && value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).filter(([field]) => selected.has(field))) : value;
        return { data, error: table === "article_working_drafts" ? options.draftError || null : null };
      }).then(resolve, reject) };
    return query;
  });
  const action = vi.fn(async () => undefined), rpc = vi.fn(() => { throw Error("Reload fixtures must not perform writes"); });
  const Boundary = (props: BoundaryProps) => {
    if (!props.current) return props.fallback;
    currentProps.push(props.current);
    return createElement(Fragment, {}, props.before, createElement("section", { "data-test-loader-current": "true" }), props.after);
  };
  const mocks = {
    "@/lib/auth": { getStaffSession: async () => ({ configured: true, mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false }, role: "owner", user: { id: "synthetic-owner" } }) },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from, rpc }) },
    "next/navigation": { notFound: () => { throw Error("Unexpected framework notFound"); },
      unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children) },
    "@/components/ArticleEditorLoader": { __esModule: true, default: Boundary },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) },
    "@/components/EditorialPreviewFonts": { editorialPreviewFonts: "synthetic-fonts" },
    "@/components/EditorialPreview.module.css": { __esModule: true, default: { fonts: "synthetic-fonts", reader: "synthetic-reader" } },
    "../actions": { duplicateArticleAction: action, discardArticleWorkingDraftAction: action,
      requestSocialPublicationAction: action, restoreArticleRevisionAction: action, softDeleteArticleAction: action },
  };
  const cache = new Map<string, any>();
  async function render(kind: "edit" | "ru" | "en") {
    const Page = loadModule(`app/(dashboard)/articles/[id]/${kind === "edit" ? "page.tsx" : "preview/page.tsx"}`, mocks, cache).default;
    const tree = await Page({ params: Promise.resolve({ id: articleId }), searchParams: Promise.resolve(kind === "edit" ? {} : { locale: kind }) });
    const markup = renderToStaticMarkup(tree);
    expect(action).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled();
    return { markup, $: parseHtml(markup), currentProps, article, reads };
  }
  return { render };
}
type Rendered = Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>;
function expectBytes(actual: unknown, expected: unknown) {
  expect(actual).toEqual(expected);
  if (typeof expected === "string") expect(Buffer.from(String(actual), "utf8").equals(Buffer.from(expected, "utf8"))).toBe(true);
}
function expectBlocked(page: Rendered) {
  expect(page.currentProps).toHaveLength(0);
  expect(page.$("article.admin-article-preview,[data-test-loader-current]").length).toBe(0);
  expect(page.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(page.markup).not.toContain(secret);
  expect(page.markup).not.toContain(canonicalRuText);
  expect(page.$("a").filter((_index, node) => /Повторить загрузку/u.test(page.$(node).text())).length).toBeGreaterThan(0);
}

describe("M02 actual edit/preview reload of retained private English", () => {
  it.each(["published", "scheduled", "hidden", "archived"])("reloads %s canonical RU and private EN through actual routes", async status => {
    const view = fixture({ status }), edit = await view.render("edit");
    expect(edit.currentProps).toHaveLength(1);
    const props = edit.currentProps[0];
    for (const [key, expected] of Object.entries(edit.article)) expectBytes(props.article[key], expected);
    expect(props.article).toMatchObject({ working_draft_scope: "english-only", working_draft_version: 3,
      working_draft_updated_at: draftStamp, working_draft_english_enabled: false });
    for (const [key, expected] of Object.entries(englishPayload)) expectBytes(props.englishTranslation?.[key], expected);
    expect(props.englishTranslation).toMatchObject({ article_id: articleId, id: englishId, locale: "en", updated_at: enStamp });
    expect(props.canonicalEnglishTranslation).toEqual(canonicalEnglish);
    expect(props.englishTranslation?.content_json).not.toEqual(props.canonicalEnglishTranslation?.content_json);
    expect(props.categories).toEqual(categories);
    expect(edit.reads.find(read => read.table === "article_working_drafts")?.columns).toContain("draft_scope,draft_english_enabled");
    const notice = edit.$('[aria-label="Рабочий черновик"]');
    expect(notice.text()).toContain("Русская версия открыта в сохранённом состоянии");
    expect(notice.text()).toContain("не выпущен");
    expect(notice.find('input[name="id"]').attr("value")).toBe(articleId);
    expect(notice.find('input[name="working_draft_version"]').attr("value")).toBe("3");
    expect(notice.find("button").text()).toBe("Удалить английский черновик");
    const ruPreview = await view.render("ru"), enPreview = await view.render("en");
    expect(ruPreview.$("article h1").text()).toBe(edit.article.title);
    expect(ruPreview.$("article header > span").text()).toBe("Canonical category B");
    expect(ruPreview.$("article header small").text()).toContain(status);
    expect(ruPreview.markup).toContain(`<div class="preview-prose">${edit.article.content_html}</div>`);
    expect(ruPreview.markup).not.toContain(workingDraft().payload.title);
    expect(enPreview.$("article h1").text()).toBe(englishPayload.title);
    expect(enPreview.markup).toContain(`<div class="preview-prose">${englishPayload.content_html}</div>`);
    expect(enPreview.$(".preview-toolbar .eyebrow").text()).toContain("английская версия не выпущена");
    expect(enPreview.markup).not.toContain(canonicalEnText);
    for (const preview of [ruPreview, enPreview]) {
      expect(preview.$("article > figure img").attr("src")).toBe(edit.article.cover_external_url);
      expect(preview.$('.preview-prose figure[data-license]').attr("data-license")).toBe(preview === ruPreview ? "RU-B author-permitted use" : "EN-A author-permitted use");
    }
  });
  it("preserves legacy complete Russian/English bundle overlay", async () => {
    const { draft_scope: _scope, draft_english_enabled: _enabled, ...legacy } = workingDraft();
    const view = fixture({ draft: legacy }), edit = await view.render("edit"), props = edit.currentProps[0];
    expect(props.article).toMatchObject({ ...legacy.payload, id: articleId, updated_at: ruStamp, working_draft_version: 3 });
    expect(props.englishTranslation).toMatchObject(englishPayload);
    expect(edit.$('[aria-label="Рабочий черновик"] button').text()).toBe("Отменить правки");
    const preview = await view.render("ru");
    expect(preview.$("article h1").text()).toBe(legacy.payload.title);
    expect(preview.$("article header > span").text()).toBe("Stale private category A");
    expect(preview.markup).toContain(`<div class="preview-prose">${legacy.payload.content_html}</div>`);
  });
  it("blocks malformed scope, incompatible envelope and foreign identity before edit/preview projection", async () => {
    for (const patch of [{ draft_scope: "damaged" }, { english_payload: { mode: "disabled" } }, { article_id: englishId }]) {
      for (const kind of ["edit", "ru", "en"] as const) expectBlocked(await fixture({ draft: { ...workingDraft(), ...patch } }).render(kind));
    }
  });
  it("a failed mandatory private-copy read blocks edit and both previews without publishing data or diagnostics", async () => {
    for (const kind of ["edit", "ru", "en"] as const) {
      expectBlocked(await fixture({ draftError: { code: "42501", message: secret } }).render(kind));
    }
  });
  it("reloads private A with proven canonical English absence without substituting Russian text", async () => {
    const draft = { ...workingDraft(), expected_english_updated_at: null }, view = fixture({ draft, english: null });
    const edit = await view.render("edit"), props = edit.currentProps[0];
    expect(props.canonicalEnglishTranslation).toBeNull();
    expect(props.englishTranslation).toMatchObject(englishPayload);
    expect(props.englishTranslation?.updated_at).toBeUndefined();
    expect(props.article.working_draft_english_enabled).toBe(false);
    const preview = await view.render("en");
    expect(preview.markup).toContain(`<div class="preview-prose">${englishPayload.content_html}</div>`);
    expect(preview.$("body").text()).not.toContain("Английская версия ещё не создана");
    expect(preview.markup).not.toContain(canonicalRuText);
  });
});
