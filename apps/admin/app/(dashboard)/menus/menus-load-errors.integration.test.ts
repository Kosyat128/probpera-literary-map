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
    fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
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
const menuId = "a0000000\u002d0000\u002d4000\u002d8000\u002d000000000001";
const secondMenuId = "a0000000\u002d0000\u002d4000\u002d8000\u002d000000000002";
const itemId = "b0000000\u002d0000\u002d4000\u002d8000\u002d000000000001";
const secondId = "b0000000\u002d0000\u002d4000\u002d8000\u002d000000000002";
const thirdId = "b0000000\u002d0000\u002d4000\u002d8000\u002d000000000003";
const menu = { id: menuId, name: "  Original menu \u2014 exact  ", location: "header" };
const item = { id: itemId, menu_id: menuId, parent_id: null, label: "  Original item \u2014 exact  ", href: "/original?x=1", open_in_new_tab: false, is_visible: true, display_order: 1, updated_at: stamp };
const defaults = { menus: { data: [menu], error: null }, items: { data: [item], error: null } };
type Dependency = keyof typeof defaults;
type Query = { location?: string; error?: string; saved?: string; deleted?: string; published?: string };
class NextSignal extends Error { constructor(readonly destination: string) { super("Next navigation signal"); } }
async function render(options: { response?: Partial<Record<Dependency, unknown>>; rejected?: Set<Dependency>; query?: Query; noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal } = {}) {
  let index = 0;
  const replies = { ...defaults, ...options.response };
  const from = vi.fn((table: string) => {
    const dependency = (["menus", "items"] as const)[index++];
    expect(table).toBe(dependency === "menus" ? "navigation_menus" : "navigation_items");
    const builder = { select: () => builder, order: () => builder,
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        if (options.rejected?.has(dependency)) throw new TypeError(privateError);
        return replies[dependency];
      }).then(fulfilled, denied),
    };
    return builder;
  });
  const save = vi.fn(); const remove = vi.fn(); const rpc = vi.fn();
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { if (options.clientSignal) throw options.clientSignal; return options.noClient ? null : { from, rpc }; } },
    "./actions": { saveNavigationItemAction: save, deleteNavigationItemAction: remove },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (destination: string): never => { throw new NextSignal(destination); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule("app/(dashboard)/menus/page.tsx", mocks).default as (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const markup = renderToStaticMarkup(await page({ searchParams: options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {}) }));
    return { markup, $: load(markup), from };
  } finally {
    expect(save).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function retryLink(view: Rendered) { return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку"); }
function expectBlocked(view: Rendered) {
  expect(view.$("form").length).toBe(0); expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(retryLink(view).length).toBe(1); expect(retryLink(view).attr("data-next-link")).toBeUndefined();
  expect(view.markup).not.toContain(privateError); expect(view.$('nav[aria-label="Фильтр расположения меню"]').length).toBe(1);
}
afterEach(() => vi.unstubAllEnvs());
describe("M02 menus real SSR read boundaries", () => {
  it.each(["menus", "items"] as const)("isolates %s provider errors and keeps independent data", async (dependency) => {
    const view = await render({ response: { [dependency]: { data: [], error: { code: "57014", message: privateError } } } });
    expectBlocked(view); expect(view.markup).toContain(dependency === "menus" ? item.label : menu.name);
    if (dependency === "items") expect(view.$(".menu-admin-heading strong").text()).toBe("Недоступно");
    expect(view.$(".empty-state").length).toBe(0);
  });
  it.each(["menus", "items"] as const)("isolates %s rejection", async (dependency) => { expectBlocked(await render({ rejected: new Set([dependency]) })); });
  it.each(["menus", "items"] as const)("does not trust %s data with an error", async (dependency) => { expectBlocked(await render({ response: { [dependency]: { ...defaults[dependency], error: { code: "42501", message: privateError } } } })); });
  it.each(["menus", "items"] as const)("does not trust null %s envelope", async (dependency) => { expectBlocked(await render({ response: { [dependency]: null } })); });
  it.each(["menus", "items"] as const)("does not trust missing %s envelope", async (dependency) => { expectBlocked(await render({ response: { [dependency]: undefined } })); });
  it.each(["42P01", "42501", "PGRST116", "57014"])("uses safe classified %s copy", async (code) => {
    const view = await render({ response: { menus: { data: [], error: { code, message: privateError } } } }); expectBlocked(view);
    if (code === "42P01") expect(view.markup).toContain("Структура редакционной базы");
    if (code === "42501") expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it.each([
    ["null", null], ["object", {}], ["null row", [null]], ["array row", [[]]],
    ["invalid ID", [{ ...menu, id: "invalid" }]], ["object name", [{ ...menu, name: {} }]],
    ["missing name", [{ ...menu, name: undefined }]], ["unknown location", [{ ...menu, location: "side" }]],
    ["missing location", [{ ...menu, location: undefined }]], ["duplicate ID", [menu, { ...menu, location: "footer", name: "second" }]],
    ["duplicate location", [menu, { ...menu, id: secondMenuId, name: "second" }]],
  ])("closes forms for malformed menus %s", async (_label, data) => { const view = await render({ response: { menus: { data, error: null } } }); expectBlocked(view); expect(view.markup).toContain(item.label); });
  it.each([
    ["null", null], ["object", {}], ["null row", [null]], ["array row", [[]]],
    ["invalid ID", [{ ...item, id: "invalid" }]], ["invalid menu ID", [{ ...item, menu_id: "invalid" }]],
    ["invalid parent ID", [{ ...item, parent_id: "invalid" }]], ["missing parent ID", [{ ...item, parent_id: undefined }]],
    ["object label", [{ ...item, label: {} }]], ["empty label", [{ ...item, label: "" }]], ["long label", [{ ...item, label: "a".repeat(101) }]],
    ["object href", [{ ...item, href: {} }]], ["missing href", [{ ...item, href: undefined }]],
    ["string visibility", [{ ...item, is_visible: "true" }]], ["string tab flag", [{ ...item, open_in_new_tab: "true" }]],
    ["fractional order", [{ ...item, display_order: 1.2 }]], ["int overflow", [{ ...item, display_order: 2147483648 }]],
    ["missing order", [{ ...item, display_order: undefined }]], ["invalid current version", [{ ...item, updated_at: "invalid" }]],
    ["duplicate ID", [item, item]],
  ])("closes forms for malformed items %s", async (_label, data) => { const view = await render({ response: { items: { data, error: null } } }); expectBlocked(view); expect(view.markup).toContain(menu.name); expect(view.$(".menu-admin-heading strong").text()).toBe("Недоступно"); });
  it("keeps confirmed empty menus/items distinct from failures", async () => {
    const view = await render({ response: { menus: { data: [], error: null }, items: { data: [], error: null } } });
    expect(view.$(".empty-state").length).toBe(1); expect(retryLink(view).length).toBe(0); expect(view.$("form").length).toBe(0);
  });
  it("permits adding to a confirmed empty menu and shows a true zero", async () => {
    const view = await render({ response: { items: { data: [], error: null } } });
    expect(view.$(".menu-admin-heading strong").text()).toBe("0"); expect(view.$("form").length).toBe(1); expect(retryLink(view).length).toBe(0);
  });
  it.each(["missing menu", "missing parent"])("keeps readable rows but closes an incomplete relation: %s", async (kind) => {
    const changed = kind === "missing menu" ? { ...item, menu_id: secondMenuId } : { ...item, parent_id: secondId };
    const view = await render({ response: { items: { data: [changed], error: null } } });
    expectBlocked(view); expect(view.markup).toContain(item.label);
  });
  it("preserves deep and cross-menu parents in existing editor selects", async () => {
    const cross = { ...item, id: thirdId, menu_id: secondMenuId, label: "Cross parent", parent_id: secondId };
    const view = await render({ response: {
      menus: { data: [menu, { id: secondMenuId, location: "footer", name: "Footer" }], error: null },
      items: { data: [{ ...item, parent_id: thirdId }, { ...item, id: secondId, label: "Root" }, cross], error: null },
    } });
    const selector = view.$(`#navigation-item-${itemId} select[name="parent_id"]`);
    expect(selector.find("option[selected]").attr("value")).toBe(thirdId); expect(selector.find("option[selected]").text()).toBe("Cross parent");
    expect(retryLink(view).length).toBe(0);
  });
  it("preserves two-node cycle data without introducing a hierarchy restriction", async () => {
    const view = await render({ response: { items: { data: [{ ...item, parent_id: secondId }, { ...item, id: secondId, parent_id: itemId }], error: null } } });
    expect(view.$(`#navigation-item-${itemId} option[selected]`).attr("value")).toBe(secondId);
    expect(view.$(`#navigation-item-${secondId} option[selected]`).attr("value")).toBe(itemId); expect(retryLink(view).length).toBe(0);
  });
  it("compares SQL UUIDs without changing stored form values or current selection", async () => {
    const view = await render({ response: { items: { data: [{ ...item, menu_id: menuId.toUpperCase(), parent_id: secondId.toUpperCase() }, { ...item, id: secondId }], error: null } } });
    expect(view.$(`#navigation-item-${itemId} option[selected]`).attr("value")).toBe(secondId.toUpperCase());
    expect(view.$(`#navigation-item-${itemId} input[name="id"]`).first().attr("value")).toBe(itemId); expect(retryLink(view).length).toBe(0);
  });
  it("retains SQL UUIDs outside the unchanged action contract as read-only data", async () => {
    const legacyMenuId = "a0000000\u002d0000\u002d0000\u002d0000\u002d000000000001";
    const view = await render({ response: { menus: { data: [{ ...menu, id: legacyMenuId }], error: null }, items: { data: [{ ...item, menu_id: legacyMenuId }], error: null } } });
    expect(view.markup).toContain(menu.name); expect(view.markup).toContain(item.label); expect(view.$("form").length).toBe(0);
  });
  it("retains SQL text/int bounds and exact displayed/editor values", async () => {
    const view = await render({ response: { items: { data: [{ ...item, label: "😀".repeat(100), display_order: -2147483648, href: "" }], error: null } } });
    expect(view.$(".navigation-item-list article header strong").text()).toBe("😀".repeat(100));
    expect(view.$('input[name="display_order"]').first().attr("value")).toBe("-2147483648");
    expect(view.$('input[name="expected_updated_at"]').first().attr("value")).toBe(stamp);
    expect(retryLink(view).length).toBe(0);
  });
  it("preserves untouched editorial text in headings and fields", async () => {
    const view = await render(); expect(view.$("h2").text()).toBe(menu.name);
    expect(view.$('input[name="label"]').first().attr("value")).toBe(item.label); expect(view.$('input[name="href"]').first().attr("value")).toBe(item.href);
  });
  it.each(["/admin", "/staff", "/"])("preserves requested location in %s retry", async (base) => {
    vi.stubEnv("ADMIN_BASE_PATH", base); const view = await render({ rejected: new Set(["items"]), query: { location: "footer", error: privateError, saved: "1", published: "started" } });
    expectBlocked(view); expect(retryLink(view).attr("href")).toBe((base === "/" ? "" : base) + "/menus?location=footer");
  });
  it("applies requested location without mixing the menu contexts", async () => {
    const view = await render({ query: { location: "footer" }, response: { menus: { data: [menu, { id: secondMenuId, location: "footer", name: "Footer" }], error: null }, items: { data: [item, { ...item, id: secondId, menu_id: secondMenuId }], error: null } } });
    expect(view.$("h2").text()).toBe("Footer"); expect(view.$('input[name="context_location"]').first().attr("value")).toBe("footer");
  });
  it.each(["started", "queued", "queue-error", "unknown"])("keeps query receipts %s unconfirmed", async (published) => {
    const view = await render({ query: { error: privateError, saved: "1", deleted: "1", published } });
    expect(view.markup).not.toContain(privateError); expect(view.$(".form-success").length).toBe(0); expect(view.$('[role="status"]').text()).toContain("не подтверждён");
  });
  it("renders dependency state without queries when client is absent", async () => { const view = await render({ noClient: true }); expect(view.from).not.toHaveBeenCalled(); expect(view.$('[role="alert"]').length).toBe(1); });
  it.each(["querySignal", "clientSignal"] as const)("preserves Next %s signals", async (field) => { const signal = new NextSignal("/login"); await expect(render({ [field]: signal })).rejects.toBe(signal); });
});
