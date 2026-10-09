import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type Exports = Record<string, unknown>;

// Execute the real page/GET route and their read validators. Only Supabase and
// environment are mocked; no browser, authenticated DB or production evidence.
function loadModule(relative: string, mocks: Record<string, unknown>): Exports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Exports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const source = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      if (source) return loadModule(path.relative(adminRoot, source), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const now = new Date("2026\u002d09\u002d30T10:00:00.000Z");
const from = "2026\u002d09\u002d23T10:00:00.000Z";
const to = now.toISOString();
const secret = "PRIVATE_PROVIDER_SECRET=never\u002drender";
const good = {
  from, to, views: 12, visitors: 5, pages: 2, ratings: 3,
  averageRating: 4.33, comments: 2,
  daily: [{ day: "2026\u002d09\u002d24", views: 12 }],
  topPaths: [{ path: "/books/example", views: 12 }],
  topSources: [{ source: "example.test", views: 12 }],
  topTransitions: [{ from: "/", to: "/books/example", views: 2 }],
};
const empty = { ...good, views: 0, visitors: 0, pages: 0, ratings: 0,
  averageRating: null, comments: 0, daily: [], topPaths: [], topSources: [], topTransitions: [] };
type Options = { response?: unknown; rejection?: unknown; noClient?: boolean };

function provider(options: Options = {}) {
  const rpc = vi.fn(async (name: string, args: unknown) => {
    expect(name).toBe("get_admin_analytics_report");
    expect(args).toEqual({ p_from: from, p_to: to });
    if (Object.hasOwn(options, "rejection")) throw options.rejection;
    return Object.hasOwn(options, "response") ? options.response : { data: good, error: null };
  });
  const fromTable = vi.fn();
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () =>
      options.noClient ? null : { rpc, from: fromTable } },
    "@/lib/env": { adminEnv: { metrikaCounterId: "123456" } },
  };
  return { rpc, fromTable, mocks };
}

async function renderPage(options: Options = {}) {
  const state = provider(options);
  const Page = loadModule("app/(dashboard)/analytics/page.tsx", state.mocks).default as
    (props: { searchParams: Promise<{ period?: string }> }) => Promise<ReactNode>;
  const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ period: "7" }) }));
  expect(state.rpc).toHaveBeenCalledTimes(options.noClient ? 0 : 1);
  expect(state.fromTable).not.toHaveBeenCalled();
  return { markup, $: load(markup) };
}

async function exportReport(options: Options = {}) {
  const state = provider(options);
  const GET = loadModule("app/(dashboard)/analytics/export/route.ts", state.mocks).GET as
    (request: Request) => Promise<Response>;
  const response = await GET(new Request("https://admin.example.test/analytics/export?period=7"));
  expect(state.rpc).toHaveBeenCalledTimes(options.noClient ? 0 : 1);
  expect(state.fromTable).not.toHaveBeenCalled();
  return response;
}

function expectUnavailable(result: Awaited<ReturnType<typeof renderPage>>) {
  expect(result.markup).not.toContain(secret);
  expect(result.$(".analytics-stats").length).toBe(0);
  expect(result.$(".analytics-timeline").length).toBe(0);
  expect(result.$(".analytics-list").length).toBe(0);
  expect(result.$('a[href*="/analytics/export"]').length).toBe(0);
  expect(result.$(".analytics-geography").length).toBe(1);
  expect(result.$("select[name=period]").val()).toBe("7");
  const retry = result.$("a").filter((_i, el) => /Повторить/.test(result.$(el).text()));
  expect(retry.attr("href")).toBe("/admin/analytics?period=7");
  expect(retry.attr("data-next-link")).toBeUndefined();
}

const malformed: [string, unknown][] = [
  ["null envelope", null], ["missing data", { error: null }],
  ["null report", { data: null }], ["array report", { data: [] }],
  ["partial report", { data: { views: 0 } }],
  ...["views", "visitors", "pages", "ratings", "comments"].flatMap((key) =>
    [null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((value): [string, unknown] =>
      [`invalid ${key} ${String(value)}`, { data: { ...good, [key]: value } }])),
  ["object rating", { data: { ...good, averageRating: {} } }],
  ["string rating", { data: { ...good, averageRating: "4.3" } }],
  ["negative rating", { data: { ...good, averageRating: -1 } }],
  ["wrong period", { data: { ...good, from: to } }],
  ["invalid period", { data: { ...good, to: "invalid" } }],
  ["missing daily", { data: { ...good, daily: null } }],
  ["bad calendar day", { data: { ...good, daily: [{ day: "2026\u002d02\u002d30", views: 1 }] } }],
  ["bad daily count", { data: { ...good, daily: [{ ...good.daily[0], views: {} }] } }],
  ["missing paths", { data: { ...good, topPaths: null } }],
  ["object path", { data: { ...good, topPaths: [{ path: {}, views: 1 }] } }],
  ["control-only path", { data: { ...good, topPaths: [{ path: "\u0001", views: 1 }] } }],
  ["control-only source", { data: { ...good, topSources: [{ source: " \u007f ", views: 1 }] } }],
  ["control-only transition origin", { data: { ...good, topTransitions: [{ from: "\u0002", to: "/books/example", views: 1 }] } }],
  ["control-only transition target", { data: { ...good, topTransitions: [{ from: "/", to: "\u0003", views: 1 }] } }],
  ["bad source", { data: { ...good, topSources: [null] } }],
  ["missing transition target", { data: { ...good, topTransitions: [{ from: "/", views: 1 }] } }],
];

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("M02 analytics actual SSR and CSV reads", () => {
  function freezeTime() { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("ADMIN_BASE_PATH", "/admin"); }

  it("retains confirmed report values and formula-safe CSV", async () => {
    freezeTime();
    const result = await renderPage();
    expect(result.$(".analytics-stats strong").first().text()).toBe("12");
    expect(result.$(".analytics-stats strong").eq(3).text()).toBe("4.33");
    const response = await exportReport({ response: { data: { ...good,
      topPaths: [{ path: '=HYPERLINK("example")', views: 12 }] }, error: null } });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(await response.text()).toContain('"\'=HYPERLINK(""example"")"');
  });

  it("retains confirmed zeros and empty lists", async () => {
    freezeTime();
    const result = await renderPage({ response: { data: empty, error: null } });
    expect(result.$(".analytics-stats strong").first().text()).toBe("0");
    expect(result.$('a[href*="/analytics/export"]').length).toBe(1);
    expect((await exportReport({ response: { data: empty, error: null } })).status).toBe(200);
  });

  it("accepts PostgreSQL timestamp offsets for the requested UTC range", async () => {
    freezeTime();
    const response = { data: { ...good, from: from.replace(".000Z", "+00:00"),
      to: to.replace(".000Z", "+00:00") }, error: null };
    expect((await renderPage({ response })).$(".analytics-stats strong").first().text()).toBe("12");
    expect((await exportReport({ response })).status).toBe(200);
  });

  it.each([0, 6])("rejects average %s outside the SQL ratings domain", async (averageRating) => {
    freezeTime();
    const response = { data: { ...good, averageRating } };
    expectUnavailable(await renderPage({ response }));
    expect((await exportReport({ response })).status).toBe(503);
  });

  it.each(["57014", "42501", "PGRST301", "PGRST202"])("classifies %s without showing raw provider errors", async (code) => {
    freezeTime();
    const options = { response: { data: good, error: { code, message: secret } } };
    const result = await renderPage(options);
    expectUnavailable(result);
    expect(result.markup.includes("Структура редакционной базы")).toBe(code === "PGRST202");
    expect(result.markup.includes("права доступа")).toBe(["42501", "PGRST301"].includes(code));
    const response = await exportReport(options);
    expect(response.status).toBe(["42501", "PGRST301"].includes(code) ? 403 : 503);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).not.toContain(secret);
  });

  it("contains transport rejection and keeps the independent geography report", async () => {
    freezeTime();
    const options = { rejection: new TypeError(secret) };
    expectUnavailable(await renderPage(options));
    const response = await exportReport(options);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(secret);
  });

  it.each([
    { response: { data: null } },
    { response: { data: { views: 0 } } },
    { response: { data: { ...good, views: Number.MAX_SAFE_INTEGER + 1 } } },
    { response: { data: { ...good, topSources: null } } },
    { response: { data: good, error: { code: "PGRST301", message: secret } } },
    { rejection: new TypeError(secret) },
  ])("rejects an unsafe CSV read independently from the page", async (options) => {
    freezeTime();
    const response = await exportReport(options);
    const expectedStatus = "response" in options && options.response &&
      "error" in options.response && options.response.error?.code === "PGRST301" ? 403 : 503;
    expect(response.status).toBe(expectedStatus);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).not.toContain(secret);
  });

  it.each(malformed)("keeps %s unavailable and refuses a fabricated CSV", async (_label, response) => {
    freezeTime();
    expectUnavailable(await renderPage({ response }));
    const exported = await exportReport({ response });
    expect(exported.status).toBe(503);
    expect(exported.headers.get("Content-Type")).toContain("application/json");
    expect(exported.headers.get("Content-Disposition")).toBeNull();
  });

  it("preserves the configured base path on a GET retry", async () => {
    freezeTime(); vi.stubEnv("ADMIN_BASE_PATH", "/staff");
    const result = await renderPage({ response: { data: null, error: { code: "57014" } } });
    expect(result.$('a[href="/staff/analytics?period=7"]').length).toBe(1);
  });

  it("offers a GET retry when no client is configured and refuses CSV", async () => {
    freezeTime();
    const result = await renderPage({ noClient: true });
    expect(result.$('a[href="/admin/analytics?period=7"]').length).toBe(1);
    expect((await exportReport({ noClient: true })).status).toBe(503);
  });
});
