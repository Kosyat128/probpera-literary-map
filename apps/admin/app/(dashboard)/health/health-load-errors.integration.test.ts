import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_EDITORIAL_SCHEMA_VERSION,
  EDITORIAL_SCHEMA_REQUIRED_FLAGS,
} from "../../../lib/editorial-schema-health";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Execute the real page and readiness, redaction, date and result helpers.
// Only the provider, Next Link and the diagnostic server action are boundaries.
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

type QueryKey = "diagnostics" | "open" | "recent" | "markers" | "schema" | "probe";
const queryKeys: QueryKey[] = ["diagnostics", "open", "recent", "markers", "schema", "probe"];
const privateError = "PRIVATE_PROVIDER_SECRET=never-render-this-fixture";
const fixtureTime = "2026-09-30T09:00:00.000Z";
const diagnostic = {
  id: 1,
  fingerprint: "diagnostic-1234",
  message: "Test UI fault",
  source: "fixture",
  path: "/books",
  status: "open",
  created_at: fixtureTime,
};
const completeSchema = {
  version: CURRENT_EDITORIAL_SCHEMA_VERSION,
  ...Object.fromEntries(EDITORIAL_SCHEMA_REQUIRED_FLAGS.map((flag) => [flag, true])),
  pendingPublicBuilds: 7,
};

async function renderHealth(
  overrides: Partial<Record<QueryKey, unknown>> = {},
  rejected: Set<QueryKey> = new Set(),
) {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(fixtureTime));
  const responses: Record<QueryKey, unknown> = {
    diagnostics: { data: [diagnostic], error: null },
    open: { count: 11, error: null },
    recent: { count: 22, error: null },
    markers: {
      data: [
        { marker_key: "encrypted_backup", status: "ok", occurred_at: fixtureTime },
        { marker_key: "restore_drill", status: "ok", occurred_at: fixtureTime },
      ],
      error: null,
    },
    schema: { data: completeSchema, error: null },
    probe: { data: null, error: null },
    ...overrides,
  };
  let fromIndex = 0;
  function response(key: QueryKey) {
    return Promise.resolve().then(() => {
      if (rejected.has(key)) throw new TypeError(privateError);
      return responses[key];
    });
  }
  const from = vi.fn((table: string) => {
    const key = table === "translation_provider_self_tests" ? "probe" : queryKeys[fromIndex++];
    const query = {
      select: () => query,
      order: () => query,
      limit: () => query,
      eq: () => query,
      gte: () => query,
      maybeSingle: () => query,
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) =>
        response(key).then(fulfilled, denied),
    };
    return query;
  });
  const rpc = vi.fn((name: string) => {
    expect(name).toBe("get_editorial_schema_health");
    return response("schema");
  });
  const mutation = vi.fn();
  const providerRun = vi.fn();
  const mocks = {
    "@/lib/supabase/server": {
      createServerSupabaseClient: async () => ({ from, rpc }),
    },
    "./actions": { setDiagnosticStatusAction: mutation },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: providerRun } } }) },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }: { children?: ReactNode }) =>
        createElement("a", { ...props, "data-next-link": "true" }, children),
    },
  };
  const HealthPage = loadAdminModule("app/(dashboard)/health/page.tsx", mocks).default as
    () => Promise<ReactNode>;
  const markup = renderToStaticMarkup(await HealthPage());
  expect(from).toHaveBeenCalledTimes(5);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(mutation).not.toHaveBeenCalled();
  expect(providerRun).not.toHaveBeenCalled();
  return { markup, $: load(markup) };
}

type RenderedHealth = Awaited<ReturnType<typeof renderHealth>>;
function card(health: RenderedHealth, label: string) {
  const { $ } = health;
  const match = $(".stat-card").filter((_index, row) =>
    $(row).children("span").first().text() === label);
  expect(match.length, `one metric named ${label}`).toBe(1);
  return match;
}
function value(health: RenderedHealth, label: string) {
  return card(health, label).children("strong").text();
}
function status(health: RenderedHealth, label: string) {
  return card(health, label).children("strong").attr("data-health-status");
}
function expectSafeRetry(health: RenderedHealth) {
  expect(health.markup).not.toContain(privateError);
  const retry = health.$("a").filter((_index, item) => /Повторить/i.test(health.$(item).text()));
  expect(retry.length).toBeGreaterThan(0);
  expect(retry.attr("data-next-link")).toBeUndefined();
}
function expectUnavailable(health: RenderedHealth, key: QueryKey) {
  expectSafeRetry(health);
  if (key === "open" || key === "recent") {
    expect(value(health, key === "open" ? "Открыто" : "За 24 часа")).toBe("Недоступно");
  } else if (key === "diagnostics") {
    expect(value(health, "Групп")).toBe("Недоступно");
    expect(health.$("table").length).toBe(0);
    expect(health.markup).not.toContain("Клиентских ошибок пока не зарегистрировано.");
  } else if (key === "markers") {
    expect(status(health, "Резервная копия DB + Storage")).toBe("UNKNOWN");
    expect(status(health, "Проверка восстановления")).toBe("UNKNOWN");
  } else if (key === "probe") {
    expect(status(health, "Перевод на английский")).toBe("UNKNOWN");
  } else {
    for (const label of ["Схема CMS", "Сохранение RU+EN", "Media Studio", "Публикация"]) {
      expect(status(health, label)).toBe("UNKNOWN");
    }
    expect(health.markup).not.toContain("Требуется актуальная production-схема");
    expect(health.markup).not.toContain("нужна актуальная lifecycle-миграция");
  }
  const independent = key === "open" ? "За 24 часа" : "Открыто";
  expect(value(health, independent)).toBe(independent === "Открыто" ? "11" : "22");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("M02 Health actual SSR dependency failures", () => {
  it.each(queryKeys)("isolates a provider error in %s without false empty data", async (key) => {
    const healthy = key === "open" || key === "recent" ? { count: 33 } : { data: null };
    const health = await renderHealth({ [key]: {
      ...healthy, error: { code: "57014", message: privateError },
    } });
    expectUnavailable(health, key);
  });

  it.each(queryKeys)("isolates a rejected %s transport", async (key) => {
    expectUnavailable(await renderHealth({}, new Set([key])), key);
  });

  it.each(queryKeys)("treats a null %s response as unavailable", async (key) => {
    expectUnavailable(await renderHealth({ [key]: null }), key);
  });

  it.each(["diagnostics", "markers", "schema"] as QueryKey[])(
    "treats successful-looking null %s data as unavailable", async (key) => {
      expectUnavailable(await renderHealth({ [key]: { data: null, error: null } }), key);
    },
  );

  it.each([
    ["diagnostics", { data: {}, error: null }],
    ["diagnostics", { data: [null], error: null }],
    ["diagnostics", { data: [{ ...diagnostic, fingerprint: {} }], error: null }],
    ["diagnostics", { data: [{ ...diagnostic, status: {} }], error: null }],
    ["diagnostics", { data: [{ ...diagnostic, created_at: {} }], error: null }],
    ["markers", { data: {}, error: null }],
    ["markers", { data: [null], error: null }],
    ["markers", { data: [{ marker_key: "encrypted_backup", status: {}, occurred_at: fixtureTime }], error: null }],
    ["markers", { data: [{ marker_key: "restore_drill", status: "ok", occurred_at: {} }], error: null }],
    ["markers", { data: [{ marker_key: "restore_drill", status: "ok", occurred_at: "not-a-date" }], error: null }],
    ["schema", { data: {}, error: null }],
    ["schema", { data: [], error: null }],
    ["schema", { data: { ...completeSchema, version: {} }, error: null }],
    ["schema", { data: { ...completeSchema, articleBundleRpc: "true" }, error: null }],
    ["schema", { data: { ...completeSchema, mediaStudioLifecycle: {} }, error: null }],
  ] as const)("rejects corrupted %s data before rendering", async (key, response) => {
    expectUnavailable(await renderHealth({ [key]: response }), key);
  });

  it.each([
    ["missing", undefined], ["null", null], ["string", "0"], ["negative", -1],
    ["NaN", Number.NaN], ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ])("keeps %s count unknown", async (_label, count) => {
    expectUnavailable(await renderHealth({ open: { count, error: null } }), "open");
  });

  it("accepts true zero and verified empty lists without inventing an error", async () => {
    const health = await renderHealth({
      diagnostics: { data: [], error: null }, open: { count: 0, error: null },
      recent: { count: 0, error: null }, markers: { data: [], error: null },
      schema: { data: { ...completeSchema, pendingPublicBuilds: 0 }, error: null },
    });
    for (const label of ["Открыто", "За 24 часа", "Групп"]) expect(value(health, label)).toBe("0");
    expect(health.markup).toContain("Клиентских ошибок пока не зарегистрировано.");
    expect(status(health, "Публикация")).toBe("OK");
    expect(card(health, "Публикация").children("small").text()).toContain("0 запросов");
    expect(health.markup).not.toContain("Повторить загрузку");
    expect(status(health, "Резервная копия DB + Storage")).toBe("UNKNOWN");
  });

  it.each([
    ["PGRST202", "не соответствует запросу"],
    ["57014", "временно недоступна"],
    ["42501", "проверить доступ"],
  ])("distinguishes schema check %s from an outage without raw provider text", async (code, message) => {
    const health = await renderHealth({ schema: {
      data: null, error: { code, message: privateError },
    } });
    expectUnavailable(health, "schema");
    expect(card(health, "Схема CMS").children("small").text()).toContain(message);
    if (code !== "PGRST202") {
      expect(card(health, "Схема CMS").children("small").text()).not.toContain("не соответствует");
    }
  });

  it("does not trust schema data supplied together with an RPC error", async () => {
    const health = await renderHealth({ schema: {
      data: completeSchema, error: { code: "57014", message: privateError },
    } });
    expectUnavailable(health, "schema");
  });

  it.each([
    { ...completeSchema, articleBundleRpc: undefined },
    { version: CURRENT_EDITORIAL_SCHEMA_VERSION, pendingPublicBuilds: 7 },
  ])("keeps an incomplete current schema response unknown: %j", async (data) => {
    const health = await renderHealth({ schema: { data, error: null } });
    expectUnavailable(health, "schema");
    expect(value(health, "Открыто")).toBe("11");
    expect(card(health, "Схема CMS").children("small").text()).toContain("неполный или повреждённый ответ");
  });

  it.each([
    ["missing", undefined], ["null", null], ["object", {}], ["string", "0"],
    ["negative", -1], ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ])("keeps %s publication queue unknown without losing valid schema checks", async (_label, pendingPublicBuilds) => {
    const health = await renderHealth({ schema: {
      data: { ...completeSchema, pendingPublicBuilds }, error: null,
    } });
    expect(status(health, "Схема CMS")).toBe("OK");
    expect(status(health, "Сохранение RU+EN")).toBe("OK");
    expect(status(health, "Публикация")).toBe("UNKNOWN");
    expect(card(health, "Публикация").children("small").text()).not.toContain("0 запросов");
    expectSafeRetry(health);
  });

  it("preserves required version and capability decisions for an actual failed check", async () => {
    const health = await renderHealth({ schema: {
      data: { ...completeSchema, version: "20260822_staff_editorial_read_rls", articleBundleRpc: false },
      error: null,
    } });
    expect(status(health, "Схема CMS")).toBe("FAILED");
    expect(status(health, "Сохранение RU+EN")).toBe("FAILED");
    expect(status(health, "Media Studio")).toBe("FAILED");
    expect(card(health, "Схема CMS").children("small").text()).toContain("актуальная версия схемы");
    expect(value(health, "Открыто")).toBe("11");
  });

  it("keeps a valid operational failure separate from unavailable evidence", async () => {
    const health = await renderHealth({ markers: { data: [
      { marker_key: "encrypted_backup", status: "failed", occurred_at: fixtureTime },
      { marker_key: "restore_drill", status: "ok", occurred_at: fixtureTime },
    ], error: null } });
    expect(status(health, "Резервная копия DB + Storage")).toBe("FAILED");
    expect(status(health, "Проверка восстановления")).toBe("OK");
    expect(health.markup).not.toContain("Повторить загрузку");
  });

  it("retains diagnostic grouping and existing secret/path redaction", async () => {
    const health = await renderHealth({ diagnostics: { data: [
      { ...diagnostic, message: "password=hunter2 sk-proj-abcdefghijk", path: "/books?token=private-query", source: "authorization: Bearer abc.def.ghi" },
      { ...diagnostic, id: 2 },
    ], error: null } });
    expect(value(health, "Групп")).toBe("1");
    expect(health.$("tbody > tr").length).toBe(1);
    expect(health.$("tbody > tr > td").eq(2).text()).toBe("2");
    for (const secret of ["hunter2", "sk-proj-abcdefghijk", "private-query", "abc.def.ghi"]) {
      expect(health.markup).not.toContain(secret);
    }
    expect(health.markup).toContain("[скрыто]");
  });

  it.each([
    ["/", "/health"], ["/admin", "/admin/health"], ["/staff/panel", "/staff/panel/health"],
  ])("retries through a fresh document request under base path %s", async (basePath, href) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    const health = await renderHealth({ open: { count: null, error: { code: "57014" } } });
    expectSafeRetry(health);
    const retry = health.$("a").filter((_index, item) => /Повторить/i.test(health.$(item).text()));
    expect(retry.attr("href")).toBe(href);
  });
});
