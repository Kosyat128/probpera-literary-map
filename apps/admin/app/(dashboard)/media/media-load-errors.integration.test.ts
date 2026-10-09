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
  const override = relative === "app/(dashboard)/media/page.tsx" ? process.env.M02_MEDIA_SOURCE : undefined;
  const compiled = ts.transpileModule(readFileSync(override || filename, "utf8"), {
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

const privateError = "PRIVATE_MEDIA_PROVIDER_SECRET=never_render";
const oldId = "12345678\u002d1234\u002d4123\u002d8123\u002d123456789abc";
const newId = "22345678\u002d1234\u002d4123\u002d8123\u002d123456789abc";
const otherId = "32345678\u002d1234\u002d4123\u002d8123\u002d123456789abc";
const stamp = "2026\u002d09\u002d23T12:00:00.000Z";
const asset = {
  id: oldId, bucket: "editorial\u002dmedia", object_path: "images/original.webp",
  original_name: "  Original image \u2014 exact.webp  ", mime_type: "image/webp", byte_size: 1024,
  width: 200, height: 300, alt_text: "  Author supplied \u2014 original  ",
  caption: "  Stored caption \u2013 exact  ", creator: "  Original creator  ",
  source_url: null, license_name: "", license_url: null, focus_x: 0.5, focus_y: 0.5,
  collection_name: "Collection", created_at: stamp, updated_at: stamp, deleted_at: null,
  rights_status: "unknown", sha256_hex: "a".repeat(64),
  replacement_of_media_id: null, replaced_by_media_id: null,
  usage_count: 0, duplicate_count: 1, total_count: 1,
};
const usage = { media_id: oldId, entity_type: "article_revision", entity_id: "source:legacy/item", field_name: "content:ru:revision:12", is_revision: true };
const replacement = {
  old_media_id: oldId, new_media_id: newId, old_updated_at: stamp, new_updated_at: stamp,
  new_original_name: "replacement.webp", new_alt_text: "  New original alt  ", new_sha256_hex: "b".repeat(64),
  current_usage_refs: [{ entity_type: "article", entity_id: otherId, field_name: "cover_media_id" }],
  history_usage_count: 2,
};
const defaults = {
  assets: { data: [asset], error: null }, usages: { data: [], error: null },
  orphan: { data: [asset], error: null }, orphanUsages: { data: [], error: null },
  replacement: { data: [replacement], error: null },
};
type Dependency = keyof typeof defaults;
type Query = Record<string, string | undefined>;
class NextSignal extends Error {
  constructor(readonly destination: string) { super("Next navigation signal"); }
}
async function render(options: {
  response?: Partial<Record<Dependency, unknown>>; rejected?: Set<Dependency>; query?: Query;
  role?: string; noClient?: boolean; querySignal?: NextSignal; clientSignal?: NextSignal;
  publicUrlReply?: unknown; publicUrlThrows?: boolean;
} = {}) {
  const replies = { ...defaults, ...options.response };
  const rejected = options.rejected ?? new Set();
  let lastList: "assets" | "orphan" = "assets";
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    let dependency: Dependency;
    if (name === "list_media_studio_assets") dependency = lastList = args.p_limit === 50 ? "orphan" : "assets";
    else if (name === "list_media_asset_usages") dependency = lastList === "assets" ? "usages" : "orphanUsages";
    else if (name === "preview_media_asset_replacement") dependency = "replacement";
    else throw new Error("Unexpected or mutating RPC " + name);
    return Promise.resolve().then(() => {
      if (rejected.has(dependency)) throw new TypeError(privateError);
      return replies[dependency];
    });
  });
  const publicUrl = vi.fn(() => {
    if (options.publicUrlThrows) throw new TypeError(privateError);
    return options.publicUrlReply ?? { data: { publicUrl: "https://fixture.invalid/original.webp" } };
  });
  const actions = Object.fromEntries([
    "applyOrphanCleanupAction", "bulkUpdateMediaMetadataAction", "permanentlyPurgeMediaAction",
    "restoreMediaAction", "replaceMediaCurrentUsagesAction", "trashMediaAction", "updateMediaMetadataAction",
  ].map((name) => [name, vi.fn()]));
  const storageMutation = vi.fn(() => { throw new Error("Storage mutation on GET"); });
  const mocks = {
    "@/lib/auth": { getStaffSession: async () => ({ role: options.role ?? "admin" }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : {
        rpc, from: storageMutation,
        storage: { from: () => ({ getPublicUrl: publicUrl, upload: storageMutation, remove: storageMutation }) },
      };
    } },
    "./actions": actions,
    "@/components/MediaFocalEditor": { __esModule: true, default: () => createElement("div", { "data-focal-editor": "true" }) },
    "@/components/MediaUploader": { __esModule: true, default: () => createElement("div", { "data-uploader": "true" }) },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow, redirect: (destination: string): never => { throw new NextSignal(destination); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule("app/(dashboard)/media/page.tsx", mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {});
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), rpc, publicUrl };
  } finally {
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    expect(storageMutation).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal) expect(rpc).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function retryLinks(view: Rendered) { return view.$("a").filter((_i, node) => view.$(node).text() === "Повторить загрузку"); }
function expectSafe(view: Rendered) {
  expect(view.markup).not.toContain(privateError);
  expect(view.markup).not.toContain("NaN");
  expect(view.markup).not.toContain("Infinity");
}
function expectCatalogBlocked(view: Rendered, cards = 0) {
  expectSafe(view);
  expect(view.$(".media-card").length).toBe(cards);
  expect(view.$(".empty-state").length).toBe(0);
  expect(view.$("#media-bulk-metadata").length).toBe(0);
  expect(view.$('.media-card form:not([method="get"])').length).toBe(0);
  expect(view.$('[data-uploader]').length).toBe(0);
  expect(retryLinks(view).length).toBeGreaterThan(0);
}
const previewQuery = { replacement_for: oldId, replacement_with: newId };
afterEach(() => vi.unstubAllEnvs());

describe("M02 media real SSR read isolation", () => {
  it.each(["assets", "usages", "orphan", "orphanUsages", "replacement"] as const)("isolates %s provider errors", async (dependency) => {
    const view = await render({ query: { ...previewQuery, orphan_cleanup: "preview" }, response: {
      [dependency]: { ...defaults[dependency], error: { code: "42501", message: privateError } },
    } });
    expectSafe(view); expect(retryLinks(view).length).toBeGreaterThan(0);
    if (dependency === "assets") expectCatalogBlocked(view);
    if (dependency === "usages") expectCatalogBlocked(view, 1);
    if (dependency === "orphan" || dependency === "orphanUsages") expect(view.$('input[name="orphan_preview_snapshot"]').length).toBe(0);
    if (dependency === "replacement") expect(view.$('input[name="expected_usage_refs"]').length).toBe(0);
  });
  it.each(["assets", "usages", "orphan", "orphanUsages", "replacement"] as const)("isolates rejected %s transport", async (dependency) => {
    const view = await render({ query: { ...previewQuery, orphan_cleanup: "preview" }, rejected: new Set([dependency]) });
    expectSafe(view); expect(retryLinks(view).length).toBeGreaterThan(0);
    if (dependency === "assets") expectCatalogBlocked(view);
    if (dependency === "usages") expectCatalogBlocked(view, 1);
    if (dependency === "orphan" || dependency === "orphanUsages") expect(view.$('input[name="orphan_preview_snapshot"]').length).toBe(0);
    if (dependency === "replacement") expect(view.$('input[name="expected_usage_refs"]').length).toBe(0);
  });
  for (const dependency of ["assets", "usages", "orphan", "orphanUsages", "replacement"] as const) {
    it.each([null, {}, "list", [null], ["item"]])("rejects malformed " + dependency + " %j", async (data) => {
      const view = await render({ query: { ...previewQuery, orphan_cleanup: "preview" }, response: { [dependency]: { data, error: null } } });
      expectSafe(view); expect(retryLinks(view).length).toBeGreaterThan(0);
      if (dependency === "assets") expectCatalogBlocked(view);
      if (dependency === "usages") expectCatalogBlocked(view, 1);
      if (dependency === "orphan" || dependency === "orphanUsages") expect(view.$('input[name="orphan_preview_snapshot"]').length).toBe(0);
      if (dependency === "replacement") expect(view.$('input[name="expected_usage_refs"]').length).toBe(0);
    });
  }
  it.each(["42P01", "PGRST202", "42501", "PGRST301", "402", "57014"])("classifies %s without leaking details", async (code) => {
    const view = await render({ response: { assets: { data: null, error: { code, message: privateError } } } });
    expectCatalogBlocked(view);
    expect(view.$('[role="alert"]').text()).toMatch(code === "42P01" || code === "PGRST202" ? /Структура/ : code === "42501" || code === "PGRST301" ? /доступ/ : /недоступна/);
  });
  it.each([
    { id: otherId, alt_text: {} }, { id: "invalid" }, { bucket: null }, { object_path: [] },
    { original_name: {} }, { mime_type: false }, { width: 1.5 }, { height: -2 },
    { caption: null }, { creator: [] }, { source_url: {} }, { license_name: null },
    { license_url: 7 }, { collection_name: {} }, { focus_x: -0.1 }, { focus_y: 2 },
    { created_at: "invalid" }, { updated_at: null }, { deleted_at: "invalid" },
    { rights_status: "unsupported" }, { sha256_hex: "bad" }, { replacement_of_media_id: "bad" },
  ])("rejects invalid projected asset %j", async (patch) => {
    const view = await render({ response: { assets: { data: [{ ...asset, ...patch }], error: null } } });
    expectCatalogBlocked(view); expect(view.publicUrl).not.toHaveBeenCalled();
  });
  it("rejects duplicate SQL identities", async () => {
    const view = await render({ response: { assets: { data: [asset, { ...asset, id: oldId.toUpperCase() }], error: null } } });
    expectCatalogBlocked(view);
  });
  it.each([null, undefined, -1, 1.5, "bad", Number.MAX_SAFE_INTEGER + 1])("keeps unknown total %j separate from valid assets", async (total_count) => {
    const view = await render({ query: { page: "4" }, response: { assets: { data: [{ ...asset, total_count }], error: null } } });
    expectCatalogBlocked(view, 1); expect(view.$(".media-catalog-heading p").text()).toContain("Недоступно");
    expect(view.$(".pagination").length).toBe(0);
  });
  it.each([null, undefined, -1, 1.5, "bad"])("keeps unknown usage %j out of action preconditions", async (usage_count) => {
    const view = await render({ response: { assets: { data: [{ ...asset, usage_count }], error: null } } });
    expectCatalogBlocked(view, 1); expect(view.$(".media-usage-readout").text()).not.toContain("Используется: 0");
  });
  it("rejects conflicting totals while keeping independent row content", async () => {
    const view = await render({ response: { assets: { data: [{ ...asset, total_count: 3 }, { ...asset, id: newId, total_count: 4 }], error: null } } });
    expectCatalogBlocked(view, 2);
  });
  it.each([{ media_id: otherId }, { entity_type: {} }, { entity_id: null }, { field_name: [] }, { is_revision: "true" }])("rejects malformed or foreign usage %j", async (patch) => {
    const view = await render({ response: { usages: { data: [{ ...usage, ...patch }], error: null } } });
    expectCatalogBlocked(view, 1);
  });
  it("keeps real zero, [] and exact author strings", async () => {
    const view = await render(); expectSafe(view);
    expect(view.$(".media-card").length).toBe(1); expect(view.$("#media-bulk-metadata").length).toBe(1);
    expect(view.$('textarea[name="alt_text"]').text()).toBe(asset.alt_text);
    expect(view.$('textarea[name="caption"]').text()).toBe(asset.caption);
    expect(view.$('.media-metadata-editor input[name="creator"]').attr("value")).toBe(asset.creator);
    expect(view.$(".media-usage-readout").text()).toContain("Используется: 0");
  });
  it("accepts exact bigint count strings and offset timestamps", async () => {
    const view = await render({ response: { assets: { data: [{ ...asset, total_count: "1", usage_count: "0", duplicate_count: "1", byte_size: "1024", updated_at: "2026\u002d09\u002d23T15:00:00+03:00" }], error: null } } });
    expect(view.$("#media-bulk-metadata").length).toBe(1); expect(view.$(".media-card").text()).toContain("1.0 КБ");
  });
  it("keeps SQL UUIDs readable without widening action UUID contracts", async () => {
    const id = oldId.replace("4123", "7123");
    const view = await render({ response: { assets: { data: [{ ...asset, id }], error: null } } });
    expect(view.$(".media-card").length).toBe(1); expect(view.markup).toContain(id);
    expect(view.$('.media-metadata-editor form').length).toBe(1);
    expect(view.$('input[name="media_selection"]').length).toBe(1);
    expect(view.$('.media-replacement-editor').length).toBe(0);
  });
  it("preserves actual empty first page", async () => {
    const view = await render({ response: { assets: { data: [], error: null } } });
    expect(view.$(".empty-state").text()).toContain("Медиатека пока пуста");
    expect(view.$(".media-catalog-heading p").text()).toContain("Файлов пока нет");
    expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not invent total or redirect from a successful empty later page", async () => {
    const view = await render({ query: { page: "4" }, response: { assets: { data: [], error: null } } });
    expect(view.$(".media-catalog-heading p").text()).toContain("Недоступно");
    expect(view.$(".empty-state").text()).not.toContain("Медиатека пока пуста");
    expect(retryLinks(view).length).toBeGreaterThan(0);
  });
  it("redirects only from a verified nonempty exact total", async () => {
    await expect(render({ query: { page: "4", q: "book", view: "list" }, response: { assets: { data: [{ ...asset, total_count: 49 }], error: null } } })).rejects.toMatchObject({ destination: "/media?q=book&view=list&page=2" });
  });
  it("retry preserves base path, search state, view and both preview inputs", async () => {
    vi.stubEnv("ADMIN_BASE_PATH", "/staff");
    const view = await render({ query: { q: "book", search_field: "creator", state: "trash", view: "list", page: "4", ...previewQuery, orphan_cleanup: "preview" }, response: { assets: { data: null, error: { message: privateError } } } });
    const link = retryLinks(view).first(); const url = new URL(link.attr("href")!, "https://fixture.invalid");
    expect(url.pathname).toBe("/staff/media"); expect(url.searchParams.get("q")).toBe("book");
    expect(url.searchParams.get("search_field")).toBe("creator"); expect(url.searchParams.get("state")).toBe("trash");
    expect(url.searchParams.get("view")).toBe("list"); expect(url.searchParams.get("page")).toBe("4");
    expect(url.searchParams.get("replacement_for")).toBe(oldId); expect(url.searchParams.get("replacement_with")).toBe(newId);
    expect(url.searchParams.get("orphan_cleanup")).toBe("preview"); expect(link.attr("data-next-link")).toBeUndefined();
  });
  it.each(["1", "trash", "restore", "replacement", "bulk", "orphan\u002dcleanup", "purge"])("does not treat saved=%s as a receipt", async (saved) => {
    const view = await render({ query: { saved, replacement_count: "99", bulk_count: "99", orphan_count: "99", published: "started", error: privateError } });
    expectSafe(view); expect(view.$(".form-success").length).toBe(0);
    expect(view.markup).not.toContain("обновлено 99"); expect(view.markup).not.toContain("сохранены для 99");
    expect(view.$('[role="status"]').text()).toContain("не подтверждён");
  });
  it.each([
    { old_media_id: otherId }, { new_media_id: otherId }, { old_updated_at: "bad" },
    { new_updated_at: null }, { new_original_name: {} }, { new_alt_text: [] },
    { new_sha256_hex: "bad" }, { current_usage_refs: null }, { current_usage_refs: [{ entity_type: "article", entity_id: null, field_name: "cover_media_id" }] },
    { current_usage_refs: [{ entity_type: ["article"], entity_id: otherId, field_name: "cover_media_id" }] },
    { current_usage_refs: [{ entity_type: {}, entity_id: otherId, field_name: "cover_media_id" }] },
    { history_usage_count: null }, { history_usage_count: -1 },
  ])("closes replacement form for invalid projection %j", async (patch) => {
    const view = await render({ query: previewQuery, response: { replacement: { data: [{ ...replacement, ...patch }], error: null } } });
    expectSafe(view); expect(view.$('input[name="expected_usage_refs"]').length).toBe(0);
    expect(retryLinks(view).length).toBeGreaterThan(0); expect(view.$(".media-card").length).toBe(1);
  });
  it.each([{ data: [] }, { data: [replacement, replacement] }])("rejects non-singleton replacement %j", async ({ data }) => {
    const view = await render({ query: previewQuery, response: { replacement: { data, error: null } } });
    expect(view.$('input[name="expected_usage_refs"]').length).toBe(0); expect(retryLinks(view).length).toBeGreaterThan(0);
  });
  it("preserves verified replacement []/zero without rewriting refs", async () => {
    const view = await render({ query: previewQuery, response: { replacement: { data: [{ ...replacement, current_usage_refs: [], history_usage_count: 0 }], error: null } } });
    expect(view.$('input[name="expected_usage_refs"]').attr("value")).toBe("[]");
    expect(view.$(".media-replacement-summary").text()).toContain("Исторических связей сохранится: 0");
  });
  it("preserves successful read-only replacement identity and snapshots", async () => {
    const view = await render({ query: previewQuery });
    expect(view.$('input[name="old_media_id"]').attr("value")).toBe(oldId);
    expect(view.$('input[name="expected_usage_refs"]').attr("value")).toBe(JSON.stringify(replacement.current_usage_refs));
    expect(view.rpc).toHaveBeenCalledWith("preview_media_asset_replacement", { p_old_media_id: oldId, p_new_media_id: newId });
  });
  it("matches SQL UUID casing without rewriting posted identities", async () => {
    const view = await render({ query: { replacement_for: oldId.toUpperCase(), replacement_with: newId.toUpperCase() } });
    expect(view.$('input[name="old_media_id"]').attr("value")).toBe(oldId);
    expect(view.$('input[name="expected_usage_refs"]').attr("value")).toBe(JSON.stringify(replacement.current_usage_refs));
  });
  it.each([
    { query: {}, patch: { deleted_at: stamp } },
    { query: { state: "trash" }, patch: { deleted_at: null } },
  ])("rejects rows outside the requested lifecycle state %j", async ({ query, patch }) => {
    const view = await render({ query, response: { assets: { data: [{ ...asset, ...patch }], error: null } } });
    expectCatalogBlocked(view);
  });
  it("orphan preview excludes real historical refs and keeps actual safe snapshot", async () => {
    const view = await render({ query: { orphan_cleanup: "preview" }, response: {
      orphan: { data: [{ ...asset, total_count: 2 }, { ...asset, id: newId, total_count: 2 }], error: null },
      orphanUsages: { data: [usage], error: null },
    } });
    expect(view.$('input[name="orphan_preview_snapshot"]').length).toBe(1);
    expect(view.$('input[name="orphan_preview_snapshot"]').attr("value")).toBe(JSON.stringify({ id: newId, updatedAt: stamp }));
  });
  it.each([{ usage_count: null }, { usage_count: -1 }, { total_count: null }, { total_count: "bad" }, { deleted_at: stamp }])("fails closed on orphan projection %j", async (patch) => {
    const view = await render({ query: { orphan_cleanup: "preview" }, response: { orphan: { data: [{ ...asset, ...patch }], error: null } } });
    expect(view.$('input[name="orphan_preview_snapshot"]').length).toBe(0); expect(retryLinks(view).length).toBeGreaterThan(0);
  });
  it("does not request lifecycle previews for ordinary staff", async () => {
    const view = await render({ role: "editor", query: { ...previewQuery, orphan_cleanup: "preview" } });
    expect(view.rpc).toHaveBeenCalledTimes(2);
    expect(view.$('input[name="orphan_preview_snapshot"],input[name="expected_usage_refs"]').length).toBe(0);
  });
  it.each([{}, { data: {} }, { data: { publicUrl: null } }, { data: { publicUrl: "javascript:alert(1)" } }])("isolates malformed public URL %j", async (publicUrlReply) => {
    const view = await render({ publicUrlReply }); expectSafe(view);
    expect(view.$(".media-card").length).toBe(1); expect(view.$(".media-card img").length).toBe(0);
    expect(view.$('.media-card form:not([method="get"])').length).toBe(0);
    expect(view.$(".media-card").text()).toContain("Изображение недоступно");
  });
  it("isolates throwing URL helper without masking row identity", async () => {
    const view = await render({ publicUrlThrows: true }); expectSafe(view);
    expect(view.$(".media-card").length).toBe(1); expect(view.$(".media-card").text()).toContain(oldId);
  });
  it("keeps missing configured client as dependency state", async () => {
    const view = await render({ noClient: true }); expect(view.rpc).not.toHaveBeenCalled();
    expect(view.markup).toContain("Редакционная база временно недоступна");
  });
  it.each(["querySignal", "clientSignal"] as const)("preserves %s Next control flow", async (field) => {
    const signal = new NextSignal("/login"); await expect(render({ [field]: signal })).rejects.toBe(signal);
  });
});
