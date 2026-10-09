import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load as html } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url), nativeNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../.."), repoRoot = path.resolve(adminRoot, "../..");
type Row = Record<string, any>;
const graph = new Map<string, { file: string; source: string; sha256: string }>(), traces: Row[] = [];
function actualModules(mocks: Row) {
  const cache = new Map<string, Row>();
  function load(relative: string): Row {
    const filename = path.join(adminRoot, relative);
    if (cache.has(filename)) return cache.get(filename)!;
    const before = process.env.M07_REVIEW_IDENTITY_BASELINE_ROOT;
    const captured = before && path.join(before, "apps/admin", relative);
    const source = captured && existsSync(captured) ? captured : filename;
    const bytes = readFileSync(source);
    graph.set(filename, { file: path.relative(repoRoot, filename).replaceAll("\\", "/"),
      source: path.relative(repoRoot, source).replaceAll("\\", "/"), sha256: createHash("sha256").update(bytes).digest("hex") });
    const module = { exports: {} as Row }; cache.set(filename, module.exports);
    const compiled = ts.transpileModule(bytes.toString(), { fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const require = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (target) for (const extension of ["", ".ts", ".tsx"]) if (existsSync(target + extension)) return load(path.relative(adminRoot, target + extension));
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    cache.set(filename, module.exports); return module.exports;
  }
  return { load };
}

const articleId = "11111111-1111-4111-8111-111111111111", englishId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333", reviewerId = "44444444-4444-4444-8444-444444444444";
const approverId = "55555555-5555-4555-8555-555555555555", actorId = "66666666-6666-4666-8666-666666666666";
const ruRevision = "2026-10-08T12:00:00.123456+03:00", enRevision = "2026-10-07T12:00:00.654321+03:00";
const reviewedAt = "2026-10-06T12:00:00.123456+03:00", approvedAt = "2026-10-06T13:00:00.654321+03:00";
const document = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  authorMetadata: { permission: "Exact author licence \u2014 CC BY", source: "https://source.invalid/author" } });
const ruPayload = {
  title: "  Авторский RU \u2014 точный текст  ", subtitle: "  Авторский подзаголовок  ", excerpt: "Первая строка.\nВторая строка.", slug: "authored-ru",
  content_html: "<p>Авторский RU&nbsp;\u2014 café.</p>\n<p>Вторая строка.</p>", content_json: document("Авторский RU \u2014 точный текст"),
  category_id: categoryId, status: "draft", scheduled_at: null, published_at: null, cover_external_url: "https://image.invalid/ru",
  cover_alt: "  Авторские права на изображение  ", legacy_path: "/legacy/author", seo_title: "Авторский поиск", seo_description: "Авторское описание",
  seo_keywords: ["автор", "литература"], canonical_url: "https://site.invalid/authored-ru", og_title: "Авторская карточка", og_description: "Точное описание",
  allow_indexing: true, sources: [{ text: "  https://source.invalid/ru?one=1&two=2  " }], bibliography: [{ text: "Русская библиография.  Два пробела." }],
  featured: true, show_on_homepage: false, pinned: true,
};
const enPayload = {
  title: "  Private English \u2014 exact authored text  ", subtitle: "  Exact English subtitle  ", excerpt: "First line.\nSecond line.",
  content_html: "<p>Private English&nbsp;\u2014 café.</p>\n<p>Second line.</p>", content_json: document("Private English \u2014 exact authored text"),
  cover_alt: "  Exact English image permission  ", slug: "private-english", sources: [{ text: "  https://source.invalid/en?one=1&two=2  " }],
  bibliography: [{ text: "English bibliography.  Two spaces." }], seo_title: "Exact English search", seo_description: "Exact English description",
  seo_keywords: ["author", "literature"], canonical_url: "https://site.invalid/en/private-english", og_title: "Exact English card", og_description: "Exact card description",
  status: "draft", source_content_hash: "a".repeat(64), reviewed_at: null, approved_at: null, published_at: null, deleted_at: null,
};
const liveArticle = { ...ruPayload, id: articleId, status: "published", updated_at: ruRevision, published_at: ruRevision,
  cover_media_id: null, categories: { name: "Авторская рубрика", slug: "authored" }, created_by: actorId, updated_by: actorId,
  rights: { holder: "Original RU author", licence: "Exact author licence \u2014 CC BY" } };
const liveEnglish = { ...enPayload, id: englishId, article_id: articleId, locale: "en", title: "Original canonical English \u2014 human reviewed",
  content_html: "<p>Canonical English \u2014 human reviewed.</p>", content_json: document("Canonical English \u2014 human reviewed"), updated_at: enRevision,
  status: "published", reviewed_at: reviewedAt, reviewed_by: reviewerId, approved_at: approvedAt, approved_by: approverId, published_at: approvedAt,
  source_article_updated_at: ruRevision, created_by: actorId, updated_by: actorId, rights: { holder: "Original EN author", licence: "Manual permission preserved" } };
function row(payload: Row = {}, scope = "english-only", canonical: Row = liveEnglish) {
  return { article_id: articleId, base_article_updated_at: ruRevision, payload: structuredClone(ruPayload),
    english_payload: { mode: "save", payload: { ...structuredClone(enPayload), ...payload } }, expected_english_updated_at: canonical.updated_at,
    draft_scope: scope, draft_english_enabled: true, version: 3, updated_at: "2026-10-08T12:05:00.123456+03:00" };
}
function fixture(options: { draft?: Row | null; canonical?: Row | null; denied?: boolean } = {}) {
  const draft = Object.hasOwn(options, "draft") ? options.draft : row(), canonical = Object.hasOwn(options, "canonical") ? options.canonical : liveEnglish;
  const before = structuredClone({ article: liveArticle, english: canonical, draft });
  const reads: Row[] = [], editorProps: Row[] = [], actions = vi.fn(async () => { throw new Error("Read-only projection called an action"); });
  function from(table: string) {
    let columns = "*", singular = false; const filters: [string, any][] = [];
    const query: any = { select(value: string) { columns = value; return query; }, eq(key: string, value: any) { filters.push([key, value]); return query; },
      order() { return query; }, limit() { return query; }, contains() { return query; }, in() { return query; },
      maybeSingle() { singular = true; return query; }, then(resolve: any, reject: any) {
        return Promise.resolve().then(() => {
          reads.push({ table, columns, filters });
          let rows: Row[] = table === "articles" ? [liveArticle] : table === "article_translations" ? canonical ? [canonical] : []
            : table === "article_working_drafts" ? draft ? [draft] : []
            : table === "categories" ? [{ id: categoryId, name: "Авторская рубрика", slug: "authored", is_visible: true }] : [];
          rows = rows.filter(value => filters.every(([key, expected]) => value[key] === expected));
          const project = (value: Row) => columns === "*" ? structuredClone(value) : Object.fromEntries(columns.split(/,(?![^()]*\))/u)
            .map(key => key.includes("(") ? [key.slice(0, key.indexOf("(")), structuredClone(value[key.slice(0, key.indexOf("("))])]
              : [key, structuredClone(value[key])]));
          return { data: singular ? rows[0] ? project(rows[0]) : null : rows.map(project), error: null };
        }).then(resolve, reject);
      }, insert() { throw new Error("Projection attempted a write"); }, update() { throw new Error("Projection attempted a write"); } };
    return query;
  }
  const Boundary = (props: Row) => { if (props.current) editorProps.push(props.current); return createElement("section", { "data-editor-boundary": "actual-page-props" }, props.fallback); };
  const modules = actualModules({
    "@/lib/supabase/server": { createServerSupabaseClient: async () => ({ from }) },
    "@/lib/auth": { getStaffSession: async () => ({ configured: true, user: options.denied ? null : { id: actorId }, role: options.denied ? null : "owner", mfa: { currentLevel: "aal2", nextLevel: "aal2", required: false } }) },
    "next/navigation": nativeNavigation,
    "next/link": { __esModule: true, default: ({ children, ...props }: Row) => createElement("a", props, children) },
    "@/components/ArticleEditorLoader": { __esModule: true, default: Boundary },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: Row) => createElement("button", { type: "submit" }, children) },
    "@/components/EditorialPreviewFonts": { editorialPreviewFonts: "fixture-fonts" },
    "@/components/EditorialPreview.module.css": { __esModule: true, default: { fonts: "fixture-fonts", reader: "fixture-reader" } },
    "../actions": { duplicateArticleAction: actions, discardArticleWorkingDraftAction: actions, requestSocialPublicationAction: actions,
      restoreArticleRevisionAction: actions, softDeleteArticleAction: actions },
  });
  const helper = modules.load("app/(dashboard)/articles/article-working-draft.ts");
  async function render(kind: "edit" | "preview", locale = "en") {
    const page = modules.load(`app/(dashboard)/articles/[id]/${kind === "edit" ? "page" : "preview/page"}.tsx`).default;
    const markup = renderToStaticMarkup(await page({ params: Promise.resolve({ id: articleId }), searchParams: Promise.resolve({ locale }) }));
    expect(actions).not.toHaveBeenCalled(); expect({ article: liveArticle, english: canonical, draft }).toEqual(before);
    traces.push({ kind, locale, reads: structuredClone(reads), props: structuredClone(editorProps), markup });
    return { markup, $: html(markup), props: editorProps.at(-1), reads };
  }
  return { helper, draft, canonical, reads, render };
}
function expectPrivateContent(actual: Row, draft: Row, canonical: Row = liveEnglish) {
  for (const [key, value] of Object.entries(draft.english_payload.payload)) expect(actual[key], key).toEqual(value);
  expect(actual.created_by).toBe(canonical.created_by); expect(actual.updated_by).toBe(canonical.updated_by); expect(actual.rights).toEqual(canonical.rights);
  expect(actual.source_article_updated_at).toBe(canonical.source_article_updated_at);
}

describe("M07 private EN human review identities through actual read model and server pages", () => {
  for (const machine of [true, false]) for (const method of ["englishTranslationWithWorkingDraft", "previewEnglishTranslationWithWorkingDraft"]) {
    it(`${method} clears canonical human actors on ${machine ? "machine" : "authored"} private payload with null dates`, () => {
      const draft = row(machine ? { content_json: { ...document("Machine private EN"), __probperaPremiumTranslation: { version: 1, method: "machine-translation", sourceHash: enPayload.source_content_hash } } } : {});
      const view = fixture({ draft }), parsed = view.helper.parseArticleWorkingDraft(draft), actual = view.helper[method](liveEnglish, parsed);
      expect(actual.reviewed_by).toBeNull(); expect(actual.approved_by).toBeNull(); expectPrivateContent(actual, draft);
      expect(actual.updated_at).toBe(method === "englishTranslationWithWorkingDraft" ? enRevision : draft.updated_at);
    });
  }
  for (const method of ["englishTranslationWithWorkingDraft", "previewEnglishTranslationWithWorkingDraft"]) {
    it(`${method} preserves existing authored matching review actors and full payload`, () => {
      const draft = row({ status: "approved", reviewed_at: reviewedAt, approved_at: approvedAt });
      const view = fixture({ draft }), actual = view.helper[method](liveEnglish, view.helper.parseArticleWorkingDraft(draft));
      expect(actual.reviewed_by).toBe(reviewerId); expect(actual.approved_by).toBe(approverId); expectPrivateContent(actual, draft);
    });
    it(`${method} compares review and approval independently without dropping microseconds`, () => {
      const draft = row({ status: "review", reviewed_at: "2026-10-06T09:00:00.123457+00:00", approved_at: "2026-10-06T10:00:00.6543210Z" });
      const view = fixture({ draft }), actual = view.helper[method](liveEnglish, view.helper.parseArticleWorkingDraft(draft));
      expect(actual.reviewed_by).toBeNull(); expect(actual.approved_by).toBe(approverId); expectPrivateContent(actual, draft);
    });
    it(`${method} preserves equal instants in different offsets and trailing-zero formatting`, () => {
      const draft = row({ reviewed_at: "2026-10-06T09:00:00.1234560Z", approved_at: "2026-10-06T10:00:00.654321+00:00" });
      const view = fixture({ draft }), actual = view.helper[method](liveEnglish, view.helper.parseArticleWorkingDraft(draft));
      expect(actual.reviewed_by).toBe(reviewerId); expect(actual.approved_by).toBe(approverId);
    });
    it(`${method} never invents actor keys absent from selected projection`, () => {
      const draft = row(), narrow = { article_id: articleId, locale: "en", title: liveEnglish.title, updated_at: enRevision };
      const view = fixture({ draft }), actual = view.helper[method](narrow, view.helper.parseArticleWorkingDraft(draft));
      expect(actual).not.toHaveProperty("reviewed_by"); expect(actual).not.toHaveProperty("approved_by");
      const absent = view.helper[method](null, view.helper.parseArticleWorkingDraft(draft));
      expect(absent).not.toHaveProperty("reviewed_by"); expect(absent).not.toHaveProperty("approved_by");
    });
    it(`${method} clears stale actor when canonical review date is absent or malformed`, () => {
      const draft = row({ reviewed_at: reviewedAt, approved_at: approvedAt }), view = fixture({ draft });
      for (const reviewed_at of [undefined, null, "not-a-date"]) {
        const actual = view.helper[method]({ ...liveEnglish, reviewed_at }, view.helper.parseArticleWorkingDraft(draft));
        expect(actual.reviewed_by).toBeNull(); expect(actual.approved_by).toBe(approverId);
      }
    });
  }
  it("disabled EN preserves captured editor CAS and never exposes canonical actors", () => {
    const view = fixture(), draft = view.helper.parseArticleWorkingDraft({ ...row(), draft_scope: "bundle", draft_english_enabled: false, english_payload: { mode: "disabled" } });
    expect(view.helper.englishTranslationWithWorkingDraft(liveEnglish, draft)).toEqual({ updated_at: enRevision });
    expect(view.helper.previewEnglishTranslationWithWorkingDraft(liveEnglish, draft)).toBeNull();
  });
  it("actual edit select* forwards private null actors while preserving separate canonical history and exact RU/EN", async () => {
    const view = fixture(), page = await view.render("edit"), current = page.props!;
    expect(page.reads.some(read => read.table === "article_translations" && read.columns === "*")).toBe(true);
    expect(current.englishTranslation.reviewed_by).toBeNull(); expect(current.englishTranslation.approved_by).toBeNull();
    expectPrivateContent(current.englishTranslation, view.draft!); expect(current.canonicalEnglishTranslation).toEqual(liveEnglish);
    expect(current.article).toMatchObject({ ...liveArticle, working_draft_version: 3, working_draft_scope: "english-only" });
    expect(current.englishTranslation.updated_at).toBe(enRevision);
  });
  it("actual editor without a private draft preserves all canonical human review metadata", async () => {
    const page = await fixture({ draft: null }).render("edit");
    expect(page.props!.englishTranslation).toEqual(liveEnglish); expect(page.props!.canonicalEnglishTranslation).toEqual(liveEnglish);
  });
  for (const locale of ["ru", "en"]) {
    it(`actual ${locale} preview respects SDK column selection and shows exact content without actor attribution`, async () => {
      const view = fixture(), page = await view.render("preview", locale), expected = locale === "en" ? enPayload : liveArticle;
      expect(page.$("article.admin-article-preview h1").text()).toBe(expected.title);
      expect(page.$(".preview-prose").html()).toBe(html(expected.content_html)("body").html());
      const read = page.reads.find(read => read.table === "article_translations");
      expect(read!.columns).toBe("article_id,locale,title,subtitle,excerpt,content_html,cover_alt,updated_at,status");
      expect(page.markup).not.toContain(reviewerId); expect(page.markup).not.toContain(approverId);
      expect(page.$(".preview-toolbar").text()).toContain(locale === "en" ? "английская версия не выпущена" : "Закрытый предпросмотр русской версии");
    });
  }
  for (const kind of ["edit", "preview"] as const) {
    it(`actual ${kind} denied staff access still blocks all private/canonical reads`, async () => {
      const view = fixture({ denied: true });
      await expect(view.render(kind)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT;replace;/login;") });
      expect(view.reads).toHaveLength(0);
    });
  }
});

afterAll(() => {
  const artifact = process.env.M07_REVIEW_IDENTITY_ARTIFACT;
  if (artifact) writeFileSync(artifact, JSON.stringify({ sourceGraph: [...graph.values()], traces,
    boundaries: { actual: "working-draft parser/read models, editor and preview server pages, read-access guard", controlled: "Auth session, Supabase selected columns, editor client boundary, mutation actions, font/CSS/link boundary", notVerified: "managed Auth/DB/RLS, native browser client editor, human review provenance beyond matching stored dates, production" } }, null, 2) + "\n");
});
