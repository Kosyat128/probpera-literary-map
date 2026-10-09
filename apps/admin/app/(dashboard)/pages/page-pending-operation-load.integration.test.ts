import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actorId, clone, document, foreignId, pageId, previous, snapshot } from "../../../lib/page-operation.test-fixture";

const nativeRequire = createRequire(import.meta.url), navigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function loadModule(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(adminRoot, relative), baseline = process.env.M02_PAGE_PENDING_LOAD_BASELINE_DIR;
  const source = baseline && relative === "app/(dashboard)/pages/[id]/page.tsx" ? path.resolve(baseline, "apps/admin", relative) : filename;
  const compiled = ts.transpileModule(readFileSync(source, "utf8"), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any }; cache.set(relative, module.exports);
  const require = (name: string): any => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const file = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (file) return loadModule(path.relative(adminRoot, file), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  cache.set(relative, module.exports); return module.exports;
}
const manual = snapshot(), secret = "PRIVATE_PAGE_ROUTE_PROVIDER_SECRET=do_not_render";
const page = { id: pageId, title: manual.title, slug: manual.slug, excerpt: manual.excerpt,
  content_html: manual.contentHtml, content_json: document("A"), status: "draft", seo_title: manual.seoTitle,
  seo_description: manual.seoDescription, canonical_url: manual.canonicalUrl, allow_indexing: true, updated_at: previous, deleted_at: null };
const revision = { id: 17, page_id: pageId, revision_number: 2, created_at: previous };
type Boundary = { pageId: string; actorId?: string; current: Record<string, any> | null; before?: ReactNode; after?: ReactNode; fallback?: ReactNode; retryHref: string };
type Options = { actor?: string; page?: unknown; failTable?: string; rejectedRead?: boolean; revisions?: unknown;
  noClient?: boolean; clientThrow?: unknown; authThrow?: unknown; paramsThrow?: unknown; queryThrow?: unknown; id?: string };
function fixture(options: Options = {}) {
  const actor = options.actor ?? actorId, boundaries: Boundary[] = [], reads: Array<{ table: string; filters: Array<[string, unknown]>; columns: string }> = [];
  const mutation = vi.fn(() => { throw Error("GET must not write"); }), rpc = vi.fn(() => { throw Error("GET must not call RPC"); });
  const from = vi.fn((table: string) => {
    if (!["pages", "page_revisions"].includes(table)) throw Error("Unexpected GET dependency");
    const filters: Array<[string, unknown]> = []; let columns = "";
    const query = { select: (value: string) => { columns = value; return query; }, eq: (name: string, value: unknown) => { filters.push([name, value]); return query; },
      order: () => query, range: () => query, maybeSingle: () => query, update: mutation, insert: mutation, delete: mutation, upsert: mutation,
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => {
        reads.push({ table, filters, columns });
        if (options.failTable === table && options.rejectedRead) throw Error(secret);
        return { data: table === "pages" ? Object.hasOwn(options, "page") ? options.page : page
          : Object.hasOwn(options, "revisions") ? options.revisions : [revision],
        ...(table === "page_revisions" ? { count: 100 } : {}), error: options.failTable === table ? { code: "42501", message: secret } : null };
      }).then(resolve, reject) };
    return query;
  });
  const getStaffSession = vi.fn(async () => { if (Object.hasOwn(options, "authThrow")) throw options.authThrow; return { configured: true, mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false }, user: { id: actor }, role: "editor" }; });
  const createClient = vi.fn(async () => { if (Object.hasOwn(options, "clientThrow")) throw options.clientThrow; return options.noClient ? null : { from, rpc }; });
  const Page = loadModule("app/(dashboard)/pages/[id]/page.tsx", {
    "@/lib/auth": { getStaffSession }, "@/lib/supabase/server": { createServerSupabaseClient: createClient },
    "@/components/PageEditorLoader": { __esModule: true, default: (props: Boundary) => {
      if (!props) return null; boundaries.push(props);
      return createElement(Fragment, {}, props.before, props.current ? createElement("section", { "data-page-editor": "true" }) : props.fallback, props.after);
    } },
  }).default as (props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) => Promise<ReactNode>;
  async function render(query: Record<string, string> = {}) {
    const tree = await Page({ params: Object.hasOwn(options, "paramsThrow") ? Promise.reject(options.paramsThrow) : Promise.resolve({ id: options.id ?? pageId }),
      searchParams: Object.hasOwn(options, "queryThrow") ? Promise.reject(options.queryThrow) : Promise.resolve(query) });
    const markup = renderToStaticMarkup(tree); expect(mutation).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
    return { markup, boundary: boundaries.at(-1)!, boundaries, reads, actor };
  }
  return { render, boundaries, reads, from, mutation, rpc, getStaffSession, createClient };
}
function blocked(result: Awaited<ReturnType<ReturnType<typeof fixture>["render"]>>) {
  expect(result.boundaries).toHaveLength(1); expect(result.boundary.actorId).toBe(result.actor); expect(result.boundary.current).toBeNull();
  expect(result.markup).not.toContain('data-page-editor="true"'); expect(result.markup).not.toContain(secret);
  expect(result.boundary).not.toHaveProperty("receipt");
}
function signal(kind: "redirect" | "notFound") { try { kind === "redirect" ? navigation.redirect("/login") : navigation.notFound(); } catch (error) { return error; } throw Error("Expected native Next signal"); }
afterEach(() => vi.unstubAllEnvs());
describe("M02 actual Page GET binds reload recovery to current staff actor", () => {
  it("binds successful boundary and editor to staff actor while preserving original author content and exact CAS", async () => {
    const before = clone(page), view = fixture(), result = await view.render();
    expect(result.boundaries).toHaveLength(1); expect(result.boundary.pageId).toBe(pageId); expect(result.boundary.actorId).toBe(actorId);
    expect(result.boundary.current?.actorId).toBe(actorId); expect(result.boundary.current?.page).toEqual(before); expect(page).toEqual(before);
    expect(result.boundary.current?.page.updated_at).toBe(previous); expect(result.boundary.current?.savedAfterSubmit).toBe(false);
    expect(result.markup).toContain('data-page-editor="true"'); expect(view.getStaffSession).toHaveBeenCalledTimes(1);
    expect(result.reads.find(read => read.table === "pages")).toEqual({ table: "pages", columns: "*", filters: [["id", pageId]] });
    expect(result.reads.find(read => read.table === "page_revisions")?.filters).toEqual([["page_id", pageId]]);
    expect(result.boundary.current).not.toHaveProperty("receipt"); expect(result.boundary.current).not.toHaveProperty("operationId");
  });
  it("uses changed staff actor and ignores URL actor, saved and publication flags as receipt proof", async () => {
    const result = await fixture({ actor: foreignId }).render({ actorId, actor_id: actorId, saved: "1", published: "started", error: secret });
    expect(result.boundary.actorId).toBe(foreignId); expect(result.boundary.current?.actorId).toBe(foreignId);
    expect(result.boundary.current?.savedAfterSubmit).toBe(false); expect(result.markup).not.toContain(secret); expect(result.markup).toContain("не подтвержд");
  });
  it("preserves catalogue/revision/retry context without introducing a write", async () => {
    vi.stubEnv("ADMIN_BASE_PATH", "/panel");
    const result = await fixture().render({ q: "  Ручная страница  ", status: "hidden", page: "3", revision_page: "2" });
    expect(result.boundary.current?.catalogContext).toEqual({ q: "Ручная страница", status: "hidden", page: 3, revisionPage: 2 });
    const url = new URL(result.boundary.retryHref, "https://fixture.invalid");
    expect(url.pathname).toBe(`/panel/pages/${pageId}`); expect(url.searchParams.get("q")).toBe("Ручная страница");
    expect(url.searchParams.get("status")).toBe("hidden"); expect(url.searchParams.get("page")).toBe("3"); expect(url.searchParams.get("revision_page")).toBe("2");
  });
  it.each([false, true])("mandatory Page read failure retains actor scope and blocks editor rejected=%s", async rejectedRead => {
    blocked(await fixture({ actor: foreignId, failTable: "pages", rejectedRead }).render());
  });
  it.each([{ noClient: true }, { clientThrow: new Error(secret) }])("missing client preserves actor-bound failure boundary %j", async options => {
    const view = fixture({ actor: foreignId, ...options }); blocked(await view.render()); expect(view.from).not.toHaveBeenCalled();
  });
  it.each([
    { ...page, id: foreignId }, { ...page, updated_at: "bad" }, { ...page, title: null }, { ...page, content_json: false },
    { ...page, content_json: { type: "doc", content: [{ type: "unknown" }] } }, { ...page, content_json: { type: "doc", content: [{ type: "paragraph", attrs: { silentlyDropped: "authored" } }] } },
    { ...page, allow_indexing: "on" }, { ...page, status: "scheduled" },
  ])("refuses foreign/malformed canonical rows without author replacement %j", async value => {
    const before = clone(value); blocked(await fixture({ page: value }).render()); expect(value).toEqual(before);
  });
  it("malformed requested UUID grants no editor or receipt", async () => {
    const result = await fixture({ id: "bad" }).render(); blocked(result); expect(result.boundary.pageId).toBe("bad");
  });
  it.each([false, true])("optional revision read failure does not invalidate fresh actor-bound author bundle rejected=%s", async rejectedRead => {
    const result = await fixture({ failTable: "page_revisions", rejectedRead }).render();
    expect(result.boundary.actorId).toBe(actorId); expect(result.boundary.current?.actorId).toBe(actorId);
    expect(result.boundary.current?.page).toEqual(page); expect(result.markup).toContain('data-page-editor="true"'); expect(result.markup).not.toContain(secret);
  });
  it("confirmed missing page keeps native notFound and does not create a recovery editor", async () => {
    const view = fixture({ page: null }); await expect(view.render()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(view.boundaries).toHaveLength(0); expect(view.mutation).not.toHaveBeenCalled(); expect(view.rpc).not.toHaveBeenCalled();
  });
  it.each(["redirect", "notFound"] as const)("preserves genuine native %s from authentication/client/route promises", async kind => {
    const native = signal(kind);
    for (const field of ["authThrow", "clientThrow", "paramsThrow", "queryThrow"] as const) {
      const view = fixture({ [field]: native }); await expect(view.render()).rejects.toBe(native);
      expect(view.boundaries).toHaveLength(0); expect(view.mutation).not.toHaveBeenCalled(); expect(view.rpc).not.toHaveBeenCalled();
      if (field !== "clientThrow") expect(view.createClient).not.toHaveBeenCalled();
    }
  });
});
