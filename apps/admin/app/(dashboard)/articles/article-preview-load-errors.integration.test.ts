import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Execute the real server page and working-draft parser. Only provider,
// framework navigation, font loading and CSS are replaced at the boundary.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
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
class RedirectSignal extends Error {}
const articleId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const privateError = "PRIVATE_PROVIDER_SECRET=never-render-this-fixture";
const authorDash = String.fromCodePoint(0x2014);
const article = {
  id: articleId,
  title: `Авторский заголовок ${authorDash} café`,
  subtitle: "  Точный подзаголовок  ",
  excerpt: "Первая строка.\nВторая строка.",
  content_html: `<p>  Авторский текст&nbsp;${authorDash} café.  </p>\n<p>Вторая строка.</p>`,
  cover_external_url: null,
  cover_alt: "Точное описание",
  updated_at: "2026-09-23T12:00:00.000Z",
  status: "draft",
  category_id: categoryId,
  categories: { name: "Литературные истории" },
};
const english = {
  article_id: articleId,
  locale: "en",
  title: `Original English ${authorDash} café`,
  subtitle: "  Exact subtitle  ",
  excerpt: "First line.\nSecond line.",
  content_html: `<p>  English&nbsp;${authorDash} café.  </p>\n<p>Second line.</p>`,
  cover_alt: "Exact description",
  updated_at: "2026-09-23T12:00:00.000Z",
  status: "draft",
};
const categories = [{ id: categoryId, name: "Литературные истории" }];
type QueryKey = "article" | "english" | "workingDraft" | "categories";
type QueryResponse = { data: unknown; error: unknown };

function workingDraft() {
  return {
    article_id: articleId,
    base_article_updated_at: article.updated_at,
    payload: {
      title: `Черновик ${authorDash} сохранён`, subtitle: article.subtitle,
      excerpt: article.excerpt, slug: "saved-draft", content_html: "<p>Сохранённый рабочий текст.</p>",
      content_json: { type: "doc", content: [] }, category_id: categoryId,
      status: "draft", scheduled_at: null, published_at: null,
      cover_external_url: null, cover_alt: article.cover_alt, legacy_path: null,
      seo_title: "", seo_description: "", seo_keywords: [], canonical_url: "https://example.org/draft",
      og_title: "", og_description: "", allow_indexing: true,
      sources: [], bibliography: [], featured: false, show_on_homepage: false, pinned: false,
    },
    english_payload: {
      mode: "save",
      payload: {
        title: "Saved English draft", subtitle: english.subtitle, excerpt: english.excerpt,
        content_html: "<p>Saved English working text.</p>", content_json: { type: "doc", content: [] },
        cover_alt: english.cover_alt, slug: "saved-english", sources: [], bibliography: [],
        seo_title: "", seo_description: "", seo_keywords: [], canonical_url: null,
        og_title: "", og_description: "", status: "draft", source_content_hash: "fixture-source",
        reviewed_at: null, approved_at: null, published_at: null, deleted_at: null,
      },
    },
    expected_english_updated_at: english.updated_at,
    version: 1,
    updated_at: "2026-09-24T12:00:00.000Z",
  };
}

function fixture(options: {
  requestId?: string;
  responses?: Partial<Record<QueryKey, QueryResponse>>;
  rejected?: QueryKey[];
  noClient?: boolean;
  clientSignal?: Error;
} = {}) {
  const defaults: Record<QueryKey, unknown> = { article, english, workingDraft: null, categories };
  const from = vi.fn((table: string) => {
    const key = ({ articles: "article", article_translations: "english", article_working_drafts: "workingDraft", categories: "categories" } as const)[table as "articles"];
    if (!key) throw new Error(`Unexpected table ${table}`);
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: () => query,
      then: (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => {
          if (options.rejected?.includes(key)) throw new TypeError(privateError);
          return options.responses?.[key] || { data: defaults[key], error: null };
        }).then(fulfilled, rejected),
    };
    return query;
  });
  const mocks = {
    "@/lib/auth": { getStaffSession: async () => ({ configured: true, mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false }, role: "editor", user: { id: "22222222-2222-4222-8222-222222222222", email: "fixture@example.invalid" } }) },
    "@/lib/supabase/server": {
      createServerSupabaseClient: async () => {
        if (options.clientSignal) throw options.clientSignal;
        return options.noClient ? null : { from };
      },
    },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, notFound: () => { throw new NotFoundSignal("NEXT_NOT_FOUND"); } },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }: { children?: ReactNode }) =>
        createElement("a", { ...props, "data-next-link": "true" }, children),
    },
    "@/components/EditorialPreviewFonts": { editorialPreviewFonts: "fixture-fonts" },
    "@/components/EditorialPreview.module.css": { __esModule: true, default: { fonts: "fixture-font-styles", reader: "fixture-reader" } },
  };
  const Page = loadAdminModule("app/(dashboard)/articles/[id]/preview/page.tsx", mocks).default as
    (args: { params: Promise<{ id: string }>; searchParams: Promise<{ locale?: string; viewport?: string }> }) => Promise<ReactNode>;
  return {
    async render(locale = "ru", viewport = "desktop") {
      const markup = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: options.requestId || articleId }), searchParams: Promise.resolve({ locale, viewport }) }));
      return { markup, $: load(markup) };
    },
  };
}

function expectBlocked(page: Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>) {
  expect(page.$(".admin-article-preview").length).toBe(0);
  expect(page.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(page.$("body").text()).not.toContain("Английская версия ещё не создана");
  expect(page.markup).not.toContain(privateError);
  const retry = page.$("a").filter((_index, node) => /Повторить загрузку/u.test(page.$(node).text()));
  expect(retry.length).toBe(1);
  expect(retry.attr("data-next-link")).toBeUndefined();
}

describe("M02 actual article preview dependency boundaries", () => {
  it.each((["article", "english", "workingDraft", "categories"] as const).flatMap((key) => ["error", "rejected"] .map((mode) => [key, mode] as const)))(
    "%s %s blocks incomplete preview without inventing missing content",
    async (key, mode) => {
      const options = mode === "rejected" ? { rejected: [key] } : { responses: { [key]: { data: null, error: { code: "57014", message: privateError } } } };
      expectBlocked(await fixture(options).render("en"));
    },
  );

  it("an unavailable client produces a dependency state instead of notFound", async () => {
    expectBlocked(await fixture({ noClient: true }).render());
  });

  it("a successful inaccessible or absent article keeps the framework notFound signal", async () => {
    await expect(fixture({ responses: { article: { data: null, error: null } } }).render()).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("framework redirects outside query settlement are not converted to data errors", async () => {
    const signal = new RedirectSignal("NEXT_REDIRECT");
    await expect(fixture({ clientSignal: signal }).render()).rejects.toBe(signal);
  });

  it("a confirmed absent English version has an honest empty state and no Russian substitution", async () => {
    const page = await fixture({ responses: { english: { data: null, error: null } } }).render("en");
    expect(page.$(".admin-article-preview").length).toBe(0);
    expect(page.$("body").text()).toContain("Английская версия ещё не создана");
    expect(page.markup).not.toContain(article.title);
  });

  it.each(["ru", "en"])("successful %s preview preserves selected text and HTML bytes", async (locale) => {
    const expected = locale === "en" ? english : article;
    const page = await fixture().render(locale, "mobile");
    expect(page.$("article.admin-article-preview.is-mobile").length).toBe(1);
    expect(page.$("article h1").text()).toBe(expected.title);
    expect(page.$(".preview-lead").text()).toBe(expected.excerpt);
    expect(page.markup).toContain(`<div class="preview-prose">${expected.content_html}</div>`);
  });

  it.each((["article", "english"] as const).flatMap((key) => [
    [key, "missing HTML", undefined], [key, "object HTML", {}],
  ] as const))("%s %s is rejected before an empty preview appears", async (key, _label, html) => {
    const data = { ...(key === "article" ? article : english), content_html: html };
    expectBlocked(await fixture({ responses: { [key]: { data, error: null } } }).render("en"));
  });

  it.each((["article", "english"] as const).flatMap((key) => [undefined, "not-a-date", ""].map((date) => [key, date] as const)))(
    "%s invalid updated_at %s cannot crash the date formatter", async (key, date) => {
      const data = { ...(key === "article" ? article : english), updated_at: date };
      expectBlocked(await fixture({ responses: { [key]: { data, error: null } } }).render("en"));
    },
  );

  it.each([{}, { name: { raw: privateError } }, [{ name: "Valid" }, { name: "Unexpected second category" }]])(
    "malformed embedded category relation %j cannot crash or invent its label", async (relation) => {
      expectBlocked(await fixture({ responses: { article: { data: { ...article, categories: relation }, error: null } } }).render());
    },
  );

  it.each([null, { name: "Литературные истории" }, [{ name: "Литературные истории" }], []])(
    "valid embedded category shape %j remains compatible", async (relation) => {
      const page = await fixture({ responses: { article: { data: { ...article, categories: relation }, error: null } } }).render();
      expect(page.$(".admin-article-preview").length).toBe(1);
    },
  );

  it.each([null, [{}], [{ id: categoryId, name: { raw: privateError } }]])(
    "invalid categories list %j cannot become a fallback category", async (data) => {
      expectBlocked(await fixture({ responses: { categories: { data, error: null } } }).render());
    },
  );

  it("confirmed empty categories and nullable cover retain a complete preview", async () => {
    const page = await fixture({ responses: { categories: { data: [], error: null }, article: { data: { ...article, category_id: null, categories: null }, error: null } } }).render();
    expect(page.$(".admin-article-preview").length).toBe(1);
    expect(page.$("article header > span").text()).toBe("Материалы");
    expect(page.$("article img").length).toBe(0);
  });

  it("a malformed working draft cannot be displayed as the published snapshot", async () => {
    expectBlocked(await fixture({ responses: { workingDraft: { data: { broken: privateError }, error: null } } }).render());
  });

  it("an otherwise valid working draft for another article is blocked", async () => {
    const data = { ...workingDraft(), article_id: "44444444-4444-4444-8444-444444444444" };
    const parse = loadAdminModule("app/(dashboard)/articles/article-working-draft.ts", {}).parseArticleWorkingDraft as (value: unknown) => unknown;
    expect(() => parse(data)).not.toThrow();
    expectBlocked(await fixture({ responses: { workingDraft: { data, error: null } } }).render());
  });

  it.each([
    { article_id: "44444444-4444-4444-8444-444444444444" },
    { article_id: undefined },
    { locale: "ru" },
    { locale: undefined },
  ])("English identity %j cannot expose a foreign or incomplete translation", async (identity) => {
    const data = { ...english, ...identity };
    const page = await fixture({ responses: { english: { data, error: null } } }).render("en");
    expectBlocked(page);
    expect(page.markup).not.toContain(english.title);
    expect(page.markup).not.toContain(english.content_html);
  });

  it.each(["ru", "en"])("%s uses the real parsed working-draft overlay without mutating the source", async (locale) => {
    const data = workingDraft();
    const snapshot = structuredClone(data);
    const expected = locale === "en" ? data.english_payload.payload : data.payload;
    const page = await fixture({ responses: { workingDraft: { data, error: null } } }).render(locale);
    expect(page.$("article h1").text()).toBe(expected.title);
    expect(page.markup).toContain(`<div class="preview-prose">${expected.content_html}</div>`);
    expect(page.$(".eyebrow").text()).toContain("Сохранённый рабочий черновик");
    expect(data).toEqual(snapshot);
  });

  it("a working draft which intentionally disables English remains an honest absent translation", async () => {
    const data = { ...workingDraft(), english_payload: { mode: "disabled" } };
    const page = await fixture({ responses: { workingDraft: { data, error: null } } }).render("en");
    expect(page.$("body").text()).toContain("Английская версия ещё не создана");
    expect(page.$(".admin-article-preview").length).toBe(0);
  });

  it("an uppercase UUID route keeps the canonical article and working-draft HTML", async () => {
    const canonicalId = "aaaa1111-bbbb-4ccc-8ddd-eeee11111111";
    const data = { ...workingDraft(), article_id: canonicalId };
    const snapshot = structuredClone(data);
    const page = await fixture({
      requestId: canonicalId.toUpperCase(),
      responses: {
        article: { data: { ...article, id: canonicalId }, error: null },
        english: { data: { ...english, article_id: canonicalId }, error: null },
        workingDraft: { data, error: null },
      },
    }).render("ru", "tablet");
    expect(page.$("article.admin-article-preview.is-tablet").length).toBe(1);
    expect(page.$("article h1").text()).toBe(data.payload.title);
    expect(page.markup).toContain(`<div class="preview-prose">${data.payload.content_html}</div>`);
    expect(data).toEqual(snapshot);
  });

  it.each([["/", ""], ["/admin", "/admin"], ["/staff/panel", "/staff/panel"]])(
    "hard retry preserves locale and viewport under base path %s", async (basePath, prefix) => {
      vi.stubEnv("ADMIN_BASE_PATH", basePath);
      try {
        const page = await fixture({ rejected: ["article"] }).render("en", "tablet");
        expectBlocked(page);
        expect(page.$("a").attr("href")).toBe(`${prefix}/articles/${articleId}/preview?locale=en&viewport=tablet`);
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );
});
