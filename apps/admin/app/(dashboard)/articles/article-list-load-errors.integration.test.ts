import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Render the actual server component and its local helpers. Only framework,
// Supabase, submit-button and server-action boundaries use isolated fixtures.
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

const privateError = "PRIVATE_PROVIDER_TOKEN=do-not-expose-this-list-fixture";
const articleId = "11111111-1111-4111-8111-111111111111";
const authorId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";
const article = {
  id: articleId,
  title: "Исходный литературный материал",
  slug: "original-literary-article",
  status: "draft",
  author_id: authorId,
  cover_external_url: null,
  created_at: "2026-09-23T12:00:00.000Z",
  updated_at: "2026-09-24T12:00:00.000Z",
  published_at: null,
  legacy_path: "/original-archive-path",
  categories: { id: categoryId, name: "Литературные истории", slug: "author-stories" },
};
type QueryKey = "articles" | "categories" | "profiles" | "views";
type QueryResponse = { data: unknown; error: unknown; count?: unknown };
type SearchValues = Record<string, string>;

function fixture(options: {
  responses?: Partial<Record<QueryKey, QueryResponse>>;
  rejected?: QueryKey[];
  noClient?: boolean;
} = {}) {
  const defaults: Record<QueryKey, QueryResponse> = {
    articles: { data: [article], count: 1, error: null },
    categories: { data: [{ id: categoryId, name: "Литературные истории" }], error: null },
    profiles: { data: [{ id: authorId, display_name: "Исходное имя автора" }], error: null },
    views: { data: 42, error: null },
  };
  const calls: QueryKey[] = [];
  function response(key: QueryKey) {
    calls.push(key);
    if (options.rejected?.includes(key)) throw new TypeError(privateError);
    return options.responses?.[key] ?? defaults[key];
  }
  const from = vi.fn((table: string) => {
    if (!["articles", "categories", "profiles"].includes(table)) {
      throw new Error(`Unexpected fixture table: ${table}`);
    }
    const query = {
      select: () => query,
      is: () => query,
      eq: () => query,
      or: () => query,
      gte: () => query,
      lte: () => query,
      order: () => query,
      range: () => query,
      in: () => query,
      then: (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => response(table as QueryKey)).then(fulfilled, rejected),
    };
    return query;
  });
  const rpc = vi.fn(async (name: string) => {
    expect(name).toBe("get_content_view_count");
    return response("views");
  });
  const action = vi.fn(async () => undefined);
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => options.noClient ? null : { from, rpc } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) },
    "./actions": {
      changeArticleStatusAction: action,
      duplicateArticleAction: action,
      importLegacyArticlesAction: action,
      softDeleteArticleAction: action,
    },
  };
  async function render(search: SearchValues = {}) {
    const page = loadAdminModule("app/(dashboard)/articles/page.tsx", mocks).default as (props: {
      searchParams: Promise<SearchValues>;
    }) => Promise<ReactNode>;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve(search) }));
    expect(action).not.toHaveBeenCalled();
    expect(markup).not.toContain(privateError);
    return { markup, $: load(markup), calls, rpc };
  }
  return { render, calls, rpc };
}

type RenderedPage = Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>;
const failure = (code = "57014"): QueryResponse => ({ data: null, error: { code, message: privateError } });
const failureModes = ["response error", "rejected transport"] as const;
function failingFixture(key: QueryKey, mode: typeof failureModes[number]) {
  return mode === "response error"
    ? fixture({ responses: { [key]: failure() } })
    : fixture({ rejected: [key] });
}
function retryAnchor(page: RenderedPage) {
  return page.$("a").filter((_index, node) => /Повторить загрузку/iu.test(page.$(node).text()));
}
function expectBlockedList(page: RenderedPage) {
  expect(page.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(page.$(".data-table tbody tr").length).toBe(0);
  expect(page.$(".empty-state").length).toBe(0);
  expect(page.$("body").text()).not.toMatch(/Найдено:\s*0/u);
  expect(page.$("body").text()).not.toContain("Материалы с такими условиями не найдены");
  expect(retryAnchor(page).length).toBeGreaterThan(0);
  expect(retryAnchor(page).attr("data-next-link")).toBeUndefined();
}
function rowCells(page: RenderedPage) {
  return page.$(".data-table tbody tr").first().find("td");
}
function expectArticleVisible(page: RenderedPage) {
  expect(page.$(".data-table tbody tr").length).toBe(1);
  expect(page.$(".article-list-title strong").text()).toBe(article.title);
}

afterEach(() => vi.unstubAllEnvs());

describe("M02 article list through its real server component", () => {
  it.each(failureModes)("a main article %s is an explicit failed read, not an empty result", async (mode) => {
    expectBlockedList(await failingFixture("articles", mode).render());
  });

  it("permission failure cannot display data returned with the rejected article result", async () => {
    const page = await fixture({ responses: {
      articles: { data: [article], count: 1, error: failure("42501").error },
    } }).render();
    expectBlockedList(page);
    expect(page.markup).not.toContain(article.title);
  });

  it.each([
    ["null list", null],
    ["object instead of list", { article }],
    ["null row", [null]],
    ["missing identity", [{ title: article.title }]],
    ["object title", [{ ...article, title: { privateError } }]],
    ["object status", [{ ...article, status: { privateError } }]],
  ])("a corrupt main result (%s) cannot create a false empty or partial list", async (_label, data) => {
    expectBlockedList(await fixture({ responses: { articles: { data, count: 0, error: null } } }).render());
  });

  it("a successful empty list and exact zero count preserve the genuine empty state", async () => {
    const page = await fixture({ responses: { articles: { data: [], count: 0, error: null } } }).render();
    expect(page.$(".table-summary").text()).toMatch(/Найдено:\s*0/u);
    expect(page.$(".empty-state").length).toBe(1);
    expect(page.$(".data-table tbody tr").length).toBe(0);
    expect(page.$('[role="alert"]').length).toBe(0);
  });

  it.each([
    ["null", null], ["undefined", undefined], ["negative", -1],
    ["NaN", Number.NaN], ["infinity", Number.POSITIVE_INFINITY],
    ["fractional", 1.5], ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
    ["numeric string", "1"], ["object", { count: 1 }],
  ])("an unavailable exact count (%s) preserves visible articles and reports unavailable", async (_label, count) => {
    const page = await fixture({ responses: { articles: { data: [article], count, error: null } } }).render();
    expectArticleVisible(page);
    expect(page.$(".table-summary").text()).toMatch(/Найдено:\s*Недоступно/u);
    expect(page.$(".table-summary").text()).not.toMatch(/Найдено:\s*0/u);
  });

  it("a valid exact count and numeric view result retain their actual values", async () => {
    const page = await fixture().render();
    expectArticleVisible(page);
    expect(page.$(".table-summary").text()).toMatch(/Найдено:\s*1/u);
    expect(rowCells(page).eq(4).text()).toBe("42");
    expect(rowCells(page).eq(1).find("small").text()).toBe("Исходное имя автора");
  });

  it.each(failureModes)("a views %s keeps the article and replaces only the unknown view count", async (mode) => {
    const page = await failingFixture("views", mode).render();
    expectArticleVisible(page);
    expect(rowCells(page).eq(4).text()).toBe("Недоступно");
    expect(rowCells(page).eq(1).find("small").text()).toBe("Исходное имя автора");
  });

  it.each([
    ["null", null], ["undefined", undefined], ["negative", -1],
    ["NaN", Number.NaN], ["infinity", Number.POSITIVE_INFINITY],
    ["fractional", 1.5], ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
    ["invalid string", "not-a-count"], ["object", { count: 12 }], ["array", [12]],
  ])("a malformed view RPC scalar (%s) is not represented as zero or a fabricated number", async (_label, data) => {
    const page = await fixture({ responses: { views: { data, error: null } } }).render();
    expectArticleVisible(page);
    expect(rowCells(page).eq(4).text()).toBe("Недоступно");
  });

  it("an actual zero view count remains zero", async () => {
    const page = await fixture({ responses: { views: { data: 0, error: null } } }).render();
    expectArticleVisible(page);
    expect(rowCells(page).eq(4).text()).toBe("0");
  });

  it.each(failureModes)("a categories %s keeps articles and the selected filter", async (mode) => {
    const page = await failingFixture("categories", mode).render({ category: categoryId });
    expectArticleVisible(page);
    expect(page.$("body").text()).toContain("Рубрики временно недоступны");
    expect(page.$('input[type="hidden"][name="category"]').attr("value")).toBe(categoryId);
    expect(page.$('select[name="category"]').length).toBe(0);
    expect(rowCells(page).eq(4).text()).toBe("42");
  });

  it.each([
    ["null list", null], ["null row", [null]],
    ["missing identity", [{ name: "Литературные истории" }]],
    ["object name", [{ id: categoryId, name: { privateError } }]],
  ])("a malformed categories result (%s) does not clear the selected filter or crash articles", async (_label, data) => {
    const page = await fixture({ responses: { categories: { data, error: null } } }).render({ category: categoryId });
    expectArticleVisible(page);
    expect(page.$("body").text()).toContain("Рубрики временно недоступны");
    expect(page.$('input[type="hidden"][name="category"]').attr("value")).toBe(categoryId);
    expect(page.$('select[name="category"]').length).toBe(0);
  });

  it("a confirmed empty category list remains a valid available selector", async () => {
    const page = await fixture({ responses: { categories: { data: [], error: null } } }).render();
    expectArticleVisible(page);
    expect(page.$('select[name="category"]').length).toBe(1);
    expect(page.$("body").text()).not.toContain("Рубрики временно недоступны");
  });

  it.each(failureModes)("a profiles %s keeps articles without assigning a fictional editorial author", async (mode) => {
    const page = await failingFixture("profiles", mode).render();
    expectArticleVisible(page);
    expect(page.$("body").text()).toContain("Авторы временно недоступны");
    expect(rowCells(page).eq(1).find("small").text()).toBe("Недоступно");
    expect(rowCells(page).eq(4).text()).toBe("42");
  });

  it.each([
    ["null list", null], ["null row", [null]],
    ["missing identity", [{ display_name: "Исходное имя автора" }]],
    ["object name", [{ id: authorId, display_name: { privateError } }]],
  ])("a malformed profiles result (%s) does not assign a fictional author", async (_label, data) => {
    const page = await fixture({ responses: { profiles: { data, error: null } } }).render();
    expectArticleVisible(page);
    expect(page.$("body").text()).toContain("Авторы временно недоступны");
    expect(rowCells(page).eq(1).find("small").text()).toBe("Недоступно");
  });

  it("several independent optional read failures retain the usable article", async () => {
    const page = await fixture({ rejected: ["categories", "profiles", "views"] }).render({ category: categoryId });
    expectArticleVisible(page);
    expect(page.$("body").text()).toContain("Рубрики временно недоступны");
    expect(page.$("body").text()).toContain("Авторы временно недоступны");
    expect(rowCells(page).eq(4).text()).toBe("Недоступно");
    expect(rowCells(page).eq(1).find("small").text()).toBe("Недоступно");
    expect(page.$('input[type="hidden"][name="category"]').attr("value")).toBe(categoryId);
  });

  it.each([
    [undefined, "/admin/articles"], ["/", "/articles"], ["/staff/", "/staff/articles"],
  ])("a failed main read retry uses a plain GET and preserves filters with base path %s", async (basePath, expectedPath) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    const filters = {
      q: "Толстой & Тургенев + café / <сюжет>", status: "published", category: categoryId,
      from: "2026-09-01", to: "2026-09-30", sort: "title", page: "3",
    };
    const page = await failingFixture("articles", "response error").render(filters);
    expectBlockedList(page);
    const retry = retryAnchor(page).first();
    const target = new URL(retry.attr("href") ?? "", "https://admin.example.test");
    expect(target.origin).toBe("https://admin.example.test");
    expect(target.pathname).toBe(expectedPath);
    expect(Object.fromEntries(target.searchParams)).toEqual(filters);
    expect(retry.attr("data-next-link")).toBeUndefined();
    expect(retry.closest("form").length).toBe(0);
  });
});
