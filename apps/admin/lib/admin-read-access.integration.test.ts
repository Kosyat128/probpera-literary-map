import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const navigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(adminRoot, "../..");
const beforeRoot = process.env.M02_READ_ACCESS_SOURCE_DIR;
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const loadedSources = new Map<string, { source: string; sha256: string }>();
const sharedHeadHashes = new Map<string, string>();
const beforeHashes = beforeRoot ? new Map<string, string>(JSON.parse(readFileSync(
  path.join(repoRoot, ".tmp/m02-code-fingerprint-before-read-access.json"), "utf8"))
  .files.map((file: { path: string; sha256: string }) => [file.path, file.sha256])) : new Map<string, string>();

// Auth, navigation, access/read/validation helpers and routes are actual modules.
// Only SDK/query results, React request-cache, visual components and actions are fixtures.
function loadModule(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const captured = beforeRoot && path.join(beforeRoot, "apps/admin", relative);
  const source = captured && existsSync(captured) ? captured : filename;
  const bytes = readFileSync(source), logical = "apps/admin/" + relative.replaceAll("\\", "/");
  if (beforeRoot && source === filename) {
    let expected = beforeHashes.get(logical) || sharedHeadHashes.get(logical);
    if (!expected) {
      expected = hash(execFileSync("git", ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "show", `HEAD:${logical}`], { cwd: repoRoot }));
      sharedHeadHashes.set(logical, expected);
    }
    if (expected !== hash(bytes)) throw Error(`Unproven read-access baseline dependency: ${logical}`);
  }
  loadedSources.set(logical, { source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: hash(bytes) });
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

type Role = "owner" | "admin" | "editor";
type Route = "article-edit" | "article-new" | "article-copy" | "article-preview" | "page-edit" | "page-preview";
type Denial = "configured-false" | "missing-user" | "missing-role" | "unknown-role" | "auth-error" | "membership-error" | "mfa-required" | "mfa-error";
const routes: Route[] = ["article-edit", "article-new", "article-copy", "article-preview", "page-edit", "page-preview"];
const roles: Role[] = ["owner", "admin", "editor"];
const denials: Denial[] = ["configured-false", "missing-user", "missing-role", "unknown-role", "auth-error", "membership-error", "mfa-required", "mfa-error"];
const routeSources: Record<Route, string> = {
  "article-edit": "app/(dashboard)/articles/[id]/page.tsx", "article-new": "app/(dashboard)/articles/new/page.tsx",
  "article-copy": "app/(dashboard)/articles/new/page.tsx", "article-preview": "app/(dashboard)/articles/[id]/preview/page.tsx",
  "page-edit": "app/(dashboard)/pages/[id]/page.tsx", "page-preview": "app/(dashboard)/pages/[id]/preview/page.tsx",
};
const actorId = "33333333-3333-4333-8333-333333333333", articleId = "11111111-1111-4111-8111-111111111111";
const englishId = "44444444-4444-4444-8444-444444444444", categoryId = "22222222-2222-4222-8222-222222222222";
const stamp = "2026-10-07T12:00:00.123456+00:00";
const privateTitle = "PRIVATE_SYNTHETIC_AUTHOR_TITLE_A", privateText = "PRIVATE_SYNTHETIC_RU_AUTHOR_TEXT_A";
const privateEnglish = "PRIVATE_SYNTHETIC_EN_AUTHOR_TEXT_A", privateRights = "PRIVATE_SYNTHETIC_AUTHOR_RIGHTS_A";
const providerSecret = "SYNTHETIC_PROVIDER_TOKEN=read-access-fixture";
const sources = [{ text: "https://fixture.invalid/private-author-source?a=1&b=2" }];
const document = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
function articleFixture(status = "draft") {
  return { id: articleId, title: privateTitle, subtitle: "Manual subtitle", excerpt: "Manual excerpt", slug: "private-author-a",
    content_html: `<p>${privateText}</p><p>${privateRights}</p>`, content_json: document(privateText),
    category_id: categoryId, categories: { name: "Manual category" }, status, updated_at: stamp,
    scheduled_at: status === "scheduled" ? "2027-01-01T10:00:00Z" : null,
    published_at: status === "published" ? "2026-10-01T10:00:00Z" : null,
    cover_alt: privateRights, cover_external_url: "https://fixture.invalid/private-author-cover.jpg", cover_media_id: null,
    sources, bibliography: [{ text: privateRights }], seo_title: "Manual SEO title", seo_description: "Manual description",
    seo_keywords: ["Manual keyword"], og_title: null, og_description: null, canonical_url: null, legacy_path: null,
    allow_indexing: true, featured: false, show_on_homepage: false, pinned: true };
}
function nativeSignal(kind: "redirect" | "notFound", destination = "/fixture-required") {
  try { if (kind === "redirect") navigation.redirect(destination); else navigation.notFound(); }
  catch (error) { return error; }
  throw Error("The actual Next public API did not throw");
}
async function resultOf(operation: () => Promise<any>) {
  try { return { tree: await operation(), error: undefined }; }
  catch (error) { return { tree: undefined, error }; }
}
function stringsIn(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap(item => stringsIn(item, seen));
  return Object.values(value).flatMap(item => stringsIn(item, seen));
}
let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined); });
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => {
  if (!process.env.M02_READ_ACCESS_METADATA) return;
  writeFileSync(process.env.M02_READ_ACCESS_METADATA, JSON.stringify({
    checkedAt: new Date().toISOString(), baselineRoot: beforeRoot || null,
    fixture: { path: "apps/admin/lib/admin-read-access.integration.test.ts", sha256: hash(readFileSync(import.meta.filename)) },
    nextVersion: nativeRequire("next/package.json").version,
    actualLoadedSources: Object.fromEntries([...loadedSources].sort(([a], [b]) => a.localeCompare(b))),
    sharedBaselineHeadHashes: Object.fromEntries([...sharedHeadHashes].sort(([a], [b]) => a.localeCompare(b))),
    scope: "Actual local Auth/routes/access/read/validation helpers and installed Next signals; SDK/database/query/cache/visual/action boundaries synthetic. No GoTrue/real DB/RLS/production claim.",
  }, null, 2));
});

type Options = { role?: Role; denial?: Denial; status?: string; queryError?: string;
  sdkSignal?: { stage: "user" | "mfa"; error: unknown }; unenrolledMfa?: boolean };
function fixture(route: Route, options: Options = {}) {
  const role = options.role || "owner", entityReads: string[] = [], events: string[] = [], parameterReads: string[] = [];
  const actor = { id: actorId, email: "fixture@example.invalid" };
  const article = articleFixture(options.status), english = { ...article, id: englishId, article_id: articleId, locale: "en",
    title: privateEnglish, content_html: `<p>${privateEnglish}</p><p>${privateRights}</p>`, content_json: document(privateEnglish),
    status: "draft", source_content_hash: null, source_article_updated_at: null, approved_at: null };
  const page = { ...article, status: options.status || "draft", deleted_at: null };
  const values: Record<string, unknown> = { articles: article, article_translations: english,
    categories: [{ id: categoryId, name: "Manual category", slug: "manual-category" }], article_working_drafts: null,
    article_revisions: [], editor_templates: [], admin_audit_log: [], pages: page, page_revisions: [] };
  const sdkError = new TypeError(providerSecret);
  const getUser = async () => {
    events.push("auth:user");
    if (options.sdkSignal?.stage === "user") throw options.sdkSignal.error;
    return { data: { user: options.denial === "missing-user" ? null : actor },
      error: options.denial === "auth-error" ? { status: 402, message: providerSecret } : null };
  };
  const getAssurance = async () => {
    events.push("auth:mfa");
    if (options.sdkSignal?.stage === "mfa") throw options.sdkSignal.error;
    return { data: { currentLevel: options.denial === "mfa-required" || options.unenrolledMfa ? "aal1" : "aal2",
      nextLevel: options.unenrolledMfa ? "aal1" : "aal2" }, error: options.denial === "mfa-error" ? sdkError : null };
  };
  const from = (table: string) => {
    if (table !== "staff_memberships") { entityReads.push(table); events.push(`private:${table}`); }
    let columns = "", filters: Array<[string, unknown]> = [];
    const query: any = { select: (value: string) => { columns = value; return query; },
      eq: (field: string, value: unknown) => { filters.push([field, value]); return query; },
      is: () => query, order: () => query, limit: () => query, contains: () => query, in: () => query,
      maybeSingle: () => query, range: () => query,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        if (table === "staff_memberships") {
          events.push("auth:membership");
          return { data: options.denial === "missing-role" ? null : { role: options.denial === "unknown-role" ? "community_reader" : role },
            error: options.denial === "membership-error" ? { code: "42501", message: providerSecret } : null };
        }
        if (!Object.hasOwn(values, table)) throw Error(`Unexpected synthetic entity read ${table}:${columns}`);
        const data = table === "articles" && !filters.some(([field]) => field === "id")
          ? [{ id: articleId, title: privateTitle, status: article.status, updated_at: stamp }] : values[table];
        return { data, error: table === options.queryError ? { code: "42501", message: providerSecret } : null,
          count: table === "page_revisions" ? 0 : undefined };
      }).then(resolve, reject) };
    return query;
  };
  const action = vi.fn(() => { throw Error("Read-access fixture attempted a write"); });
  const supabase = { auth: { getUser, mfa: { getAuthenticatorAssuranceLevel: getAssurance } }, from, rpc: action };
  const clientFactory = async () => { events.push("client"); return options.denial === "configured-false" ? null : supabase; };
  const Boundary = (props: { current: unknown; fallback?: ReactNode; before?: ReactNode; after?: ReactNode }) =>
    props.current ? createElement(Fragment, {}, props.before, createElement("div", { "data-private-editor": true }), props.after) : props.fallback;
  const Visual = ({ children }: { children?: ReactNode }) => createElement("span", {}, children);
  const actionModule = { duplicateArticleAction: action, discardArticleWorkingDraftAction: action, requestSocialPublicationAction: action,
    restoreArticleRevisionAction: action, softDeleteArticleAction: action, restorePageRevisionAction: action, softDeletePageAction: action };
  const mocks = { react: { ...nativeRequire("react"), cache: (callback: unknown) => callback },
    "@/lib/env": { isSupabaseConfigured: options.denial !== "configured-false", adminEnv: { publicSiteUrl: "https://fixture.invalid" } },
    "@/lib/supabase/server": { createServerSupabaseClient: clientFactory },
    "next/link": { __esModule: true, default: ({ children, ...props }: any) => createElement("a", props, children) },
    "@/components/ArticleEditorLoader": { __esModule: true, default: Boundary },
    "@/components/PageEditorLoader": { __esModule: true, default: Boundary },
    "@/components/ArticleCopyPicker": { __esModule: true, default: Visual },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: Visual },
    "@/components/EditorialPreviewFonts": { editorialPreviewFonts: "fixture-fonts" },
    "@/components/EditorialPreview.module.css": { __esModule: true, default: {} }, "../actions": actionModule };
  const cache = new Map<string, any>();
  // Preload, without invoking, actual Auth so its source is evidenced for every variant.
  loadModule("lib/auth.ts", mocks, cache);
  const Page = loadModule(routeSources[route], mocks, cache).default;
  const parameter = (name: string, value: unknown) => ({ then: (resolve: (value: unknown) => unknown) => {
    parameterReads.push(name); events.push(`parameter:${name}`); return Promise.resolve(resolve(value)); } });
  const render = async () => {
    const tree = await Page({ params: parameter("params", { id: articleId }),
      searchParams: parameter("searchParams", route === "article-copy" ? { copyFrom: articleId } : {}) });
    expect(action).not.toHaveBeenCalled();
    return tree;
  };
  const redirectForDenial = options.denial === "missing-user" || options.denial === "auth-error" ? "/login"
    : options.denial === "mfa-required" ? "/mfa" : options.denial === "mfa-error"
      ? `/login?error=${encodeURIComponent(loadModule("lib/auth-service-error.ts", mocks, cache).authServiceError(sdkError))}` : null;
  return { render, entityReads, parameterReads, events, action, article, english, page, Boundary, redirectForDenial };
}

describe("M02 actual Auth guard precedes private Article/Page reads", () => {
  for (const route of routes) {
    it.each(denials)(`${route} %s denies before entity queries, identity props and route inputs`, async denial => {
      const view = fixture(route, { denial }), result = await resultOf(view.render);
      expect(view.entityReads).toEqual([]);
      expect(view.parameterReads).toEqual([]);
      expect(view.action).not.toHaveBeenCalled();
      if (view.redirectForDenial) {
        expect(result.tree).toBeUndefined();
        expect(result.error).toMatchObject({ digest: (nativeSignal("redirect", view.redirectForDenial) as { digest: string }).digest });
      } else {
        expect(result.error).toBeUndefined();
        expect(result.tree).toBeDefined();
        expect(result.tree.type).not.toBe(view.Boundary);
        expect(result.tree.props).not.toHaveProperty("actorId");
        expect(result.tree.props).not.toHaveProperty("current");
        expect(result.tree.props).not.toHaveProperty("pageId");
      }
      const rendered = result.tree ? renderToStaticMarkup(result.tree) : "";
      const exposed = stringsIn(result.tree).join("\n") + rendered + JSON.stringify(result.error);
      for (const authored of [privateTitle, privateText, privateEnglish, privateRights, actorId, providerSecret, sources[0].text]) expect(exposed).not.toContain(authored);
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(providerSecret);
    });
    it.each(roles)(`${route} actual %s session permits unchanged authored reads`, async role => {
      const view = fixture(route, { role }), tree = await view.render();
      expect(view.entityReads.length).toBeGreaterThan(0);
      const firstPrivate = view.events.findIndex(event => event.startsWith("private:"));
      expect(view.events.indexOf("auth:mfa")).toBeGreaterThanOrEqual(0);
      expect(view.events.indexOf("auth:mfa")).toBeLessThan(firstPrivate);
      expect(view.action).not.toHaveBeenCalled();
      if (route.endsWith("preview")) {
        const markup = renderToStaticMarkup(tree);
        expect(markup).toContain(privateTitle);
        expect(markup).toContain(privateText);
        expect(markup).toContain(privateRights);
      } else {
        expect(tree.props.current).not.toBeNull();
        expect(tree.props.current.actorId).toBe(actorId);
        if (route === "article-new") expect(tree.props.current.article.status).toBe("draft");
        else if (route === "page-edit") {
          expect(tree.props.current.page).toEqual(view.page);
          expect(tree.props.pageId).toBe(articleId);
        } else {
          expect(tree.props.current.article).toMatchObject({ title: privateTitle, content_html: view.article.content_html,
            content_json: view.article.content_json, sources, bibliography: view.article.bibliography, cover_alt: privateRights });
          expect(tree.props.current.englishTranslation).toMatchObject({ title: privateEnglish, content_json: view.english.content_json });
          if (route === "article-edit") expect(tree.props.current.article.id).toBe(articleId);
          else expect(tree.props.current.article).not.toHaveProperty("id");
        }
      }
    });
  }
  it("existing aal1/aal1 staff policy remains allowed without inventing compulsory enrollment", async () => {
    const view = fixture("page-edit", { role: "editor", unenrolledMfa: true }), tree = await view.render();
    expect(tree.props.current.page).toEqual(view.page);
    expect(view.entityReads).toContain("pages");
  });
});

describe("M02 allowed read failures/statuses remain compatible after authorization", () => {
  it.each(routes)("%s ordinary mandatory failure keeps safe read UI without provider text", async route => {
    const queryError = route === "article-new" ? "categories" : route.startsWith("page") ? "pages" : "articles";
    const view = fixture(route, { queryError }), tree = await view.render(), markup = renderToStaticMarkup(tree);
    expect(view.entityReads).toContain(queryError);
    expect(markup).toContain('role="alert"');
    for (const authored of [privateTitle, privateText, privateEnglish, privateRights, providerSecret]) expect(markup).not.toContain(authored);
    expect(view.action).not.toHaveBeenCalled();
  });
  it.each([["article-edit", "editor_templates"], ["page-edit", "page_revisions"]] as Array<[Route, string]>)("%s ordinary optional %s failure preserves the editor", async (route, queryError) => {
    const view = fixture(route, { queryError }), tree = await view.render();
    expect(tree.props.current).not.toBeNull();
    expect(renderToStaticMarkup(tree)).not.toContain(providerSecret);
    expect(view.action).not.toHaveBeenCalled();
  });
  it.each(["draft", "review", "scheduled", "published", "hidden", "archived"])("allowed Article preview retains %s canonical status/body", async status => {
    const view = fixture("article-preview", { status }), markup = renderToStaticMarkup(await view.render());
    expect(markup).toContain(status);
    expect(markup).toContain(privateText);
    expect(markup).toContain(privateRights);
    expect(view.article.status).toBe(status);
    expect(view.action).not.toHaveBeenCalled();
  });
  it.each(["draft", "published", "hidden"])("allowed Page preview retains existing %s status/body", async status => {
    const view = fixture("page-preview", { status }), markup = renderToStaticMarkup(await view.render());
    expect(markup).toContain(status);
    expect(markup).toContain(privateText);
    expect(markup).toContain(privateRights);
    expect(view.page.status).toBe(status);
    expect(view.action).not.toHaveBeenCalled();
  });
});

describe("M02 read authorization preserves actual Next control flow", () => {
  for (const route of ["article-edit", "page-preview"] as Route[]) {
    for (const stage of ["user", "mfa"] as const) {
      it.each(["redirect", "notFound"] as const)(`${route} SDK ${stage} native %s propagates before entity/input access`, async kind => {
        const signal = nativeSignal(kind), error = stage === "mfa" ? new Error(providerSecret, { cause: signal }) : signal;
        const view = fixture(route, { sdkSignal: { stage, error } }), result = await resultOf(view.render);
        expect(result.error).toBe(signal);
        expect(result.tree).toBeUndefined();
        expect(view.entityReads).toEqual([]);
        expect(view.parameterReads).toEqual([]);
        expect(view.action).not.toHaveBeenCalled();
        expect(errorLog).not.toHaveBeenCalled();
      });
    }
  }
});
