import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const nextNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(adminRoot, "../..");
const baselineRoot = process.env.M02_CONTROL_FLOW_SOURCE_DIR;
const loadedSources = new Map<string, { source: string; sha256: string }>();
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const beforeManifest = baselineRoot
  ? JSON.parse(readFileSync(path.join(repoRoot, ".tmp/m02-code-fingerprint-before-auth-boundary.json"), "utf8"))
  : null;
const baselineHashes = new Map<string, string>((beforeManifest?.files || []).map((file: { path: string; sha256: string }) => [file.path, file.sha256]));
const sharedBaselineHashes = new Map<string, string>();

// Only the SDK, visual components and React request-cache boundary are synthetic.
// The Auth/read/validation/navigation helpers and routes execute actual source.
function loadModule(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const captured = baselineRoot && path.join(baselineRoot, "apps/admin", relative);
  const source = captured && existsSync(captured) ? captured : filename;
  const bytes = readFileSync(source);
  const logical = "apps/admin/" + relative.replaceAll("\\", "/");
  if (baselineRoot && source === filename) {
    // Sparse captures may reuse a dependency only with an exact pre-step hash.
    let expected = baselineHashes.get(logical) || sharedBaselineHashes.get(logical);
    if (!expected) {
      const headBytes = execFileSync("git", ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "show", `HEAD:${logical}`], { cwd: repoRoot });
      expected = sha256(headBytes);
      sharedBaselineHashes.set(logical, expected);
    }
    if (expected !== sha256(bytes)) throw Error(`Unproven baseline dependency: ${logical}`);
  }
  loadedSources.set(logical, { source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: sha256(bytes) });
  const compiled = ts.transpileModule(readFileSync(source, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  cache.set(filename, module.exports);
  const require = (name: string): any => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const file = [target, target + ".ts", target + ".tsx"].find(candidate => existsSync(candidate));
      if (file) return loadModule(path.relative(adminRoot, file), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

type SignalKind = "redirect" | "notFound";
const signalKinds: SignalKind[] = ["redirect", "notFound"];
function nativeSignal(kind: SignalKind, destination = "/fixture-required") {
  try { if (kind === "redirect") nextNavigation.redirect(destination); else nextNavigation.notFound(); }
  catch (error) { return error; }
  throw Error("The actual Next API did not throw its control-flow signal");
}
function captureSync(operation: () => unknown) {
  try { operation(); } catch (error) { return error; }
  return undefined;
}
async function captureAsync(operation: () => Promise<unknown>) {
  try { await operation(); } catch (error) { return error; }
  return undefined;
}
const secret = "SYNTHETIC_PRIVATE_TOKEN=control-flow-fixture";
const actorId = "33333333-3333-4333-8333-333333333333";
const articleId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const stamp = "2026-09-23T12:00:00.123456+00:00";
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Authored fixture" }] }] };
const article = { id: articleId, title: "Authored fixture", subtitle: "", excerpt: "", slug: "fixture",
  content_html: "<p>Authored fixture</p>", content_json: doc, category_id: categoryId, status: "draft", updated_at: stamp,
  cover_alt: "", cover_external_url: null, cover_media_id: null, sources: [{ text: "https://fixture.invalid/source" }],
  bibliography: [{ text: "Original author source" }], seo_title: null, seo_description: null, seo_keywords: [],
  og_title: null, og_description: null, allow_indexing: true, scheduled_at: null, published_at: null,
  legacy_path: null, canonical_url: null, featured: false, show_on_homepage: false, pinned: false, categories: { name: "Fixture" } };
const english = { ...article, id: "44444444-4444-4444-8444-444444444444", article_id: articleId, locale: "en",
  source_content_hash: null, source_article_updated_at: null, approved_at: null };
const page = { ...article, deleted_at: null };
const staff = { configured: true, role: "owner", user: { id: actorId, email: "fixture@example.invalid" },
  mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false } };
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => {
  if (!process.env.M02_CONTROL_FLOW_METADATA) return;
  writeFileSync(process.env.M02_CONTROL_FLOW_METADATA, JSON.stringify({
    checkedAt: new Date().toISOString(), baselineRoot: baselineRoot || null,
    fixture: { path: "apps/admin/lib/admin-control-flow.integration.test.ts", sha256: sha256(readFileSync(import.meta.filename)) },
    nextVersion: nativeRequire("next/package.json").version,
    actualLoadedSources: Object.fromEntries([...loadedSources].sort(([a], [b]) => a.localeCompare(b))),
    sharedBaselineHeadHashes: Object.fromEntries([...sharedBaselineHashes].sort(([a], [b]) => a.localeCompare(b))),
    scope: "Local actual helper/route execution; synthetic Auth SDK/query data and React cache; no real GoTrue/DB/RLS/network",
  }, null, 2));
});

describe("M02 actual read and guarded Auth control-flow boundaries", () => {
  it.each(signalKinds.flatMap(kind => ["reject", "error"].map(channel => [kind, channel] as const)))("readAdminResult preserves native %s from %s channel", (kind, channel) => {
    const helper = loadModule("lib/admin-read-result.ts", {}), signal = nativeSignal(kind), validate = vi.fn(() => true);
    const result = channel === "reject" ? { status: "rejected", reason: signal } : { status: "fulfilled", value: { data: [], error: signal } };
    expect(captureSync(() => helper.readAdminResult(result, validate))).toBe(signal);
    expect(validate).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });
  it.each(signalKinds.flatMap(kind => ["reject", "error"].map(channel => [kind, channel] as const)))("readAdminList preserves wrapped native %s from %s channel", (kind, channel) => {
    const helper = loadModule("lib/admin-read-result.ts", {}), signal = nativeSignal(kind);
    const wrapped = new Error(secret, { cause: signal });
    const result = channel === "reject" ? { status: "rejected", reason: wrapped } : { status: "fulfilled", value: { data: [], error: wrapped } };
    expect(captureSync(() => helper.readAdminList(result))).toBe(signal);
    expect(errorLog).not.toHaveBeenCalled();
  });
  it("ordinary read failures remain classified and redacted; valid data retains identity", () => {
    const helper = loadModule("lib/admin-read-result.ts", {}), data = [{ title: "Exact authored bytes" }];
    expect(helper.readAdminList({ status: "fulfilled", value: { data, error: null } }).data).toBe(data);
    for (const [code, issue] of [["42501", "permission"], ["42P01", "schema"], ["unknown", "unavailable"]]) {
      const result = helper.readAdminList({ status: "rejected", reason: { code, message: secret } });
      expect(result).toEqual({ status: "failed", issue });
      expect(JSON.stringify(result)).not.toContain(secret);
    }
    expect(helper.readAdminList({ status: "fulfilled", value: { data: null, error: null } })).toEqual({ status: "failed", issue: "invalid" });
  });
  it.each(signalKinds.flatMap(kind => [false, true].map(wrapped => [kind, wrapped] as const)))("guardedAuthRequest preserves native %s rejection (wrapped=%s)", async (kind, wrapped) => {
    const helper = loadModule("lib/auth-service-error.ts", {}), signal = nativeSignal(kind);
    const error = wrapped ? new Error(secret, { cause: signal }) : signal;
    expect(await captureAsync(() => helper.guardedAuthRequest(async () => { throw error; }))).toBe(signal);
    expect(errorLog).not.toHaveBeenCalled();
  });
  it.each(signalKinds.flatMap(kind => [false, true].map(wrapped => [kind, wrapped] as const)))("guardedAuthRequest preserves native %s in a fulfilled SDK error (wrapped=%s)", async (kind, wrapped) => {
    const helper = loadModule("lib/auth-service-error.ts", {}), signal = nativeSignal(kind);
    const error = wrapped ? new Error(secret, { cause: signal }) : signal;
    expect(await captureAsync(() => helper.guardedAuthRequest(async () => ({ data: null, error })))).toBe(signal);
    expect(errorLog).not.toHaveBeenCalled();
  });
  it("guardedAuthRequest preserves ordinary returned errors, safe failure classification and successful SDK identity", async () => {
    const helper = loadModule("lib/auth-service-error.ts", {}), error = new TypeError(secret);
    const failure = await helper.guardedAuthRequest(async () => { throw error; });
    expect(failure.error).toBe(error);
    expect(helper.authServiceError(failure.error)).not.toContain(secret);
    const empty = await helper.guardedAuthRequest(async () => { throw null; });
    expect(helper.authServiceError(empty.error)).toContain("временно недоступен");
    const response = { data: { user: null }, error: { status: 402, message: secret } };
    expect(await helper.guardedAuthRequest(async () => response)).toBe(response);
    helper.logAuthFailure("fixture_check", response.error);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
  });
});

type AuthStage = "user" | "membership" | "mfa";
type ErrorChannel = "reject" | "error";
function authFixture(stage?: AuthStage, channel: ErrorChannel = "reject", failure?: unknown,
  assurance = { currentLevel: "aal2", nextLevel: "aal2" }) {
  const calls: string[] = [];
  const respond = async (name: AuthStage, data: unknown) => {
    calls.push(name);
    if (stage === name && channel === "reject") throw failure;
    return { data, error: stage === name ? failure : null };
  };
  const query: any = { select: () => query, eq: () => query, maybeSingle: () => respond("membership", { role: "owner" }) };
  const supabase = { auth: { getUser: () => respond("user", { user: staff.user }),
    mfa: { getAuthenticatorAssuranceLevel: () => respond("mfa", assurance) } }, from: vi.fn(() => query) };
  const shell = (props: { children: ReactNode }) => createElement("section", { "data-actual-layout-authorized": true }, props.children);
  const mocks = { react: { ...nativeRequire("react"), cache: (callback: unknown) => callback },
    "@/lib/env": { isSupabaseConfigured: true, adminEnv: { publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => supabase },
    "@/components/AdminShell": { __esModule: true, default: shell },
    "@/app/(auth)/login/actions": { logoutAction: vi.fn() } };
  const cache = new Map<string, any>();
  return { auth: loadModule("lib/auth.ts", mocks, cache),
    layout: () => loadModule("app/(dashboard)/layout.tsx", mocks, cache).default({ children: createElement("b", {}, "Authored child") }), calls };
}
describe("M02 actual staff-session and DashboardLayout boundaries", () => {
  for (const stage of ["user", "membership", "mfa"] as AuthStage[]) {
    for (const channel of ["reject", "error"] as ErrorChannel[]) {
      it.each(signalKinds)(`${stage} ${channel} preserves native %s before session fallback/logging`, async kind => {
        const signal = nativeSignal(kind), fixture = authFixture(stage, channel, signal);
        expect(await captureAsync(() => fixture.auth.getStaffSession())).toBe(signal);
        expect(fixture.calls).toEqual(["user", "membership", "mfa"].slice(0, ["user", "membership", "mfa"].indexOf(stage) + 1));
        expect(errorLog).not.toHaveBeenCalled();
      });
    }
  }
  it.each(signalKinds)("MFA nested and outer catches preserve wrapped native %s identity", async kind => {
    const signal = nativeSignal(kind), fixture = authFixture("mfa", "reject", new Error(secret, { cause: signal }));
    expect(await captureAsync(() => fixture.auth.getStaffSession())).toBe(signal);
    expect(errorLog).not.toHaveBeenCalled();
  });
  it.each(["user", "membership", "mfa"] as AuthStage[])("ordinary %s outage remains fail-closed and redacted", async stage => {
    const fixture = authFixture(stage, "reject", new TypeError(secret));
    expect(await fixture.auth.requireStaff()).toBeNull();
    expect(JSON.stringify(await fixture.auth.getStaffSession())).not.toContain(secret);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
  });
  it("actual aal2 staff authorization passes actual DashboardLayout and preserves children", async () => {
    const fixture = authFixture(), tree = await fixture.layout();
    expect(tree.props.session).toMatchObject({ role: "owner", user: staff.user, mfa: { required: false } });
    expect(renderToStaticMarkup(tree)).toContain("Authored child");
    expect(errorLog).not.toHaveBeenCalled();
  });
  it("actual aal1/aal2 MFA policy redirects through actual DashboardLayout before children", async () => {
    const fixture = authFixture(undefined, "reject", undefined, { currentLevel: "aal1", nextLevel: "aal2" });
    const expected = nativeSignal("redirect", "/mfa") as { digest: string };
    expect(await captureAsync(fixture.layout)).toMatchObject({ digest: expected.digest });
    expect(errorLog).not.toHaveBeenCalled();
  });
  it("ordinary MFA outage reaches the safe actual layout login redirect without provider content", async () => {
    const fixture = authFixture("mfa", "reject", new TypeError(secret));
    const session = await fixture.auth.getStaffSession();
    const expected = nativeSignal("redirect", `/login?error=${encodeURIComponent(session.mfa.checkError)}`) as { digest: string };
    const result = await captureAsync(fixture.layout);
    expect(result).toMatchObject({ digest: expected.digest });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
  });
  it.each(signalKinds)("actual Auth-to-layout chain preserves SDK %s instead of substituting login", async kind => {
    const signal = nativeSignal(kind), fixture = authFixture("user", "reject", signal);
    expect(await captureAsync(fixture.layout)).toBe(signal);
    expect(errorLog).not.toHaveBeenCalled();
  });
});

type RouteKind = "article-edit" | "article-new" | "article-copy" | "article-preview" | "page-edit" | "page-preview" | "settings";
type Override = { channel: ErrorChannel; failure: unknown } | { data: unknown };
const routeFiles: Record<RouteKind, string> = {
  "article-edit": "app/(dashboard)/articles/[id]/page.tsx", "article-new": "app/(dashboard)/articles/new/page.tsx",
  "article-copy": "app/(dashboard)/articles/new/page.tsx", "article-preview": "app/(dashboard)/articles/[id]/preview/page.tsx",
  "page-edit": "app/(dashboard)/pages/[id]/page.tsx", "page-preview": "app/(dashboard)/pages/[id]/preview/page.tsx",
  settings: "app/(dashboard)/settings/page.tsx" };
function routeFixture(kind: RouteKind, overrides: Record<string, Override> = {}) {
  const reads: string[] = [], actions = vi.fn(() => { throw Error("Read-only route fixture attempted a write"); });
  const values: Record<string, unknown> = { article, sourceArticle: article, english, sourceEnglish: english,
    categories: [{ id: categoryId, name: "Fixture", slug: "fixture" }],
    revisions: [{ id: "revision1", revision_number: 1, created_at: stamp, change_summary: "Fixture", changed_by: actorId }],
    templates: [{ id: "template1", label: "Fixture", content_html: "<p>Fixture</p>", visibility: "personal", owner_id: actorId }],
    workingDraft: null, copyOptions: [{ id: articleId, title: article.title, status: "draft", updated_at: stamp }],
    socialRequests: [{ id: "request1", created_at: stamp, metadata: { article_id: articleId } }], socialResults: [], page,
    pageRevisions: [{ id: 1, page_id: articleId, revision_number: 1, created_at: stamp }],
    staffList: [{ user_id: actorId, role: "owner", created_at: stamp }] };
  const from = (table: string) => {
    let columns = "", filters: Array<[string, unknown]> = [];
    const query: any = {
      select: (value: string) => { columns = value; return query; },
      eq: (field: string, value: unknown) => { filters.push([field, value]); return query; },
      is: () => query, order: () => query, limit: () => query, contains: () => query, in: () => query,
      maybeSingle: () => query, range: () => query,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        const target = table === "articles" ? (filters.some(([field]) => field === "id") ? (kind === "article-copy" ? "sourceArticle" : "article") : "copyOptions")
          : table === "article_translations" ? (kind === "article-copy" ? "sourceEnglish" : "english")
          : table === "article_revisions" ? "revisions" : table === "editor_templates" ? "templates"
          : table === "article_working_drafts" ? "workingDraft" : table === "admin_audit_log"
            ? (filters.some(([field, value]) => field === "action" && value === "social_publish.requested") ? "socialRequests" : "socialResults")
            : table === "pages" ? "page" : table === "page_revisions" ? "pageRevisions" : table === "staff_memberships" ? "staffList" : table;
        if (!Object.hasOwn(values, target)) throw Error(`Unexpected synthetic read ${table}:${columns}`);
        reads.push(target);
        const override = overrides[target];
        if (override && "channel" in override && override.channel === "reject") throw override.failure;
        return { data: override && "data" in override ? override.data : values[target],
          error: override && "channel" in override ? override.failure : null, count: target === "pageRevisions" ? 1 : undefined };
      }).then(resolve, reject),
    };
    return query;
  };
  const Boundary = (props: { current: unknown; fallback?: ReactNode; before?: ReactNode; after?: ReactNode }) =>
    props.current ? createElement(Fragment, {}, props.before, createElement("div", { "data-fixture-editor": true }), props.after) : props.fallback;
  const Visual = ({ children }: { children?: ReactNode }) => createElement("span", {}, children);
  const actionModule = { duplicateArticleAction: actions, discardArticleWorkingDraftAction: actions, requestSocialPublicationAction: actions,
    restoreArticleRevisionAction: actions, softDeleteArticleAction: actions, restorePageRevisionAction: actions, softDeletePageAction: actions,
    removeStaffMemberAction: actions, saveStaffMemberAction: actions };
  const mocks = { "@/lib/auth": { getStaffSession: async () => staff },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from, rpc: actions }) },
    "next/link": { __esModule: true, default: ({ children, ...props }: any) => createElement("a", props, children) },
    "@/components/ArticleEditorLoader": { __esModule: true, default: Boundary },
    "@/components/PageEditorLoader": { __esModule: true, default: Boundary },
    "@/components/ArticleCopyPicker": { __esModule: true, default: Visual },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: Visual },
    "@/components/AdminMfaSettingsLoader": { __esModule: true, default: Visual },
    "@/components/EditorialPreviewFonts": { editorialPreviewFonts: "fixture-fonts" },
    "@/components/EditorialPreview.module.css": { __esModule: true, default: {} },
    "../actions": actionModule, "./actions": actionModule };
  const Page = loadModule(routeFiles[kind], mocks).default;
  const render = async () => {
    const result = await Page({ params: Promise.resolve({ id: articleId }),
      searchParams: Promise.resolve(kind === "article-copy" ? { copyFrom: articleId } : {}) });
    expect(actions).not.toHaveBeenCalled();
    return result;
  };
  return { render, reads, actions };
}
const routeReadTargets: Array<[RouteKind, string]> = [
  ...["article", "english", "categories", "revisions", "templates", "workingDraft", "socialRequests", "socialResults"].map(target => ["article-edit", target] as [RouteKind, string]),
  ...["categories", "templates", "copyOptions"].map(target => ["article-new", target] as [RouteKind, string]),
  ["article-copy", "sourceArticle"], ["article-copy", "sourceEnglish"],
  ...["article", "english", "workingDraft", "categories"].map(target => ["article-preview", target] as [RouteKind, string]),
  ["page-edit", "page"], ["page-edit", "pageRevisions"], ["page-preview", "page"], ["settings", "staffList"],
];
describe("M02 actual Article/Page/settings query control-flow propagation", () => {
  for (const [kind, target] of routeReadTargets) {
    it.each(signalKinds)(`${kind} ${target} query rejection preserves native %s identity`, async signalKind => {
      const signal = nativeSignal(signalKind), fixture = routeFixture(kind, { [target]: { channel: "reject", failure: signal } });
      expect(await captureAsync(fixture.render)).toBe(signal);
      expect(fixture.reads).toContain(target);
      expect(fixture.actions).not.toHaveBeenCalled();
      expect(errorLog).not.toHaveBeenCalled();
    });
  }
  for (const [kind, target] of [["article-edit", "templates"], ["page-edit", "pageRevisions"], ["settings", "staffList"]] as Array<[RouteKind, string]>) {
    it.each(signalKinds)(`${kind} ${target} fulfilled error preserves wrapped native %s`, async signalKind => {
      const signal = nativeSignal(signalKind), fixture = routeFixture(kind,
        { [target]: { channel: "error", failure: new Error(secret, { cause: signal }) } });
      expect(await captureAsync(fixture.render)).toBe(signal);
      expect(fixture.reads).toContain(target);
      expect(errorLog).not.toHaveBeenCalled();
    });
  }
  for (const [kind, primary, later] of [["article-edit", "article", "templates"], ["article-new", "categories", "templates"],
    ["article-preview", "article", "english"], ["page-edit", "page", "pageRevisions"]] as Array<[RouteKind, string, string]>) {
    it.each(signalKinds)(`${kind} ordinary primary failure cannot hide later %s`, async signalKind => {
      const signal = nativeSignal(signalKind), fixture = routeFixture(kind, {
        [primary]: { channel: "error", failure: { code: "42501", message: secret } },
        [later]: { channel: "reject", failure: signal } });
      expect(await captureAsync(fixture.render)).toBe(signal);
      expect(fixture.reads).toEqual(expect.arrayContaining([primary, later]));
      expect(errorLog).not.toHaveBeenCalled();
    });
  }
  it.each(["article-edit", "article-preview", "page-edit"] as RouteKind[])("%s null primary cannot replace a later actual redirect with notFound", async kind => {
    const primary = kind === "page-edit" ? "page" : "article", later = kind === "page-edit" ? "pageRevisions" : "english";
    const signal = nativeSignal("redirect"), fixture = routeFixture(kind, {
      [primary]: { data: null }, [later]: { channel: "error", failure: signal } });
    expect(await captureAsync(fixture.render)).toBe(signal);
  });
  it.each(Object.keys(routeFiles) as RouteKind[])("%s successful reads keep the existing form/preview without writes", async kind => {
    const fixture = routeFixture(kind), tree = await fixture.render();
    const markup = renderToStaticMarkup(tree);
    expect(markup.length).toBeGreaterThan(0);
    if (["article-edit", "article-new", "article-copy", "page-edit"].includes(kind)) expect(tree.props.current).not.toBeNull();
    expect(fixture.actions).not.toHaveBeenCalled();
    // React 18's static renderer may warn on a Next server-action form prop.
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
  });
  it.each(["article-edit", "article-preview", "page-edit", "page-preview", "settings"] as RouteKind[])("%s ordinary critical read error stays safe and redacted", async kind => {
    const target = kind === "settings" ? "staffList" : kind.startsWith("page") ? "page" : "article";
    const fixture = routeFixture(kind, { [target]: { channel: "error", failure: { code: "42501", message: secret } } });
    const markup = renderToStaticMarkup(await fixture.render());
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain(secret);
    expect(markup).not.toContain("data-fixture-editor");
    expect(fixture.actions).not.toHaveBeenCalled();
  });
  it.each([["article-edit", "templates"], ["page-edit", "pageRevisions"]] as Array<[RouteKind, string]>)("%s ordinary optional %s failure preserves the editor", async (kind, target) => {
    const fixture = routeFixture(kind, { [target]: { channel: "reject", failure: new Error(secret) } });
    const tree = await fixture.render();
    expect(tree.props.current).not.toBeNull();
    expect(renderToStaticMarkup(tree)).not.toContain(secret);
    expect(fixture.actions).not.toHaveBeenCalled();
  });
});
