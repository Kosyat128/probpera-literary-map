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
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
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
const block = { id: "a0000000\u002d0000\u002d4000\u002d8000\u002d000000000001", settings: { systemKey: "site-copy-overrides", siteCopy: { ru: { "interface.Search": "Original Russian override" }, en: { "interface.Search": "Original English override" } } }, updated_at: stamp };
const definition = { key: "interface.Search", group: "Core fields", label: "Original label", defaultRu: "Search", defaultEn: "Search English" };
const definitions = [definition];
type Query = { errorCode?: string; saved?: string; published?: string };
class NextSignal extends Error { constructor(readonly destination: string) { super("Next navigation signal"); } }
async function render(options: { response?: unknown; catalog?: unknown; rejected?: boolean; catalogRejected?: boolean; query?: Query; noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal } = {}) {
  const from = vi.fn((table: string) => {
    expect(table).toBe("homepage_blocks");
    const builder = { select: () => builder, order: () => builder, contains: vi.fn((_column: string, _value: unknown) => builder), limit: vi.fn((_limit: number) => builder),
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        if (options.rejected) throw new TypeError(privateError);
        return Object.hasOwn(options, "response") ? options.response : { data: [block], error: null };
      }).then(fulfilled, denied),
    };
    return builder;
  });
  const catalog = vi.fn(async () => { if (options.catalogRejected) throw new Error(privateError); return Object.hasOwn(options, "catalog") ? options.catalog : definitions; });
  const action = vi.fn(); const rpc = vi.fn();
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { if (options.clientSignal) throw options.clientSignal; return options.noClient ? null : { from, rpc }; } },
    "@/lib/site-copy-catalog": { loadAllSiteCopyCatalog: catalog },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://public.invalid" } },
    "@/app/(dashboard)/site-copy/actions": { saveSiteCopyAction: action },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (destination: string): never => { throw new NextSignal(destination); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule("app/(dashboard)/site-copy/page.tsx", mocks).default as (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const markup = renderToStaticMarkup(await page({ searchParams: options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {}) }));
    return { markup, $: load(markup), from, catalog };
  } finally {
    expect(action).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function retryLink(view: Rendered) { return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку"); }
function expectBlocked(view: Rendered) {
  expect(view.$("form.site-copy-editor").length).toBe(0); expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(retryLink(view).length).toBe(1); expect(retryLink(view).attr("data-next-link")).toBeUndefined();
  expect(view.markup).not.toContain(privateError);
}
afterEach(() => vi.unstubAllEnvs());
describe("M02 site-copy actual page and editor SSR read boundaries", () => {
  it.each(["42P01", "42501", "PGRST116", "57014"])("closes the editor on %s storage error", async (code) => {
    const view = await render({ response: { data: [block], error: { code, message: privateError } } }); expectBlocked(view);
    if (code === "42P01") expect(view.markup).toContain("Структура редакционной базы");
    if (code === "42501") expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it("closes the editor on storage rejection", async () => { expectBlocked(await render({ rejected: true })); });
  it("closes the editor on catalog rejection while settling storage", async () => { const view = await render({ catalogRejected: true }); expectBlocked(view); expect(view.from).toHaveBeenCalledTimes(1); });
  it.each([null, undefined, {}, { error: null }])("closes the editor on malformed storage envelope %j", async (response) => { expectBlocked(await render({ response })); });
  it.each([
    ["null data", null], ["object data", {}], ["null row", [null]], ["array row", [[]]],
    ["invalid ID", [{ ...block, id: "invalid" }]], ["missing ID", [{ ...block, id: undefined }]],
    ["null settings", [{ ...block, settings: null }]], ["array settings", [{ ...block, settings: [] }]],
    ["wrong system key", [{ ...block, settings: { ...block.settings, systemKey: "unrelated" } }]],
    ["missing system key", [{ ...block, settings: { siteCopy: block.settings.siteCopy } }]],
    ["invalid current version", [{ ...block, updated_at: "invalid" }]], ["missing current version", [{ ...block, updated_at: undefined }]],
    ["array copy", [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy: [] } }]],
    ["string copy", [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy: "wrong" } }]],
    ["array Russian map", [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy: { ru: [] } } }]],
    ["string English map", [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy: { en: "wrong" } } }]],
    ["object Russian value", [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy: { ru: { "interface.Search": {} } } } }]],
    ["numeric English value", [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy: { en: { "interface.Search": 1 } } } }]],
    ["array premium metadata", [{ ...block, settings: { ...block.settings, premiumTranslation: [] } }]],
    ["array machine map", [{ ...block, settings: { ...block.settings, premiumTranslation: { siteCopyEn: [] } } }]],
    ["scalar machine entry", [{ ...block, settings: { ...block.settings, premiumTranslation: { siteCopyEn: { "interface.Search": "wrong" } } } }]],
    ["more than one limited row", [block, block]],
  ])("does not expose editable defaults for malformed storage %s", async (_label, data) => { expectBlocked(await render({ response: { data, error: null } })); });
  it.each([
    ["null", null], ["object", {}], ["empty", []], ["null row", [null]], ["array row", [[]]],
    ["object key", [{ ...definition, key: {} }]], ["empty key", [{ ...definition, key: "" }]],
    ["object group", [{ ...definition, group: {} }]], ["missing group", [{ ...definition, group: undefined }]],
    ["object label", [{ ...definition, label: {} }]], ["missing label", [{ ...definition, label: undefined }]],
    ["object default", [{ ...definition, defaultRu: {} }]], ["missing default", [{ ...definition, defaultRu: undefined }]],
    ["object English default", [{ ...definition, defaultEn: {} }]], ["string multiline flag", [{ ...definition, multiline: "true" }]],
    ["duplicate keys", [definition, definition]],
  ])("does not expose the editor for invalid required catalog %s", async (_label, catalog) => { const view = await render({ catalog }); expectBlocked(view); expect(view.from).toHaveBeenCalledTimes(1); });
  it("keeps a confirmed missing system record editable for first-time creation", async () => {
    const view = await render({ response: { data: [], error: null } });
    expect(view.$("form.site-copy-editor").length).toBe(1); expect(view.$('input[name="expected_updated_at"]').attr("value")).toBe(""); expect(retryLink(view).length).toBe(0);
  });
  it.each([undefined, null, {}, { ru: null, en: null }, { ru: {} }, { en: {} }])("preserves supported empty/legacy copy %j", async (siteCopy) => {
    const view = await render({ response: { data: [{ ...block, settings: { systemKey: "site-copy-overrides", siteCopy } }], error: null } });
    expect(view.$("form.site-copy-editor").length).toBe(1); expect(retryLink(view).length).toBe(0);
  });
  it("preserves empty English, stored overrides and extra JSON metadata without a new normalizer", async () => {
    const view = await render({ response: { data: [{ ...block, settings: { ...block.settings, custom: [null, 1], siteCopy: { ru: { "interface.Search": "Original Russian override", "interface.Additional": "Original extra" }, en: { "interface.Search": "" } }, premiumTranslation: { siteCopyEn: { "interface.Search": { sourceHash: "fixture", model: "model", custom: [null] } }, custom: null } } }], error: null } });
    expect(view.$("form.site-copy-editor").length).toBe(1); expect(view.$(".site-copy-card").length).toBe(2);
    expect(view.$('input[value="Original Russian override"]').length).toBe(1); expect(view.$('input[value="Original extra"]').length).toBe(1);
    expect(view.$('input[name="expected_updated_at"]').attr("value")).toBe(stamp); expect(retryLink(view).length).toBe(0);
  });
  it("keeps independent Russian and English stored values on the real editor", async () => {
    const view = await render(); expect(view.$('input[value="Original Russian override"]').length).toBe(1);
    expect(view.$('input[value="Original English override"]').length).toBe(1); expect(view.$("h2").text()).toBe(definition.label);
  });
  it.each(["/admin", "/staff", "/"])("uses a clean %s retry without query receipts", async (base) => {
    vi.stubEnv("ADMIN_BASE_PATH", base); const view = await render({ rejected: true, query: { saved: "1", published: "started", errorCode: privateError } });
    expectBlocked(view); expect(retryLink(view).attr("href")).toBe((base === "/" ? "" : base) + "/site-copy");
  });
  it.each(["started", "queued", "queue-error", "unknown"])("does not turn saved/published=%s URL into a receipt", async (published) => {
    const view = await render({ query: { saved: "1", published, errorCode: privateError } });
    expect(view.markup).not.toContain(privateError); expect(view.$(".form-success").length).toBe(0); expect(view.$('[role="status"]').text()).toContain("не подтверждён");
  });
  it("does not need a catalog/provider read when no database client exists", async () => { const view = await render({ noClient: true }); expect(view.from).not.toHaveBeenCalled(); expect(view.$("form.site-copy-editor").length).toBe(0); });
  it.each(["querySignal", "clientSignal"] as const)("preserves Next %s signals", async (field) => { const signal = new NextSignal("/login"); await expect(render({ [field]: signal })).rejects.toBe(signal); });
});
