import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;
function loadModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith(".module.css")) return { __esModule: true, default: {} };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const source = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (source) return loadModule(path.relative(adminRoot, source), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}
const privateError = "PRIVATE_PROVIDER_SECRET=page_fixture";
const stamp = "2026-09-30T10:00:00.123456+00:00";
const id = "11111111-1111-4111-8111-111111111111";
const page = { id, title: "  Ручная страница  ", slug: "original-page", excerpt: "Ручное описание \u2014 как есть",
  content_html: "<p>Ручной текст <em>как есть</em>.</p>", content_json: { type: "doc", content: [{ type: "paragraph",
    content: [{ type: "text", text: "Ручной текст " }, { type: "text", text: "как есть", marks: [{ type: "italic" }] },
      { type: "text", text: "." }] }] },
  status: "draft", seo_title: null, seo_description: null, canonical_url: null, allow_indexing: true,
  updated_at: stamp, deleted_at: null };
const revision = { id: 17, page_id: id, revision_number: 2, created_at: stamp };
const defaults = { list: { data: [page], count: 1, error: null }, page: { data: page, error: null },
  revisions: { data: [revision], count: 1, error: null }, preview: { data: page, error: null } };
type Dependency = keyof typeof defaults;
type Surface = "list" | "edit" | "preview";
type Query = { q?: string; page?: string; revision_page?: string; status?: string; error?: string; saved?: string; deleted?: string; published?: string };
class NextSignal extends Error {
  readonly digest: string;
  constructor(readonly destination: string) {
    super("Next signal");
    this.digest = destination === "notFound" ? "NEXT_HTTP_ERROR_FALLBACK;404" : `NEXT_REDIRECT;replace;${destination};307;`;
  }
}
async function render(surface: Surface, options: { replies?: Partial<Record<Dependency, unknown>>;
  rejected?: Dependency[]; query?: Query; noClient?: boolean; id?: string; signal?: "query" | "client" | "params";
  clientFailure?: boolean; clientControl?: string } = {}) {
  const replies = { ...defaults, ...options.replies }, editorProps: Record<string, unknown>[] = [], ranges: [number, number][] = [];
  const mutation = vi.fn(), rpc = vi.fn(), navigationSignal = new NextSignal("/login");
  const from = vi.fn((table: string) => {
    expect(["pages", "page_revisions"]).toContain(table);
    const dependency: Dependency = table === "page_revisions" ? "revisions"
      : surface === "edit" ? "page" : surface;
    const builder = { select: () => builder, order: () => builder, is: () => builder, eq: () => builder,
      ilike: () => builder, maybeSingle: () => builder,
      range: (first: number, last: number) => { ranges.push([first, last]); return builder; },
      then: (yes: (value: unknown) => unknown, no: (error: unknown) => unknown) => Promise.resolve().then(() => {
        if (options.rejected?.includes(dependency)) throw new TypeError(privateError);
        return replies[dependency];
      }).then(yes, no) };
    return builder;
  });
  const actions = { changePageStatusAction: mutation, createPageAction: mutation,
    softDeletePageAction: mutation, restorePageRevisionAction: mutation };
  const mocks = {
    "@/lib/auth": { getStaffSession: async () => ({ configured: true, mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false }, user: { id: "22222222-2222-4222-8222-222222222222" }, role: "editor" }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientFailure) throw new TypeError(privateError);
      if (options.clientControl) throw new NextSignal(options.clientControl);
      if (options.signal === "client") throw navigationSignal;
      return options.noClient ? null : { from, rpc };
    } },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://example.test" } },
    "@/components/PageEditorLoader": { __esModule: true, default: (props: Record<string, unknown>) => {
      const current = Object.hasOwn(props, "current") ? props.current : props;
      if (current) editorProps.push(current as Record<string, unknown>);
      return createElement(Fragment, {}, props.before as ReactNode,
        current ? createElement("section", { "data-page-editor": "true" }, "Real editor props boundary") : props.fallback as ReactNode,
        props.after as ReactNode);
    } },
    "@/components/EditorialPreviewFonts": { editorialPreviewFonts: "fixture-font" },
    "./EditorialBlockView": { __esModule: true, default: () => { throw new Error("Client view must not execute during server reads"); } },
    "./EditorialImageView": { __esModule: true, default: () => { throw new Error("Client view must not execute during server reads"); } },
    "@tiptap/react": { ReactNodeViewRenderer: () => { throw new Error("Node view must not execute during schema validation"); } },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) =>
      createElement("button", { type: "submit" }, children) },
    "./actions": actions, "../actions": actions,
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
    "next/navigation": { redirect: (href: string): never => { throw new NextSignal(href); },
      notFound: (): never => { throw new NextSignal("notFound"); },
      unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow },
  };
  const filename = surface === "list" ? "page.tsx" : surface === "edit" ? "[id]/page.tsx" : "[id]/preview/page.tsx";
  const component = loadModule(`app/(dashboard)/pages/${filename}`, mocks).default as
    (props: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const markup = renderToStaticMarkup(await component({ params: options.signal === "params"
      ? Promise.reject(navigationSignal) : Promise.resolve({ id: options.id ?? id }),
      searchParams: options.signal === "query" ? Promise.reject(navigationSignal) : Promise.resolve(options.query ?? {}) }));
    return { markup, $: load(markup), from, ranges, editorProps };
  } finally { expect(mutation).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled(); }
}
type View = Awaited<ReturnType<typeof render>>;
const surfaceFor = (dependency: Dependency): Surface => dependency === "page" || dependency === "revisions" ? "edit" : dependency;
const retry = (view: View) => view.$("a").filter((_i, el) => view.$(el).text() === "Повторить загрузку");
function failed(view: View, dependency: Dependency) {
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(view.markup).not.toContain(privateError); expect(retry(view).length).toBeGreaterThan(0);
  if (dependency !== "revisions") expect(view.editorProps).toHaveLength(0);
  else expect(view.editorProps).toHaveLength(1);
  expect(view.$('input[name="revision_id"]').length).toBe(0);
  if (dependency === "list") expect(view.$('form input[name="id"],form input[name="title"]').length).toBe(0);
  if (dependency === "page") expect(view.$('input[name="expected_updated_at"]').length).toBe(0);
}
afterEach(() => vi.unstubAllEnvs());
describe("M02 real page list/editor/preview read chain", () => {
  it("settles ordinary edit client factory failure without leaking details or opening an initial editor", async () => {
    const view = await render("edit", { clientFailure: true });
    failed(view, "page"); expect(view.from).not.toHaveBeenCalled();
  });
  it.each(["/login", "notFound"])("edit client factory preserves native %s control signal", async destination => {
    await expect(render("edit", { clientControl: destination })).rejects.toMatchObject({ destination });
  });
  it.each(Object.keys(defaults) as Dependency[])("isolates %s provider error", async dependency => {
    failed(await render(surfaceFor(dependency), { replies: { [dependency]: { data: null, count: 0,
      error: { code: "57014", message: privateError } } } }), dependency);
  });
  it.each(Object.keys(defaults) as Dependency[])("isolates rejected %s transport", async dependency => {
    failed(await render(surfaceFor(dependency), { rejected: [dependency] }), dependency);
  });
  it.each(Object.keys(defaults) as Dependency[])("rejects %s data plus error", async dependency => {
    failed(await render(surfaceFor(dependency), { replies: { [dependency]: { ...defaults[dependency],
      error: { code: "42501", message: privateError } } } }), dependency);
  });
  it.each((Object.keys(defaults) as Dependency[]).flatMap(dependency =>
    [null, undefined, {}, { data: {} }, { data: [null] }].map(response => [dependency, response] as const)))
    ("rejects damaged %s response %j", async (dependency, response) => {
      failed(await render(surfaceFor(dependency), { replies: { [dependency]: response } }), dependency);
    });
  it.each((Object.keys(defaults) as Dependency[]).flatMap(dependency =>
    ["42P01", "42501", "PGRST116", "57014"].map(code => [dependency, code] as const)))
    ("classifies %s %s safely", async (dependency, code) => {
      const view = await render(surfaceFor(dependency), { replies: { [dependency]: { data: null, count: null,
        error: { code, message: privateError } } } });
      failed(view, dependency);
      expect(view.markup).toContain(code === "42P01" ? "Структура редакционной базы"
        : code === "42501" ? "Проверьте вход и права доступа" : code === "PGRST116" ? "повреждённый ответ" : "временно недоступна");
    });
  it.each((["list", "revisions"] as const).flatMap(dependency =>
    [null, undefined, "0", -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(count => [dependency, count] as const)))
    ("keeps unknown %s count %j without redirect or unsafe actions", async (dependency, count) => {
      const view = await render(surfaceFor(dependency), { replies: { [dependency]: { ...defaults[dependency], count } },
        query: { page: "7", revision_page: "7", q: "Ручная", status: "draft" } });
      failed(view, dependency); expect(view.markup).toContain("Недоступно");
      expect(view.$("nav.pagination").length).toBe(0);
      expect(view.markup).toContain(dependency === "list" ? page.title : "Версия 2");
    });
  it.each([
    ["list", { ...page, id: {} }], ["list", { ...page, title: {} }], ["list", { ...page, status: "__proto__" }],
    ["list", { ...page, updated_at: "invalid" }], ["list", { ...page, slug: null }],
    ["page", { ...page, id: "22222222-2222-4222-8222-222222222222" }], ["page", { ...page, title: [] }],
    ["page", { ...page, content_html: null }], ["page", { ...page, excerpt: {} }], ["page", { ...page, seo_title: [] }],
    ["page", { ...page, allow_indexing: null }], ["page", { ...page, content_json: undefined }],
    ["preview", { ...page, id: "22222222-2222-4222-8222-222222222222" }], ["preview", { ...page, title: {} }],
    ["preview", { ...page, content_html: null }], ["preview", { ...page, excerpt: [] }],
    ["preview", { ...page, updated_at: "invalid" }], ["preview", { ...page, status: {} }],
    ["revisions", { ...revision, id: "9223372036854775808" }], ["revisions", { ...revision, revision_number: {} }],
    ["revisions", { ...revision, created_at: "invalid" }], ["revisions", { ...revision, page_id: "22222222-2222-4222-8222-222222222222" }],
  ] as [Dependency, unknown][])("holds damaged/foreign %s row %j", async (dependency, row) => {
    failed(await render(surfaceFor(dependency), { replies: { [dependency]: { data: dependency === "list" || dependency === "revisions"
      ? [row] : row, count: 1, error: null } } }), dependency);
  });
  it.each([null, false, "legacy content", [], {}, { type: "doc", content: "not-an-array" },
    { type: "doc", content: [null] }, { type: "doc", content: [{ type: "paragraph", content: {} }] },
    { type: "doc", content: [{ type: "text", text: "" }] },
    { type: "doc", content: [{ type: "text", text: "Text", marks: [null] }] },
    { type: "doc", content: [{ type: "retiredWidget", content: [{ type: "text", text: "Original" }] }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Original", marks: [{ type: "retiredMark" }] }] }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "paragraph" }] }] },
    { type: "doc", content: [{ type: "paragraph", text: "Original text in unsupported field" }] },
    { type: "doc", content: [{ type: "paragraph", attrs: { originalAuthorNote: "Keep this value" } }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Original", marks: [{ type: "bold", attrs: { originalAuthorNote: "Keep" } }] }] }] },
    { type: "doc", originalAuthorNote: "Keep", content: [{ type: "paragraph" }] },
    { type: "doc", content: [] }].map(content_json => ({ content_json })))
    ("reads legacy JSON $content_json without opening an empty editor", async ({ content_json }) => {
      const view = await render("edit", { replies: { page: { data: { ...page, content_json }, error: null } } });
      expect(view.editorProps).toHaveLength(0); expect(view.markup).toContain(page.slug);
      expect(view.$('input[name="expected_updated_at"]').length).toBe(0);
      expect(retry(view).length).toBeGreaterThan(0);
    });
  it("keeps the canonical empty new draft editable", async () => {
    const original = { ...page, content_json: { type: "doc", content: [] }, content_html: "" };
    const view = await render("edit", { replies: { page: { data: original, error: null } } });
    expect(view.editorProps).toHaveLength(1); expect(view.editorProps[0].page).toEqual(original);
  });
  it("retains supported gallery, image rights and semantic marks unchanged", async () => {
    const original = { ...page, content_json: { type: "doc", content: [{ type: "editorialBlock",
      attrs: { kind: "gallery", galleryId: "original-gallery", galleryColumnsDesktop: 3 }, content: [
        { type: "paragraph", content: [{ type: "text", text: "  Original prose  ", marks: [
          { type: "textTone", attrs: { tone: "accent" } }, { type: "typographyScope", attrs: { scope: "body" } }] }] },
        { type: "image", attrs: { src: "https://example.test/original.webp", mediaId: id,
          alt: "Original alt", caption: "Original caption", credit: "Original credit", source: "https://example.test/source",
          license: "Original license", licenseUrl: "https://example.test/rights", width: 75, focusX: 0.3 } },
      ] }] } };
    const view = await render("edit", { replies: { page: { data: original, error: null } } });
    expect(view.editorProps).toHaveLength(1); expect(view.editorProps[0].page).toEqual(original);
  });
  it("preserves full author values and ignores forged saved-after-submit", async () => {
    const view = await render("edit", { query: { saved: "yes", error: privateError, q: "Ручная", page: "2", revision_page: "2" },
      replies: { revisions: { data: [revision], count: 25, error: null } } });
    expect(view.editorProps).toHaveLength(1); expect(view.editorProps[0].page).toEqual(page);
    expect(view.editorProps[0].savedAfterSubmit).toBe(false); expect(view.markup).not.toContain(privateError);
    expect(view.editorProps[0].catalogContext).toEqual({ q: "Ручная", status: "", page: 2, revisionPage: 2 });
  });
  it("retains exact preview HTML without rewriting it", async () => {
    const view = await render("preview"); expect(view.$(".preview-prose").html()).toBe(page.content_html);
    expect(view.markup).toContain(page.title); expect(view.markup).toContain(page.excerpt);
  });
  it.each(["edit", "preview"] as const)("keeps confirmed absent %s as native notFound", async surface => {
    await expect(render(surface, { replies: { [surface === "edit" ? "page" : "preview"]: { data: null, error: null } } }))
      .rejects.toMatchObject({ destination: "notFound" });
  });
  it.each(["list", "revisions"] as const)("keeps true empty %s and zero count", async dependency => {
    const view = await render(surfaceFor(dependency), { replies: { [dependency]: { data: [], count: 0, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0); expect(view.markup).not.toContain("Недоступно");
    if (dependency === "list") expect(view.$('form input[name="title"]').length).toBe(1);
  });
  it.each(["list", "revisions"] as const)("does not call an empty range with unknown %s total an empty archive", async dependency => {
    const view = await render(surfaceFor(dependency), { replies: { [dependency]: { data: [], count: null, error: null } } });
    failed(view, dependency); expect(view.markup).toContain("неизвестно");
    expect(view.markup).not.toContain("История появится после первого изменения страницы");
    expect(view.$(".empty-state").length).toBe(0);
  });
  it("keeps exact large revision IDs readable while closing lossy restore", async () => {
    const view = await render("edit", { replies: { revisions: { data: [{ ...revision, id: "9223372036854775807" }], count: 1, error: null } } });
    expect(view.markup).toContain("Версия 2"); expect(view.$('input[name="revision_id"]').length).toBe(0);
  });
  it.each(["list", "edit", "preview"] as const)("preserves %s retry context/base path", async surface => {
    vi.stubEnv("ADMIN_BASE_PATH", "/panel");
    const view = await render(surface, { rejected: [surface === "edit" ? "page" : surface],
      query: { q: "Ручная", status: "draft", page: "7", revision_page: "7", saved: "yes", error: privateError } });
    const link = retry(view).last(), url = new URL(link.attr("href")!, "https://example.test");
    expect(url.pathname).toBe(surface === "list" ? "/panel/pages" : `/panel/pages/${id}${surface === "preview" ? "/preview" : ""}`);
    expect(url.searchParams.get("q")).toBe("Ручная"); expect(url.searchParams.get("status")).toBe("draft");
    expect(url.searchParams.get("page")).toBe("7");
    if (surface !== "list") expect(url.searchParams.get("revision_page")).toBe("7");
    expect(url.searchParams.has("saved")).toBe(false); expect(url.searchParams.has("error")).toBe(false);
    expect(link.attr("data-next-link")).toBeUndefined();
  });
  it.each(["list", "edit"] as const)("treats %s URL notices as unconfirmed", async surface => {
    const view = await render(surface, { query: { saved: "yes", deleted: "yes", published: "started", error: privateError } });
    expect(view.$(".form-success").length).toBe(0); expect(view.markup).not.toContain(privateError);
    expect(view.markup).toContain("не подтвержд");
  });
  it.each(["list", "edit", "preview"] as const)("keeps %s missing dependency distinct from notFound", async surface => {
    const view = await render(surface, { noClient: true }); expect(view.from).not.toHaveBeenCalled();
    expect(view.editorProps).toHaveLength(0);
  });
  it.each((["list", "edit", "preview"] as const).flatMap(surface =>
    (["query", "client"] as const).map(signal => [surface, signal] as const)))
    ("preserves %s Next %s signals", async (surface, signal) => {
      await expect(render(surface, { signal })).rejects.toMatchObject({ destination: "/login" });
    });
});
