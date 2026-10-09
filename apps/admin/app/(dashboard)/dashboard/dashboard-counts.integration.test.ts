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

// Load the real server component with its real format/status modules. Only
// the database client and the framework link are replaced at the boundary.
function loadAdminModule(
  relative: string,
  mocks: Record<string, unknown>,
): ModuleExports {
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
      const sourceFile = [target, `${target}.ts`, `${target}.tsx`].find(
        (candidate) => existsSync(candidate),
      );
      if (sourceFile) {
        return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
      }
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(
    require,
    module,
    module.exports,
  );
  return module.exports;
}

const queryMetrics = [
  "Всего статей",
  "Опубликовано",
  "На проверке",
  "По расписанию",
  "Комментарии",
  "Просмотры",
  "Медиафайлы",
  "Произведения",
  "Точные издания",
  "Реальные обложки",
  "Читатели",
  "Оценки книг и статей",
] as const;
const privateError = "PRIVATE_DB_PASSWORD=never-render-this-fixture";

async function renderDashboard(
  overrides: Map<number, unknown> = new Map(),
  rejectedQueries: Set<number> = new Set(),
) {
  let nextQuery = 0;
  const from = vi.fn(() => {
    const queryIndex = nextQuery++;
    const query = {
      select: () => query,
      is: () => query,
      eq: () => query,
      not: () => query,
      in: () => query,
      then: (
        fulfilled: (value: unknown) => unknown,
        rejected: (reason: unknown) => unknown,
      ) =>
        Promise.resolve()
          .then(() => {
            if (rejectedQueries.has(queryIndex)) {
              throw new TypeError(privateError);
            }
            return overrides.has(queryIndex)
              ? overrides.get(queryIndex)
              : { count: queryIndex + 10, error: null };
          })
          .then(fulfilled, rejected),
    };
    return query;
  });
  const mocks = {
    "@/lib/supabase/server": {
      createServerSupabaseClient: async () => ({ from }),
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...props }: { children?: ReactNode }) =>
        createElement("a", { ...props, "data-next-link": "true" }, children),
    },
  };
  const DashboardPage = loadAdminModule(
    "app/(dashboard)/dashboard/page.tsx",
    mocks,
  ).default as () => Promise<ReactNode>;
  const markup = renderToStaticMarkup(await DashboardPage());
  expect(from).toHaveBeenCalledTimes(12);
  return { markup, $: load(markup) };
}

type RenderedDashboard = Awaited<ReturnType<typeof renderDashboard>>;

function metric(dashboard: RenderedDashboard, label: string) {
  const { $ } = dashboard;
  const rows = $(".stat-card, .status-list > div").filter(
    (_index, row) => $(row).children("span").first().text() === label,
  );
  expect(rows.length, `exactly one metric named ${label}`).toBe(1);
  return rows.children("strong").text();
}

function expectSafePartialState(dashboard: RenderedDashboard, failedIndex: number) {
  expect(metric(dashboard, queryMetrics[failedIndex])).toBe("Недоступно");
  const independentIndex = (failedIndex + 1) % queryMetrics.length;
  expect(metric(dashboard, queryMetrics[independentIndex])).toBe(
    String(independentIndex + 10),
  );
  expect(dashboard.markup).not.toContain(privateError);
  const retry = dashboard.$("a, button").filter((_index, element) =>
    /Повторить/i.test(dashboard.$(element).text()),
  );
  expect(retry.length, "a visible retry action for unavailable data").toBeGreaterThan(0);
}

describe("M02 dashboard counts through the actual server component", () => {
  it.each(queryMetrics.map((label, index) => [label, index] as const))(
    "T01: failed %s count leaves independent metrics visible",
    async (_label, index) => {
      const dashboard = await renderDashboard(
        new Map([[index, { count: null, error: { code: "57014", message: privateError } }]]),
      );
      expectSafePartialState(dashboard, index);
    },
  );

  it("T02: twelve successful zero counts render twelve real zeroes without an error state", async () => {
    const dashboard = await renderDashboard(
      new Map(queryMetrics.map((_label, index) => [index, { count: 0, error: null }])),
    );
    for (const label of queryMetrics) expect(metric(dashboard, label)).toBe("0");
    expect(dashboard.markup).not.toContain("Недоступно");
    expect(dashboard.$('[role="alert"]').length).toBe(0);
  });

  it.each([
    ["null response", null],
    ["missing count", { error: null }],
    ["null count", { count: null, error: null }],
    ["negative count", { count: -1, error: null }],
    ["NaN count", { count: Number.NaN, error: null }],
    ["string count", { count: "0", error: null }],
    ["successful-looking count with an error", { count: 21, error: { message: privateError } }],
  ])("keeps %s unavailable rather than inventing a number", async (_label, response) => {
    const dashboard = await renderDashboard(new Map([[0, response]]));
    expectSafePartialState(dashboard, 0);
  });

  it.each(queryMetrics.map((label, index) => [label, index] as const))(
    "a rejected transport for %s cannot crash independent metrics",
    async (_label, index) => {
      const dashboard = await renderDashboard(new Map(), new Set([index]));
      expectSafePartialState(dashboard, index);
    },
  );

  it.each([
    ["/", "/dashboard"],
    ["/admin", "/admin/dashboard"],
    ["/staff/panel", "/staff/panel/dashboard"],
  ])("retries with a document navigation under base path %s", async (basePath, href) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    try {
      const dashboard = await renderDashboard(
        new Map([[0, { count: null, error: { code: "57014" } }]]),
      );
      const retry = dashboard.$("a").filter((_index, element) =>
        /Повторить/i.test(dashboard.$(element).text()),
      );
      expect(retry.length).toBe(1);
      expect(retry.attr("href")).toBe(href);
      // The marker belongs only to the mocked Next Link. An ordinary anchor
      // performs a fresh document request rather than using its route cache.
      expect(retry.attr("data-next-link")).toBeUndefined();
      expect(dashboard.$('a[data-next-link="true"]').length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
