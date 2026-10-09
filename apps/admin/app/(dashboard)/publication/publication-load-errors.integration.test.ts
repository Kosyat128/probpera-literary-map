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

// Run the real page and read/query helpers; mock only provider, Next and actions.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
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
const event = {
  id: 42, entity_type: "  article  ", entity_id: "  source:writer/work  ",
  reason: "  Original publication reason \u2014 exact  ", status: "requested",
  attempt_count: 0, last_error: null, provider: null, requested_at: stamp,
  dispatched_at: null, deployed_at: null, deployment_run_id: null,
};
const defaults = {
  list: { data: [event], count: 1, error: null },
  pending: { data: null, count: 2, error: null },
  failed: { data: null, count: 3, error: null },
};
type Dependency = keyof typeof defaults;
type Query = { q?: string; status?: string; page?: string; published?: string; error?: string };
class NextSignal extends Error {
  constructor(readonly destination: string) { super("Next navigation signal"); }
}
async function render(options: {
  response?: Partial<Record<Dependency, unknown>>;
  rejected?: Set<Dependency>; query?: Query; noClient?: boolean;
  querySignal?: NextSignal; clientSignal?: NextSignal;
} = {}) {
  const replies = { ...defaults, ...options.response };
  const rejected = options.rejected ?? new Set();
  const query = options.query ?? {};
  let fromIndex = 0;
  const filters: [number, string, unknown][] = [];
  const ranges: [number, number][] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("public_build_outbox");
    const index = fromIndex++;
    const dependency = (["list", "pending", "failed"] as const)[index];
    const builder = {
      select: () => builder, order: () => builder,
      eq: (key: string, value: unknown) => { filters.push([index, key, value]); return builder; },
      in: (key: string, value: unknown) => { filters.push([index, key, value]); return builder; },
      or: (value: unknown) => { filters.push([index, "or", value]); return builder; },
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
  const fullAction = vi.fn();
  const retryAction = vi.fn();
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : { from, rpc };
    } },
    "./actions": { requestFullPublicBuildAction: fullAction, retryPublicationAction: retryAction },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (destination: string): never => { throw new NextSignal(destination); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule("app/(dashboard)/publication/page.tsx", mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(query);
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), from, filters, ranges };
  } finally {
    expect(rpc).not.toHaveBeenCalled();
    expect(fullAction).not.toHaveBeenCalled();
    expect(retryAction).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function metric(view: Rendered, index: number) { return view.$(".stat-card strong").eq(index).text(); }
function retryLink(view: Rendered) {
  return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку");
}
function expectBlocked(view: Rendered) {
  expect(view.$("header form").length).toBe(0);
  expect(view.$('input[name="outbox_id"]').length).toBe(0);
  expect(view.$("form.toolbar").length).toBe(1);
  expect(view.markup).not.toContain(privateError);
  expect(view.markup).not.toContain("Проверьте применённые миграции");
  expect(retryLink(view).length).toBe(1);
  expect(retryLink(view).attr("data-next-link")).toBeUndefined();
}
function expectRows(view: Rendered, count = 1) { expect(view.$(".data-table tbody tr").length).toBe(count); }

afterEach(() => vi.unstubAllEnvs());

describe("M02 publication real SSR read isolation", () => {
  it.each(["list", "pending", "failed"] as const)("isolates %s provider errors", async (dependency) => {
    const view = await render({ response: { [dependency]: { data: null, count: 0, error: { code: "57014", message: privateError } } } });
    expectBlocked(view);
    if (dependency === "list") {
      expect(metric(view, 0)).toBe("2"); expect(metric(view, 1)).toBe("3");
      expect(view.$(".empty-state").length).toBe(0);
    } else {
      expectRows(view); expect(metric(view, dependency === "pending" ? 0 : 1)).toBe("Недоступно");
      expect(metric(view, dependency === "pending" ? 1 : 0)).toBe(dependency === "pending" ? "3" : "2");
      expect(metric(view, 2)).toBe("1");
    }
  });
  it.each(["list", "pending", "failed"] as const)("isolates rejected %s transport", async (dependency) => {
    const view = await render({ rejected: new Set([dependency]) });
    expectBlocked(view);
    if (dependency !== "list") expectRows(view);
    else { expect(metric(view, 0)).toBe("2"); expect(metric(view, 1)).toBe("3"); }
  });
  it.each(["list", "pending", "failed"] as const)("rejects successful looking %s data with an error", async (dependency) => {
    const view = await render({ response: { [dependency]: { ...defaults[dependency], error: { code: "42501", message: privateError } } } });
    expectBlocked(view);
    expect(metric(view, dependency === "list" ? 2 : dependency === "pending" ? 0 : 1)).toBe("Недоступно");
  });
  it.each(["list", "pending", "failed"] as const)("keeps null %s response unavailable", async (dependency) => {
    expectBlocked(await render({ response: { [dependency]: null } }));
  });
  it.each(["list", "pending", "failed"] as const)("keeps absent %s response unavailable", async (dependency) => {
    expectBlocked(await render({ response: { [dependency]: undefined } }));
  });
  it.each(["42P01", "42501", "PGRST116", "57014"])("uses safe dependency copy for %s", async (code) => {
    const view = await render({ response: { list: { data: [], count: 0, error: { code, message: privateError } } } });
    expectBlocked(view);
    expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
    if (code === "42P01") expect(view.markup).toContain("Структура редакционной базы");
    if (code === "42501") expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it.each([
    ["null list", null], ["object list", {}], ["null row", [null]], ["array row", [[]]],
    ["object entity type", [{ ...event, entity_type: {} }]],
    ["empty entity type", [{ ...event, entity_type: "" }]],
    ["long entity type", [{ ...event, entity_type: "a".repeat(121) }]],
    ["object entity ID", [{ ...event, entity_id: {} }]],
    ["empty entity ID", [{ ...event, entity_id: "" }]],
    ["long entity ID", [{ ...event, entity_id: "a".repeat(241) }]],
    ["object reason", [{ ...event, reason: {} }]],
    ["empty reason", [{ ...event, reason: "" }]],
    ["long reason", [{ ...event, reason: "a".repeat(241) }]],
    ["object status", [{ ...event, status: {} }]],
    ["unknown status", [{ ...event, status: "unknown" }]],
    ["prototype status", [{ ...event, status: "__proto__" }]],
    ["object attempts", [{ ...event, attempt_count: {} }]],
    ["string attempts", [{ ...event, attempt_count: "0" }]],
    ["negative attempts", [{ ...event, attempt_count: -1 }]],
    ["fractional attempts", [{ ...event, attempt_count: 1.5 }]],
    ["unsafe attempts", [{ ...event, attempt_count: Number.MAX_SAFE_INTEGER + 1 }]],
    ["SQL int overflow attempts", [{ ...event, attempt_count: 2147483648 }]],
    ["object last error", [{ ...event, last_error: {} }]],
    ["object provider", [{ ...event, provider: {} }]],
    ["null requested timestamp", [{ ...event, requested_at: null }]],
    ["invalid requested timestamp", [{ ...event, requested_at: "invalid" }]],
    ["object dispatched timestamp", [{ ...event, dispatched_at: {} }]],
    ["invalid deployed timestamp", [{ ...event, deployed_at: "invalid" }]],
    ["object run ID", [{ ...event, deployment_run_id: {} }]],
    ["object ID", [{ ...event, id: {} }]],
    ["zero ID", [{ ...event, id: 0 }]],
    ["negative ID", [{ ...event, id: -1 }]],
    ["fractional ID", [{ ...event, id: 1.5 }]],
    ["unsafe numeric ID", [{ ...event, id: Number.MAX_SAFE_INTEGER + 1 }]],
    ["leading zero string ID", [{ ...event, id: "042" }]],
    ["negative string ID", [{ ...event, id: "\u002d42" }]],
    ["SQL bigint overflow ID", [{ ...event, id: "9223372036854775808" }]],
    ["absent nullable field", [{ ...event, provider: undefined }]],
  ])("blocks a corrupt %s without an empty queue", async (_label, data) => {
    const view = await render({ response: { list: { data, count: 1, error: null } } });
    expectBlocked(view);
    expect(view.$(".empty-state").length).toBe(0);
    expectRows(view, 0);
    expect(metric(view, 0)).toBe("2"); expect(metric(view, 1)).toBe("3");
  });
  it.each(["list", "pending", "failed"] as const)("keeps %s invalid counts distinct from zero", async (dependency) => {
    for (const count of [null, undefined, "0", -1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const view = await render({ response: { [dependency]: { ...defaults[dependency], count } } });
      expectBlocked(view);
      expectRows(view);
      expect(metric(view, dependency === "list" ? 2 : dependency === "pending" ? 0 : 1)).toBe("Недоступно");
      expect(view.$("nav.pagination").length).toBe(0);
    }
  });
  it("keeps null totals on later pages without redirecting or hiding independent rows", async () => {
    const view = await render({ query: { page: "7" }, response: { list: { data: [event], count: null, error: null } } });
    expectBlocked(view); expectRows(view); expect(metric(view, 2)).toBe("Недоступно");
  });
  it("keeps failed totals on later pages without redirecting", async () => {
    const view = await render({ query: { page: "7" }, response: { list: { data: [], count: 0, error: { message: privateError } } } });
    expectBlocked(view); expect(view.$(".empty-state").length).toBe(0);
  });
  it("does not redirect when valid counts accompany an invalid list", async () => {
    const view = await render({ query: { page: "7" }, response: { list: { data: null, count: 0, error: null } } });
    expectBlocked(view);
  });
  it("preserves confirmed zero counts and an actual empty list", async () => {
    const view = await render({ response: {
      list: { data: [], count: 0, error: null }, pending: { data: null, count: 0, error: null }, failed: { data: null, count: 0, error: null },
    } });
    expect(view.$(".empty-state").text()).toContain("Запросов с такими условиями пока нет");
    expect([metric(view, 0), metric(view, 1), metric(view, 2)]).toEqual(["0", "0", "0"]);
    expect(view.$("header form").length).toBe(1); expect(retryLink(view).length).toBe(0);
  });
  it("keeps complete normal rows and source fields unchanged", async () => {
    const view = await render();
    expectRows(view); expect(view.$("header form").length).toBe(1);
    expect(view.$('input[name="outbox_id"]').attr("value")).toBe("42");
    expect(view.$("td.data-title strong").text()).toBe(event.entity_type + " · " + event.entity_id);
    expect(view.$("td.data-title small").first().text()).toBe(event.reason);
    expect(view.$(".data-table").text()).toContain("Попыток: 0");
  });
  it.each(["1", "9007199254740993", "9223372036854775807"])("keeps original exact bigint string ID %s", async (id) => {
    const view = await render({ response: { list: { data: [{ ...event, id }], count: 1, error: null } } });
    expectRows(view); expect(view.$('input[name="outbox_id"]').attr("value")).toBe(id);
  });
  it.each(["requested", "dispatched", "deployed", "failed"])("accepts SQL nullable provider/times for %s", async (status) => {
    const view = await render({ response: { list: { data: [{ ...event, status }], count: 1, error: null } } });
    expectRows(view); expect(view.$("header form").length).toBe(1);
    expect(view.$('input[name="outbox_id"]').length).toBe(status === "deployed" ? 0 : 1);
    expect(view.$('[aria-label="Публикация подтверждена"]').length).toBe(status === "deployed" ? 1 : 0);
  });
  it("accepts direct finalized deployment without intermediate timestamps", async () => {
    const view = await render({ response: { list: { data: [{ ...event, status: "deployed", deployed_at: stamp }], count: 1, error: null } } });
    expectRows(view); expect(view.$('[aria-label="Публикация подтверждена"]').length).toBe(1);
  });
  it("shows a fixed diagnostic rather than a raw stored provider error", async () => {
    const view = await render({ response: { list: { data: [{ ...event, last_error: privateError }], count: 1, error: null } } });
    expectRows(view); expect(view.markup).not.toContain(privateError);
    expect(view.$("td .form-error").text().length).toBeGreaterThan(0);
  });
  it("keeps a numeric deployment run link on a valid row", async () => {
    const view = await render({ response: { list: { data: [{ ...event, provider: "github", deployment_run_id: "123456" }], count: 1, error: null } } });
    expect(view.$('a[href="https://github.com/Kosyat128/probpera-literary-map/actions/runs/123456"]').length).toBe(1);
  });
  it.each(["opaque:run", "https://provider.example.test/run", "javascript:alert(1)"])("allows opaque run metadata but makes no unsafe run link %s", async (deployment_run_id) => {
    const view = await render({ response: { list: { data: [{ ...event, deployment_run_id }], count: 1, error: null } } });
    expectRows(view); expect(view.$(".data-table a").length).toBe(0); expect(view.$("header form").length).toBe(1);
  });
  it.each(["started", "queued", "queue\u002derror", "unknown"])("does not treat URL published=%s as a receipt", async (published) => {
    const view = await render({ query: { published } });
    expect(view.$(".form-success").length).toBe(0);
    expect(view.markup).not.toContain("Запрос надёжно записан");
    expect(view.markup).not.toContain("Запрос не удалось надёжно записать");
    expect(view.markup).toContain("Проверьте актуальную очередь");
  });
  it.each([privateError, "__proto__", "constructor", "toString"])("keeps URL error text safe for %s", async (error) => {
    const view = await render({ query: { error } });
    expect(view.markup).not.toContain(privateError);
    expect(view.markup).not.toContain(error);
    expect(view.$(".form-success").length).toBe(0);
    expect(view.markup).toContain("Проверьте актуальную очередь");
  });
  it.each(["/admin", "/staff/panel", "/"])("offers fresh filtered GET retry for base path %s", async (basePath) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    const view = await render({ query: { q: "article 100%_", status: "failed", page: "3", published: "queued", error: privateError }, response: { list: { data: [event], count: 151, error: null } }, rejected: new Set(["pending"]) });
    expectBlocked(view);
    const retry = retryLink(view);
    const href = retry.attr("href")!;
    const url = new URL(href, "https://admin.example.test");
    expect(url.pathname).toBe((basePath === "/" ? "" : basePath) + "/publication");
    expect(url.searchParams.get("q")).toBe("article 100%_");
    expect(url.searchParams.get("status")).toBe("failed"); expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.has("published")).toBe(false); expect(url.searchParams.has("error")).toBe(false);
    expect(view.ranges).toEqual([[100, 149]]);
    expect(view.filters).toContainEqual([0, "status", "failed"]);
    expect(view.filters.some(([index, key]) => index === 0 && key === "or")).toBe(true);
  });
  it("preserves pagination and catalog context on healthy pages", async () => {
    const view = await render({ query: { q: "article", status: "failed", page: "2" }, response: { list: { data: [event], count: 151, error: null } } });
    expect(view.$('nav.pagination [aria-current="page"]').text()).toBe("Страница 2 из 4");
    expect(view.$("nav.pagination a").map((_index, node) => view.$(node).attr("href")).get()).toEqual([
      "/publication?q=article&status=failed", "/publication?q=article&status=failed&page=3",
    ]);
    expect(view.$('header input[name="catalog_q"]').attr("value")).toBe("article");
    expect(view.$('header input[name="catalog_status"]').attr("value")).toBe("failed");
    expect(view.$('header input[name="catalog_page"]').attr("value")).toBe("2");
  });
  it.each([[0, "/publication?q=article&status=failed"], [151, "/publication?q=article&status=failed&page=4"]] as const)("redirects confirmed out of range total %s through Next", async (count, destination) => {
    await expect(render({ query: { q: "article", status: "failed", page: "9" }, response: { list: { data: [], count, error: null } } })).rejects.toMatchObject({ destination });
  });
  it("keeps absent client dependency state without actions", async () => {
    const view = await render({ noClient: true });
    expect(view.markup).toContain("Редакционная база временно недоступна"); expect(view.from).not.toHaveBeenCalled();
    expect(view.$("form").length).toBe(0);
  });
  it("preserves query framework signals before reading", async () => {
    const signal = new NextSignal("/login"); await expect(render({ querySignal: signal })).rejects.toBe(signal);
  });
  it("preserves client framework signals before reading", async () => {
    const signal = new NextSignal("/login"); await expect(render({ clientSignal: signal })).rejects.toBe(signal);
  });
});
