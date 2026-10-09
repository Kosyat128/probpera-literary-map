import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function loadModule(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const baseline = process.env.M02_PENDING_OPERATION_LOAD_BASELINE_DIR;
  const before = baseline && [path.join(baseline, "apps/admin", relative), path.join(baseline, relative)].find(existsSync);
  const compiled = ts.transpileModule(readFileSync(before || filename, "utf8"), {
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

const actorA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", actorB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const articleId = "11111111-1111-4111-8111-111111111111", foreignId = "99999999-9999-4999-8999-999999999999";
const categoryId = "22222222-2222-4222-8222-222222222222", englishId = "44444444-4444-4444-8444-444444444444";
const ruStamp = "2026-10-07T12:00:00.123456+00:00", enStamp = "2026-10-07T11:00:00.654321+00:00";
const secret = "PRIVATE_SYNTHETIC_DATABASE_TOKEN=actor-route-fixture-secret";
const ruText = "  Ручной русский A \u2014 café.\nАвторская строка.  ";
const enText = "  Authored English A \u2014 café.\nManual second line.  ";
const document = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const article = { id: articleId, title: "Ручная статья A", subtitle: "  Подзаголовок A  ", excerpt: "Ручной анонс",
  slug: "manual-article-a", content_html: `<p>${ruText}</p>`, content_json: document(ruText), category_id: categoryId,
  categories: { name: "Ручная рубрика" }, status: "draft", updated_at: ruStamp, scheduled_at: null, published_at: null,
  cover_external_url: "https://fixture.invalid/manual-cover.jpg", cover_media_id: null, cover_alt: "Автор разрешил обложку",
  sources: [{ text: "  Источник автора \u2014 https://fixture.invalid/ru-source?a=1&b=2" }],
  bibliography: [{ text: "Библиография автора.  Два пробела." }], seo_title: "SEO автора", seo_description: "Описание автора",
  seo_keywords: ["ручное"], canonical_url: "https://fixture.invalid/manual-article-a", legacy_path: null,
  og_title: "OG автора", og_description: "OG описание автора", allow_indexing: true, featured: false,
  show_on_homepage: false, pinned: false };
const english = { id: englishId, article_id: articleId, locale: "en", title: "Authored English A", subtitle: "  English subtitle A  ",
  excerpt: "Authored English introduction", slug: "manual-english-a", content_html: `<p>${enText}</p>`, content_json: document(enText),
  cover_alt: "Author permitted English cover", sources: [{ text: "  Manual English source \u2014 https://fixture.invalid/en-source" }],
  bibliography: [{ text: "Manual English bibliography.  Two spaces." }], seo_title: "Author English SEO", seo_description: "Author English description",
  seo_keywords: ["manual"], canonical_url: "https://fixture.invalid/manual-english-a", og_title: "Author English OG",
  og_description: "Author English OG description", status: "draft", updated_at: enStamp, source_content_hash: "manual-source-a",
  source_article_updated_at: ruStamp, reviewed_at: null, approved_at: null, published_at: null, deleted_at: null };
const categories = [{ id: categoryId, name: "Ручная рубрика", slug: "manual-category" }];
type RouteKind = "edit" | "new" | "copy";
type Boundary = { actorId?: string; editorKey: string; current: Record<string, any> | null; fallback?: ReactNode; before?: ReactNode; after?: ReactNode };
type Options = { actorId?: string; role?: "owner" | "editor"; article?: unknown; english?: unknown;
  failTable?: string; rejectedRead?: boolean; clientUnavailable?: boolean; authRedirect?: boolean };

function fixture(options: Options = {}) {
  const actor = options.actorId ?? actorA, boundaries: Boundary[] = [], reads: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }> = [];
  const values: Record<string, unknown> = { articles: Object.hasOwn(options, "article") ? options.article : article,
    article_translations: Object.hasOwn(options, "english") ? options.english : english, article_working_drafts: null,
    categories, article_revisions: [], editor_templates: [], admin_audit_log: [] };
  const from = vi.fn((table: string) => {
    if (!Object.hasOwn(values, table)) throw Error(`Unexpected synthetic table ${table}`);
    let columns = "", single = false;
    const filters: Array<[string, unknown]> = [];
    const query = { select: (value: string) => { columns = value; return query; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; }, is: () => query,
      order: () => query, limit: () => query, contains: () => query, in: () => query,
      maybeSingle: () => { single = true; return query; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        reads.push({ table, columns, filters });
        if (options.failTable === table && options.rejectedRead) throw Error(secret);
        const source = table === "articles" && !single ? [{ id: articleId, title: article.title, status: "draft", updated_at: ruStamp }] : values[table];
        const selected = new Set(columns.split(","));
        const data = columns !== "*" && source && typeof source === "object" && !Array.isArray(source)
          ? Object.fromEntries(Object.entries(source).filter(([field]) => selected.has(field))) : source;
        return { data, error: options.failTable === table ? { code: "42501", message: secret } : null };
      }).then(resolve, reject) };
    return query;
  });
  const action = vi.fn(async () => undefined), rpc = vi.fn(() => { throw Error("Read fixtures must never write"); });
  const mocks = {
    "@/lib/auth": { getStaffSession: async () => {
      if (options.authRedirect) nativeRequire("next/navigation").redirect("/auth-required");
      return { configured: true, mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false }, role: options.role ?? "owner", user: { id: actor } };
    } },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => options.clientUnavailable ? null : { from, rpc } },
    "next/navigation": { notFound: nativeRequire("next/navigation").notFound, unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children) },
    "@/components/ArticleEditorLoader": { __esModule: true, default: (props: Boundary) => {
      // React may call a component without props while building a diagnostic stack.
      if (!props) return null;
      boundaries.push(props);
      return props.current ? createElement(Fragment, {}, props.before, createElement("section", { "data-test-editor": "true" }), props.after) : props.fallback;
    } },
    "@/components/ArticleCopyPicker": { __esModule: true, default: () => createElement("section", { "data-test-copy-picker": "true" }) },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) },
    "../actions": { duplicateArticleAction: action, discardArticleWorkingDraftAction: action, requestSocialPublicationAction: action,
      restoreArticleRevisionAction: action, softDeleteArticleAction: action },
  };
  const cache = new Map<string, any>();
  async function render(kind: RouteKind, query: Record<string, string> = {}) {
    const Page = loadModule(`app/(dashboard)/articles/${kind === "edit" ? "[id]" : "new"}/page.tsx`, mocks, cache).default;
    const tree = await Page({ params: Promise.resolve({ id: articleId }),
      searchParams: Promise.resolve({ ...query, ...(kind === "copy" ? { copyFrom: articleId } : {}) }) });
    const markup = renderToStaticMarkup(tree);
    expect(action).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
    return { markup, boundary: boundaries.at(-1)!, boundaries, reads, actor };
  }
  return { render, from, action, rpc, boundaries };
}
function expectFresh(page: Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>, key: string) {
  expect(page.boundaries).toHaveLength(1);
  expect(page.boundary.editorKey).toBe(key);
  expect(page.boundary.current?.actorId, JSON.stringify({ editorKey: page.boundary.editorKey,
    props: Object.keys(page.boundary.current ?? {}), baseline: process.env.M02_PENDING_OPERATION_LOAD_BASELINE_DIR ?? null })).toBe(page.actor);
  expect(page.markup).toContain('data-test-editor="true"');
}
function expectBlocked(page: Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>, key: string) {
  expect(page.boundaries).toHaveLength(1);
  expect(page.boundary.editorKey).toBe(key);
  expect(page.boundary.actorId).toBe(page.actor);
  expect(page.boundary.current).toBeNull();
  expect(page.markup).not.toContain('data-test-editor="true"');
  expect(page.markup).not.toContain(secret);
  expect(page.markup).not.toContain(ruText);
  expect(page.markup).not.toContain(enText);
  expect(page.markup).toContain('role="alert"');
}

describe("M02 actual article routes bind pending reload to the current staff actor", () => {
  it("binds edit to authenticated actor and preserves fresh canonical English/CAS", async () => {
    const page = await fixture().render("edit"); expectFresh(page, `article:${articleId}`);
    expect(page.boundary.current?.article).toEqual({ ...article, working_draft_version: 0 });
    expect(page.boundary.current?.englishTranslation).toEqual(english);
    expect(page.boundary.current?.canonicalEnglishTranslation).toEqual(english);
    expect(page.boundary.current?.categories).toEqual(categories);
  });
  it("binds new draft to a different current staff actor without borrowing entity identity", async () => {
    const page = await fixture({ actorId: actorB, role: "editor" }).render("new"); expectFresh(page, "new");
    expect(page.boundary.current?.article).toEqual({ status: "draft" });
    expect(page.boundary.current?.englishTranslation).toBeUndefined();
    expect(page.boundary.current?.canPublish).toBe(false);
  });
  it("binds copy actor/source separately while preserving author bytes and removing source CAS", async () => {
    const page = await fixture({ actorId: actorB }).render("copy"); expectFresh(page, `copy:${articleId}`);
    const current = page.boundary.current!;
    expect(current.draftKey).toBe(`copy-${articleId}`);
    for (const key of ["content_html", "content_json", "sources", "bibliography", "cover_alt"] as const) {
      expect(current.article[key]).toEqual(article[key]); expect(current.englishTranslation[key]).toEqual(english[key]);
    }
    expect(current.article.id).toBeUndefined(); expect(current.article.updated_at).toBeUndefined();
    expect(current.englishTranslation.id).toBeUndefined(); expect(current.englishTranslation.updated_at).toBeUndefined();
    expect(current.englishTranslation.article_id).toBeUndefined(); expect(current.canonicalEnglishTranslation).toBeUndefined();
    expect(current.article.slug).not.toBe(article.slug); expect(current.englishTranslation.slug).not.toBe(english.slug);
  });
  it.each(["edit", "new", "copy"] as const)("%s ignores route-supplied actor identity", async kind => {
    const page = await fixture().render(kind, { actorId: actorB, actor_id: actorB, saved: "1" });
    expectFresh(page, kind === "edit" ? `article:${articleId}` : kind === "copy" ? `copy:${articleId}` : "new");
    expect(page.boundary.current?.actorId).not.toBe(actorB);
  });
  it.each(["articles", "article_translations", "article_working_drafts", "categories"])("edit %s failure keeps actor scope but grants no editor", async failTable => {
    expectBlocked(await fixture({ actorId: actorB, failTable }).render("edit"), `article:${articleId}`);
  });
  it.each(["edit", "new", "copy"] as const)("%s unavailable dependency preserves actor scope and blocks editor", async kind => {
    const page = await fixture({ actorId: actorB, clientUnavailable: true }).render(kind);
    expectBlocked(page, kind === "edit" ? `article:${articleId}` : kind === "copy" ? `copy:${articleId}` : "new");
  });
  it.each(["edit", "copy"] as const)("%s refuses foreign article/English data without adopting foreign identity", async kind => {
    for (const patch of [{ article: { ...article, id: foreignId } }, { english: { ...english, article_id: foreignId } }]) {
      const page = await fixture({ actorId: actorB, ...patch }).render(kind);
      expectBlocked(page, kind === "edit" ? `article:${articleId}` : `copy:${articleId}`);
    }
  });
  it("copy missing source remains a blocked copy, never a new actorless draft", async () => {
    expectBlocked(await fixture({ article: null }).render("copy"), `copy:${articleId}`);
  });
  it("new mandatory read rejection retains current actor without diagnostics or editable defaults", async () => {
    expectBlocked(await fixture({ actorId: actorB, failTable: "categories", rejectedRead: true }).render("new"), "new");
  });
  it("optional template/revision failures leave a fresh actor-bound editor available", async () => {
    for (const failTable of ["editor_templates", "article_revisions"]) {
      const page = await fixture({ failTable }).render("edit"); expectFresh(page, `article:${articleId}`);
      expect(page.boundary.current?.article.content_html).toBe(article.content_html);
      expect(page.markup).not.toContain(secret);
    }
  });
  it.each(["edit", "new", "copy"] as const)("%s preserves native auth redirect before any editor/read", async kind => {
    const view = fixture({ authRedirect: true });
    await expect(view.render(kind)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(view.boundaries).toHaveLength(0); expect(view.from).not.toHaveBeenCalled(); expect(view.rpc).not.toHaveBeenCalled();
  });
});
