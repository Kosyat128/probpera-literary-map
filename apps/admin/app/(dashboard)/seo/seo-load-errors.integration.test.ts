import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nativeRequire = createRequire(import.meta.url);
type ModuleExports = Record<string, unknown>;
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const source = relative === "app/(dashboard)/seo/page.tsx" && process.env.M02_SEO_BASELINE
    ? process.env.M02_SEO_BASELINE : filename;
  const compiled = ts.transpileModule(readFileSync(source, "utf8"), {
    fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const sourceFile = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}
const privateError = "PRIVATE_PROVIDER_SECRET=never\u002drender\u002dthis\u002dfixture";
const stamp = "2026\u002d09\u002d23T12:00:00.000Z";
const record = {
  id: "12345678\u002d1234\u002d4234\u002d9234\u002d123456789012",
  source_path: "/old", destination_path: "/new", status_code: 301,
  is_active: true, created_at: stamp, updated_at: stamp,
};
const issue = {
  id: "87654321\u002d1234\u002d4234\u002d9234\u002d123456789012",
  title: "  Исходное название \u2014 точное  ", seo_title: null,
  seo_description: "", canonical_url: "https://example.org/article",
};
const defaults = {
  redirects: { data: [record], count: 1, error: null },
  articles: { data: null, count: 7, error: null },
  issuesCount: { data: null, count: 2, error: null },
  issues: { data: [issue], error: null },
  permanent: { data: null, count: 3, error: null },
};
type Dependency = keyof typeof defaults;
type Query = { q?: string; status?: string; code?: string; page?: string; error?: string; saved?: string; deleted?: string; published?: string };
class NextSignal extends Error {
  constructor(readonly destination: string) { super("Next navigation signal"); }
}
async function render(options: {
  response?: Partial<Record<Dependency, unknown>>; rejected?: Set<Dependency>;
  query?: Query; noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal;
} = {}) {
  const replies = { ...defaults, ...options.response };
  const rejected = options.rejected ?? new Set();
  let index = 0;
  const filters: [Dependency, string, unknown][] = [];
  const ranges: [number, number][] = [];
  const orders: [Dependency, string][] = [];
  const from = vi.fn((table: string) => {
    const dependency = (["redirects", "articles", "issuesCount", "issues", "permanent"] as const)[index++];
    expect(table).toBe(["redirects", "permanent"].includes(dependency) ? "redirects" : "articles");
    const builder = {
      select: () => builder,
      order: (key: string) => { orders.push([dependency, key]); return builder; },
      eq: (key: string, value: unknown) => { filters.push([dependency, key, value]); return builder; },
      is: (key: string, value: unknown) => { filters.push([dependency, key, value]); return builder; },
      or: (value: unknown) => { filters.push([dependency, "or", value]); return builder; },
      limit: (value: unknown) => { filters.push([dependency, "limit", value]); return builder; },
      range: (start: number, end: number) => { ranges.push([start, end]); return builder; },
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => {
          if (rejected.has(dependency)) throw new TypeError(privateError);
          return replies[dependency];
        }).then(fulfilled, denied),
    };
    return builder;
  });
  const rpc = vi.fn();
  const create = vi.fn(); const update = vi.fn(); const remove = vi.fn();
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : { from, rpc };
    } },
    "./actions": { createRedirectAction: create, updateRedirectAction: update, deleteRedirectAction: remove },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (destination: string): never => { throw new NextSignal(destination); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule("app/(dashboard)/seo/page.tsx", mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {});
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), from, filters, ranges, orders };
  } finally {
    expect(rpc).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function metric(view: Rendered, index: number) { return view.$(".stat-card strong").eq(index).text(); }
function retryLinks(view: Rendered) {
  return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку");
}
function expectSafeError(view: Rendered) {
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(view.markup).not.toContain(privateError);
  expect(retryLinks(view).length).toBeGreaterThan(0);
  expect(retryLinks(view).attr("data-next-link")).toBeUndefined();
}
function expectRedirectsClosed(view: Rendered) {
  expectSafeError(view);
  expect(view.$('input[name="expected_updated_at"]').length).toBe(0);
  expect(view.$('button[type="submit"]').filter((_index, node) => /Создать переадресацию|Сохранить переадресацию|Удалить/u.test(view.$(node).text())).length).toBe(0);
  expect(view.$('form[method="get"]').length).toBe(1);
}
afterEach(() => vi.unstubAllEnvs());

describe("M02 SEO actual SSR read boundary", () => {
  it.each(Object.keys(defaults) as Dependency[])("isolates %s provider errors", async (dependency) => {
    const view = await render({ response: { [dependency]: { data: null, count: 0, error: { code: "57014", message: privateError } } } });
    expectSafeError(view);
    if (dependency === "redirects") expectRedirectsClosed(view);
    else expect(view.$(".data-table tbody tr").length).toBe(1);
    if (dependency === "issues") expect(view.markup).not.toContain("заполнены основные SEO");
    if (dependency === "articles") expect(metric(view, 0)).toBe("Недоступно");
    if (dependency === "issuesCount") expect(metric(view, 1)).toBe("Недоступно");
    if (dependency === "permanent") expect(metric(view, 2)).toBe("Недоступно");
  });
  it.each(Object.keys(defaults) as Dependency[])("isolates rejected %s transport", async (dependency) => {
    const view = await render({ rejected: new Set([dependency]) });
    expectSafeError(view);
    if (dependency === "redirects") expectRedirectsClosed(view);
    else expect(view.$(".data-table tbody tr").length).toBe(1);
  });
  it.each(Object.keys(defaults) as Dependency[])("rejects success looking %s data with error", async (dependency) => {
    const view = await render({ response: { [dependency]: { ...defaults[dependency], error: { code: "42501", message: privateError } } } });
    expectSafeError(view);
    if (dependency === "redirects") expectRedirectsClosed(view);
  });
  it.each(Object.keys(defaults) as Dependency[])("keeps null %s envelope unavailable", async (dependency) => {
    expectSafeError(await render({ response: { [dependency]: null } }));
  });
  it.each(Object.keys(defaults) as Dependency[])("keeps absent %s envelope unavailable", async (dependency) => {
    expectSafeError(await render({ response: { [dependency]: undefined } }));
  });
  it.each(["42P01", "42703", "PGRST205", "42501", "PGRST301", "PGRST116", "57014"])("classifies safe provider code %s", async (code) => {
    const view = await render({ response: { redirects: { data: [], count: 0, error: { code, message: privateError } } } });
    expectRedirectsClosed(view);
    if (["42P01", "42703", "PGRST205"].includes(code)) expect(view.markup).toContain("Структура редакционной базы");
    if (["42501", "PGRST301"].includes(code)) expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it.each([
    ["null", null], ["string", "0"], ["object", {}], ["fractional", 0.5],
    ["negative", -1], ["unsafe", Number.MAX_SAFE_INTEGER + 1], ["absent", undefined],
  ])("keeps %s counts unknown independently", async (_label, count) => {
    for (const dependency of ["articles", "issuesCount", "permanent", "redirects"] as const) {
      const view = await render({ response: { [dependency]: { ...defaults[dependency], count } } });
      expectSafeError(view);
      if (dependency === "redirects") {
        expectRedirectsClosed(view);
        expect(view.markup).not.toContain("Переадресации не найдены.");
        expect(view.$(".data-table tbody tr").length).toBe(1);
      } else expect(metric(view, dependency === "articles" ? 0 : dependency === "issuesCount" ? 1 : 2)).toBe("Недоступно");
    }
  });
  it.each([
    ["null list", null], ["object list", {}], ["null row", [null]], ["array row", [[]]],
    ["object ID", [{ ...record, id: {} }]], ["non UUID ID", [{ ...record, id: "oops" }]],
    ["object source", [{ ...record, source_path: {} }]], ["missing source", [{ ...record, source_path: undefined }]],
    ["non root source", [{ ...record, source_path: "old" }]],
    ["object destination", [{ ...record, destination_path: {} }]],
    ["invalid destination", [{ ...record, destination_path: "http://example.org" }]],
    ["object status", [{ ...record, status_code: {} }]], ["string status", [{ ...record, status_code: "301" }]],
    ["unknown status", [{ ...record, status_code: 300 }]], ["object active", [{ ...record, is_active: {} }]],
    ["null active", [{ ...record, is_active: null }]], ["invalid created date", [{ ...record, created_at: "invalid" }]],
    ["null updated date", [{ ...record, updated_at: null }]],
    ["duplicate identities", [record, { ...record, source_path: "/another" }]],
  ])("rejects %s redirect DTO without false empty catalog", async (_label, data) => {
    const view = await render({ response: { redirects: { data, count: 1, error: null } } });
    expectRedirectsClosed(view);
    expect(view.$(".data-table tbody tr").length).toBe(0);
    expect(view.$(".empty-state").length).toBe(0);
    expect(metric(view, 0)).toBe("7");
  });
  it.each([
    ["null list", null], ["object list", {}], ["null row", [null]], ["array row", [[]]],
    ["invalid ID", [{ ...issue, id: "oops" }]], ["object title", [{ ...issue, title: {} }]],
    ["short title", [{ ...issue, title: "ab" }]], ["long title", [{ ...issue, title: "a".repeat(241) }]],
    ["absent SEO title", [{ ...issue, seo_title: undefined }]], ["object SEO title", [{ ...issue, seo_title: {} }]],
    ["long SEO title", [{ ...issue, seo_title: "a".repeat(181) }]],
    ["object SEO description", [{ ...issue, seo_description: {} }]],
    ["long SEO description", [{ ...issue, seo_description: "a".repeat(401) }]],
    ["object canonical", [{ ...issue, canonical_url: {} }]],
    ["duplicate IDs", [issue, issue]],
  ])("rejects %s issue DTO without claiming SEO is complete", async (_label, data) => {
    const view = await render({ response: { issues: { data, error: null } } });
    expectSafeError(view);
    expect(view.markup).not.toContain("заполнены основные SEO");
    expect(view.$(".data-table tbody tr").length).toBe(1);
    expect(metric(view, 1)).toBe("2");
  });
  it("preserves confirmed zero counts and genuine empty lists", async () => {
    const view = await render({ response: {
      redirects: { data: [], count: 0, error: null }, issues: { data: [], error: null },
      articles: { data: null, count: 0, error: null }, issuesCount: { data: null, count: 0, error: null },
      permanent: { data: null, count: 0, error: null },
    } });
    expect([metric(view, 0), metric(view, 1), metric(view, 2)]).toEqual(["0", "0", "0"]);
    expect(view.markup).toContain("Переадресации не найдены.");
    expect(view.markup).toContain("заполнены основные SEO");
    expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.$('input[name="source_path"]').length).toBe(1);
  });
  it("preserves actual nullable and empty SEO fields and original title", async () => {
    const view = await render({ response: { issues: { data: [{ ...issue, seo_title: "", seo_description: null, canonical_url: null }], error: null } } });
    expect(view.$(".status-list").text()).toContain(issue.title);
    expect(view.$(".status-list").text()).toContain("нет: заголовок, описание, canonical");
    expect(view.$('[role="alert"]').length).toBe(0);
  });
  it("allows SQL Unicode character bounds without rewriting original text", async () => {
    const title = "😀".repeat(240);
    const view = await render({ response: { issues: { data: [{ ...issue, title, seo_title: "😀".repeat(180), seo_description: null }], error: null } } });
    expect(view.$(".status-list").text()).toContain(title);
    expect(view.$('[role="alert"]').length).toBe(0);
  });
  it("keeps legacy SQL UUID rows readable without unsupported CAS forms", async () => {
    const legacy = { ...record, id: "12345678\u002d1234\u002d9234\u002d0234\u002d123456789012" };
    const view = await render({ response: { redirects: { data: [legacy], count: 1, error: null } } });
    expect(view.$(".data-table tbody tr").length).toBe(1);
    expect(view.$('input[name="expected_updated_at"]').length).toBe(0);
    expect(view.$('input[name="source_path"]').length).toBe(1);
  });
  it.each([301, 302, 307, 308])("preserves supported status code %s and real CAS tokens", async (status_code) => {
    const view = await render({ response: { redirects: { data: [{ ...record, status_code, is_active: false }], count: 1, error: null } } });
    expect(view.$('input[name="expected_updated_at"]').map((_index, node) => view.$(node).attr("value")).get()).toEqual([stamp, stamp]);
    expect(view.$('input[name="id"]').map((_index, node) => view.$(node).attr("value")).get()).toEqual([record.id, record.id]);
    expect(view.$(".badge").text()).toBe("Выключена");
  });
  it("keeps unknown total on requested page with verified rows instead of redirecting to first page", async () => {
    const view = await render({ response: { redirects: { ...defaults.redirects, count: null } }, query: { page: "4" } });
    expectRedirectsClosed(view);
    expect(view.$(".pagination").length).toBe(0);
    expect(view.ranges).toEqual([[120, 159]]);
  });
  it("does not redirect on failed list even when reported total is zero", async () => {
    const view = await render({ response: { redirects: { data: null, count: 0, error: { message: privateError } } }, query: { page: "4" } });
    expectRedirectsClosed(view);
  });
  it("redirects only after verified empty list and confirmed zero count", async () => {
    await expect(render({ response: { redirects: { data: [], count: 0, error: null } }, query: { q: "old", status: "inactive", code: "308", page: "4" } }))
      .rejects.toMatchObject({ destination: "/seo?q=old&status=inactive&code=308" });
  });
  it("preserves filters, stable ordering, count pagination and issue preview bound", async () => {
    const view = await render({ response: { redirects: { ...defaults.redirects, count: 90 } }, query: { q: "old_", status: "inactive", code: "308", page: "2" } });
    expect(view.ranges).toEqual([[40, 79]]);
    expect(view.orders).toContainEqual(["redirects", "created_at"]);
    expect(view.orders).toContainEqual(["redirects", "id"]);
    expect(view.filters).toContainEqual(["redirects", "is_active", false]);
    expect(view.filters).toContainEqual(["redirects", "status_code", 308]);
    expect(view.filters).toContainEqual(["issues", "limit", 12]);
    const next = view.$(".pagination a").filter((_index, node) => view.$(node).text() === "Вперёд");
    expect(new URL(next.attr("href")!, "https://example.org").searchParams.get("page")).toBe("3");
    expect(view.$('input[name="catalog_q"]').map((_index, node) => view.$(node).attr("value")).get()).toEqual(["old_", "old_", "old_"]);
  });
  it.each(["/admin", "/editorial", "/"])("GET retry preserves catalog and configured base %s without transient notices", async (base) => {
    vi.stubEnv("ADMIN_BASE_PATH", base);
    const view = await render({ rejected: new Set(["redirects"]), query: { q: "old", status: "active", code: "307", page: "3", error: privateError, saved: "created" } });
    expectRedirectsClosed(view);
    const link = retryLinks(view).first();
    const url = new URL(link.attr("href")!, "https://example.org");
    expect(url.pathname).toBe((base === "/" ? "" : base) + "/seo");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "old", status: "active", code: "307", page: "3" });
  });
  it.each([
    { saved: "created" }, { saved: "updated" }, { deleted: "1" },
    { published: "started" }, { published: "queued" }, { published: "queue-error" },
    { error: privateError },
  ])("URL notice %j does not claim mutation or provider receipt", async (query) => {
    const view = await render({ query });
    expect(view.markup).not.toContain(privateError);
    expect(view.markup).not.toContain("Переадресация создана.");
    expect(view.markup).not.toContain("Переадресация сохранена.");
    expect(view.markup).not.toContain("Переадресация удалена.");
    expect(view.markup).not.toContain("Публичная сборка с изменениями адресов запущена.");
    expect(view.$('[role="status"]').text()).toContain("не подтверждён");
  });
  it("renders the dependency state with no client and no database reads", async () => {
    const view = await render({ noClient: true });
    expect(view.from).not.toHaveBeenCalled();
    expect(view.$(".data-table").length).toBe(0);
    expect(view.$('input[name="source_path"]').length).toBe(0);
  });
  it("propagates Next signals from search parameters", async () => {
    const signal = new NextSignal("/login");
    await expect(render({ querySignal: signal })).rejects.toBe(signal);
  });
  it("propagates Next signals from auth/client setup", async () => {
    const signal = new NextSignal("/login");
    await expect(render({ clientSignal: signal })).rejects.toBe(signal);
  });
});
