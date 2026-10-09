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
type Route = "tokens" | "fonts" | "releases";
type Exports = Record<string, unknown>;
function loadAdminModule(relative: string, mocks: Record<string, unknown>): Exports {
  const filename = path.join(adminRoot, relative);
  const basename = /^app\/\(dashboard\)\/site-studio\/(tokens|fonts|releases)\/page\.tsx$/u.exec(relative.replaceAll("\\", "/"))?.[1];
  const source = basename && process.env.M02_STUDIO_BASELINE_ROOT ? path.join(process.env.M02_STUDIO_BASELINE_ROOT, basename + ".tsx") : filename;
  const compiled = ts.transpileModule(readFileSync(source, "utf8"), { fileName: filename, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as Exports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
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
const tokenId = "876543ab\u002d1234\u002d4234\u002d9234\u002d123456789012";
const releaseId = "11111111\u002d1234\u002d4234\u002d9234\u002d123456789012";
const token = {
  id: tokenId, layer: "site", target_key: "site", token_key: "site.color.primary", category: "color", value_type: "color",
  breakpoint: "base", state: "default", description: "Исходное описание", draft_value: "#ff00ff", published_value: null, cas_version: 2, updated_at: stamp,
};
const component = { component_key: "magazine", display_name: "Исходный журнал", owner_lock: false };
const changeSet = { id, name: "  Исходный выпуск  ", description: "Исходное описание", status: "draft", scheduled_at: null, cas_version: 3, updated_at: stamp, submitted_at: null, approved_at: null, published_at: null };
const item = { id: 1, change_set_id: id, token_id: tokenId, expected_token_cas_version: 2, proposed_value: "#ffffff" };
const release = { id: releaseId, release_number: 1, action: "publish", change_set_id: id, rollback_of_release_id: null, token_count: 1, created_at: stamp };
const font = { id, display_name: "Исходный шрифт", family_name: "Original Font", source_type: "system", format: null, font_style: "normal", weight_min: 400, weight_max: 400, byte_size: null, is_variable: false, license_name: null, license_url: null, created_at: stamp, cas_version: 1 };
const override = { id: tokenId, layer: "site", target_key: "site", semantic_scope: "body", breakpoint: "base", draft_settings: { familyId: id, fontSize: 16 }, published_settings: null, cas_version: 2, updated_at: stamp };
const revision = { id: 1, override_id: tokenId, revision_number: 1, action: "publish", snapshot: { layer: "site", targetKey: "site", semanticScope: "body", breakpoint: "base", publishedSettings: { familyId: id, fontSize: 16 } }, created_at: stamp };
const fixtures = {
  tokens: { site_design_tokens: [token], site_component_registry: [component], site_design_change_sets: [changeSet] },
  fonts: { font_assets: [font], site_typography_overrides: [override], site_typography_revisions: [revision] },
  releases: { site_design_change_sets: [changeSet], site_design_change_set_items: [item], site_design_tokens: [token], site_design_releases: [release] },
};
type Query = Record<string, string | number | undefined>;
class NextSignal extends Error { constructor(readonly destination: string) { super("Next navigation signal"); } }
async function render(route: Route, options: {
  response?: Record<string, unknown>; rejected?: Set<string>; query?: Query; role?: string;
  noClient?: boolean; querySignal?: NextSignal; authSignal?: NextSignal; clientSignal?: NextSignal;
} = {}) {
  const defaults = Object.fromEntries(Object.entries(fixtures[route]).map(([table, rows]) => [table, { data: rows, count: rows.length, error: null }]));
  const replies = { ...defaults, ...options.response };
  const rejected = options.rejected ?? new Set();
  const reads: [string, string, unknown][] = [];
  const from = vi.fn((table: string) => {
    expect(Object.keys(defaults)).toContain(table);
    const builder = {
      select: (_value: string, options?: unknown) => { reads.push([table, "select", options]); return builder; },
      order: () => builder, limit: () => builder, eq: () => builder, is: () => builder,
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => { if (rejected.has(table)) throw new TypeError(privateError); return replies[table]; }).then(fulfilled, denied),
    };
    return builder;
  });
  const rpc = vi.fn();
  const actionNames = ["publishSiteDesignChangeSetAction", "removeSiteDesignChangeSetItemAction", "rollbackSiteDesignReleaseAction", "saveSiteDesignChangeSetAction", "transitionSiteDesignChangeSetAction"];
  const actions = Object.fromEntries(actionNames.map((name) => [name, vi.fn()]));
  const workspace = vi.fn((props: Record<string, unknown>) => createElement("section", { "data-workspace": "true", "data-messages": JSON.stringify(props.messages) }, [
    createElement("span", { key: "rows" }, JSON.stringify([props.tokens, props.components, props.changeSets, props.fonts, props.overrides, props.revisions])),
    props.canManage ? createElement("form", { key: "form" }, createElement("button", { type: "submit" }, "Save fixture")) : null,
  ]));
  const mocks = {
    "@/lib/auth": { getStaffSession: async () => { if (options.authSignal) throw options.authSignal; return { role: options.role ?? "admin" }; } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { if (options.clientSignal) throw options.clientSignal; return options.noClient ? null : { from, rpc }; } },
    "./TokenStudio": { __esModule: true, default: workspace },
    "./TypographyWorkspaceLoader": { __esModule: true, default: workspace },
    "./actions": actions,
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const page = loadAdminModule(`app/(dashboard)/site-studio/${route}/page.tsx`, mocks).default as (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal) : Promise.resolve(options.query ?? {});
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), from, reads, workspace };
  } finally { expect(rpc).not.toHaveBeenCalled(); Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled()); }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function retryLink(view: Rendered) { return view.$("a").filter((_index, node) => view.$(node).text() === "Повторить загрузку"); }
function expectClosed(view: Rendered) {
  expect(view.$('[role="alert"]').length).toBeGreaterThan(0);
  expect(view.markup).not.toContain(privateError);
  expect(view.$("form").length).toBe(0);
  expect(view.workspace).not.toHaveBeenCalled();
  expect(view.markup).not.toContain("Схема выпусков ещё не применена");
  expect(retryLink(view).length).toBe(1);
  expect(retryLink(view).attr("data-next-link")).toBeUndefined();
}
afterEach(() => vi.unstubAllEnvs());
describe.each(["tokens", "fonts", "releases"] as const)("M02 Site Studio %s actual server loader", (route) => {
  const dependencies = Object.keys(fixtures[route]);
  it.each(dependencies)("isolates provider error %s", async (table) => {
    expectClosed(await render(route, { response: { [table]: { data: [], count: 0, error: { code: "42501", message: privateError } } } }));
  });
  it.each(dependencies)("settles rejection %s", async (table) => { expectClosed(await render(route, { rejected: new Set([table]) })); });
  it.each(dependencies)("rejects good data plus error %s", async (table) => {
    expectClosed(await render(route, { response: { [table]: { data: (fixtures[route] as Record<string, unknown[]>)[table], count: 1, error: { message: privateError } } } }));
  });
  it.each(dependencies)("rejects null envelope %s", async (table) => { expectClosed(await render(route, { response: { [table]: null } })); });
  it.each(dependencies)("rejects null data %s", async (table) => { expectClosed(await render(route, { response: { [table]: { data: null, count: 0, error: null } } })); });
  it.each(dependencies)("rejects malformed rows %s while retaining valid rows explicitly readonly", async (table) => {
    const rows = (fixtures[route] as Record<string, unknown[]>)[table];
    const view = await render(route, { response: { [table]: { data: [...rows, {}], count: 2, error: null } } });
    expectClosed(view);
    expect(view.markup).toContain(route === "fonts" ? font.display_name : changeSet.name);
  });
  it.each(dependencies)("rejects duplicates %s without duplicate DOM keys", async (table) => {
    const rows = (fixtures[route] as Record<string, unknown[]>)[table];
    expectClosed(await render(route, { response: { [table]: { data: [...rows, ...rows], count: 2, error: null } } }));
  });
  it.each([null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined])("rejects invalid count %j", async (count) => {
    const table = dependencies[0]; const rows = (fixtures[route] as Record<string, unknown[]>)[table];
    expectClosed(await render(route, { response: { [table]: { data: rows, count, error: null } } }));
  });
  it("keeps partial bounded dependencies closed rather than treating truncated data as complete", async () => {
    const table = dependencies[0]; const rows = (fixtures[route] as Record<string, unknown[]>)[table];
    expectClosed(await render(route, { response: { [table]: { data: rows, count: 2000, error: null } } }));
  });
  it("preserves verified zero counts/empty lists as complete without fake records", async () => {
    const response = Object.fromEntries(dependencies.map((table) => [table, { data: [], count: 0, error: null }]));
    const view = await render(route, { response });
    expect(view.$('[role="alert"]').length).toBe(0);
    if (route !== "releases") expect(view.workspace).toHaveBeenCalledOnce();
    else expect(view.markup).toContain("Наборов изменений пока нет.");
  });
  it("passes current verified versions and original values without rewriting source rows", async () => {
    const before = JSON.stringify(fixtures[route]); const view = await render(route);
    expect(view.$('[role="alert"]').length).toBe(0);
    expect(view.markup).toContain(route === "fonts" ? font.display_name : changeSet.name);
    expect(JSON.stringify(fixtures[route])).toBe(before);
    if (route !== "releases") {
      const props = view.workspace.mock.calls[0][0]; expect(props.canManage).toBe(true); expect(props.messages).toEqual({});
    } else expect(view.$('input[name="expected_version"]').map((_index, node) => view.$(node).attr("value")).get()).toContain("3");
  });
  it.each(["42P01", "42501", "PGRST116", "57014"])("classifies %s accurately", async (code) => {
    const view = await render(route, { response: { [dependencies[0]]: { data: [], count: 0, error: { code, message: privateError } } } });
    expectClosed(view);
    if (code === "42P01") expect(view.markup).toContain("Структура редакционной базы");
    if (code === "42501") expect(view.markup).toContain("Проверьте вход и права доступа");
  });
  it.each([0, 1, 2, 3])("URL flag fixture %s does not manufacture receipts", async (index) => {
    const query = (route === "tokens" ? [{ saved: "1" }, { staged: "1" }, { saved: "other" }, { error: privateError }]
      : route === "fonts" ? [{ saved: "1" }, { published: "1" }, { restored: "1" }, { error: privateError }]
        : [{ saved: "1" }, { published: "1" }, { rolled_back: "1" }, { error: privateError }])[index];
    const view = await render(route, { query });
    expect(view.markup).not.toContain(privateError);
    expect(view.$('[role="status"]').text()).toContain("не подтверждён");
    if (route !== "releases") expect(view.workspace.mock.calls[0][0].messages).toEqual({});
    else expect(view.markup).not.toContain("Выпуск опубликован атомарно.");
  });
  it("GET retry preserves selected context/configured admin base and drops action notices", async () => {
    vi.stubEnv("ADMIN_BASE_PATH", "/editorial");
    const query = route === "tokens" ? { token: tokenId, layer: "site", target: "site", error: privateError }
      : route === "fonts" ? { override: tokenId, error: privateError } : { set: id, error: privateError };
    const view = await render(route, { rejected: new Set([dependencies[0]]), query });
    expectClosed(view);
    const url = new URL(retryLink(view).attr("href")!, "https://example.org");
    expect(url.pathname).toBe(`/editorial/site-studio/${route}`); expect(url.searchParams.has("error")).toBe(false);
    expect(url.searchParams.get(route === "tokens" ? "token" : route === "fonts" ? "override" : "set")).toBe(route === "releases" ? id : tokenId);
  });
  it("read-only staff stays read-only on complete data", async () => {
    const view = await render(route, { role: "editor" });
    if (route !== "releases") expect(view.workspace.mock.calls[0][0].canManage).toBe(false);
    else expect(view.$("button[type=submit]:not([disabled])").length).toBe(0);
  });
  it("renders missing Supabase dependency with zero reads", async () => { const view = await render(route, { noClient: true }); expect(view.from).not.toHaveBeenCalled(); });
  it("propagates Next search parameter signals", async () => { const signal = new NextSignal("/login"); await expect(render(route, { querySignal: signal })).rejects.toBe(signal); });
  it("propagates auth signals", async () => { const signal = new NextSignal("/login"); await expect(render(route, { authSignal: signal })).rejects.toBe(signal); });
  it("propagates client/auth setup signals", async () => { const signal = new NextSignal("/login"); await expect(render(route, { clientSignal: signal })).rejects.toBe(signal); });
});
describe("M02 Studio exact identities and settings", () => {
  it.each(["fonts", "releases"] as const)("positive first bounded history count cannot become an empty %s history", async (route) => {
    const table = route === "fonts" ? "site_typography_revisions" : "site_design_releases";
    const view = await render(route, { response: { [table]: { data: [], count: 1, error: null } } });
    expectClosed(view);
    expect(view.markup).not.toContain("Публикаций ещё не было.");
  });
  it.each(["fonts", "releases"] as const)("nonempty bounded %s history preserves a larger exact count", async (route) => {
    const table = route === "fonts" ? "site_typography_revisions" : "site_design_releases";
    const rows = route === "fonts" ? [revision] : [release];
    const view = await render(route, { response: { [table]: { data: rows, count: 100, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0);
    if (route === "fonts") expect(view.workspace.mock.calls[0][0].canManage).toBe(true);
    else expect(view.$("form").length).toBeGreaterThan(0);
  });
  it.each([
    { layer: "unsupported" }, { layer: null }, { layer: undefined },
    { targetKey: "wrong site" }, { targetKey: null }, { targetKey: undefined }, { targetKey: "other" },
    { semanticScope: "unsupported" }, { semanticScope: null }, { semanticScope: undefined },
    { breakpoint: "unsupported" }, { breakpoint: null }, { breakpoint: undefined },
  ])("legal revision snapshot with unsupported restore identity %j remains readable and closed", async (patch) => {
    const snapshot = Object.fromEntries(Object.entries({ ...revision.snapshot, ...patch }).filter(([, value]) => value !== undefined));
    const row = { ...revision, snapshot };
    const before = JSON.stringify(row);
    const view = await render("fonts", { response: { site_typography_revisions: { data: [row], count: 1, error: null } } });
    expectClosed(view); expect(view.markup).toContain("publish · 1");
    expect(JSON.stringify(row)).toBe(before);
  });
  it("valid historical restore identity may differ from the current override without rewriting its snapshot", async () => {
    const row = { ...revision, snapshot: { ...revision.snapshot, layer: "component", targetKey: "magazine", semanticScope: "h1", breakpoint: "tablet", opaqueMetadata: ["preserved"] } };
    const before = JSON.stringify(row);
    const view = await render("fonts", { response: { site_typography_revisions: { data: [row], count: 1, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0); expect(view.workspace.mock.calls[0][0].canManage).toBe(true);
    expect(JSON.stringify(row)).toBe(before);
  });
  it("restore identity already held by a different loaded override closes controls", async () => {
    const other = { ...override, id: releaseId, semantic_scope: "h1" };
    const row = { ...revision, snapshot: { ...revision.snapshot, semanticScope: "h1" } };
    const view = await render("fonts", { response: {
      site_typography_overrides: { data: [override, other], count: 2, error: null },
      site_typography_revisions: { data: [row], count: 1, error: null },
    } });
    expectClosed(view); expect(view.markup).toContain("publish · 1");
  });
  it.each([
    { category: "spacing", value_type: "length", draft_value: { value: 2, unit: "rem" } },
    { category: "typography", value_type: "number", draft_value: 1.25 },
    { category: "motion", value_type: "duration", draft_value: 250 },
    { category: "motion", value_type: "easing", draft_value: "ease-in-out" },
    { category: "shadow", value_type: "shadow", draft_value: { x: { value: 0, unit: "px" }, y: { value: 2, unit: "px" }, blur: { value: 4, unit: "px" }, spread: { value: 0, unit: "px" }, color: "#000000", inset: false } },
    { category: "motion", value_type: "effect", draft_value: { name: "reveal-up", durationMs: 250, easing: "ease", reducedMotionFallback: "fade" } },
    { category: "layout", value_type: "layout", draft_value: { display: "grid", columns: 3, gap: { value: 1, unit: "rem" }, maxWidth: { value: 1200, unit: "px" } } },
  ])("keeps supported SQL typed token values %j exactly", async (patch) => {
    const row = { ...token, ...patch }; const before = JSON.stringify(row);
    const view = await render("tokens", { response: { site_design_tokens: { data: [row], count: 1, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0);
    expect((view.workspace.mock.calls[0][0].tokens as { draftValue: unknown }[])[0].draftValue).toEqual(patch.draft_value);
    expect(JSON.stringify(row)).toBe(before);
  });
  it.each([
    { cas_version: null }, { cas_version: "2" }, { cas_version: 0 }, { cas_version: -1 },
    { cas_version: Number.MAX_SAFE_INTEGER + 1 }, { layer: "unknown" }, { category: {} },
    { state: "unknown" }, { value_type: "unknown" }, { updated_at: "invalid" }, { draft_value: undefined },
  ])("rejects malformed token projection %j without silently defaulting", async (patch) => {
    expectClosed(await render("tokens", { response: { site_design_tokens: { data: [{ ...token, ...patch }], count: 1, error: null } } }));
  });
  it("component token without active registered component cannot open editor", async () => {
    expectClosed(await render("tokens", { response: { site_design_tokens: { data: [{ ...token, layer: "component", target_key: "unknown-component" }], count: 1, error: null } } }));
  });
  it.each(["tokens", "fonts"] as const)("missing requested %s identity never turns into a new editor", async (route) => {
    expectClosed(await render(route, { query: route === "tokens" ? { token: releaseId } : { override: releaseId } }));
  });
  it.each([{ unknownStoredKey: "kept" }, { fontSize: "invalid" }, { fontSize: 1000 }, { familyId: id, systemFamily: "georgia" }])("legal SQL object settings %j remain readable without editable fallback", async (draft_settings) => {
    const row = { ...override, draft_settings }; const before = JSON.stringify(row);
    const view = await render("fonts", { response: { site_typography_overrides: { data: [row], count: 1, error: null } } });
    expectClosed(view); expect(view.markup).toContain("site"); expect(JSON.stringify(row)).toBe(before);
  });
  it("accepts supported typography numeric strings without mutating stored representation", async () => {
    const row = { ...override, draft_settings: { familyId: id, fontSize: "16" } }; const before = JSON.stringify(row);
    const view = await render("fonts", { response: { site_typography_overrides: { data: [row], count: 1, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0); expect(view.workspace.mock.calls[0][0].canManage).toBe(true);
    expect(JSON.stringify(row)).toBe(before);
  });
  it.each(["tokens", "fonts"] as const)("resolves requested uppercase SQL UUID to actual %s identity", async (route) => {
    const view = await render(route, { query: route === "tokens" ? { token: tokenId.toUpperCase() } : { override: tokenId.toUpperCase() } });
    expect(view.$('[role="alert"]').length).toBe(0); expect(view.workspace.mock.calls[0][0].selectedId).toBe(tokenId);
  });
  it("missing font family reference blocks current typography editor", async () => {
    expectClosed(await render("fonts", { response: { font_assets: { data: [], count: 0, error: null } } }));
  });
  it("missing revision target blocks restore controls", async () => {
    expectClosed(await render("fonts", { response: { site_typography_overrides: { data: [], count: 0, error: null } } }));
  });
  it("missing release token reference prevents publish and removal controls", async () => {
    expectClosed(await render("releases", { response: { site_design_tokens: { data: [], count: 0, error: null } } }));
  });
  it.each([{ status: "unknown" }, { cas_version: "3" }, { submitted_at: {} }, { description: {} }])("malformed release set %j is not dropped into successful empty state", async (patch) => {
    const view = await render("releases", { response: { site_design_change_sets: { data: [{ ...changeSet, ...patch }], count: 1, error: null } } });
    expectClosed(view); expect(view.markup).not.toContain("Наборов изменений пока нет.");
  });
  it("preserves JSON-null item proposal allowed by SQL", async () => {
    const view = await render("releases", { response: { site_design_change_set_items: { data: [{ ...item, proposed_value: null }], count: 1, error: null } } });
    expect(view.$('[role="alert"]').length).toBe(0); expect(view.$("code").text()).toContain("null");
  });
});
describe("M02 unchanged static Studio navigation boundaries", () => {
  it.each(["page.tsx", "components/page.tsx"])("%s keeps auth and static catalog without database loader", async (relative) => {
    const getStaffSession = vi.fn(async () => ({ role: "editor" }));
    const createServerSupabaseClient = vi.fn();
    const componentStudio = vi.fn(({ role }: { role: string }) => createElement("p", {}, role));
    const module = loadAdminModule(`app/(dashboard)/site-studio/${relative}`, {
      "@/lib/auth": { getStaffSession }, "@/lib/supabase/server": { createServerSupabaseClient },
      "./ComponentStudio": { __esModule: true, default: componentStudio },
      "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", props, children) },
    });
    const page = module.default as () => Promise<ReactNode>;
    const markup = renderToStaticMarkup(await page());
    expect(getStaffSession).toHaveBeenCalledOnce(); expect(createServerSupabaseClient).not.toHaveBeenCalled();
    if (relative === "page.tsx") expect(load(markup)("a").length).toBe(5);
    else expect(componentStudio.mock.calls[0][0].role).toBe("editor");
  });
});
