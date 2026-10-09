import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffRole } from "../../../lib/auth";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Real page and read validators. Provider, artifact reader, auth, framework
// links and server action are isolated; this does not exercise live RPC or DB.
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

const healthKeys = [
  "countries", "writers", "forceRls", "authenticatedSelectOnly", "directMutationClosed",
  "staffSelectPolicies", "validatedForeignKeys", "ensureReferenceRpc", "manualReferenceRpc",
  "catalogSyncRpc", "manualReferencesValid", "atomicEditionCreate", "atomicEditionUpdate",
] as const;
const completeHealth = {
  version: "20260901_zz_data_studio_integrity",
  ...Object.fromEntries(healthKeys.map((key) => [key, true])),
};
const catalog = {
  version: 1,
  countries: [
    { id: "fixture1", label: "Fixture country 1", fields: {}, writers: [
      { id: "writer1", label: "Fixture writer 1", fields: {} },
      { id: "writer2", label: "Fixture writer 2", fields: {} },
    ] },
    { id: "fixture2", label: "Fixture country 2", fields: {}, writers: [
      { id: "writer3", label: "Fixture writer 3", fields: {} },
    ] },
  ],
};
const privateError = "PRIVATE_PROVIDER_SECRET=never\u002drender\u002dthis\u002dfixture";
const countKeys = ["countries", "writers", "works", "editions", "imports"] as const;
type CountKey = (typeof countKeys)[number];
type QueryKey = CountKey | "health" | "catalog";
const allKeys: QueryKey[] = [...countKeys, "health", "catalog"];
const labels = ["Страны", "Авторы", "Произведения", "Издания", "Кандидаты"];
type QueryParams = { error?: string; synchronized?: string };

class NextSignal extends Error {}
async function renderDataStudio(options: {
  overrides?: Partial<Record<QueryKey, unknown>>;
  rejected?: Set<QueryKey>;
  role?: StaffRole | null;
  query?: QueryParams;
  authSignal?: NextSignal;
} = {}) {
  const { overrides = {}, rejected = new Set(), role = "owner", query = {} } = options;
  const responses: Record<QueryKey, unknown> = {
    countries: { count: 11, error: null }, writers: { count: 22, error: null },
    works: { count: 33, error: null }, editions: { count: 44, error: null },
    imports: { count: 55, error: null }, health: { data: completeHealth, error: null },
    catalog,
    ...overrides,
  };
  function response(key: QueryKey) {
    return Promise.resolve().then(() => {
      if (rejected.has(key)) throw new TypeError(privateError);
      return responses[key];
    });
  }
  let fromIndex = 0;
  const from = vi.fn(() => {
    const key = countKeys[fromIndex++];
    return { select: () => response(key) };
  });
  const rpc = vi.fn((name: string) => {
    expect(name).toBe("get_data_studio_schema_health");
    return response("health");
  });
  const action = vi.fn();
  const loadCatalog = vi.fn(() => response("catalog"));
  const auth = vi.fn(async () => {
    if (options.authSignal) throw options.authSignal;
    return { role, user: { id: "own\u002duser", email: "owner@example.test" }, mfa: {} };
  });
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from, rpc }) },
    "@/lib/auth": { getStaffSession: auth },
    "@/lib/editorial-catalog": { loadEditorialCatalog: loadCatalog },
    "./actions": { synchronizeEditorialReferencesAction: action },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }: { children?: ReactNode }) =>
        createElement("a", { ...props, "data-next-link": "true" }, children),
    },
  };
  const DataStudioPage = loadAdminModule("app/(dashboard)/data-studio/page.tsx", mocks).default as
    (props: { searchParams: Promise<QueryParams> }) => Promise<ReactNode>;
  if (options.authSignal) {
    await expect(DataStudioPage({ searchParams: Promise.resolve(query) })).rejects.toBe(options.authSignal);
    expect(action).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    return null;
  }
  const markup = renderToStaticMarkup(await DataStudioPage({ searchParams: Promise.resolve(query) }));
  expect(from).toHaveBeenCalledTimes(5);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(loadCatalog).toHaveBeenCalledTimes(1);
  expect(auth).toHaveBeenCalledTimes(1);
  expect(action).not.toHaveBeenCalled();
  return { markup, $: load(markup) };
}

type RenderedDataStudio = NonNullable<Awaited<ReturnType<typeof renderDataStudio>>>;
async function render(options?: Parameters<typeof renderDataStudio>[0]) {
  const studio = await renderDataStudio(options);
  expect(studio).not.toBeNull();
  return studio as RenderedDataStudio;
}
function card(studio: RenderedDataStudio, label: string) {
  const { $ } = studio;
  const rows = $(".stat-card").filter((_index, row) => $(row).children("span").text() === label);
  expect(rows.length).toBe(1);
  return rows;
}
function expectSafeRetry(studio: RenderedDataStudio) {
  expect(studio.markup).not.toContain(privateError);
  expect(studio.$("form").length).toBe(0);
  const retry = studio.$("a").filter((_index, item) => /Повторить/i.test(studio.$(item).text()));
  expect(retry.length).toBeGreaterThan(0);
  expect(retry.attr("data-next-link")).toBeUndefined();
  expect(studio.$(".quick-actions > a").length).toBe(5);
  expect(studio.markup).not.toContain("примените миграцию");
  expect(studio.$(".badge").text()).not.toBe("Нужна миграция");
}
function expectUnavailable(studio: RenderedDataStudio, key: QueryKey) {
  expectSafeRetry(studio);
  if (countKeys.includes(key as CountKey)) {
    const index = countKeys.indexOf(key as CountKey);
    expect(card(studio, labels[index]).children("strong").text()).toBe("Недоступно");
    const independent = (index + 1) % countKeys.length;
    expect(card(studio, labels[independent]).children("strong").text()).toBe(String((independent + 1) * 11));
  } else {
    expect(card(studio, "Страны").children("strong").text()).toBe("11");
    expect(card(studio, "Авторы").children("strong").text()).toBe("22");
    if (key === "catalog") {
      expect(card(studio, "Страны").children("small").text()).toContain("Каталог недоступен");
      expect(card(studio, "Авторы").children("small").text()).toContain("Каталог недоступен");
    } else {
      expect(studio.$(".badge").text()).toBe("Схема не проверена");
    }
  }
}

afterEach(() => vi.unstubAllEnvs());

describe("M02 Data Studio actual SSR dependencies", () => {
  it.each([...countKeys, "health"] as const)("isolates an error in %s", async (key) => {
    expectUnavailable(await render({ overrides: { [key]: { count: null, data: null, error: { code: "57014", message: privateError } } } }), key);
  });

  it.each(allKeys)("isolates rejected %s read", async (key) => {
    expectUnavailable(await render({ rejected: new Set([key]) }), key);
  });

  it.each(allKeys)("rejects null %s response without false zero or migration advice", async (key) => {
    expectUnavailable(await render({ overrides: { [key]: null } }), key);
  });

  it.each([
    ["missing", undefined], ["null", null], ["object", {}], ["string", "0"],
    ["negative", -1], ["NaN", Number.NaN], ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ])("keeps %s count unavailable", async (_label, count) => {
    expectUnavailable(await render({ overrides: { countries: { count, error: null } } }), "countries");
  });

  it("does not use success-looking counts with provider error", async () => {
    expectUnavailable(await render({ overrides: { countries: { count: 21, error: { code: "57014", message: privateError } } } }), "countries");
  });

  it("does not trust health data together with provider error", async () => {
    expectUnavailable(await render({ overrides: { health: { data: completeHealth, error: { code: "57014", message: privateError } } } }), "health");
  });

  it.each([
    ["null", null], ["array", []], ["empty object", {}],
    ["invalid version", { ...completeHealth, version: {} }],
    ["missing version", Object.fromEntries(healthKeys.map((key) => [key, true]))],
    ["string flag", { ...completeHealth, forceRls: "true" }],
    ["object flag", { ...completeHealth, directMutationClosed: {} }],
    ["missing flag", { ...completeHealth, forceRls: undefined }],
  ])("keeps %s health DTO unverified", async (_label, data) => {
    expectUnavailable(await render({ overrides: { health: { data, error: null } } }), "health");
  });

  it.each([
    ["missing root", undefined], ["missing countries", { version: 1 }],
    ["invalid version", { ...catalog, version: 2 }], ["non-array countries", { version: 1, countries: {} }],
    ["null country", { version: 1, countries: [null] }],
    ["missing writers", { version: 1, countries: [{ id: "country", label: "Fixture", fields: {} }] }],
    ["null writer", { version: 1, countries: [{ ...catalog.countries[0], writers: [null] }] }],
  ])("isolates %s catalog from the independent DB metrics", async (_label, sourceCatalog) => {
    expectUnavailable(await render({ overrides: { catalog: sourceCatalog } }), "catalog");
  });

  it.each([
    ["PGRST202", "не соответствует запросу"], ["57014", "временно недоступна"], ["42501", "проверить доступ"],
  ])("classifies health error %s safely", async (code, message) => {
    const studio = await render({ overrides: { health: { data: null, error: { code, message: privateError } } } });
    expectUnavailable(studio, "health");
    expect(studio.markup).toContain(message);
  });

  it("retains verified source totals and real zero DB counts without warning", async () => {
    const studio = await render({ overrides: Object.fromEntries(countKeys.map((key) => [key, { count: 0, error: null }])) });
    for (const label of labels) expect(card(studio, label).children("strong").text()).toBe("0");
    expect(card(studio, "Страны").children("small").text()).toBe("2 в каталоге");
    expect(card(studio, "Авторы").children("small").text()).toBe("3 в каталоге");
    expect(studio.$("form").length).toBe(1);
    expect(studio.$(".badge").text()).toBe("Схема готова");
    expect(studio.markup).not.toContain("Повторить загрузку");
  });

  it.each(healthKeys)("keeps confirmed false %s distinct from an unavailable schema", async (key) => {
    const studio = await render({ overrides: { health: { data: { ...completeHealth, [key]: false }, error: null } } });
    expect(studio.$("form").length).toBe(0);
    expect(studio.markup).toContain("примените миграцию");
    expect(studio.$(".badge").text()).toBe("Нужна миграция");
    expect(card(studio, "Страны").children("strong").text()).toBe("11");
  });

  it("reports a confirmed stale schema version without claiming a network failure", async () => {
    const studio = await render({ overrides: { health: { data: { ...completeHealth, version: "20260801_previous_schema" }, error: null } } });
    expect(studio.$("form").length).toBe(0);
    expect(studio.markup).toContain("примените миграцию");
    expect(studio.$(".badge").text()).toBe("Нужна миграция");
  });

  it.each(["owner", "admin", "editor", null] as const)("preserves existing synchronization role boundary for %s", async (role) => {
    const studio = await render({ role });
    expect(studio.$("form").length).toBe(role === "owner" || role === "admin" ? 1 : 0);
  });

  it.each([
    ["/", "/data-studio"], ["/admin", "/admin/data-studio"], ["/staff/panel", "/staff/panel/data-studio"],
  ])("retries through a fresh GET under base path %s", async (basePath, href) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    const studio = await render({ rejected: new Set(["catalog"]) });
    expectUnavailable(studio, "catalog");
    const retry = studio.$("a").filter((_index, item) => /Повторить/i.test(studio.$(item).text()));
    expect(retry.attr("href")).toBe(href);
  });

  it("does not treat synchronized URL flag as a synchronization receipt", async () => {
    const studio = await render({ query: { synchronized: "1" } });
    expect(studio.markup).not.toContain("Канонические страны и авторы сверены с редакционным каталогом.");
    expect(studio.$(".form-success").length).toBe(0);
    expect(studio.markup).toContain("Проверьте актуальные справочники");
  });

  it("does not turn sync query error into known rejection or migration advice", async () => {
    const studio = await render({ query: { error: "sync" } });
    expect(studio.markup).not.toContain("Справочники не синхронизированы.");
    expect(studio.markup).not.toContain("Проверьте миграцию Data Studio.");
    expect(studio.markup).toContain("Результат синхронизации не удалось подтвердить");
  });

  it("never echoes unknown action error or private provider fixture", async () => {
    const studio = await render({ query: { error: privateError } });
    expect(studio.markup).not.toContain(privateError);
    expect(studio.markup).toContain("Результат операции не удалось подтвердить.");
  });

  it.each(["__proto__", "constructor", "toString"])("treats inherited query error %s as unconfirmed text", async (error) => {
    const studio = await render({ query: { error } });
    expect(studio.markup).toContain("Результат операции не удалось подтвердить.");
    expect(studio.markup).not.toContain("[object Object]");
    expect(card(studio, "Страны").children("strong").text()).toBe("11");
  });

  it.each(["redirect", "notFound"])("leaves framework %s signal outside read recovery", async (name) => {
    await renderDataStudio({ authSignal: new NextSignal(name) });
  });
});
