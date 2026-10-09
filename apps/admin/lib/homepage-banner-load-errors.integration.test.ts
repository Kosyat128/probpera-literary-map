import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
type ModuleExports = Record<string, unknown>;
type Route = "banners" | "homepage";
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const baseline = process.env.M02_VISUAL_BASELINE_ROOT;
  const source = baseline && /^app\/\(dashboard\)\/(banners|homepage)\/page\.tsx$/u.test(relative.replaceAll("\\", "/"))
    ? path.join(baseline, relative.includes("banners") ? "banners.tsx" : "homepage.tsx") : filename;
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
const id = "12345678\u002d1234\u002d4234\u002d9234\u002d123456789012";
const mediaId = "87654321\u002d1234\u002d4234\u002d9234\u002d123456789012";
const otherId = "11111111\u002d1234\u002d4234\u002d9234\u002d123456789012";
const banner = {
  id, name: "  Исходное имя  ", title: "  Исходный заголовок \u2014 точно  ", description: "Исходное описание",
  target_url: null, button_text: "", desktop_media_id: mediaId, tablet_media_id: null, mobile_media_id: null,
  starts_at: null, ends_at: null, display_order: 0, is_active: false, page_patterns: ["/", "/articles/*"], updated_at: stamp,
};
const block = {
  id, block_type: "text", title: banner.title, settings: { description: "  Исходное описание \u2014 точно  ", unknown: { preserve: true } },
  display_order: 0, is_enabled: true, background_style: "paper", background_media_id: mediaId, updated_at: stamp,
};
const asset = {
  id: mediaId, bucket: "editorial-media", object_path: "original/photo.png", alt_text: "Исходное описание изображения",
  original_name: "Исходное фото.png", collection_name: "Исходная коллекция", mime_type: "image/png", creator: "Автор",
  source_url: "https://example.org/source", license_name: "CC BY", license_url: "https://example.org/license",
};
type Dependency = "records" | "base" | "alt" | "name" | "refs";
type Query = { media_q?: string; error?: string; saved?: string; deleted?: string; published?: string };
class NextSignal extends Error { constructor(readonly destination: string) { super("Next navigation signal"); } }
async function render(route: Route, options: {
  response?: Partial<Record<Dependency, unknown>>; rejected?: Set<Dependency>; query?: Query;
  noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal;
  storageThrow?: boolean; storageResult?: unknown;
} = {}) {
  const defaults = {
    records: { data: [route === "banners" ? banner : block], error: null },
    base: { data: [], error: null }, alt: { data: [], error: null }, name: { data: [], error: null }, refs: { data: [asset], error: null },
  };
  const replies = { ...defaults, ...options.response };
  const rejected = options.rejected ?? new Set();
  const calls: [Dependency, string, unknown][] = [];
  const pageSource = readFileSync(path.join(adminRoot, `app/(dashboard)/${route}/page.tsx`), "utf8");
  const from = vi.fn((table: string) => {
    let dependency: Dependency = table === "media_assets" ? "base" : "records";
    expect(["media_assets", route === "banners" ? "banners" : "homepage_blocks"]).toContain(table);
    const builder = {
      select: () => builder, order: () => builder, is: () => builder, limit: () => builder,
      in: (key: string, value: unknown) => { dependency = "refs"; calls.push([dependency, key, value]); return builder; },
      ilike: (key: string, value: unknown) => { dependency = key === "alt_text" ? "alt" : "name"; calls.push([dependency, key, value]); return builder; },
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => { if (rejected.has(dependency)) throw new TypeError(privateError); return replies[dependency]; }).then(fulfilled, denied),
    };
    return builder;
  });
  const getPublicUrl = vi.fn(() => {
    if (options.storageThrow) throw new TypeError(privateError);
    return Object.hasOwn(options, "storageResult") ? options.storageResult : { data: { publicUrl: "https://example.org/storage/photo.png" } };
  });
  const rpc = vi.fn();
  const actionNames = ["saveBannerAction", "deleteBannerAction", "createHomepageBlockAction", "deleteHomepageBlockAction", "moveHomepageBlockAction", "republishHomepageAction", "saveCoreHomepageSectionAction", "toggleHomepageBlockAction", "updateHomepageBlockAction"];
  const actionMocks = Object.fromEntries(actionNames.map((name) => [name, vi.fn()]));
  const preview = vi.fn(() => createElement("div", { "data-preview-boundary": "true" }));
  const mocks = {
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { if (options.clientSignal) throw options.clientSignal; return options.noClient ? null : { from, rpc, storage: { from: () => ({ getPublicUrl }) } }; } },
    "./actions": actionMocks,
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://example.org" } },
    "../../../../../src/data/articles/catalog": { articleCatalog: [] },
    "@/components/HomepageVisualPreview": { __esModule: true, default: preview },
    "@/components/HeaderShowcaseEditor": { __esModule: true, default: () => createElement("div", { "data-header-boundary": "true" }) },
    "@/components/HomepageMediaField": { __esModule: true, default: ({ value, media }: { value?: string; media: { id: string; label: string }[] }) =>
      createElement("select", { name: "background_media_id", defaultValue: value ?? "" }, [
        createElement("option", { key: "empty", value: "" }, "Нет изображения"),
        ...media.map((item) => createElement("option", { key: item.id, value: item.id }, item.label)),
      ]) },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule(`app/(dashboard)/${route}/page.tsx`, mocks).default as (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {});
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), calls, from, getPublicUrl, preview, pageSource };
  } finally {
    expect(rpc).not.toHaveBeenCalled(); Object.values(actionMocks).forEach((action) => expect(action).not.toHaveBeenCalled());
    if (options.querySignal || options.clientSignal) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function retryLinks(view: Rendered) { return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку"); }
function expectClosed(view: Rendered) {
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(view.markup).not.toContain(privateError);
  expect(view.$('form:not([method="get"])').length).toBe(0);
  expect(view.$('form[method="get"]').length).toBe(1);
  expect(view.$('[data-preview-boundary="true"]').length).toBe(0);
  expect(retryLinks(view).length).toBeGreaterThan(0);
  expect(retryLinks(view).attr("data-next-link")).toBeUndefined();
}
afterEach(() => vi.unstubAllEnvs());

describe.each(["banners", "homepage"] as const)("M02 %s actual SSR media/settings boundary", (route) => {
  it.each(["records", "base", "alt", "name", "refs"] as const)("blocks incomplete %s provider dependency", async (dependency) => {
    const view = await render(route, { query: { media_q: "photo" }, response: { [dependency]: { data: [], error: { code: "42501", message: privateError } } } });
    expectClosed(view);
    if (dependency !== "records") expect(view.$(route === "banners" ? ".banner-admin-card" : '[id^="block-"]').text()).toContain(banner.title);
  });
  it.each(["records", "base", "alt", "name", "refs"] as const)("settles rejected %s dependency", async (dependency) => {
    expectClosed(await render(route, { query: { media_q: "photo" }, rejected: new Set([dependency]) }));
  });
  it.each(["records", "base", "alt", "name", "refs"] as const)("rejects success looking %s plus error", async (dependency) => {
    expectClosed(await render(route, { query: { media_q: "photo" }, response: { [dependency]: { data: dependency === "records" ? [route === "banners" ? banner : block] : [asset], error: { message: privateError } } } }));
  });
  it.each(["records", "base", "refs"] as const)("keeps absent %s response unknown", async (dependency) => {
    expectClosed(await render(route, { response: { [dependency]: undefined } }));
  });
  it.each(["null list", "object list", "null row", "object ID", "object title", "invalid timestamp", "duplicate IDs"])("blocks %s primary DTO", async (label) => {
    const item = route === "banners" ? banner : block;
    const data = label === "null list" ? null : label === "object list" ? {} : label === "null row" ? [null]
      : label === "object ID" ? [{ ...item, id: {} }] : label === "object title" ? [{ ...item, title: {} }]
      : label === "invalid timestamp" ? [{ ...item, updated_at: "invalid" }] : [item, item];
    const view = await render(route, { response: { records: { data, error: null } } });
    expectClosed(view);
    expect(view.markup).not.toContain("Управляемых блоков пока нет");
  });
  it.each([
    ["null", null], ["object", {}], ["null row", [null]], ["array row", [[]]],
    ["object ID", [{ ...asset, id: {} }]], ["object bucket", [{ ...asset, bucket: {} }]],
    ["object path", [{ ...asset, object_path: {} }]], ["object alt", [{ ...asset, alt_text: {} }]],
    ["long alt", [{ ...asset, alt_text: "a".repeat(501) }]], ["duplicate IDs", [asset, asset]],
  ])("blocks %s media DTO before storage producer", async (_label, data) => {
    const view = await render(route, { response: { refs: { data, error: null } } });
    expectClosed(view);
    expect(view.getPublicUrl).not.toHaveBeenCalled();
  });
  it("blocks missing referenced media even if base query has the asset", async () => {
    const view = await render(route, { response: { base: { data: [asset], error: null }, refs: { data: [], error: null } } });
    expectClosed(view);
  });
  it("blocks unrelated rows returned for referenced media request", async () => {
    expectClosed(await render(route, { response: { refs: { data: [{ ...asset, id: otherId }], error: null } } }));
  });
  it("blocks conflicting duplicate media across independent queries", async () => {
    expectClosed(await render(route, { response: { base: { data: [{ ...asset, alt_text: "Другой ответ" }], error: null } } }));
  });
  it("preserves referenced image outside recent/search limits", async () => {
    const view = await render(route, { query: { media_q: "unmatched" } });
    expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.calls).toContainEqual(["refs", "id", [mediaId]]);
    expect(view.$(`option[value="${mediaId}"][selected]`).length).toBeGreaterThan(0);
    expect(view.$('input[name="expected_updated_at"]').map((_index, node) => view.$(node).attr("value")).get()).toContain(stamp);
  });
  it("genuine empty primary/media lists enable create without inventing records", async () => {
    const view = await render(route, { response: { records: { data: [], error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.$('form:not([method="get"])').length).toBeGreaterThan(0);
    expect(view.calls.some((call) => call[0] === "refs")).toBe(false);
  });
  it.each([null, {}, { data: {} }, { data: { publicUrl: {} } }, { data: { publicUrl: "javascript:alert(1)" } }])("blocks malformed public URL response %j", async (storageResult) => {
    expectClosed(await render(route, { storageResult }));
  });
  it("settles storage URL producer throw without raw errors", async () => { expectClosed(await render(route, { storageThrow: true })); });
  it.each(["42P01", "42501", "PGRST116", "57014"])("classifies %s without raw errors", async (code) => {
    const view = await render(route, { response: { records: { data: [], error: { code, message: privateError } } } });
    expectClosed(view);
    if (code === "42P01") expect(view.markup).toContain("Структура редакционной базы");
    if (code === "42501") expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it("GET retry keeps media query/base and removes forged notices", async () => {
    vi.stubEnv("ADMIN_BASE_PATH", "/editorial");
    const view = await render(route, { rejected: new Set(["base"]), query: { media_q: " old_% ", saved: "yes", error: privateError } });
    expectClosed(view);
    const url = new URL(retryLinks(view).first().attr("href")!, "https://example.org");
    expect(url.pathname).toBe(`/editorial/${route}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ media_q: "old_%" });
    expect(view.calls).toContainEqual(["alt", "alt_text", "%old\\_\\%%"]);
  });
  it.each([{ error: privateError }, { saved: "1" }, { deleted: "1" }, { published: "started" }, { published: "queued" }, { published: "queue-error" }])("URL flags %j are not receipts", async (query) => {
    const view = await render(route, { query });
    expect(view.markup).not.toContain(privateError);
    expect(view.$('[role="status"]').text()).toContain("не подтверждён");
    expect(view.$(".form-success").length).toBe(0);
  });
  it("keeps SQL legacy identities readable with the route's actual action compatibility", async () => {
    const item = { ...(route === "banners" ? banner : block), id: "12345678\u002d1234\u002d9234\u002d0234\u002d123456789012" };
    const view = await render(route, { response: { records: { data: [item], error: null } } });
    if (route === "banners") expectClosed(view);
    else expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.$(route === "banners" ? ".banner-admin-card" : '[id^="block-"]').text()).toContain(banner.title);
  });
  it("missing Supabase renders dependency state without reads or forms", async () => {
    const view = await render(route, { noClient: true });
    expect(view.from).not.toHaveBeenCalled(); expect(view.$("form").length).toBe(0);
  });
  it("preserves Next search parameter signals", async () => {
    const signal = new NextSignal("/login"); await expect(render(route, { querySignal: signal })).rejects.toBe(signal);
  });
  it("preserves Next client/auth signals", async () => {
    const signal = new NextSignal("/login"); await expect(render(route, { clientSignal: signal })).rejects.toBe(signal);
  });
});
describe("M02 exact settings and banner SQL contract", () => {
  it.each([null, 0, "stored scalar", [1, "kept", null], { description: block.settings.description, unknown: { keep: [1, true] } }])("reads legal arbitrary JSONB settings %j without modifying producer data", async (settings) => {
    const row = { ...block, settings };
    const before = JSON.stringify(row);
    const view = await render("homepage", { response: { records: { data: [row], error: null } } });
    if (settings !== null && typeof settings === "object" && !Array.isArray(settings)) expect(view.$('[role="alert"]').length).toBe(0);
    else expectClosed(view);
    expect(view.$('[id^="block-"] h2').text()).toBe(block.title);
    expect(JSON.stringify(row)).toBe(before);
  });
  it.each([
    { display_order: 1.5 }, { display_order: 2147483648 }, { settings: undefined },
    { block_type: "unknown" }, { background_style: {} }, { is_enabled: null }, { background_media_id: {} },
  ])("blocks malformed homepage projection %j", async (patch) => {
    expectClosed(await render("homepage", { response: { records: { data: [{ ...block, ...patch }], error: null } } }));
  });
  it.each([
    { name: {} }, { name: "a" }, { name: "a".repeat(161) }, { description: {} }, { target_url: {} },
    { button_text: {} }, { is_active: null }, { display_order: 2147483648 }, { desktop_media_id: {} },
    { page_patterns: {} }, { page_patterns: [null] }, { starts_at: "invalid" }, { starts_at: stamp, ends_at: stamp },
  ])("blocks malformed banner projection %j", async (patch) => {
    expectClosed(await render("banners", { response: { records: { data: [{ ...banner, ...patch }], error: null } } }));
  });
  it("keeps unapproved book archive reference closed instead of silently clearing selected background", async () => {
    expectClosed(await render("homepage", { response: {
      records: { data: [{ ...block, settings: { coreSectionKey: "book-archive" } }], error: null },
      refs: { data: [{ ...asset, license_name: "", creator: "" }], error: null },
    } }));
  });
  it("blocks duplicate core-section identities without hiding verified custom text", async () => {
    const duplicate = { ...block, settings: { coreSectionKey: "hero" } };
    expectClosed(await render("homepage", { response: { records: { data: [duplicate, { ...duplicate, id: otherId }], error: null } } }));
  });
  it("matches homepage old v1 to v5 media-ID producer rather than silently nulling v7 backgrounds", async () => {
    const legacyId = "87654321\u002d1234\u002d7234\u002d9234\u002d123456789012";
    expectClosed(await render("homepage", { response: { records: { data: [{ ...block, background_media_id: legacyId }], error: null }, refs: { data: [{ ...asset, id: legacyId }], error: null } } }));
  });
  it("allows SQL v7 block identity because its action reads the original UUID text", async () => {
    const legacyId = "12345678\u002d1234\u002d7234\u002d9234\u002d123456789012";
    const view = await render("homepage", { response: { records: { data: [{ ...block, id: legacyId }], error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.$(`input[name="id"][value="${legacyId}"]`).length).toBeGreaterThan(0);
  });
  it.each([
    { description: {} }, { eyebrow: ["stored"] }, { buttonText: 0 }, { buttonUrl: null },
    { articleIds: ["stored", null] }, { imageZoom: "invalid" }, { imageZoom: -1 },
    { coreSectionKey: "book-archive", bookSceneDynamicThemes: "invalid" }, { coreSectionKey: "featured-journal", headerShowcasePins: {} }, { coreSectionKey: {} },
  ])("keeps incompatible consumed settings %j readable without empty overwrite forms", async (settings) => {
    const row = { ...block, settings }; const before = JSON.stringify(row);
    const view = await render("homepage", { response: { records: { data: [row], error: null } } });
    expectClosed(view); expect(view.markup).toContain(block.title); expect(JSON.stringify(row)).toBe(before);
  });
  it.each([
    { imageZoom: "100", titleWeight: "700" },
    { coreSectionKey: "book-archive", bookSceneDynamicThemes: "true", bookSceneDarkness: "42" },
    { coreSectionKey: "featured-journal", headerShowcasePins: [{ articleId: "stored", order: 5, startsAt: "2026\u002d09\u002d01T00:00:00Z", endsAt: "2026\u002d10\u002d01T00:00:00Z", timezone: "UTC" }] },
  ])("accepts supported producer settings %j without mutating their stored representation", async (settings) => {
    const row = { ...block, settings }; const before = JSON.stringify(row);
    const view = await render("homepage", { response: { records: { data: [row], error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0); expect(view.$('form:not([method="get"])').length).toBeGreaterThan(0);
    expect(JSON.stringify(row)).toBe(before);
  });
});
