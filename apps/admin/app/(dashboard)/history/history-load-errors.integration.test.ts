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
const actorId = "00000000\u002d0000\u002d0000\u002d0000\u002d000000000001";
const revision = {
  revision_id: 42, entity_id: "source:writer/work", snapshot: { title: "  Original title \u2014 exact  " },
  actor_id: actorId, created_at: stamp, revision_number: 1, kind: "article",
  restorable: true, entity_updated_at: stamp,
};
const event = {
  id: 24, action: "  Original action \u2014 exact  ", entity_type: "literary_work",
  entity_id: "source:writer/work", actor_id: actorId, created_at: stamp,
};
const defaults = {
  revisions: { data: [revision], count: 1, error: null },
  restorable: { data: null, count: 1, error: null },
  events: { data: [event], count: 1, error: null },
};
type Dependency = keyof typeof defaults;
type Query = { error?: string; restored?: string; published?: string; kind?: string; entity?: string; page?: string; events_page?: string };
class NextSignal extends Error {
  constructor(readonly destination: string) { super("Next navigation signal"); }
}
async function render(options: {
  response?: Partial<Record<Dependency, unknown>>; rejected?: Set<Dependency>;
  query?: Query; noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal;
} = {}) {
  const replies = { ...defaults, ...options.response };
  const filters: [number, string, unknown][] = [];
  const ranges: [number, number][] = [];
  let index = 0;
  const from = vi.fn((table: string) => {
    const current = index++;
    const dependency = (["revisions", "restorable", "events"] as const)[current];
    expect(table).toBe(dependency === "events" ? "admin_audit_log" : "admin_revision_history");
    const builder = {
      select: () => builder, order: () => builder,
      eq: (key: string, value: unknown) => { filters.push([current, key, value]); return builder; },
      in: (key: string, value: unknown) => { filters.push([current, key, value]); return builder; },
      ilike: (key: string, value: unknown) => { filters.push([current, key, value]); return builder; },
      range: (start: number, end: number) => { ranges.push([start, end]); return builder; },
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => {
          if (options.rejected?.has(dependency)) throw new TypeError(privateError);
          return replies[dependency];
        }).then(fulfilled, denied),
    };
    return builder;
  });
  const rpc = vi.fn();
  const action = vi.fn();
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : { from, rpc };
    } },
    "./actions": { restoreRevisionAction: action },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) =>
      createElement("button", { type: "submit" }, children) },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (destination: string): never => { throw new NextSignal(destination); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule("app/(dashboard)/history/page.tsx", mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {});
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), from, ranges, filters };
  } finally {
    expect(rpc).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function revisionRows(view: Rendered) { return view.$("section.panel").eq(1).find("tbody tr"); }
function eventRows(view: Rendered) { return view.$("section.panel").eq(2).find("tbody tr"); }
function metric(view: Rendered, index: number) { return view.$(".stat-card strong").eq(index).text(); }
function retryLink(view: Rendered) {
  return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку");
}
function expectBlocked(view: Rendered) {
  expect(view.$('input[name="revision_id"]').length).toBe(0);
  expect(view.$(".history-catalog-filters form").length).toBe(1);
  expect(view.markup).not.toContain(privateError);
  expect(view.markup).not.toContain("20260813_unified_revision_history.sql");
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(retryLink(view).length).toBe(1);
  expect(retryLink(view).attr("data-next-link")).toBeUndefined();
}

afterEach(() => vi.unstubAllEnvs());

describe("M02 history real SSR read isolation", () => {
  it.each(["revisions", "restorable", "events"] as const)("isolates %s provider errors", async (dependency) => {
    const view = await render({ response: { [dependency]: { data: null, count: 0, error: { code: "57014", message: privateError } } } });
    expectBlocked(view);
    if (dependency !== "revisions") { expect(revisionRows(view).length).toBe(1); expect(metric(view, 0)).toBe("1"); }
    else { expect(eventRows(view).length).toBe(1); expect(metric(view, 1)).toBe("1"); }
    if (dependency !== "events") expect(eventRows(view).length).toBe(1);
  });
  it.each(["revisions", "restorable", "events"] as const)("isolates %s transport rejection", async (dependency) => {
    const view = await render({ rejected: new Set([dependency]) });
    expectBlocked(view);
    if (dependency !== "revisions") expect(revisionRows(view).length).toBe(1);
    if (dependency !== "events") expect(eventRows(view).length).toBe(1);
  });
  it.each(["revisions", "restorable", "events"] as const)("does not trust %s data returned with an error", async (dependency) => {
    const view = await render({ response: { [dependency]: { ...defaults[dependency], error: { code: "42501", message: privateError } } } });
    expectBlocked(view);
    if (dependency === "revisions" || dependency === "events") expect(metric(view, dependency === "revisions" ? 0 : 1)).toBe("Недоступно");
    else expect(view.$(".stat-card small").first().text()).toBe("Недоступно доступны для восстановления");
  });
  it.each(["revisions", "restorable", "events"] as const)("keeps null %s response unavailable", async (dependency) => {
    expectBlocked(await render({ response: { [dependency]: null } }));
  });
  it.each(["revisions", "restorable", "events"] as const)("keeps missing %s response unavailable", async (dependency) => {
    expectBlocked(await render({ response: { [dependency]: undefined } }));
  });
  it.each(["42P01", "42501", "PGRST116", "57014"])("uses classified safe messages for %s", async (code) => {
    const view = await render({ response: { revisions: { data: [], count: 0, error: { code, message: privateError } } } });
    expectBlocked(view);
    expect(view.$(".empty-state").length).toBe(0);
    if (code === "42P01") expect(view.markup).toContain("Структура редакционной базы");
    if (code === "42501") expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it.each([
    ["null list", null], ["object list", {}], ["null row", [null]], ["array row", [[]]],
    ["object ID", [{ ...revision, revision_id: {} }]], ["zero ID", [{ ...revision, revision_id: 0 }]],
    ["unsafe ID", [{ ...revision, revision_id: Number.MAX_SAFE_INTEGER + 1 }]],
    ["invalid decimal ID", [{ ...revision, revision_id: "42.0" }]],
    ["bigint overflow", [{ ...revision, revision_id: "9223372036854775808" }]],
    ["missing entity ID", [{ ...revision, entity_id: undefined }]], ["object entity ID", [{ ...revision, entity_id: {} }]],
    ["missing snapshot", [{ ...revision, snapshot: undefined }]],
    ["unknown kind", [{ ...revision, kind: "unknown" }]], ["prototype kind", [{ ...revision, kind: "__proto__" }]],
    ["missing kind", [{ ...revision, kind: undefined }]], ["string restorable", [{ ...revision, restorable: "true" }]],
    ["invalid creation time", [{ ...revision, created_at: "invalid" }]], ["missing creation time", [{ ...revision, created_at: undefined }]],
    ["object actor", [{ ...revision, actor_id: {} }]], ["missing actor", [{ ...revision, actor_id: undefined }]],
    ["invalid revision number", [{ ...revision, revision_number: 1.2 }]],
    ["int overflow", [{ ...revision, revision_number: 2147483648 }]],
    ["missing revision number", [{ ...revision, revision_number: undefined }]],
    ["invalid current version", [{ ...revision, entity_updated_at: "invalid" }]],
    ["missing current version", [{ ...revision, entity_updated_at: undefined }]],
  ])("keeps malformed revision %s out of the table and restore forms", async (_label, data) => {
    const view = await render({ response: { revisions: { data, count: 1, error: null } } });
    expectBlocked(view); expect(revisionRows(view).length).toBe(0);
    expect(eventRows(view).length).toBe(1); expect(view.$(".empty-state").length).toBe(0);
  });
  it.each([
    ["null list", null], ["object list", {}], ["null row", [null]], ["array row", [[]]],
    ["object ID", [{ ...event, id: {} }]], ["zero ID", [{ ...event, id: 0 }]],
    ["unsafe ID", [{ ...event, id: Number.MAX_SAFE_INTEGER + 1 }]],
    ["bigint overflow", [{ ...event, id: "9223372036854775808" }]],
    ["object action", [{ ...event, action: {} }]], ["missing action", [{ ...event, action: undefined }]],
    ["object type", [{ ...event, entity_type: {} }]], ["missing type", [{ ...event, entity_type: undefined }]],
    ["object entity ID", [{ ...event, entity_id: {} }]], ["missing entity ID", [{ ...event, entity_id: undefined }]],
    ["invalid creation time", [{ ...event, created_at: "invalid" }]],
    ["object actor", [{ ...event, actor_id: {} }]], ["missing actor", [{ ...event, actor_id: undefined }]],
  ])("keeps malformed audit %s unavailable while retaining versions", async (_label, data) => {
    const view = await render({ response: { events: { data, count: 1, error: null } } });
    expectBlocked(view); expect(eventRows(view).length).toBe(0); expect(revisionRows(view).length).toBe(1);
    expect(view.$(".empty-state").length).toBe(0);
  });
  it.each(["revisions", "restorable", "events"] as const)("distinguishes confirmed zero %s count", async (dependency) => {
    const view = await render({ response: { [dependency]: { data: dependency === "restorable" ? null : [], count: 0, error: null } } });
    if (dependency === "restorable") expect(view.$(".stat-card small").first().text()).toBe("0 доступны для восстановления");
    else { expect(metric(view, dependency === "revisions" ? 0 : 1)).toBe("0"); expect(view.$(".empty-state").length).toBe(1); }
    expect(retryLink(view).length).toBe(0);
  });
  it.each([null, undefined, "1", -1, 1.2, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])("keeps invalid count %s unknown and does not redirect", async (count) => {
    for (const dependency of ["revisions", "restorable", "events"] as const) {
      const view = await render({ response: { [dependency]: { ...defaults[dependency], count } } });
      expectBlocked(view);
      if (dependency === "restorable") expect(view.$(".stat-card small").first().text()).toBe("Недоступно доступны для восстановления");
      else expect(metric(view, dependency === "revisions" ? 0 : 1)).toBe("Недоступно");
      expect(revisionRows(view).length).toBe(1); expect(eventRows(view).length).toBe(1);
    }
  });
  it.each(["revisions", "restorable", "events"] as const)("does not trust %s count in an envelope without data", async (dependency) => {
    expectBlocked(await render({ response: { [dependency]: { count: 1, error: null } } }));
  });
  it("does not trust a count with a malformed response body", async () => {
    const view = await render({ response: { restorable: { data: {}, count: 1, error: null } } });
    expectBlocked(view); expect(view.$(".stat-card small").first().text()).toContain("Недоступно");
  });
  it.each(["article", "page", "homepage", "country", "writer", "work", "edition", "banner", "navigation"])("retains readable %s revisions", async (kind) => {
    const view = await render({ response: { revisions: { ...defaults.revisions, data: [{ ...revision, kind }] } } });
    expect(revisionRows(view).length).toBe(1); expect(view.$('input[name="revision_id"]').length).toBe(1);
  });
  it.each([null, "snapshot string", 3, true, ["snapshot array"]].map(snapshot => ({ snapshot })))("retains SQL JSONB snapshot $snapshot without advertising restore", async ({ snapshot }) => {
    const view = await render({ response: { revisions: { ...defaults.revisions, data: [{ ...revision, snapshot }] } } });
    expect(revisionRows(view).length).toBe(1); expect(view.$('input[name="revision_id"]').length).toBe(0);
    expect(retryLink(view).length).toBe(0);
  });
  it("retains deleted revisions with nullable identity/current version and audit system events", async () => {
    const view = await render({ response: {
      revisions: { ...defaults.revisions, data: [{ ...revision, entity_id: null, restorable: false, entity_updated_at: null, actor_id: null, revision_number: null }] },
      events: { ...defaults.events, data: [{ ...event, entity_id: null, actor_id: null }] },
    } });
    expect(revisionRows(view).length).toBe(1); expect(eventRows(view).length).toBe(1);
    expect(view.$('input[name="revision_id"]').length).toBe(0); expect(view.markup).toContain("Система");
  });
  it("retains original title/action text without normalization", async () => {
    const view = await render();
    expect(revisionRows(view).find("strong").text()).toBe(revision.snapshot.title);
    expect(eventRows(view).find("td").first().text()).toBe(event.action);
  });
  it("renders a compound JSONB label safely without coercing its stored toString field", async () => {
    const view = await render({ response: { revisions: { ...defaults.revisions, data: [{ ...revision, snapshot: { title: { toString: null }, metadata: { label: ["unchanged"] } } }] } } });
    expect(revisionRows(view).length).toBe(1);
    expect(revisionRows(view).find("strong").text()).toBe(revision.entity_id);
    expect(eventRows(view).length).toBe(1);
  });
  it("preserves positive bigint decimal IDs and the exact CAS version in restore forms", async () => {
    const view = await render({ response: {
      revisions: { ...defaults.revisions, data: [{ ...revision, revision_id: "9223372036854775807" }] },
      events: { ...defaults.events, data: [{ ...event, id: "9223372036854775807" }] },
    } });
    expect(view.$('input[name="revision_id"]').attr("value")).toBe("9223372036854775807");
    expect(view.$('input[name="expected_updated_at"]').attr("value")).toBe(stamp); expect(eventRows(view).length).toBe(1);
  });
  it("does not advertise restore for a parseable but action-incompatible CAS timestamp", async () => {
    const view = await render({ response: { revisions: { ...defaults.revisions, data: [{ ...revision, entity_updated_at: "2026\u002d09\u002d23" }] } } });
    expect(revisionRows(view).length).toBe(1); expect(view.$('input[name="revision_id"]').length).toBe(0);
  });
  it("preserves actual filtered ranges and restore context", async () => {
    const view = await render({ query: { kind: "work", entity: "book_50%", page: "2", events_page: "3" }, response: {
      revisions: { ...defaults.revisions, count: 80 }, events: { ...defaults.events, count: 180 },
    } });
    expect(view.ranges).toEqual([[40, 79], [120, 179]]);
    expect(view.filters).toContainEqual([0, "kind", "work"]);
    expect(view.filters).toContainEqual([0, "search_text", "%book\\_50\\%%"]);
    expect(view.filters).toContainEqual([2, "entity_id", "%book\\_50\\%%"]);
    expect(view.$('input[name="history_kind"]').attr("value")).toBe("work");
    expect(view.$('input[name="history_entity"]').attr("value")).toBe("book_50%");
    expect(view.$('input[name="history_page"]').attr("value")).toBe("2");
    expect(view.$('input[name="history_events_page"]').attr("value")).toBe("3");
  });
  it.each(["/admin", "/staff", "/"])("uses %s retry context without action receipt parameters", async (base) => {
    vi.stubEnv("ADMIN_BASE_PATH", base);
    const view = await render({ rejected: new Set(["events"]), query: { kind: "work", entity: "source:book", page: "2", events_page: "3", error: privateError, restored: "work", published: "started" }, response: { revisions: { ...defaults.revisions, count: 80 } } });
    expectBlocked(view);
    const url = new URL(retryLink(view).attr("href")!, "https://admin.invalid");
    expect(url.pathname).toBe((base === "/" ? "" : base) + "/history");
    expect(Object.fromEntries(url.searchParams)).toEqual({ kind: "work", entity: "source:book", page: "2", events_page: "3" });
  });
  it.each(["revisions", "events"] as const)("preserves unknown %s pagination instead of redirecting to page one", async (dependency) => {
    const view = await render({ query: { page: "2", events_page: "3" }, response: {
      revisions: { ...defaults.revisions, count: 80 }, events: { ...defaults.events, count: 180 },
      [dependency]: { ...defaults[dependency], count: null },
    } });
    expectBlocked(view);
    const pagination = view.$(`nav[aria-label="${dependency === "revisions" ? "Страницы версий" : "Страницы журнала операций"}"]`);
    expect(pagination.length).toBe(0);
  });
  it("clamps confirmed revision pagination without guessing unknown audit total", async () => {
    await expect(render({ query: { page: "3", events_page: "7", kind: "work", entity: "book" }, response: { events: { ...defaults.events, count: null } } })).rejects.toMatchObject({ destination: "/history?kind=work&entity=book&events_page=7" });
  });
  it("clamps confirmed audit pagination without guessing unknown revision total", async () => {
    await expect(render({ query: { page: "7", events_page: "3", kind: "work", entity: "book" }, response: { revisions: { ...defaults.revisions, count: null } } })).rejects.toMatchObject({ destination: "/history?kind=work&entity=book&page=7" });
  });
  it.each(["started", "queued", "queue-error", "unknown"])("does not turn restored/published=%s URL parameters into success evidence", async (published) => {
    const view = await render({ query: { error: privateError, restored: "article", published } });
    expect(view.markup).not.toContain(privateError);
    expect(view.$(".form-success").length).toBe(0);
    expect(view.markup).not.toContain("Версия восстановлена");
    expect(view.$('[role="status"]').text()).toContain("не подтверждён");
  });
  it("renders dependency state without provider requests when no client exists", async () => {
    const view = await render({ noClient: true });
    expect(view.from).not.toHaveBeenCalled(); expect(view.$('[role="alert"]').length).toBe(1);
  });
  it.each(["querySignal", "clientSignal"] as const)("preserves Next %s signals", async (field) => {
    const signal = new NextSignal("/login");
    await expect(render({ [field]: signal })).rejects.toBe(signal);
  });
});
