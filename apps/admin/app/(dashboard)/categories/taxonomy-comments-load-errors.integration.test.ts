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
// Execute real pages/helpers. Only framework, provider and mutation controls are mocked.
function loadModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const source = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (source) return loadModule(path.relative(adminRoot, source), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}
const privateError = "PRIVATE_PROVIDER_SECRET=taxonomy_comments_fixture";
const stamp = "2026-09-30T10:00:00.123456+00:00";
const id = "11111111-1111-4111-8111-111111111111";
const category = { id, name: "  Ручная рубрика  ", slug: "original-category", description: "Ручное описание \u2014 как есть",
  seo_title: null, seo_description: null, display_order: 0, is_visible: true, updated_at: stamp };
const tag = { id, name: "  Ручной тег  ", slug: "original-tag", description: "Ручное пояснение", updated_at: stamp };
const comment = { id, article_slug: "original-article", guest_name: null, body: "  Ручной комментарий \u2014 как есть  ",
  status: "pending", created_at: stamp, updated_at: stamp, profiles: { display_name: "Ручное имя" } };
const defaults = { categories: { data: [category], error: null }, tags: { data: [tag], count: 1, error: null },
  article_comments: { data: [comment], count: 1, error: null } };
type Dependency = keyof typeof defaults;
type Page = "categories" | "comments";
type Query = { q?: string; page?: string; status?: string; error?: string; saved?: string; deleted?: string; published?: string };
class NextSignal extends Error { constructor(readonly destination: string) { super("Next signal"); } }
async function render(page: Page, options: { replies?: Partial<Record<Dependency, unknown>>; rejected?: Dependency[];
  query?: Query; noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal } = {}) {
  const replies = { ...defaults, ...options.replies }, ranges: [string, number, number][] = [];
  const mutation = vi.fn(), rpc = vi.fn();
  const from = vi.fn((table: Dependency) => {
    expect(Object.hasOwn(defaults, table)).toBe(true);
    const builder = { select: () => builder, order: () => builder, or: () => builder, eq: () => builder,
      range: (first: number, last: number) => { ranges.push([table, first, last]); return builder; },
      then: (yes: (value: unknown) => unknown, no: (error: unknown) => unknown) => Promise.resolve().then(() => {
        if (options.rejected?.includes(table)) throw new TypeError(privateError);
        return replies[table];
      }).then(yes, no) };
    return builder;
  });
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : { from, rpc };
    } },
    "./actions": { createTaxonomyItemAction: mutation, updateTaxonomyItemAction: mutation,
      deleteTaxonomyItemAction: mutation, bulkModerateCommentsAction: mutation, moderateCommentAction: mutation },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) =>
      createElement("button", { type: "submit" }, children) },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (href: string): never => { throw new NextSignal(href); } },
  };
  const component = loadModule(`app/(dashboard)/${page}/page.tsx`, mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const markup = renderToStaticMarkup(await component({ searchParams: options.querySignal
      ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {}) }));
    return { markup, $: load(markup), from, ranges };
  } finally {
    expect(mutation).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  }
}
type View = Awaited<ReturnType<typeof render>>;
const pageFor = (dependency: Dependency): Page => dependency === "article_comments" ? "comments" : "categories";
function forms(view: View, dependency: Dependency) {
  return dependency === "article_comments" ? view.$('form input[name="id"], form#bulk-comment-form').length
    : view.$(`form input[name="kind"][value="${dependency === "categories" ? "category" : "tag"}"]`).length;
}
function retry(view: View) { return view.$("a").filter((_i, el) => view.$(el).text() === "Повторить загрузку"); }
function expectFailed(view: View, dependency: Dependency) {
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(forms(view, dependency)).toBe(0);
  expect(retry(view).length).toBeGreaterThan(0);
  expect(view.markup).not.toContain(privateError);
  if (dependency === "categories") expect(view.markup).toContain(tag.name);
  if (dependency === "tags") expect(view.markup).toContain(category.name);
}
afterEach(() => vi.unstubAllEnvs());
describe("M02 real taxonomy and comments SSR read boundaries", () => {
  it("keeps an empty comment range with unknown total distinct from an empty archive", async () => {
    const view = await render("comments", { replies: { article_comments: { data: [], count: null, error: null } } });
    expectFailed(view, "article_comments"); expect(view.markup).toContain("неизвестно");
    expect(view.$(".empty-state").length).toBe(0);
  });
  it.each(Object.keys(defaults) as Dependency[])("isolates %s provider failure", async dependency => {
    const view = await render(pageFor(dependency), { replies: { [dependency]: { data: null, count: 0,
      error: { code: "57014", message: privateError } } } });
    expectFailed(view, dependency);
    expect(view.markup).not.toContain("Совпадений нет.");
    if (dependency !== "categories") expect(view.markup).toContain("Недоступно");
  });
  it.each(Object.keys(defaults) as Dependency[])("isolates rejected %s transport", async dependency => {
    expectFailed(await render(pageFor(dependency), { rejected: [dependency] }), dependency);
  });
  it.each(Object.keys(defaults) as Dependency[])("rejects data together with %s error", async dependency => {
    expectFailed(await render(pageFor(dependency), { replies: { [dependency]: { ...defaults[dependency],
      error: { code: "42501", message: privateError } } } }), dependency);
  });
  it.each((Object.keys(defaults) as Dependency[]).flatMap(dependency =>
    [null, undefined, {}, { data: null }, { data: {} }, { data: [null] }, { data: [[]] }].map(response => [dependency, response] as const)))
    ("rejects damaged %s envelope/list (%j)", async (dependency, response) => {
      expectFailed(await render(pageFor(dependency), { replies: { [dependency]: response } }), dependency);
    });
  it.each((Object.keys(defaults) as Dependency[]).flatMap(dependency =>
    ["42P01", "42501", "PGRST116", "57014"].map(code => [dependency, code] as const)))
    ("classifies %s %s without raw errors", async (dependency, code) => {
      const view = await render(pageFor(dependency), { replies: { [dependency]: { data: [], count: 0,
        error: { code, message: privateError } } } });
      expectFailed(view, dependency);
      expect(view.markup).toContain(code === "42P01" ? "Структура редакционной базы"
        : code === "42501" ? "Проверьте вход и права доступа" : code === "PGRST116" ? "повреждённый ответ" : "временно недоступна");
    });
  it.each([
    ["categories", { ...category, name: {} }], ["categories", { ...category, slug: [] }],
    ["categories", { ...category, description: null }], ["categories", { ...category, seo_title: {} }],
    ["categories", { ...category, is_visible: "false" }], ["categories", { ...category, display_order: 1.5 }],
    ["categories", { ...category, updated_at: null }], ["categories", { ...category, id: "not-a-uuid" }],
    ["tags", { ...tag, name: {} }], ["tags", { ...tag, description: [] }],
    ["tags", { ...tag, updated_at: "invalid" }], ["tags", { ...tag, id: {} }],
    ["article_comments", { ...comment, body: {} }], ["article_comments", { ...comment, guest_name: [] }],
    ["article_comments", { ...comment, status: "__proto__" }], ["article_comments", { ...comment, id: "invalid" }],
    ["article_comments", { ...comment, article_slug: {} }], ["article_comments", { ...comment, created_at: "invalid" }],
    ["article_comments", { ...comment, updated_at: null }], ["article_comments", { ...comment, profiles: {} }],
    ["article_comments", { ...comment, profiles: [{ display_name: {} }] }],
    ["article_comments", { ...comment, profiles: [{ display_name: "One" }, { display_name: "Two" }] }],
  ] as [Dependency, unknown][])("closes unsafe %s row (%j)", async (dependency, row) => {
    expectFailed(await render(pageFor(dependency), { replies: { [dependency]: { data: [row], count: 1, error: null } } }), dependency);
  });
  it.each((["tags", "article_comments"] as const).flatMap(dependency =>
    [null, undefined, "0", -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1].map(count => [dependency, count] as const)))
    ("keeps unknown %s count %j with readable rows", async (dependency, count) => {
      const view = await render(pageFor(dependency), { replies: { [dependency]: { ...defaults[dependency], count } } });
      expect(view.markup).toContain("Недоступно");
      expect(view.markup).toContain(dependency === "tags" ? tag.name : comment.body);
      expect(forms(view, dependency)).toBe(0);
      expect(retry(view).length).toBeGreaterThan(0);
      expect(view.$("nav.pagination").length).toBe(0);
    });
  it.each(Object.keys(defaults) as Dependency[])("keeps successful empty %s", async dependency => {
    const view = await render(pageFor(dependency), { replies: { [dependency]: { data: [], count: 0, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0);
    if (dependency !== "article_comments") expect(forms(view, dependency)).toBe(1);
    else expect(view.markup).toContain("пока нет комментариев");
    if (dependency !== "categories") expect(view.markup).not.toContain("Недоступно");
  });
  it.each([null, [], { display_name: "  Имя как есть  " }, [{ display_name: "  Имя как есть  " }]])
    ("keeps valid nullable/object/legacy-array profile %j", async profiles => {
      const view = await render("comments", { replies: { article_comments: { data: [{ ...comment, profiles }], count: 1, error: null } } });
      expect(view.markup).toContain(comment.body); expect(forms(view, "article_comments")).toBeGreaterThan(0);
    });
  it("retains readable comments while holding an unsupported action timestamp", async () => {
    const view = await render("comments", { replies: { article_comments: { data: [{ ...comment, updated_at: "123" }], count: 1, error: null } } });
    expect(view.markup).toContain(comment.body); expect(forms(view, "article_comments")).toBe(0);
    expect(view.$('input[name="selected_comment"]').length).toBe(0); expect(retry(view).length).toBeGreaterThan(0);
  });
  it.each(["tags", "article_comments"] as const)("does not redirect %s with an unknown total", async dependency => {
    const view = await render(pageFor(dependency), { query: { q: "Ручной", page: "7", status: "pending" },
      replies: { [dependency]: { ...defaults[dependency], count: null } } });
    expect(view.ranges).toContainEqual([dependency, dependency === "tags" ? 240 : 300, dependency === "tags" ? 279 : 349]);
    expect(view.markup).toContain("Недоступно");
  });
  it.each(["categories", "comments"] as const)("preserves filters/page/base path for fresh %s retry", async page => {
    vi.stubEnv("ADMIN_BASE_PATH", "/panel");
    const dependency = page === "categories" ? "tags" : "article_comments";
    const view = await render(page, { query: { q: "Ручной", page: "7", status: "pending", error: privateError, saved: "yes" },
      rejected: [dependency] });
    const link = retry(view).last();
    const url = new URL(link.attr("href")!, "https://example.test");
    expect(url.pathname).toBe(`/panel/${page}`); expect(url.searchParams.get("q")).toBe("Ручной");
    expect(url.searchParams.get("page")).toBe("7");
    if (page === "comments") expect(url.searchParams.get("status")).toBe("pending");
    expect(url.searchParams.has("error")).toBe(false); expect(url.searchParams.has("saved")).toBe(false);
    expect(link.attr("data-next-link")).toBeUndefined(); expect(view.markup).not.toContain(privateError);
  });
  it.each(["categories", "comments"] as const)("does not treat %s URL notices as receipts", async page => {
    const view = await render(page, { query: { saved: "category-updated", deleted: "tag", published: "started", error: privateError } });
    expect(view.$(".form-success").length).toBe(0); expect(view.markup).not.toContain(privateError);
    expect(view.markup).toContain("не подтвержд");
  });
  it.each(["categories", "comments"] as const)("keeps %s Next query navigation signals", async page => {
    const signal = new NextSignal("/login"); await expect(render(page, { querySignal: signal })).rejects.toBe(signal);
  });
  it.each(["categories", "comments"] as const)("keeps %s Next client navigation signals", async page => {
    const signal = new NextSignal("/login"); await expect(render(page, { clientSignal: signal })).rejects.toBe(signal);
  });
  it.each(["categories", "comments"] as const)("keeps the %s missing-client dependency state", async page => {
    const view = await render(page, { noClient: true }); expect(view.from).not.toHaveBeenCalled();
    expect(view.$("form").length).toBe(0);
  });
});
