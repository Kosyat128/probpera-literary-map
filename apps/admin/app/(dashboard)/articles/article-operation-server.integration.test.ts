import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureArticleOperationIntent } from "../../../lib/article-operation-intent";
import type { ArticleOperationResultContext } from "../../../lib/article-operation-result";

const nativeRequire = createRequire(import.meta.url);
const nativeNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
const baselineRoot = path.resolve(adminRoot, "../../.tmp/m02-operation-wiring-before");
const ownedFiles = new Set(["save-article-action.ts", "atomic-standard-save-action.ts", "article-bundle-rpc.ts", "article-working-draft.ts"]);

// Execute the real server action/helpers; only external boundaries are synthetic.
// The excluded formatter is never imported or executed by this harness.
function loadAdmin(relative: string, mocks: Record<string, unknown>, sourceDir?: string,
  cache = new Map<string, Record<string, any>>()): Record<string, any> {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename)!;
  const overrideRoot = sourceDir || process.env.M02_OPERATION_SERVER_BASELINE_DIR;
  const override = overrideRoot && ownedFiles.has(path.basename(filename))
    ? path.join(overrideRoot, path.basename(filename)) : filename;
  const compiled = ts.transpileModule(readFileSync(override, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, any> };
  cache.set(filename, module.exports);
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const source = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (source) return loadAdmin(path.relative(adminRoot, source), mocks, sourceDir, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const articleId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const copyId = "33333333-3333-4333-8333-333333333333";
const operationId = "44444444-4444-4444-8444-444444444444";
const previous = "2026-09-30T12:00:00.123456+00:00";
const englishPrevious = "2026-09-30T11:00:00.654321+00:00";
const next = "2026-09-30T12:00:00.123457+00:00";
const englishNext = "2026-09-30T11:00:00.654322+00:00";
const privateError = "PRIVATE_OPERATION_SQL_OR_TOKEN_DO_NOT_RENDER";
const ruBody = "Авторский RU \u2014 текст; дефис - и тире \u2014 сохранены.";
const enBody = "Manual EN \u2014 text; hyphen - and dash \u2014 retained.";
const source = "Ручной источник RU https://fixture.invalid/ru-source; права автора";
const bibliography = "Книга \u2014 RU; автор разрешил цитирование";
const document = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const fields = {
  id: articleId, title: "Авторский материал RU", subtitle: "Ручной подзаголовок", excerpt: "Ручное описание",
  slug: "synthetic-article", content_html: `<p>${ruBody}</p>`, content_json: JSON.stringify(document(ruBody)),
  category_id: categoryId, status: "draft", sources: source, bibliography,
  cover_external_url: "https://fixture.invalid/cover.jpg", cover_alt: "Обложка \u2014 фотограф Иванов, с разрешения",
  seo_title: "Авторский SEO", seo_description: "Авторское описание SEO", canonical_url: "https://fixture.invalid/article/",
  expected_updated_at: previous, english_expected_updated_at: englishPrevious, working_draft_version: "0",
  intent: "save", preview_locale: "en", article_result_mode: "receipt",
  english_title: "Manual English article", english_subtitle: "Manual subtitle", english_excerpt: "Manual excerpt",
  english_slug: "manual-english", english_content_html: `<p>${enBody}</p>`, english_content_json: JSON.stringify(document(enBody)),
  english_cover_alt: "Manual English cover credit", english_status: "draft", english_seo_title: "Manual English SEO",
  english_seo_description: "Manual English description", english_canonical_url: "https://fixture.invalid/en/article/",
  english_sources: "Manual EN source https://fixture.invalid/en-source; author's permission",
  english_bibliography: "Manual EN bibliography \u2014 author's edition",
};
function form(patch: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...patch })) if (value !== undefined) data.set(key, value);
  return data;
}
function context(data: FormData): ArticleOperationResultContext {
  const submittedIntent = captureArticleOperationIntent(data);
  if (!submittedIntent) throw new Error("Synthetic operation intent must be valid");
  return { operationId, submittedIntent };
}
function englishRow(patch: Record<string, unknown> = {}) {
  return {
    updated_at: englishPrevious, source_content_hash: null, status: "draft", content_json: document(enBody),
    title: fields.english_title, subtitle: fields.english_subtitle, excerpt: fields.english_excerpt,
    slug: fields.english_slug, content_html: fields.english_content_html, cover_alt: fields.english_cover_alt,
    seo_title: fields.english_seo_title, seo_description: fields.english_seo_description, seo_keywords: [],
    canonical_url: fields.english_canonical_url, og_title: null, og_description: null,
    sources: [{ text: fields.english_sources }], bibliography: [{ text: fields.english_bibliography }],
    approved_at: null, published_at: null, ...patch,
  };
}
type Options = {
  sourceDir?: string; previousStatus?: string; englishData?: unknown; replayed?: boolean;
  rpcError?: unknown; rpcThrow?: unknown; envelopePatch?: Record<string, unknown>;
  publicationThrow?: unknown; afterThrow?: unknown; autoTranslation?: boolean; translationThrow?: unknown;
};
const names = {
  save_article_bundle: "article-bundle", save_article_working_draft: "working-draft",
  promote_article_working_draft: "working-draft-promotion",
} as const;
function setup(options: Options = {}) {
  const from = vi.fn((table: string) => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query),
      single: vi.fn(async () => read()), maybeSingle: vi.fn(async () => read()) };
    function read() {
      return { data: table === "articles"
        ? { slug: fields.slug, status: options.previousStatus || "draft", updated_at: previous,
          published_at: options.previousStatus === "published" ? previous : null, categories: { slug: "fixture-category" } }
        : table === "article_translations" ? Object.hasOwn(options, "englishData") ? options.englishData : null
          : { slug: "fixture-category" }, error: null };
    }
    return query;
  });
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => {
    if (Object.hasOwn(options, "rpcThrow")) throw options.rpcThrow;
    if (Object.hasOwn(options, "rpcError")) return { data: null, error: options.rpcError };
    const oldName = name.replace(/_operation$/u, "") as keyof typeof names;
    if (!Object.hasOwn(names, oldName)) throw new Error(`Unexpected synthetic RPC ${name}`);
    const result = oldName === "save_article_working_draft"
      ? { articleId: args.p_article_id, version: args.p_expected_version + 1, updatedAt: next }
      : { article_id: args.p_article_id || copyId, article_updated_at: next,
        english_updated_at: args.p_english_mode === "none" ? null : englishNext, homepage_replaced: 0 };
    return { error: null, data: name.endsWith("_operation") ? {
      version: 1, operationId: args.p_operation_id, entityType: "article", requestedEntityId: args.p_article_id,
      intent: args.p_submitted_intent.intent, persistence: names[oldName], replayed: Boolean(options.replayed),
      result, canonicalStatus: oldName === "save_article_working_draft" ? "published" : args.p_article_payload.status,
      ...options.envelopePatch,
    } : oldName === "save_article_working_draft" ? result : [result] };
  });
  const client = { from, rpc };
  const publication = vi.fn(async () => {
    if (Object.hasOwn(options, "publicationThrow")) throw options.publicationThrow;
    return { state: "queued" };
  });
  const afterCallbacks: (() => unknown)[] = [];
  const after = vi.fn((callback: () => unknown) => {
    if (Object.hasOwn(options, "afterThrow")) throw options.afterThrow;
    afterCallbacks.push(callback);
  });
  const revalidatePath = vi.fn();
  const translate = vi.fn(async () => {
    if (Object.hasOwn(options, "translationThrow")) throw options.translationThrow;
    if (!options.autoTranslation) throw new Error("No paid provider may run in this fixture");
    const text = Array(270).fill("Synthetic English author text").join(" ");
    return { title: "Synthetic translated title", subtitle: "Manual fixture subtitle", excerpt: "English card description ".repeat(8),
      content_html: `<h2>English fixture section</h2><p>${text}</p>`, cover_alt: "English cover with synthetic permission",
      seo_title: "English fixture SEO", seo_description: "English fixture description ".repeat(7),
      seo_keywords: [], og_title: "English fixture OG", og_description: "English fixture OG description ".repeat(5),
      sources: ["Synthetic English source"], bibliography: ["Synthetic English bibliography"],
      model: "fixture", reviewModel: "fixture", requestId: null, reviewRequestId: null };
  });
  const mocks = {
    "next/cache": { revalidatePath }, "next/server": { after },
    "next/navigation": { unstable_rethrow: nativeNavigation.unstable_rethrow },
    "@/lib/navigation": { redirect: nativeNavigation.redirect },
    "@/lib/auth": { requireStaff: vi.fn(async () => ({ user: { id: categoryId }, role: "admin" })) },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid", openAiAutoTranslateArticles: Boolean(options.autoTranslation),
      openAiApiKey: options.autoTranslation ? "synthetic-not-a-key" : undefined } },
    "@/lib/supabase/server": { createServerSupabaseClient: vi.fn(async () => client) },
    "@/lib/publication": { requestPublicBuild: publication },
    "@/lib/short-hyphens": { normalizeShortHyphensFormData: (_data: FormData) => undefined },
    "@/lib/auto-translate-article": { translateArticleSourceToEnglish: translate },
  };
  const cache = new Map<string, Record<string, any>>();
  const canonical = loadAdmin("app/(dashboard)/articles/save-article-action.ts", mocks, options.sourceDir, cache).saveArticleAction;
  const atomic = loadAdmin("app/(dashboard)/articles/atomic-standard-save-action.ts", mocks, options.sourceDir, cache).saveStandardArticleAtomically;
  return { canonical, atomic, rpc, from, publication, after, afterCallbacks, revalidatePath, translate };
}
function noAftermath(view: ReturnType<typeof setup>) {
  expect(view.publication).not.toHaveBeenCalled();
  expect(view.after).not.toHaveBeenCalled();
  expect(view.revalidatePath).not.toHaveBeenCalled();
}
function oldArgs(args: Record<string, unknown>) {
  const { p_operation_id: _id, p_submitted_intent: _intent, ...rest } = args;
  return rest;
}
function nativeSignal(kind: "redirect" | "notFound") {
  try { kind === "redirect" ? nativeNavigation.redirect("/synthetic-control") : nativeNavigation.notFound(); }
  catch (error) { return error; }
  throw new Error("Expected native control signal");
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const flows: ReadonlyArray<{
  name: string; patch: Record<string, string | undefined>; options: Options; oldName: keyof typeof names;
}> = [
  { name: "existing bundle", patch: { english_enabled: "on" }, options: { englishData: englishRow() }, oldName: "save_article_bundle" },
  { name: "new/copy bundle", patch: { id: undefined, expected_updated_at: undefined }, options: {}, oldName: "save_article_bundle" },
  { name: "published working copy", patch: { english_enabled: "on", working_draft_version: "2", intent: "preview" },
    options: { previousStatus: "published", englishData: englishRow() }, oldName: "save_article_working_draft" },
  { name: "working copy promotion", patch: { intent: "publish", status: "hidden", working_draft_version: "2" },
    options: { previousStatus: "published" }, oldName: "promote_article_working_draft" },
  { name: "new publication", patch: { id: undefined, expected_updated_at: undefined, intent: "publish", status: "hidden" },
    options: {}, oldName: "save_article_bundle" },
] as const;

describe("M02 real server operation wiring with identical preserved baseline fixtures", () => {
  it.each(flows)("preserves legacy payload/aftermath while binding fresh $name", async flow => {
    const before = setup({ ...flow.options, sourceDir: baselineRoot });
    const current = setup(flow.options);
    const baselineForm = form(flow.patch), currentForm = form(flow.patch), operation = context(currentForm);
    const originalIntent = structuredClone(operation.submittedIntent);
    const legacyResult = await before.canonical(baselineForm);
    const saved = await current.canonical(currentForm, operation);
    expect(current.rpc).toHaveBeenCalledTimes(1);
    expect(current.rpc.mock.calls[0][0]).toBe(`${flow.oldName}_operation`);
    expect(before.rpc.mock.calls[0][0]).toBe(flow.oldName);
    const args = current.rpc.mock.calls[0][1];
    expect(oldArgs(args)).toEqual(before.rpc.mock.calls[0][1]);
    expect(args.p_operation_id).toBe(operationId);
    expect(args.p_submitted_intent).toEqual(originalIntent);
    expect(operation.submittedIntent).toEqual(originalIntent);
    expect(saved).toMatchObject({ outcome: "saved", operationId, receipt: legacyResult.receipt,
      publicationState: legacyResult.publicationState, revalidationState: legacyResult.revalidationState });
    expect(Object.hasOwn(legacyResult, "englishState")).toBe(false);
    expect(saved.englishState).toBe(flow.patch.english_enabled === "on" ? "saved" : "preserved");
    const publicationArgs = (view: ReturnType<typeof setup>) => view.publication.mock.calls.map(call => {
      const { supabase: _client, ...args } = (call as unknown as [Record<string, unknown>])[0];
      return args;
    });
    expect(publicationArgs(current)).toEqual(publicationArgs(before));
    expect(current.afterCallbacks.length).toBe(before.afterCallbacks.length);
    expect(current.revalidatePath).not.toHaveBeenCalled();
    for (const callback of current.afterCallbacks) await callback();
    for (const callback of before.afterCallbacks) await callback();
    expect(current.revalidatePath.mock.calls).toEqual(before.revalidatePath.mock.calls);
  });

  it.each(flows)("returns original $name replay without a second aftermath", async flow => {
    const view = setup({ ...flow.options, replayed: true });
    const data = form(flow.patch), operation = context(data);
    const result = await view.canonical(data, operation);
    expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.calls[0][0]).toBe(`${flow.oldName}_operation`);
    expect(result).toMatchObject({ outcome: "saved", operationId, englishState: "unknown", publicationState: "unknown", revalidationState: "unknown" });
    expect(result.receipt.articleId).toBe(operation.submittedIntent.entityId || copyId);
    expect(result.receipt.articleUpdatedAt).toBe(flow.oldName === "save_article_working_draft" ? previous : next);
    expect(result.destination).toBe(flow.patch.intent === "preview"
      ? `/articles/${articleId}/preview?locale=en` : `/articles/edit?id=${operation.submittedIntent.entityId || copyId}`);
    noAftermath(view);
    expect(view.translate).not.toHaveBeenCalled();
  });

  it("preserves author RU/EN, category, cover, rights and sources through manual ownership transfer", async () => {
    const marked = { ...document(enBody), __probperaPremiumTranslation: { version: 1, method: "machine-translation", sourceHash: "old", model: "fixture" } };
    const data = form({ english_enabled: "on", english_content_json: JSON.stringify(marked) });
    const operation = context(data), view = setup({ englishData: englishRow() });
    expect((await view.canonical(data, operation)).outcome).toBe("saved");
    const args = view.rpc.mock.calls[0][1];
    expect(args.p_article_payload).toMatchObject({ category_id: categoryId, content_html: fields.content_html,
      content_json: document(ruBody), cover_external_url: fields.cover_external_url, cover_alt: fields.cover_alt,
      sources: [{ text: source }], bibliography: [{ text: bibliography }] });
    expect(args.p_english_payload).toMatchObject({ content_html: fields.english_content_html, content_json: document(enBody),
      cover_alt: fields.english_cover_alt, sources: [{ text: fields.english_sources }], bibliography: [{ text: fields.english_bibliography }] });
    expect(new Map(args.p_submitted_intent.fields).get("english_content_json")).toBe(JSON.stringify(marked));
    expect(args.p_expected_article_updated_at).toBe(previous);
    expect(args.p_expected_english_updated_at).toBe(englishPrevious);
    expect(view.translate).not.toHaveBeenCalled();
  });

  it("preserves inline media identity and photographer permission in the prepared operation", async () => {
    const url = "https://fixture.invalid/photo.jpg", alt = "Авторское фото", credit = "Фотограф Иванов, разрешение автора";
    const html = `<p>${ruBody}</p><img src="${url}" alt="${alt}" data-media-id="${copyId}" data-credit="${credit}" data-license="CC BY" data-source="https://fixture.invalid/photo-source">`;
    const json = { ...document(ruBody), content: [...document(ruBody).content,
      { type: "image", attrs: { src: url, alt, mediaId: copyId, credit, license: "CC BY", source: "https://fixture.invalid/photo-source" } }] };
    const data = form({ content_html: html, content_json: JSON.stringify(json) }), view = setup();
    expect((await view.canonical(data, context(data))).outcome).toBe("saved");
    const payload = view.rpc.mock.calls[0][1].p_article_payload;
    expect(payload.content_json.content[1].attrs).toMatchObject({ src: url, alt, mediaId: copyId, credit, license: "CC BY", source: "https://fixture.invalid/photo-source" });
    expect(payload.content_html).toContain(`data-credit="${credit}"`);
    expect(payload.content_html).toContain('data-license="CC BY"');
  });

  it("distinguishes an EN status-only update from saved EN text despite a non-null acknowledgement", async () => {
    const data = form(), view = setup({ englishData: englishRow({ status: "published", source_content_hash: "previous-source" }) });
    const result = await view.canonical(data, context(data));
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_english_mode: "stale", p_english_payload: null,
      p_expected_english_updated_at: englishPrevious });
    expect(result).toMatchObject({ outcome: "saved", operationId, englishState: "status-only", receipt: { englishUpdatedAt: englishNext } });
    expect(result.englishState).not.toBe("saved");
  });

  it("does not acknowledge disabled working-copy EN text after the existing auto-translation fallback", async () => {
    const machineJson = { type: "doc", content: [], __probperaPremiumTranslation: {
      version: 1, method: "machine-translation", sourceHash: "previous-source", model: "fixture" } };
    const data = form({ intent: "publish", status: "published", english_enabled: "on", english_content_json: JSON.stringify(machineJson) });
    const operation = context(data), view = setup({ previousStatus: "published", autoTranslation: true,
      translationThrow: new Error(privateError), englishData: englishRow({ source_content_hash: "previous-source", content_json: machineJson }) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await view.canonical(data, operation);
    expect(view.translate).toHaveBeenCalledTimes(1);
    expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_working_draft_operation");
    expect(view.rpc.mock.calls[0][1].p_english_payload).toEqual({ mode: "disabled" });
    expect(new Map(view.rpc.mock.calls[0][1].p_submitted_intent.fields).get("english_enabled")).toBe("on");
    expect(result).toMatchObject({ outcome: "saved", operationId, persistence: "working-draft", englishState: "preserved",
      receipt: { englishUpdatedAt: englishPrevious, canonicalStatus: "published" } });
    expect(result.englishState).not.toBe("saved");
    expect(view.publication).not.toHaveBeenCalled();
  });

  it("forces a receipt for a context-bearing internal call without changing the legacy redirect mode", async () => {
    const view = setup(), data = form({ article_result_mode: undefined });
    const result = await view.atomic(data, context(data));
    expect(result).toMatchObject({ outcome: "saved", operationId });
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_bundle_operation");
  });

  it("reports the actual SQL canonical status rather than a prepared publication status", async () => {
    const text = Array(270).fill("Synthetic author source text").join(" ");
    const data = form({ intent: "publish", status: "published", publication_ready: "yes", content_html: `<h2>Fixture section</h2><p>${text}</p>`,
      content_json: JSON.stringify(document(text)), excerpt: "Author card description ".repeat(7), seo_description: "Author SEO description ".repeat(7) });
    const view = setup({ envelopePatch: { canonicalStatus: "review" } });
    const result = await view.canonical(data, context(data));
    expect(view.rpc.mock.calls[0][1].p_article_payload.status).toBe("published");
    expect(result).toMatchObject({ outcome: "saved", operationId, receipt: { canonicalStatus: "review", articleUpdatedAt: next } });
    expect(view.publication).toHaveBeenCalledTimes(1);
    expect(view.after).toHaveBeenCalledTimes(1);
  });

  it("retains the legacy internal redirect when no operation context is supplied", async () => {
    const view = setup(), data = form({ article_result_mode: undefined });
    await expect(view.atomic(data)).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;/u) });
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_bundle");
    expect(view.after).not.toHaveBeenCalled();
    expect(view.revalidatePath).toHaveBeenCalledTimes(2);
  });

  it.each([
    { error: { code: "PGRST202", message: privateError }, category: "capability-unavailable" },
    { error: { code: "42501", message: privateError }, category: "permission" },
    { error: { code: "22023", message: "EDITOR_OPERATION_CONFLICT" }, category: "intent-conflict" },
    { error: { code: "22023", message: "EDITOR_OPERATION_INTENT_INVALID" }, category: "intent-conflict" },
  ])("passes known guarded refusal $category to the facade without legacy fallback", async ({ error, category }) => {
    const view = setup({ rpcError: error }), data = form();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(view.canonical(data, context(data))).rejects.toMatchObject({ name: "ArticleOperationRpcError", category });
    expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_bundle_operation");
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateError);
    expect(JSON.stringify(log.mock.calls)).not.toContain(ruBody);
    noAftermath(view);
  });

  it.each([
    { operationId: copyId }, { requestedEntityId: copyId }, { persistence: "working-draft" }, { replayed: "true" },
  ])("refuses a malformed/foreign operation receipt before aftermath %#", async envelopePatch => {
    const view = setup({ envelopePatch }), data = form();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(view.canonical(data, context(data))).rejects.toMatchObject({ name: "ArticleOperationRpcError", category: "unknown" });
    expect(view.rpc).toHaveBeenCalledTimes(1);
    noAftermath(view);
  });

  it.each(["redirect", "notFound"] as const)("preserves native Next %s control flow through operation write errors", async kind => {
    const error = nativeSignal(kind), view = setup({ rpcThrow: error }), data = form();
    await expect(view.canonical(data, context(data))).rejects.toBe(error);
    noAftermath(view);
  });

  it.each(["queue", "after"] as const)("keeps the committed fresh receipt when %s scheduling fails", async stage => {
    const view = setup(stage === "queue" ? { publicationThrow: new Error(privateError) } : { afterThrow: new Error(privateError) });
    const data = form({ intent: "publish", status: "hidden" });
    const result = await view.canonical(data, context(data));
    expect(result).toMatchObject({ outcome: "saved", operationId, receipt: { articleId, articleUpdatedAt: next } });
    expect(stage === "queue" ? result.publicationState : result.revalidationState).toBe("unknown");
    expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain(privateError);
  });
});

describe("M02 frozen operation survives existing English ownership paths", () => {
  const marker = { version: 1, method: "machine-translation", sourceHash: "previous-source", model: "fixture" };
  const machineJson = { type: "doc", content: [], __probperaPremiumTranslation: marker };
  it.each(["unchanged-machine", "changed-machine", "forced-manual-release"] as const)("forwards context through %s", async branch => {
    const data = form({ english_enabled: "on", english_content_json: JSON.stringify(machineJson),
      ...(branch === "changed-machine" ? { english_title: "Edited human English title" } : {}),
      ...(branch === "forced-manual-release" ? { intent: "publish", status: "hidden", english_status: "approved", english_confirm_current_source: "on" } : {}) });
    const operation = context(data), original = structuredClone(operation.submittedIntent);
    const view = setup({ englishData: englishRow({ source_content_hash: marker.sourceHash, content_json: machineJson }) });
    const result = await view.canonical(data, operation);
    expect(result).toMatchObject({ outcome: "saved", operationId });
    const args = view.rpc.mock.calls[0][1];
    expect(args.p_submitted_intent).toEqual(original);
    expect(args.p_operation_id).toBe(operationId);
    expect(new Map(args.p_submitted_intent.fields).get("english_content_json")).toBe(JSON.stringify(machineJson));
    expect(Object.hasOwn(args.p_english_payload.content_json, "__probperaPremiumTranslation")).toBe(branch === "unchanged-machine");
    expect(view.translate).not.toHaveBeenCalled();
  });

  it.each([false, true])("forwards frozen context through synthetic auto-translation failure=%s", async failure => {
    const text = Array(270).fill("Synthetic Russian source text").join(" ");
    const data = form({ id: undefined, expected_updated_at: undefined, english_expected_updated_at: undefined,
      intent: "publish", status: "published", publication_ready: "yes", english_enabled: "on", content_html: `<h2>RU fixture section</h2><p>${text}</p>`,
      content_json: JSON.stringify(document(text)), excerpt: "Russian fixture description ".repeat(7), seo_description: "Russian SEO description ".repeat(7),
      english_title: "", english_subtitle: "", english_excerpt: "", english_content_html: "", english_seo_title: "", english_seo_description: "",
      english_sources: "", english_bibliography: "", english_content_json: JSON.stringify({ type: "doc", content: [] }) });
    const operation = context(data), original = structuredClone(operation.submittedIntent);
    const view = setup({ autoTranslation: true, ...(failure ? { translationThrow: new Error(privateError) } : {}) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await view.canonical(data, operation);
    expect(result).toMatchObject({ outcome: "saved", operationId, receipt: { canonicalStatus: "published" } });
    expect(view.translate).toHaveBeenCalledTimes(1);
    expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_bundle_operation");
    const args = view.rpc.mock.calls[0][1];
    expect(args.p_submitted_intent).toEqual(original);
    expect(args.p_english_mode).toBe(failure ? "none" : "save");
    expect(new Map(args.p_submitted_intent.fields).get("english_title")).toBe("");
    expect(operation.submittedIntent).toEqual(original);
  });

  it("redacts provider Error text while preserving the exact legacy author payload and fallback", async () => {
    const patch = { id: undefined, expected_updated_at: undefined, english_expected_updated_at: undefined,
      intent: "publish", status: "published", english_enabled: "on", english_title: "", english_subtitle: "", english_excerpt: "",
      english_content_html: "", english_seo_title: "", english_seo_description: "", english_sources: "", english_bibliography: "",
      english_content_json: JSON.stringify({ type: "doc", content: [] }) };
    const failure = new Error(`${privateError}\n${ruBody}\n${enBody}`);
    const options = { autoTranslation: true, translationThrow: failure };
    const before = setup({ ...options, sourceDir: baselineRoot }), current = setup(options);
    const logs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logText = () => logs.mock.calls.flatMap(call => call.map(value =>
      value instanceof Error ? String(value) : JSON.stringify(value))).join("\n");
    const original = await before.canonical(form(patch));
    expect(logText()).toContain(privateError);
    expect(logText()).toContain(ruBody);
    expect(logText()).toContain(enBody);
    logs.mockClear();
    const saved = await current.canonical(form(patch));
    expect(saved).toEqual(original);
    expect(current.rpc.mock.calls).toEqual(before.rpc.mock.calls);
    expect(current.translate).toHaveBeenCalledTimes(1);
    expect(current.rpc).toHaveBeenCalledTimes(1);
    expect(logText()).not.toContain(privateError);
    expect(logText()).not.toContain(ruBody);
    expect(logText()).not.toContain(enBody);
    expect(logs).toHaveBeenCalledWith("Automatic article translation failed before publication", { code: "ARTICLE_AUTO_TRANSLATION_FAILED" });
  });
});
