import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const nativeNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Exercise the actual page and local data/working-draft helpers. Browser-only
// editor components and provider/framework boundaries are isolated fixtures.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const baseline = process.env.M02_ARTICLE_READ_SOURCE_DIR;
  const override = baseline && ["app/(dashboard)/articles/[id]/page.tsx", "app/(dashboard)/articles/new/page.tsx"].includes(relative.replaceAll(path.sep, "/"))
    ? path.join(baseline, relative) : filename;
  const compiled = ts.transpileModule(readFileSync(override, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/")
        ? path.join(adminRoot, name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const sourceFile = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

class NotFoundSignal extends Error {}
const articleId = "111111ab-cdef-4111-8abc-111111abcdef";
const categoryId = "22222222-2222-4222-8222-222222222222";
const privateError = "PRIVATE_PROVIDER_TOKEN=do-not-expose-this-fixture";
const authorDash = String.fromCodePoint(0x2014);
const article = {
  id: articleId,
  title: `Авторский заголовок ${authorDash} без исправлений`,
  subtitle: "  Подзаголовок с пробелами  ",
  excerpt: "Первый абзац.\nВторой абзац.",
  slug: "article-fixture",
  content_html: `<p>Авторский текст&nbsp;${authorDash} café.</p>\n<p>Вторая строка.</p>`,
  content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Текст ${authorDash} café` }] }] },
  sources: [{ text: "https://example.org/ru?one=1&two=2" }],
  bibliography: [{ text: "Русская библиография.  Два пробела." }],
  category_id: categoryId,
  status: "draft",
  updated_at: "2026-09-23T12:00:00.000Z",
  cover_alt: "Авторское описание иллюстрации",
  cover_external_url: null,
  cover_media_id: null,
  seo_title: "Точный заголовок поиска",
  seo_description: "Точное описание",
  seo_keywords: ["книга", "автор"],
  og_title: "Точный заголовок карточки",
  og_description: "Точное описание карточки",
  allow_indexing: true,
  scheduled_at: null,
  published_at: null,
  legacy_path: null,
  canonical_url: null,
  featured: false,
  show_on_homepage: false,
  pinned: false,
};
const englishTranslation = {
  ...article,
  id: "33333333-3333-4333-8333-333333333333",
  article_id: articleId,
  locale: "en",
  title: `Original English ${authorDash} unchanged`,
  subtitle: "  Exact English subtitle  ",
  excerpt: "First paragraph.\nSecond paragraph.",
  slug: "english-fixture",
  content_html: `<p>English&nbsp;${authorDash} café.</p>\n<p>Second line.</p>`,
  content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `English ${authorDash} café` }] }] },
  sources: [{ text: "https://example.org/en?one=1&two=2" }],
  bibliography: [{ text: "English bibliography.  Two spaces." }],
  source_content_hash: null,
  source_article_updated_at: null,
  reviewed_at: null,
  approved_at: null,
  published_at: null,
  canonical_url: null,
  status: "draft",
};
const categories = [{ id: categoryId, name: "Литературные истории", slug: "author-stories" }];
type QueryKey = "article" | "english" | "categories" | "revisions" | "templates" | "workingDraft" | "copyPicker" | "socialRequests" | "socialResults";
type QueryResponse = { data: unknown; error: unknown };
type EditorProps = { article?: Record<string, unknown>; englishTranslation?: Record<string, unknown>; categories?: unknown };
type BoundaryProps = { editorKey?: string; current?: EditorProps | null; fallback?: ReactNode; before?: ReactNode; after?: ReactNode; retryHref?: string };

function fixture(options: {
  responses?: Partial<Record<QueryKey, QueryResponse>>;
  rejected?: QueryKey[];
  noClient?: boolean;
  factoryThrow?: unknown;
  role?: "owner" | "admin" | "editor";
} = {}) {
  const defaults: Record<QueryKey, unknown> = {
    article,
    english: englishTranslation,
    categories,
    revisions: [{ id: "revision-1", revision_number: 1, created_at: article.updated_at, change_summary: "Fixture revision", changed_by: "fixture-staff" }],
    templates: [{ id: "template-1", label: "Fixture template", content_html: "<p>Template</p>", visibility: "personal", owner_id: "fixture-staff" }],
    workingDraft: null,
    copyPicker: [{ id: articleId, title: article.title, status: article.status, updated_at: article.updated_at }],
    socialRequests: [{ id: "social-request-1", created_at: article.updated_at, metadata: { article_id: articleId } }],
    socialResults: [{ action: "social_publish.succeeded", created_at: article.updated_at, metadata: { platform: "dzen", state: "rss-ready" } }],
  };
  const calls: QueryKey[] = [];
  const editorProps: EditorProps[] = [];
  const boundaryProps: BoundaryProps[] = [];
  const Boundary = (props: EditorProps & BoundaryProps) => {
    boundaryProps.push(props);
    const current = Object.hasOwn(props, "current") ? props.current : props;
    if (!current) return props.fallback;
    editorProps.push(current);
    return createElement(Fragment, {}, props.before, createElement("section", { "data-test-editor": "true" }), props.after);
  };
  const from = vi.fn((table: string) => {
    let columns = "";
    const equals = new Map<string, unknown>();
    const query = {
      select: (value: string) => { columns = value; return query; },
      eq: (key: string, value: unknown) => { equals.set(key, value); return query; },
      is: () => query,
      order: () => query,
      limit: () => query,
      contains: () => query,
      in: () => query,
      maybeSingle: () => query,
      then: (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => {
          const queryKey: QueryKey = table === "articles"
            ? columns === "*" || equals.has("id") ? "article" : "copyPicker"
            : table === "article_translations" ? "english"
            : table === "categories" ? "categories"
            : table === "article_revisions" ? "revisions"
            : table === "editor_templates" ? "templates"
            : table === "article_working_drafts" ? "workingDraft"
            : table === "admin_audit_log" && equals.get("action") === "social_publish.requested" ? "socialRequests"
            : table === "admin_audit_log" ? "socialResults"
            : (() => { throw new Error(`Unexpected fixture table: ${table}`); })();
          calls.push(queryKey);
          if (options.rejected?.includes(queryKey)) throw new TypeError(privateError);
          return options.responses?.[queryKey] ?? { data: defaults[queryKey], error: null };
        }).then(fulfilled, rejected),
    };
    return query;
  });
  const action = vi.fn(async () => undefined);
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (Object.hasOwn(options, "factoryThrow")) throw options.factoryThrow;
      return options.noClient ? null : { from };
    } },
    "@/lib/auth": { getStaffSession: async () => ({ configured: true, mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false }, role: options.role || "owner", user: { id: "fixture-staff" } }) },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://probpera.ru" } },
    "next/navigation": { notFound: () => { throw new NotFoundSignal("framework not found"); }, unstable_rethrow: nativeNavigation.unstable_rethrow },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
    "@/components/ArticleEditorLoader": {
      __esModule: true,
      default: Boundary,
    },
    "@/components/ArticleCopyPicker": { __esModule: true, default: () => createElement("section", { "data-test-copy-picker": "true" }) },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) },
    "../actions": {
      duplicateArticleAction: action,
      discardArticleWorkingDraftAction: action,
      requestSocialPublicationAction: action,
      restoreArticleRevisionAction: action,
      softDeleteArticleAction: action,
    },
  };
  async function render(kind: "edit" | "new", copyFrom?: string, requestId = articleId) {
    const page = loadAdminModule(`app/(dashboard)/articles/${kind === "edit" ? "[id]" : "new"}/page.tsx`, mocks).default as (props: {
      params: Promise<{ id: string }>;
      searchParams: Promise<{ copyFrom?: string }>;
    }) => Promise<ReactNode>;
    const tree = await page({
      params: Promise.resolve({ id: requestId }),
      searchParams: Promise.resolve(copyFrom ? { copyFrom } : {}),
    });
    const rootBoundary = isValidElement<BoundaryProps>(tree) && tree.type === Boundary ? tree : null;
    const markup = renderToStaticMarkup(tree);
    expect(action).not.toHaveBeenCalled();
    return { markup, $: load(markup), editorProps, boundaryProps, rootBoundary, calls };
  }
  return { render, editorProps, boundaryProps, calls };
}

type RenderedPage = Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>;
function expectBlocked(page: RenderedPage) {
  expect(page.editorProps).toHaveLength(0);
  expect(page.$("[data-test-editor]").length).toBe(0);
  expect(page.$("body").text()).toMatch(/Не удалось загрузить данные редактора|временно недоступн/iu);
  expect(page.markup).not.toContain(privateError);
  const retry = page.$("a").filter((_index, node) => /Повторить загрузку/iu.test(page.$(node).text()));
  expect(retry.length).toBeGreaterThan(0);
  expect(retry.attr("data-next-link")).toBeUndefined();
}
const failure = (code = "57014"): QueryResponse => ({ data: null, error: { code, message: privateError } });
const modes = ["response error", "rejected transport"] as const;
function failingFixture(key: QueryKey, mode: typeof modes[number]) {
  return mode === "response error"
    ? fixture({ responses: { [key]: failure() } })
    : fixture({ rejected: [key] });
}
const protectedContentFields = ["title", "subtitle", "excerpt", "content_html", "content_json", "sources", "bibliography", "cover_alt", "seo_title", "seo_description", "seo_keywords", "og_title", "og_description"] as const;
function expectUnchangedContent(actual: Record<string, unknown> | undefined, expected: Record<string, unknown>) {
  expect(actual).toBeDefined();
  for (const field of protectedContentFields) {
    expect(actual?.[field], field).toEqual(expected[field]);
    if (typeof expected[field] === "string") {
      expect(Buffer.from(String(actual?.[field]), "utf8").equals(Buffer.from(expected[field] as string, "utf8")), `${field} bytes`).toBe(true);
    }
  }
}

function omitField(record: Record<string, unknown>, omitted: string) {
  return Object.fromEntries(Object.entries(record).filter(([field]) => field !== omitted));
}
const articleModes = ["edit", "copy"] as const;
async function renderMode(f: ReturnType<typeof fixture>, mode: typeof articleModes[number]) {
  return mode === "edit" ? f.render("edit") : f.render("new", articleId);
}

describe("M02 article reads through real edit/new server components", () => {
  it("an uppercase UUID edit route preserves the canonical article and English identity", async () => {
    const page = await fixture().render("edit", undefined, articleId.toUpperCase());
    expect(page.editorProps).toHaveLength(1);
    expect(page.editorProps[0].article?.id).toBe(articleId);
    expect(page.editorProps[0].englishTranslation?.article_id).toBe(articleId);
    expectUnchangedContent(page.editorProps[0].article, article);
    expectUnchangedContent(page.editorProps[0].englishTranslation, englishTranslation);
  });

  it("an uppercase UUID copy source preserves canonical RU and EN source content", async () => {
    const page = await fixture().render("new", articleId.toUpperCase());
    expect(page.editorProps).toHaveLength(1);
    expectUnchangedContent(page.editorProps[0].article, article);
    expectUnchangedContent(page.editorProps[0].englishTranslation, englishTranslation);
    expect(page.editorProps[0].article?.status).toBe("draft");
    expect(page.editorProps[0].englishTranslation?.locale).toBe("en");
  });

  it.each((["edit", "new"] as const).flatMap((kind) => ["article_id", "locale"].map((field) => [kind, field] as const)))(
    "%s refuses an English response belonging to a different %s",
    async (kind, field) => {
      const foreignTranslation = { ...englishTranslation, [field]: field === "locale" ? "ru" : "foreign-article" };
      expectBlocked(await fixture({ responses: { english: { data: foreignTranslation, error: null } } }).render(kind, kind === "new" ? articleId : undefined));
    },
  );
  it.each(modes)("an article %s is dependency failure, not a missing article", async (mode) => {
    expectBlocked(await failingFixture("article", mode).render("edit"));
  });

  it("a confirmed absent article preserves the framework notFound signal", async () => {
    const f = fixture({ responses: { article: { data: null, error: null } } });
    await expect(f.render("edit")).rejects.toBeInstanceOf(NotFoundSignal);
    expect(f.editorProps).toHaveLength(0);
  });

  it("permission failure cannot expose an accompanying article or raw diagnostics", async () => {
    const page = await fixture({ responses: { article: { data: article, error: failure("42501").error } } }).render("edit");
    expectBlocked(page);
    expect(page.markup).not.toContain(article.title);
    expect(page.markup).not.toContain(article.content_html);
  });

  it("a missing database client is dependency failure rather than notFound", async () => {
    expectBlocked(await fixture({ noClient: true }).render("edit"));
  });

  it.each((["english", "categories", "workingDraft"] as const).flatMap((key) => modes.map((mode) => [key, mode] as const)))(
    "an edit %s %s cannot open a partial bundle",
    async (key, mode) => expectBlocked(await failingFixture(key, mode).render("edit")),
  );

  it("a corrupt working draft cannot silently open the published copy for editing", async () => {
    expectBlocked(await fixture({ responses: { workingDraft: { data: { payload: privateError }, error: null } } }).render("edit"));
  });

  it("a confirmed absent English translation remains a valid new translation state", async () => {
    const page = await fixture({ responses: { english: { data: null, error: null } } }).render("edit");
    expect(page.editorProps).toHaveLength(1);
    expect(page.editorProps[0].englishTranslation).toBeUndefined();
    expectUnchangedContent(page.editorProps[0].article, article);
  });

  it("successful existing RU and EN reach the editor without content changes", async () => {
    const page = await fixture().render("edit");
    expect(page.editorProps).toHaveLength(1);
    expectUnchangedContent(page.editorProps[0].article, article);
    expectUnchangedContent(page.editorProps[0].englishTranslation, englishTranslation);
    expect(page.editorProps[0].categories).toEqual(categories);
    expect(page.calls).toEqual(expect.arrayContaining(["article", "english", "categories", "workingDraft", "revisions", "templates", "socialRequests", "socialResults"]));
  });

  it.each(modes)("optional history %s stays visibly unavailable while the editor remains usable", async (mode) => {
    const page = await failingFixture("revisions", mode).render("edit");
    expect(page.editorProps).toHaveLength(1);
    expect(page.$("body").text()).toContain("История версий временно недоступна");
    expect(page.$("body").text()).not.toContain("Нет сохранённых версий для этой статьи");
    expect(page.markup).not.toContain(privateError);
  });

  it.each((["socialRequests", "socialResults"] as const).flatMap((key) => modes.map((mode) => [key, mode] as const)))(
    "optional %s %s does not invent a delivery state",
    async (key, mode) => {
      const page = await failingFixture(key, mode).render("edit");
      expect(page.editorProps).toHaveLength(1);
      const dzen = page.$(".social-channel").filter((_index, node) => page.$(node).find("strong").text() === "Дзен");
      expect(dzen.find("small").text()).toBe("Недоступно");
      expect(dzen.text()).not.toMatch(/Не отправлялось|Ожидает отправки/u);
      expect(page.markup).not.toContain(privateError);
    },
  );

  it.each((["edit", "new"] as const).flatMap((kind) => modes.map((mode) => [kind, mode] as const)))(
    "optional templates on %s with %s remain explicitly unavailable",
    async (kind, mode) => {
      const page = await failingFixture("templates", mode).render(kind);
      expect(page.editorProps).toHaveLength(1);
      expect(page.$("body").text()).toContain("Шаблоны временно недоступны");
      expect(page.markup).not.toContain(privateError);
    },
  );

  it.each(modes)("new article categories %s cannot open an incomplete editor", async (mode) => {
    expectBlocked(await failingFixture("categories", mode).render("new"));
  });

  it.each((["article", "english"] as const).flatMap((key) => modes.map((mode) => [key, mode] as const)))(
    "copy %s %s cannot silently become an incomplete new article",
    async (key, mode) => expectBlocked(await failingFixture(key, mode).render("new", articleId)),
  );

  it("a confirmed missing copy source cannot become a clean blank editor", async () => {
    expectBlocked(await fixture({ responses: { article: { data: null, error: null } } }).render("new", articleId));
  });

  it.each(modes)("optional copy-picker %s does not prevent a complete clean new article", async (mode) => {
    const page = await failingFixture("copyPicker", mode).render("new");
    expect(page.editorProps).toHaveLength(1);
    expect(page.$("[data-test-copy-picker]").length).toBe(0);
    expect(page.$("body").text()).toMatch(/(?:[Пп]оиск|[Сс]писок|[Вв]ыбор)[^.]*недоступ/iu);
    expect(page.markup).not.toContain(privateError);
  });

  it("a successful RU/EN copy preserves source content and independently creates draft routing", async () => {
    const page = await fixture().render("new", articleId);
    expect(page.editorProps).toHaveLength(1);
    expectUnchangedContent(page.editorProps[0].article, article);
    expectUnchangedContent(page.editorProps[0].englishTranslation, englishTranslation);
    expect(page.editorProps[0].article?.status).toBe("draft");
    expect(page.editorProps[0].article?.slug).not.toBe(article.slug);
    expect(page.editorProps[0].englishTranslation?.slug).not.toBe(englishTranslation.slug);
  });

  it.each(articleModes.flatMap((mode) => ["content_html", "content_json", "sources", "bibliography", "category_id"].map((field) => [mode, field] as const)))(
    "%s blocks a Russian record with a missing %s rather than opening empty content",
    async (mode, field) => {
      expectBlocked(await renderMode(fixture({ responses: { article: { data: omitField(article, field), error: null } } }), mode));
    },
  );

  it.each(articleModes.flatMap((mode) => ["content_html", "content_json", "sources", "bibliography"].map((field) => [mode, field] as const)))(
    "%s blocks an English record with a missing %s rather than replacing its content",
    async (mode, field) => {
      expectBlocked(await renderMode(fixture({ responses: { english: { data: omitField(englishTranslation, field), error: null } } }), mode));
    },
  );

  it.each(articleModes.flatMap((mode) => (["article", "english"] as const).flatMap((key) => [
    [mode, key, "seo_keywords", {}],
    [mode, key, "sources", [{ text: {} }]],
    [mode, key, "bibliography", {}],
    [mode, key, "content_json", []],
  ] as const)))(
    "%s blocks malformed %s.%s before the editor consumes it",
    async (mode, key, field, value) => {
      const original = key === "article" ? article : englishTranslation;
      const invalidRecord = { ...original, [field]: value };
      expectBlocked(await renderMode(fixture({ responses: { [key]: { data: invalidRecord, error: null } } }), mode));
    },
  );

  it.each(articleModes)("%s cannot open an article response for a different route identity", async (mode) => {
    expectBlocked(await renderMode(fixture({ responses: { article: { data: { ...article, id: "44444444-4444-4444-8444-444444444444" }, error: null } } }), mode));
  });

  it("edit cannot combine an English translation belonging to a different article", async () => {
    expectBlocked(await fixture({ responses: { english: { data: { ...englishTranslation, article_id: "44444444-4444-4444-8444-444444444444" }, error: null } } }).render("edit"));
  });

  it("edit cannot merge an otherwise valid working draft belonging to another article", async () => {
    const payload = Object.fromEntries(Object.entries(article).filter(([field]) => !["id", "updated_at", "cover_media_id"].includes(field)));
    const workingDraft = {
      article_id: "44444444-4444-4444-8444-444444444444",
      base_article_updated_at: article.updated_at,
      payload: { ...payload, canonical_url: "https://example.org/article-fixture" },
      english_payload: { mode: "disabled" },
      expected_english_updated_at: englishTranslation.updated_at,
      version: 1,
      updated_at: article.updated_at,
    };
    const parser = loadAdminModule("app/(dashboard)/articles/article-working-draft.ts", {}).parseArticleWorkingDraft as (value: unknown) => unknown;
    expect(() => parser(workingDraft)).not.toThrow();
    expectBlocked(await fixture({ responses: { workingDraft: { data: workingDraft, error: null } } }).render("edit"));
  });

  it("a malformed history text field remains unavailable rather than crashing React", async () => {
    const page = await fixture({ responses: { revisions: { data: [{ id: "revision-1", revision_number: 1, created_at: article.updated_at, change_summary: { raw: privateError }, changed_by: "fixture-staff" }], error: null } } }).render("edit");
    expect(page.editorProps).toHaveLength(1);
    expect(page.$("body").text()).toContain("История версий временно недоступна");
    expect(page.markup).not.toContain(privateError);
  });

  it.each(["edit", "new"] as const)("%s keeps malformed template labels unavailable", async (kind) => {
    const page = await fixture({ responses: { templates: { data: [{ id: "template-1", label: { raw: privateError }, content_html: "<p>Template</p>", visibility: "personal", owner_id: "fixture-staff" }], error: null } } }).render(kind);
    expect(page.editorProps).toHaveLength(1);
    expect(page.$("body").text()).toContain("Шаблоны временно недоступны");
    expect(page.markup).not.toContain(privateError);
  });

  it("new hides a malformed copy-picker row without inventing a blank list", async () => {
    const page = await fixture({ responses: { copyPicker: { data: [{ id: articleId, title: { raw: privateError }, status: "draft", updated_at: article.updated_at }], error: null } } }).render("new");
    expect(page.editorProps).toHaveLength(1);
    expect(page.$("[data-test-copy-picker]").length).toBe(0);
    expect(page.$("body").text()).toMatch(/(?:[Пп]оиск|[Сс]писок|[Вв]ыбор)[^.]*недоступ/iu);
    expect(page.markup).not.toContain(privateError);
  });

  it("a malformed social action remains unavailable rather than inventing a retry state", async () => {
    const page = await fixture({ responses: { socialResults: { data: [{ action: { raw: privateError }, created_at: article.updated_at, metadata: { platform: "dzen", state: "rss-ready" } }], error: null } } }).render("edit");
    expect(page.editorProps).toHaveLength(1);
    const dzen = page.$(".social-channel").filter((_index, node) => page.$(node).find("strong").text() === "Дзен");
    expect(dzen.find("small").text()).toBe("Недоступно");
    expect(page.markup).not.toContain(privateError);
  });

  it("a completed aggregate receipt preserves the preceding successful Dzen channel result", async () => {
    const page = await fixture({ responses: { socialResults: { data: [
      { action: "social_publish.succeeded", created_at: article.updated_at, metadata: { article_id: articleId, platform: "dzen", state: "rss-ready" } },
      { action: "social_publish.completed", created_at: article.updated_at, metadata: { article_id: articleId, platforms: { dzen: "rss-ready" } } },
    ], error: null } } }).render("edit");
    expect(page.editorProps).toHaveLength(1);
    const dzen = page.$(".social-channel").filter((_index, node) => page.$(node).find("strong").text() === "Дзен");
    expect(dzen.find("small").text()).toBe("RSS готов");
    expect(dzen.text()).not.toContain("Недоступно");
  });

  it("a failed delivery shows its state without exposing provider diagnostics", async () => {
    const page = await fixture({ responses: { socialResults: { data: [
      { action: "social_publish.failed", created_at: article.updated_at, metadata: { article_id: articleId, platform: "dzen", error: privateError } },
    ], error: null } } }).render("edit");
    expect(page.editorProps).toHaveLength(1);
    const dzen = page.$(".social-channel").filter((_index, node) => page.$(node).find("strong").text() === "Дзен");
    expect(dzen.find("small").text()).toBe("Ошибка доставки");
    expect(page.markup).not.toContain(privateError);
  });

  it.each(articleModes)("%s accepts a confirmed empty category list without altering the existing category", async (mode) => {
    const page = await renderMode(fixture({ responses: { categories: { data: [], error: null } } }), mode);
    expect(page.editorProps).toHaveLength(1);
    expect(page.editorProps[0].categories).toEqual([]);
    expect(page.editorProps[0].article?.category_id).toBe(article.category_id);
  });

  it("a copy with a confirmed absent English translation preserves the complete Russian source", async () => {
    const page = await fixture({ responses: { english: { data: null, error: null } } }).render("new", articleId);
    expect(page.editorProps).toHaveLength(1);
    expect(page.editorProps[0].englishTranslation).toBeUndefined();
    expectUnchangedContent(page.editorProps[0].article, article);
  });

  it.each(articleModes.flatMap((mode) => ["/", "/admin", "/staff/panel"].map((basePath) => [mode, basePath] as const)))(
    "%s retries the same article context with a fresh document request under %s",
    async (mode, basePath) => {
      vi.stubEnv("ADMIN_BASE_PATH", basePath);
      try {
        const page = await renderMode(failingFixture("english", "response error"), mode);
        expectBlocked(page);
        const retry = page.$("a").filter((_index, node) => /Повторить загрузку/iu.test(page.$(node).text()));
        const prefix = basePath === "/" ? "" : basePath;
        const route = mode === "edit" ? `/articles/${articleId}` : `/articles/new?copyFrom=${articleId}`;
        expect(retry.length).toBe(1);
        expect(retry.attr("href")).toBe(`${prefix}${route}`);
        expect(retry.attr("data-next-link")).toBeUndefined();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );
});

function expectStableBoundary(page: RenderedPage, editorKey: string, ready: boolean) {
  expect(page.rootBoundary).not.toBeNull();
  expect(page.rootBoundary?.key).toBe(editorKey);
  expect(page.rootBoundary?.props.editorKey).toBe(editorKey);
  expect(page.boundaryProps).toHaveLength(1);
  expect(page.rootBoundary?.props.retryHref).toBeDefined();
  if (ready) {
    expect(page.rootBoundary?.props.current).not.toBeNull();
    expect(page.editorProps).toHaveLength(1);
  } else {
    expect(page.rootBoundary?.props.current).toBeNull();
    expect(page.rootBoundary?.props.before).toBeUndefined();
    expect(page.rootBoundary?.props.after).toBeUndefined();
    expect(page.$("form")).toHaveLength(0);
    expectBlocked(page);
  }
}
function nativeReadSignal(kind: "redirect" | "notFound") {
  try { kind === "redirect" ? nativeNavigation.redirect("/fixture-native") : nativeNavigation.notFound(); }
  catch (error) { return error; }
  throw new Error("Expected native control signal");
}
describe("M02 stable article root read boundary", () => {
  it.each([
    ["edit", undefined, `article:${articleId}`],
    ["new", undefined, "new"],
    ["new", articleId, `copy:${articleId}`],
  ] as const)("%s ready route %s returns the single keyed root boundary", async (kind, copyFrom, key) => {
    const page = await fixture().render(kind, copyFrom);
    expectStableBoundary(page, key, true);
    expect(page.rootBoundary?.props.before).toBeDefined();
    if (kind === "edit") expect(page.rootBoundary?.props.after).toBeDefined();
  });
  it.each((["article", "english", "categories", "workingDraft"] as const).flatMap(key => modes.map(mode => [key, mode] as const)))(
    "edit %s %s returns same keyed boundary without stale mutation controls", async (key, mode) => {
      const page = await failingFixture(key, mode).render("edit");
      expectStableBoundary(page, `article:${articleId}`, false);
      expect(page.markup).not.toMatch(/Архивировать|Отменить правки|Повторить проверку Дзена/u);
    }
  );
  it.each((["article", "english", "categories"] as const).flatMap(key => modes.map(mode => [key, mode] as const)))(
    "copy %s %s returns same copy boundary without a clean new editor", async (key, mode) => {
      expectStableBoundary(await failingFixture(key, mode).render("new", articleId), `copy:${articleId}`, false);
    }
  );
  it.each(modes)("clean new categories %s keeps the new root boundary", async mode => {
    expectStableBoundary(await failingFixture("categories", mode).render("new"), "new", false);
  });
  it.each([
    ["edit", undefined, `article:${articleId}`], ["new", undefined, "new"], ["new", articleId, `copy:${articleId}`],
  ] as const)("%s no client %s keeps the same initial-failure boundary", async (kind, copyFrom, key) => {
    expectStableBoundary(await fixture({ noClient: true }).render(kind, copyFrom), key, false);
  });
  it.each([
    ["edit", undefined, `article:${articleId}`], ["new", undefined, "new"], ["new", articleId, `copy:${articleId}`],
  ] as const)("%s ordinary client factory throw %s returns safe read failure", async (kind, copyFrom, key) => {
    expectStableBoundary(await fixture({ factoryThrow: new Error(privateError) }).render(kind, copyFrom), key, false);
  });
  it.each((["edit", "new"] as const).flatMap(kind => (["redirect", "notFound"] as const).map(signal => [kind, signal] as const)))(
    "%s client factory %s remains a native control signal", async (kind, signal) => {
      const native = nativeReadSignal(signal), f = fixture({ factoryThrow: native });
      await expect(f.render(kind)).rejects.toBe(native); expect(f.boundaryProps).toHaveLength(0);
    }
  );
  it("uppercase edit aliases use the same canonical boundary key on success and failure", async () => {
    expectStableBoundary(await fixture().render("edit", undefined, articleId.toUpperCase()), `article:${articleId}`, true);
    expectStableBoundary(await failingFixture("english", "response error").render("edit", undefined, articleId.toUpperCase()), `article:${articleId}`, false);
  });
  it("uppercase copy aliases retain their existing draftKey spelling under the canonical boundary", async () => {
    const page = await fixture().render("new", articleId.toUpperCase());
    expectStableBoundary(page, `copy:${articleId}`, true);
    expect((page.rootBoundary?.props.current as { draftKey?: string }).draftKey).toBe(`copy-${articleId.toUpperCase()}`);
    expectStableBoundary(await failingFixture("english", "response error").render("new", articleId.toUpperCase()), `copy:${articleId}`, false);
  });
  it("invalid copy intent cannot reuse the clean-new root identity", async () => {
    expectStableBoundary(await fixture().render("new", "not-a-uuid"), "copy:not-a-uuid", false);
  });
  it.each((["edit", "new"] as const).flatMap(kind => (["owner", "admin", "editor"] as const).map(role => [kind, role] as const)))(
    "%s preserves actual server role capabilities for %s", async (kind, role) => {
      const page = await fixture({ role }).render(kind); const props = page.editorProps[0] as { canPublish?: boolean; canOverridePublicationChecklist?: boolean };
      expect(props.canPublish).toBe(role === "owner" || role === "admin");
      expect(props.canOverridePublicationChecklist).toBe(role === "owner");
    }
  );
  it("a verified private working draft remains complete inside the same ready boundary", async () => {
    const payload = Object.fromEntries(Object.entries(article).filter(([field]) => !["id", "updated_at", "cover_media_id"].includes(field)));
    const workingDraft = { article_id: articleId, base_article_updated_at: article.updated_at,
      payload: { ...payload, canonical_url: "https://example.org/article-fixture" }, english_payload: { mode: "disabled" },
      expected_english_updated_at: englishTranslation.updated_at, version: 2, updated_at: article.updated_at };
    const page = await fixture({ responses: { article: { data: { ...article, status: "published" }, error: null }, workingDraft: { data: workingDraft, error: null } } }).render("edit");
    expectStableBoundary(page, `article:${articleId}`, true);
    expectUnchangedContent(page.editorProps[0].article, article);
    expect(page.editorProps[0].article?.working_draft_version).toBe(2);
    expect(page.$("body").text()).toContain("Отменить правки");
  });
});
