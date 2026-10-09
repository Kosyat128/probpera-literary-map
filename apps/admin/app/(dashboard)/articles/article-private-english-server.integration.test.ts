import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
function load(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): any {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const candidate = process.env.M02_PRIVATE_EN_BASELINE_DIR && path.join(process.env.M02_PRIVATE_EN_BASELINE_DIR, relative);
  const source = candidate && existsSync(candidate) ? candidate : filename;
  const compiled = ts.transpileModule(readFileSync(source, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  cache.set(filename, module.exports);
  const require = (name: string): any => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const actual = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (actual) return load(path.relative(adminRoot, actual), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const id = "11111111-1111-4111-8111-111111111111", category = "22222222-2222-4222-8222-222222222222";
const op = "33333333-3333-4333-8333-333333333333", foreign = "44444444-4444-4444-8444-444444444444";
const ru = "2026-10-07T12:00:00.123456+00:00", en = "2026-10-07T11:00:00.654321+00:00";
const nextRu = "2026-10-07T12:00:00.123457+00:00", nextEn = "2026-10-07T11:00:00.654322+00:00";
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const ruText = Array(270).fill("Авторский текст текущей русской версии").join(" ");
const enText = "Private manual A; synthetic image license and author citation retained";
const ruHtml = `<h2>Авторский раздел</h2><p>${ruText}</p>`, enHtml = `<p>${enText}</p>`;
const ruDescription = "Ручное авторское описание со ссылкой на проверенный источник. ".repeat(3);
const enPayload = {
  title: "Private manual English A", subtitle: "Manual A subtitle", excerpt: "Manual A excerpt", slug: "private-english-a",
  content_html: enHtml, content_json: doc(enText), cover_alt: "Author licensed English image", sources: [{ text: "Author source A" }],
  bibliography: [{ text: "Author bibliography A" }], seo_title: "Manual A SEO", seo_description: "Manual A search description",
  seo_keywords: ["Manual A keyword"], canonical_url: "https://fixture.invalid/manual-a", og_title: "Manual A OG",
  og_description: "Manual A OG description", status: "draft", source_content_hash: "private-original-source-A",
  reviewed_at: null, approved_at: null, published_at: null, deleted_at: null,
};
const ruPayload = {
  title: "Old private Russian A", subtitle: "Old private RU subtitle", excerpt: ruDescription, slug: "private-ru-a",
  content_html: "<p>Old private Russian A must not replace canonical Russian B</p>", content_json: doc("Old private RU A"),
  category_id: foreign, status: "draft", scheduled_at: null, published_at: null, cover_external_url: "https://fixture.invalid/old.jpg",
  cover_alt: "Old licensed cover", legacy_path: null, seo_title: "Private RU A SEO", seo_description: ruDescription,
  seo_keywords: ["Private RU A"], canonical_url: "https://fixture.invalid/old-ru", og_title: "Old RU OG", og_description: ruDescription,
  allow_indexing: false, sources: [{ text: "Old RU source" }], bibliography: [{ text: "Old RU bibliography" }],
  featured: false, show_on_homepage: false, pinned: true,
};
const row = {
  article_id: id, base_article_updated_at: ru, payload: ruPayload, english_payload: { mode: "save", payload: enPayload },
  expected_english_updated_at: en, version: 2, updated_at: ru, draft_scope: "english-only", draft_english_enabled: false,
};
const originalEnglish = {
  ...enPayload, title: "Canonical unchanged E0", content_html: "<p>Canonical unchanged E0</p>", content_json: doc("Canonical E0"),
  updated_at: en, approved_at: null, published_at: null,
};
function form(patch: Record<string, string | null> = {}) {
  const data = new FormData();
  const fields: Record<string, string> = {
    id, title: "Canonical released Russian B", subtitle: "Current manual subtitle", excerpt: ruDescription, slug: "canonical-ru-b",
    content_html: ruHtml, content_json: JSON.stringify(doc(ruText)), category_id: category,
    cover_external_url: "https://fixture.invalid/current.jpg", cover_alt: "Current manual licensed Russian cover",
    seo_title: "Manual RU SEO", seo_description: ruDescription, seo_keywords: "Manual RU keyword", sources: "Current manual RU source",
    bibliography: "Current manual RU bibliography", canonical_url: "https://fixture.invalid/current-ru",
    expected_updated_at: ru, english_expected_updated_at: en, working_draft_version: "2", article_result_mode: "receipt",
    status: "draft", intent: "save", preview_locale: "en", publication_ready: "yes", scheduled_at: "2026-12-01T10:00:00Z",
    english_title: enPayload.title, english_subtitle: enPayload.subtitle, english_excerpt: enPayload.excerpt, english_slug: enPayload.slug,
    english_content_html: enHtml, english_content_json: JSON.stringify(enPayload.content_json), english_cover_alt: enPayload.cover_alt,
    english_sources: "Author source A", english_bibliography: "Author bibliography A", english_seo_title: enPayload.seo_title,
    english_seo_description: enPayload.seo_description, english_canonical_url: enPayload.canonical_url, english_status: "draft",
  };
  for (const [key, value] of Object.entries({ ...fields, ...patch })) if (value !== null) data.set(key, value);
  return data;
}
type Options = { status?: string; englishStatus?: string; replayed?: boolean; draft?: unknown; draftError?: unknown; metadata?: boolean; rpcError?: unknown };
function setup(options: Options = {}) {
  const status = options.status || "published", reads: string[] = [];
  const from = vi.fn((table: string) => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), single: read, maybeSingle: read };
    async function read() {
      reads.push(table);
      if (table === "article_working_drafts") return { data: Object.hasOwn(options, "draft") ? options.draft : row, error: options.draftError || null };
      return { data: table === "articles" ? { slug: "canonical-ru-b", status, published_at: status === "published" ? ru : null,
        updated_at: ru, categories: { slug: "current-category" } }
        : table === "article_translations" ? { ...originalEnglish, status: options.englishStatus || "draft" } : { slug: "current-category" }, error: null };
    }
    return query;
  });
  const rpc = vi.fn(async (name: string, args: any) => {
    if (options.rpcError) return { data: null, error: options.rpcError };
    const working = name === "save_article_working_draft_operation", promotion = name === "promote_article_working_draft_operation";
    if (!working && !promotion && name !== "save_article_bundle_operation") throw Error("No legacy fallback allowed");
    const englishWrite = working ? args.p_english_payload.mode === "save" ? "saved" : "preserved"
      : args.p_english_mode === "save" ? "saved" : args.p_english_mode === "stale" ? "status-only" : "preserved";
    const result = working ? { articleId: id, version: 3, updatedAt: nextRu }
      : { article_id: id, article_updated_at: nextRu, english_updated_at: args.p_english_mode === "none" ? null : nextEn, homepage_replaced: 0 };
    const workingDraft = {
      scope: working ? "bundle" : "english-only", version: 3, updatedAt: nextRu,
      baseArticleUpdatedAt: working ? ru : nextRu, englishExpectedUpdatedAt: working || args.p_english_mode === "none" ? en : nextEn,
      englishWrite: working ? englishWrite : "preserved", englishEnabled: working ? args.p_english_payload.mode === "save" : false,
    };
    return { data: { version: 1, operationId: args.p_operation_id, entityType: "article", requestedEntityId: args.p_article_id,
      intent: args.p_submitted_intent.intent, persistence: working ? "working-draft" : promotion ? "working-draft-promotion" : "article-bundle",
      replayed: Boolean(options.replayed), result, canonicalStatus: working ? status : args.p_article_payload.status, englishWrite,
      ...(options.metadata === false || !working && !promotion || englishWrite === "saved" && !working ? {} : { workingDraft }) }, error: null };
  });
  const publication = vi.fn(async () => ({ state: "queued" })), after = vi.fn(), revalidatePath = vi.fn();
  const mocks = {
    "@/lib/auth": { requireStaff: vi.fn(async () => ({ user: { id: category }, role: "admin" })) },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid", openAiAutoTranslateArticles: false } },
    "@/lib/supabase/server": { createServerSupabaseClient: vi.fn(async () => ({ from, rpc })) },
    "@/lib/publication": { requestPublicBuild: publication }, "next/server": { after }, "next/cache": { revalidatePath },
    "@/lib/navigation": { redirect: nativeRequire("next/navigation").redirect },
    "next/navigation": { unstable_rethrow: nativeRequire("next/navigation").unstable_rethrow },
    // Excluded formatter is not imported or executed. Its source/calls/tests are unchanged.
    "@/lib/short-hyphens": { normalizeShortHyphensFormData: (_value: FormData) => undefined },
  };
  const cache = new Map<string, any>(), helper = load("app/(dashboard)/articles/article-working-draft.ts", mocks, cache);
  const atomic = load("app/(dashboard)/articles/atomic-standard-save-action.ts", mocks, cache).saveStandardArticleAtomically;
  const capture = load("lib/article-operation-intent.ts", mocks, cache).captureArticleOperationIntent;
  return { helper, atomic, capture, rpc, from, reads, publication, after, revalidatePath };
}
async function submit(view: ReturnType<typeof setup>, data: FormData) {
  return view.atomic(data, { operationId: op, submittedIntent: view.capture(data) });
}

describe("private English preserved after canonical Russian commit", () => {
  it.each(["published", "scheduled", "hidden", "archived"])('projects retained EN with canonical RU/category/status for %s', status => {
    const view = setup(), parsed = view.helper.parseArticleWorkingDraft(row);
    const canonical = { id, title: "Canonical released Russian B", content_html: ruHtml, content_json: doc(ruText), status,
      category_id: category, updated_at: ru, sources: [{ text: "Current source B" }] };
    const projected = view.helper.articleWithWorkingDraft(canonical, parsed);
    expect(projected).toMatchObject({ ...canonical, working_draft_scope: "english-only", working_draft_version: 2,
      working_draft_updated_at: ru, working_draft_english_enabled: false });
    const english = view.helper.englishTranslationWithWorkingDraft(originalEnglish, parsed);
    expect(english).toMatchObject({ ...enPayload, updated_at: en });
    expect(view.helper.previewEnglishTranslationWithWorkingDraft(originalEnglish, parsed)).toMatchObject(enPayload);
    expect(row.english_payload.payload).toEqual(enPayload);
  });
  it('keeps legacy bundle overlay and enabled fallback without adding command modes', () => {
    const view = setup(), { draft_scope: _scope, draft_english_enabled: _enabled, ...legacy } = row;
    const parsed = view.helper.parseArticleWorkingDraft(legacy);
    expect(view.helper.articleWithWorkingDraft({ id, title: "Canonical E0" }, parsed)).toMatchObject({ title: ruPayload.title,
      working_draft_scope: "bundle", working_draft_english_enabled: true });
    expect(view.helper.articleWorkingDraftEnglishEnvelope(null)).toEqual({ mode: "disabled" });
    expect(view.helper.articleWorkingDraftEnglishEnvelope(enPayload)).toEqual({ mode: "save", payload: enPayload });
  });
  it.each([
    { draft_scope: "foreign" }, { draft_scope: "english-only", english_payload: { mode: "disabled" } },
    { draft_scope: "bundle", draft_english_enabled: true, english_payload: { mode: "disabled" } },
    { version: Number.MAX_SAFE_INTEGER + 1 }, { english_payload: { mode: "preserved", payload: enPayload } },
  ])('rejects unsafe stored draft metadata %j', patch => {
    expect(() => setup().helper.parseArticleWorkingDraft({ ...row, ...patch })).toThrow("Рабочий черновик повреждён");
  });
  for (const status of ["published", "scheduled", "hidden", "archived"]) for (const englishStatus of ["draft", "published"]) {
    it(`canonical ${status}/${englishStatus} fresh receipt retains committed draft metadata and raw EN scope`, async () => {
      const view = setup({ status, englishStatus }), result = await submit(view, form({ intent: "publish", status }));
      expect(result.outcome).toBe("saved");
      expect(result.persistence).toBe("working-draft-promotion");
      expect(result.englishState).toBe(englishStatus === "published" ? "status-only" : "preserved");
      expect(result.receipt).toMatchObject({ articleId: id, articleUpdatedAt: nextRu, englishUpdatedAt: englishStatus === "published" ? nextEn : null,
        canonicalStatus: status, workingDraftVersion: 3, workingDraftUpdatedAt: nextRu, workingDraft: {
          scope: "english-only", version: 3, updatedAt: nextRu, baseArticleUpdatedAt: nextRu,
          englishExpectedUpdatedAt: englishStatus === "published" ? nextEn : en, englishWrite: "preserved", englishEnabled: false } });
      const args = view.rpc.mock.calls[0][1];
      expect(args.p_english_payload).toBeNull();
      expect(args.p_english_mode).toBe(englishStatus === "published" ? "stale" : "none");
      expect(args.p_expected_working_draft_version).toBe(2);
      expect(args.p_article_payload).toMatchObject({ title: "Canonical released Russian B", sources: [{ text: "Current manual RU source" }] });
      expect(view.publication).toHaveBeenCalledTimes(1);
      expect(view.after).toHaveBeenCalledTimes(1);
    });
  }
  for (const status of ["scheduled", "hidden", "archived"]) for (const intent of ["save", "preview"]) for (const enabled of [false, true]) {
    it(`continues verified ${status} private ${intent} with EN ${enabled ? "full save" : "disabled preservation"}`, async () => {
      const view = setup({ status }), result = await submit(view, form({ intent, english_enabled: enabled ? "on" : null }));
      expect(view.reads).toContain("article_working_drafts");
      expect(view.rpc.mock.calls[0][0]).toBe("save_article_working_draft_operation");
      expect(view.rpc.mock.calls[0][1].p_english_payload.mode).toBe(enabled ? "save" : "disabled");
      expect(result).toMatchObject({ outcome: "saved", persistence: "working-draft", englishState: enabled ? "saved" : "preserved",
        receipt: { articleId: id, articleUpdatedAt: ru, englishUpdatedAt: en, canonicalStatus: status,
          workingDraftVersion: 3, workingDraftUpdatedAt: nextRu, workingDraft: {
            scope: "bundle", version: 3, baseArticleUpdatedAt: ru, englishExpectedUpdatedAt: en,
            englishWrite: enabled ? "saved" : "preserved", englishEnabled: enabled } } });
      expect(view.publication).not.toHaveBeenCalled();
      expect(view.after).toHaveBeenCalledTimes(1);
    });
  }
  it.each(["scheduled", "hidden", "archived"])('continues own bundle converted from residual for %s', async status => {
    const view = setup({ status, draft: { ...row, draft_scope: "bundle" } });
    expect(await submit(view, form())).toMatchObject({ outcome: "saved", persistence: "working-draft", receipt: { canonicalStatus: status } });
  });
  it.each([
    { draft: null, outcome: "conflict", scope: "article" },
    { draft: { ...row, article_id: foreign }, outcome: "conflict", scope: "article" },
    { draft: { ...row, version: 3 }, outcome: "conflict", scope: "article" },
    { draft: { ...row, base_article_updated_at: nextRu }, outcome: "conflict", scope: "article" },
    { draft: { ...row, expected_english_updated_at: nextEn }, outcome: "conflict", scope: "english" },
    { draft: { ...row, draft_scope: "damaged" }, outcome: "dependency-unavailable" },
    { draftError: { message: "synthetic dependency outage" }, outcome: "dependency-unavailable" },
  ])('fails closed before private write when verified row is unavailable/stale: %j', async options => {
    const view = setup({ status: "hidden", ...options });
    expect(await submit(view, form())).toMatchObject({ outcome: options.outcome, ...("scope" in options ? { scope: options.scope } : {}) });
    expect(view.rpc).not.toHaveBeenCalled();expect(view.publication).not.toHaveBeenCalled();expect(view.after).not.toHaveBeenCalled();
  });
  it.each(["scheduled", "hidden", "archived"])('preserves preexisting no-draft routing on %s', async status => {
    const view = setup({ status }), result = await submit(view, form({ working_draft_version: "0" }));
    expect(view.reads).not.toContain("article_working_drafts");
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_bundle_operation");
    expect(result).toMatchObject({ outcome: "saved", persistence: "article-bundle", receipt: { workingDraftVersion: 0 } });
  });
  it.each(["published", "scheduled", "hidden", "archived"])('replayed %s partial receipt returns original metadata without aftermath', async status => {
    const view = setup({ status, replayed: true }), result = await submit(view, form({ intent: "publish", status }));
    expect(result).toMatchObject({ outcome: "saved", persistence: "working-draft-promotion", publicationState: "unknown",
      revalidationState: "unknown", receipt: { workingDraftVersion: 3, workingDraft: { scope: "english-only" } } });
    expect(view.publication).not.toHaveBeenCalled();expect(view.after).not.toHaveBeenCalled();expect(view.revalidatePath).not.toHaveBeenCalled();
    expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it('accepts an old operation receipt without fabricating retained draft metadata', async () => {
    const view = setup({ metadata: false, replayed: true });
    const result = await submit(view, form({ intent: "publish", status: "published" }));
    expect(result).toMatchObject({ outcome: "saved", receipt: { workingDraftVersion: 0, workingDraftUpdatedAt: null } });
    expect(result.receipt).not.toHaveProperty("workingDraft");expect(view.after).not.toHaveBeenCalled();
  });
  it('does not retry a failed guarded private write through a legacy producer', async () => {
    const view = setup({ status: "hidden", rpcError: { code: "40001", message: "article-version-conflict" } });
    await expect(submit(view, form())).rejects.toMatchObject({ name: "ArticleOperationRpcError" });
    expect(view.rpc).toHaveBeenCalledTimes(1);expect(view.after).not.toHaveBeenCalled();expect(view.publication).not.toHaveBeenCalled();
  });
});
