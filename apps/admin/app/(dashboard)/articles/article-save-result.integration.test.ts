import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const nativeNavigation = nativeRequire("next/navigation");
const adminRoot = path.resolve(import.meta.dirname, "../../..");
const actionFiles = ["save-article-action.ts", "atomic-standard-save-action.ts"];
function loadAdmin(relative: string, mocks: Record<string, unknown>, cache = new Map<string, any>()): Record<string, any> {
  const filename = path.join(adminRoot, relative);
  if (cache.has(filename)) return cache.get(filename);
  const baseline = process.env.M02_ARTICLE_SAVE_SOURCE_DIR;
  const successBaseline = process.env.M02_ARTICLE_SUCCESS_SOURCE_ROOT;
  const successOverride = successBaseline ? path.resolve(successBaseline, relative) : null;
  const override = successOverride && existsSync(successOverride) ? successOverride : baseline && actionFiles.includes(path.basename(filename))
    ? path.join(baseline, path.basename(filename)) : filename;
  const compiled = ts.transpileModule(readFileSync(override, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const source = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (source) return loadAdmin(path.relative(adminRoot, source), mocks, cache);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const articleId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const previous = "2026-09-30T12:00:00.123456+00:00";
const englishPrevious = "2026-09-30T11:00:00.654321+00:00";
const next = "2026-09-30T12:00:00.123457+00:00";
const privateError = "PRIVATE_ARTICLE_PROVIDER_TOKEN=do_not_render";
const body = "Synthetic author text - punctuation \u2014 remains exact.";
const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] };
const formFields = {
  id: articleId, title: "Synthetic article", subtitle: "Synthetic subtitle", excerpt: "Synthetic excerpt",
  slug: "synthetic-article", content_html: `<p>${body}</p>`, content_json: JSON.stringify(document),
  status: "draft", seo_title: "Synthetic SEO", seo_description: "Synthetic description",
  canonical_url: "https://fixture.invalid/article/", expected_updated_at: previous,
  english_expected_updated_at: englishPrevious, working_draft_version: "0", intent: "save",
  english_title: "Synthetic English article", english_subtitle: "English subtitle", english_excerpt: "English excerpt",
  english_slug: "synthetic-english", english_content_html: "<p>English author body.</p>",
  english_content_json: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "English author body." }] }] }),
  english_status: "draft", preview_locale: "en",
};
const englishRow = {
  updated_at: englishPrevious, source_content_hash: null, status: "draft",
  content_json: JSON.parse(formFields.english_content_json), title: formFields.english_title,
  subtitle: formFields.english_subtitle, excerpt: formFields.english_excerpt, slug: formFields.english_slug,
  content_html: formFields.english_content_html, cover_alt: null, seo_title: null, seo_description: null,
  seo_keywords: null, canonical_url: null, og_title: null, og_description: null,
  sources: null, bibliography: null, approved_at: null, published_at: null,
};
function form(patch: Record<string, string | undefined> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ ...formFields, ...patch })) if (value !== undefined) result.set(key, value);
  return result;
}
type Options = {
  role?: string; noSession?: boolean; authThrow?: unknown; noClient?: boolean; clientThrow?: unknown;
  previousData?: unknown; previousError?: unknown; previousThrow?: unknown;
  englishData?: unknown; englishError?: unknown; englishThrow?: unknown;
  categoryData?: unknown; categoryError?: unknown; categoryThrow?: unknown;
  rpcData?: unknown; rpcError?: unknown; rpcThrow?: unknown; publicationThrow?: unknown; revalidationThrow?: unknown;
  afterThrow?: unknown; publicationState?: unknown;
  autoTranslation?: boolean; translationThrow?: unknown;
};
function setup(options: Options = {}) {
  const calls: { table: string; filters: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, filters: [] as unknown[] }; calls.push(call);
    const query = {
      select: vi.fn(() => query), eq: vi.fn((...args: unknown[]) => { call.filters.push(args); return query; }),
      single: vi.fn(() => read()), maybeSingle: vi.fn(() => read()),
    };
    async function read() {
      const prefix = table === "articles" ? "previous" : table === "article_translations" ? "english" : "category";
      const config = options as Record<string, unknown>;
      if (Object.hasOwn(config, prefix + "Throw")) throw config[prefix + "Throw"];
      const data = Object.hasOwn(config, prefix + "Data") ? config[prefix + "Data"]
        : table === "articles" ? { slug: "synthetic-article", status: "draft", published_at: null, updated_at: previous, categories: null }
          : table === "article_translations" ? null : { slug: "fixture-category" };
      return { data, error: config[prefix + "Error"] ?? null };
    }
    return query;
  });
  const rpc = vi.fn(async (name: string, _input: unknown) => {
    if (Object.hasOwn(options, "rpcThrow")) throw options.rpcThrow;
    return {
      data: Object.hasOwn(options, "rpcData") ? options.rpcData
        : name === "save_article_working_draft" ? { articleId, version: 1, updatedAt: next }
          : [{ article_id: articleId, article_updated_at: next, english_updated_at: null, homepage_replaced: 0 }],
      error: options.rpcError ?? null,
    };
  });
  const client = { from, rpc };
  const createClient = vi.fn(async () => {
    if (Object.hasOwn(options, "clientThrow")) throw options.clientThrow;
    return options.noClient ? null : client;
  });
  const requireStaff = vi.fn(async () => {
    if (Object.hasOwn(options, "authThrow")) throw options.authThrow;
    return options.noSession ? null : { user: { id: categoryId }, role: options.role || "admin" };
  });
  const publication = vi.fn(async () => {
    if (Object.hasOwn(options, "publicationThrow")) throw options.publicationThrow;
    return { state: Object.hasOwn(options, "publicationState") ? options.publicationState : "queued" };
  });
  const revalidatePath = vi.fn(() => {
    if (Object.hasOwn(options, "revalidationThrow")) throw options.revalidationThrow;
  });
  const afterCallbacks: (() => unknown)[] = [];
  const after = vi.fn((callback: () => unknown) => {
    if (Object.hasOwn(options, "afterThrow")) throw options.afterThrow;
    afterCallbacks.push(callback);
  });
  // The excluded normalizer is replaced, never imported or executed by this harness.
  const normalizeForm = vi.fn((_data: FormData) => undefined);
  const translate = vi.fn(async () => {
    if (Object.hasOwn(options, "translationThrow")) throw options.translationThrow;
    if (!options.autoTranslation) throw new Error("Paid translation must not run in this fixture");
    return { title: "Synthetic translated title", subtitle: "", excerpt: "Synthetic translated excerpt",
      content_html: "<p>Synthetic translation.</p>", cover_alt: "Synthetic translated cover",
      seo_title: "Synthetic translated SEO", seo_description: "Synthetic translated description",
      seo_keywords: [], og_title: "Synthetic translated OG", og_description: "Synthetic translated OG description",
      sources: [], bibliography: [], model: "fixture", reviewModel: "fixture", requestId: null, reviewRequestId: null };
  });
  const mocks = {
    "next/cache": { revalidatePath },
    "next/server": { after },
    "next/navigation": { unstable_rethrow: nativeNavigation.unstable_rethrow },
    "@/lib/navigation": { redirect: nativeNavigation.redirect }, "@/lib/auth": { requireStaff },
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://fixture.invalid", openAiAutoTranslateArticles: Boolean(options.autoTranslation),
      openAiApiKey: options.autoTranslation ? "fixture-only" : undefined } },
    "@/lib/supabase/server": { createServerSupabaseClient: createClient },
    "@/lib/publication": { requestPublicBuild: publication },
    "@/lib/short-hyphens": { normalizeShortHyphensFormData: normalizeForm },
    "@/lib/auto-translate-article": { translateArticleSourceToEnglish: translate },
  };
  const cache = new Map();
  const action = loadAdmin("app/(dashboard)/articles/save-article-publication-action.ts", mocks, cache).saveArticleAction as (data: FormData) => Promise<any>;
  const atomic = loadAdmin("app/(dashboard)/articles/atomic-standard-save-action.ts", mocks, cache).saveStandardArticleAtomically as (data: FormData) => Promise<any>;
  return { action, atomic, calls, from, rpc, createClient, requireStaff, publication, revalidatePath, after, afterCallbacks,
    normalizeForm, translate };
}
function beforeWrite(view: ReturnType<typeof setup>) {
  expect(view.rpc).not.toHaveBeenCalled(); expect(view.publication).not.toHaveBeenCalled();
  expect(view.revalidatePath).not.toHaveBeenCalled(); expect(view.translate).not.toHaveBeenCalled();
}
function safe(value: unknown) { expect(JSON.stringify(value)).not.toContain(privateError); }
function signal(which: "redirect" | "notFound") {
  try { which === "redirect" ? nativeNavigation.redirect("/fixture-native") : nativeNavigation.notFound(); }
  catch (error) { return error; }
  throw new Error("Expected native control signal");
}
async function redirectResult(run: Promise<unknown>) {
  try { await run; } catch (error) {
    expect((error as { digest?: string }).digest).toMatch(/^NEXT_REDIRECT;/u);
    return error as { digest: string };
  }
  throw new Error("Expected existing native redirect");
}

describe("M02 actual article prewrite refusal boundary", () => {
  it.each([
    [{ intent: "publish" }, { role: "editor" }, "permission"],
    [{ publication_override: "1" }, { role: "admin" }, "permission"],
    [{ intent: "publish", status: "scheduled", scheduled_at: undefined }, {}, "schedule"],
  ] as const)("returns canonical refusal for %j", async (patch, options, reason) => {
    const view = setup(options); const result = await view.action(form(patch));
    expect(result).toEqual({ outcome: "rejected", reason }); safe(result); beforeWrite(view);
    expect(view.createClient).not.toHaveBeenCalled();
  });
  it.each([
    { title: "x" }, { id: "bad" }, { canonical_url: "invalid" },
    { category_id: "bad" }, { cover_external_url: "invalid" }, { content_html: "x".repeat(2_000_001) },
  ])("returns atomic Russian validation refusal %#", async patch => {
    const view = setup(); const result = await view.atomic(form(patch));
    expect(result).toEqual({ outcome: "rejected", reason: "validation" }); beforeWrite(view);
    expect(view.createClient).not.toHaveBeenCalled();
  });
  it.each([{ english_title: "x" }, { english_canonical_url: "invalid" }, { english_content_html: "x".repeat(2_000_001) }])(
    "returns atomic English validation refusal %#", async patch => {
      const view = setup(); expect(await view.atomic(form({ ...patch, english_enabled: "on" })))
        .toEqual({ outcome: "rejected", reason: "english-validation" }); beforeWrite(view);
      expect(view.createClient).not.toHaveBeenCalled();
    }
  );
  it.each([privateError, "null", "[]", '{"type":"text"}'])("holds malformed Russian JSON %s", async content_json => {
    const view = setup(); const result = await view.atomic(form({ content_json }));
    expect(result).toEqual({ outcome: "rejected", reason: "content" }); safe(result); beforeWrite(view);
  });
  it.each([privateError, "null", "[]", '{"type":"text"}'])("holds malformed English JSON %s", async english_content_json => {
    const view = setup(); const result = await view.atomic(form({ english_enabled: "on", english_content_json }));
    expect(result).toEqual({ outcome: "rejected", reason: "english-content" }); safe(result); beforeWrite(view);
  });
  it("rejects actual media mismatch before write", async () => {
    const content = { type: "doc", content: [{ type: "image", attrs: { src: "https://fixture.invalid/a.jpg", alt: "A", mediaId: articleId } }] };
    const view = setup(); expect(await view.atomic(form({ content_json: JSON.stringify(content) })))
      .toEqual({ outcome: "rejected", reason: "media" }); beforeWrite(view);
  });
  it.each([{ noClient: true }, { clientThrow: new Error(privateError) }])("holds prewrite client failure %j", async options => {
    const view = setup(options); const result = await view.action(form());
    expect(result).toEqual({ outcome: "dependency-unavailable" }); safe(result); beforeWrite(view);
  });
  it.each([
    { previousError: { message: privateError } }, { previousThrow: new Error(privateError) }, { previousData: null },
    { englishError: { message: privateError } }, { englishThrow: new Error(privateError) },
  ])("holds required existing bundle read failure %j", async options => {
    const view = setup(options); const result = await view.action(form());
    expect(result).toEqual({ outcome: "dependency-unavailable" }); safe(result); beforeWrite(view);
  });
  it.each([
    { updated_at: previous }, { slug: "synthetic-article", published_at: previous, updated_at: previous, categories: null },
    { slug: "synthetic-article", status: "bad", published_at: null, updated_at: previous, categories: null },
    { slug: "synthetic-article", status: ["published"], published_at: previous, updated_at: previous, categories: null },
    { slug: "synthetic-article", status: "published", published_at: previous, updated_at: previous },
    { slug: "synthetic-article", status: "published", published_at: previous, updated_at: previous, categories: [{}] },
  ])("holds incomplete primary read instead of choosing live persistence %#", async previousData => {
    const view = setup({ previousData }); expect(await view.atomic(form())).toEqual({ outcome: "dependency-unavailable" }); beforeWrite(view);
  });
  it.each([null, [], { slug: "fixture-category" }, [{ slug: "fixture-category" }]])(
    "preserves genuine primary relation projection %#", async categories => {
      const view = setup({ previousData: { slug: "synthetic-article", status: "published", published_at: previous, updated_at: previous, categories } });
      const native = await redirectResult(view.atomic(form())); expect(native.digest).toContain("saved=working-draft");
      expect(view.rpc.mock.calls[0][0]).toBe("save_article_working_draft"); expect(view.publication).not.toHaveBeenCalled();
    }
  );
  it.each([{}, [], 42, { ...englishRow, title: null }, { ...englishRow, sources: {} },
    { ...englishRow, seo_keywords: [42] }, { ...englishRow, content_json: undefined }])(
    "holds incomplete ownership read before changing submitted EN metadata %#", async englishData => {
      const view = setup({ englishData }); const data = form({ english_enabled: "on" });
      const before = [...data.entries()]; const result = await view.action(data);
      expect(result).toEqual({ outcome: "dependency-unavailable" }); expect([...data.entries()]).toEqual(before); beforeWrite(view);
    }
  );
  it.each([{ updated_at: englishPrevious }, { ...englishRow, approved_at: undefined },
    { ...englishRow, status: ["published"] }, { ...englishRow, bibliography: {} }])(
    "holds incomplete direct atomic EN read before CAS and persistence %#", async englishData => {
      const view = setup({ englishData }); expect(await view.atomic(form({ english_enabled: "on" })))
        .toEqual({ outcome: "dependency-unavailable" }); beforeWrite(view);
    }
  );
  it("does not strip ownership on failed EN read even when a later read would succeed", async () => {
    const view = setup({ englishError: { message: privateError } }); const data = form({ english_enabled: "on" });
    const before = [...data.entries()]; const result = await view.action(data);
    expect(result).toEqual({ outcome: "dependency-unavailable" }); expect([...data.entries()]).toEqual(before);
    expect(view.createClient).toHaveBeenCalledTimes(1); beforeWrite(view);
  });
  it.each([{ ...englishRow }, { ...englishRow, sources: ["Legacy source", { text: "Manual source" }], bibliography: [] }])(
    "preserves valid nullable and legacy human EN through the canonical save %#", async englishData => {
      const view = setup({ englishData }); const native = await redirectResult(view.action(form({ english_enabled: "on" })));
      expect(native.digest).toContain("saved=1"); expect(view.rpc).toHaveBeenCalledTimes(1);
      expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_english_mode: "save", p_expected_english_updated_at: englishPrevious,
        p_english_payload: { title: formFields.english_title, content_html: formFields.english_content_html } });
    }
  );
  it.each([{ categoryError: { message: privateError } }, { categoryThrow: new Error(privateError) }, { categoryData: null }])(
    "holds selected category read failure %j", async options => {
      const view = setup(options); const result = await view.atomic(form({ category_id: categoryId }));
      expect(result).toEqual({ outcome: "dependency-unavailable" }); safe(result); beforeWrite(view);
    }
  );
  it.each([undefined, "old", "2026-09-30T12:00:00.123455+00:00"])("holds stale/missing Russian CAS %s", async expected_updated_at => {
    const view = setup(); expect(await view.atomic(form({ expected_updated_at })))
      .toEqual({ outcome: "conflict", scope: "article" }); beforeWrite(view);
  });
  it.each([undefined, "old", "2026-09-30T11:00:00.654320+00:00"])("holds stale/missing English CAS %s", async english_expected_updated_at => {
    const view = setup({ englishData: { ...englishRow } });
    expect(await view.atomic(form({ english_expected_updated_at }))).toEqual({ outcome: "conflict", scope: "english" });
    beforeWrite(view);
  });
  it.each(["-1", "1.5", "bad"])("holds invalid working draft CAS %s", async working_draft_version => {
    const view = setup(); expect(await view.atomic(form({ working_draft_version })))
      .toEqual({ outcome: "conflict", scope: "article" }); beforeWrite(view);
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s during authentication", async kind => {
    const native = signal(kind), view = setup({ authThrow: native });
    await expect(view.action(form())).rejects.toBe(native); beforeWrite(view);
  });
  it("preserves native login redirect when unauthenticated", async () => {
    const view = setup({ noSession: true }); const native = await redirectResult(view.action(form()));
    expect(native.digest).toContain("/login"); beforeWrite(view);
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s during client initialization", async kind => {
    const native = signal(kind), view = setup({ clientThrow: native });
    await expect(view.action(form())).rejects.toBe(native); beforeWrite(view);
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s during required read", async kind => {
    const native = signal(kind), view = setup({ previousThrow: native });
    await expect(view.atomic(form())).rejects.toBe(native); beforeWrite(view);
  });
  it("preserves exact RU/EN fields and RPC CAS arguments on the existing success path", async () => {
    const view = setup(); const data = form({ english_enabled: "on" });
    const native = await redirectResult(view.action(data));
    expect(native.digest).toContain("saved=1"); expect(view.rpc).toHaveBeenCalledTimes(1);
    const [name, input] = view.rpc.mock.calls[0];
    expect(name).toBe("save_article_bundle");
    expect(input).toMatchObject({ p_article_id: articleId, p_expected_article_updated_at: previous,
      p_english_mode: "save", p_expected_english_updated_at: englishPrevious,
      p_article_payload: { title: formFields.title, content_html: formFields.content_html, content_json: document },
      p_english_payload: { title: formFields.english_title, content_html: formFields.english_content_html } });
    expect(Object.keys(input as object)).not.toContain("p_operation_id");
    expect(view.normalizeForm).toHaveBeenCalledTimes(2); expect(view.translate).not.toHaveBeenCalled();
  });
  it("keeps real published working draft persistence and its private CAS", async () => {
    const view = setup({ previousData: { slug: "synthetic-article", status: "published", published_at: previous, updated_at: previous, categories: null } });
    const native = await redirectResult(view.action(form({ status: "published" })));
    expect(native.digest).toContain("saved=working-draft"); expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.rpc.mock.calls[0]).toEqual(["save_article_working_draft", expect.objectContaining({
      p_article_id: articleId, p_base_article_updated_at: previous, p_expected_version: 0,
      p_payload: expect.objectContaining({ content_html: formFields.content_html, content_json: document }),
      p_english_payload: { mode: "disabled" },
    })]); expect(view.publication).not.toHaveBeenCalled();
  });
  it("keeps preview navigation native after acknowledged save", async () => {
    const view = setup(); const native = await redirectResult(view.action(form({ intent: "preview" })));
    expect(native.digest).toContain(`/articles/${articleId}/preview?locale=en`); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { rpcError: { code: "40001", message: "ARTICLE_CONFLICT" } },
    { rpcError: { code: "", message: privateError } },
    { rpcData: null }, { rpcThrow: new Error(privateError) },
  ])("holds unconfirmed bundle RPC failure in the form %j", async options => {
    const view = setup(options); const result = await view.action(form());
    expect(result).toEqual({ outcome: "unknown-outcome" }); safe(result); expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.publication).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it.each([{ rpcData: null }, { rpcThrow: new Error(privateError) }])("holds working draft reply loss in the form %j", async options => {
    const view = setup({ ...options, previousData: { slug: "synthetic-article", status: "published", published_at: previous, updated_at: previous, categories: null } });
    const result = await view.action(form()); expect(result).toEqual({ outcome: "unknown-outcome" }); safe(result);
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.rpc.mock.calls[0][0]).toBe("save_article_working_draft");
    expect(view.publication).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s from RPC rather than creating an unknown result", async kind => {
    const native = signal(kind), view = setup({ rpcThrow: native });
    await expect(view.action(form())).rejects.toBe(native); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s from synthetic translation without RU fallback", async kind => {
    const native = signal(kind), view = setup({ autoTranslation: true, translationThrow: native });
    await expect(view.action(form({ intent: "publish", english_enabled: "on", english_title: "", english_excerpt: "",
      english_content_html: "", english_seo_title: "", english_seo_description: "", english_sources: "", english_bibliography: "" })))
      .rejects.toBe(native);
    expect(view.translate).toHaveBeenCalledTimes(1); expect(view.rpc).not.toHaveBeenCalled(); expect(view.normalizeForm).toHaveBeenCalledTimes(1);
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s from synthetic translation category lookup without RU fallback", async kind => {
    const native = signal(kind), view = setup({ autoTranslation: true, categoryThrow: native });
    await expect(view.action(form({ intent: "publish", english_enabled: "on", category_id: categoryId,
      english_title: "", english_excerpt: "", english_content_html: "", english_seo_title: "",
      english_seo_description: "", english_sources: "", english_bibliography: "" }))).rejects.toBe(native);
    expect(view.translate).toHaveBeenCalledTimes(1); expect(view.rpc).not.toHaveBeenCalled(); expect(view.normalizeForm).toHaveBeenCalledTimes(1);
  });
  it("does not claim prewrite refusal after a postcommit revalidation throw", async () => {
    const failure = new Error(privateError), view = setup({ revalidationThrow: failure });
    await expect(view.action(form())).rejects.toBe(failure); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("M02 finite article prewrite result parser", () => {
  const parse = loadAdmin("lib/article-save-result.ts", {}).parseArticleSaveResult;
  it.each(["validation", "english-validation", "content", "english-content", "media", "permission", "schedule"])(
    "accepts finite safe rejected reason %s", reason => {
      expect(parse({ outcome: "rejected", reason })).toEqual({ outcome: "rejected", reason });
    }
  );
  it.each([{ outcome: "dependency-unavailable" }, { outcome: "unknown-outcome" }, { outcome: "conflict", scope: "article" }, { outcome: "conflict", scope: "english" }])(
    "accepts safe known result %j", result => expect(parse(result)).toEqual(result)
  );
  it.each([null, undefined, [], "saved", { outcome: "saved" }, { outcome: "rejected", reason: privateError },
    { outcome: "rejected", reason: "validation", message: privateError },
    { outcome: "dependency-unavailable", retryable: true }, { outcome: "conflict", scope: "unknown" },
    { outcome: "conflict" }, { outcome: "unknown-outcome", receipt: "invented" }, { saved: 1 }])(
    "rejects unsupported or raw message result %j", result => expect(parse(result)).toBeNull()
  );
});

function receiptForm(patch: Record<string, string | undefined> = {}) {
  return form({ ...patch, article_result_mode: "receipt" });
}
const publishedArticle = { slug: "synthetic-article", status: "published", published_at: previous,
  updated_at: previous, categories: null };
const englishNext = "2026-09-30T11:00:00.654322+00:00";
function bundleReply(patch: Record<string, unknown> = {}) {
  return [{ article_id: articleId, article_updated_at: next, english_updated_at: null, homepage_replaced: 0, ...patch }];
}

describe("M02 actual Article saved acknowledgement without replacing the mounted form", () => {
  it("returns a canonical receipt and schedules cache work while preserving exact submitted text/CAS and normalizer calls", async () => {
    const view = setup();
    const result = await view.action(receiptForm());
    expect(result).toEqual({ outcome: "saved", persistence: "article-bundle",
      receipt: { articleId, articleUpdatedAt: next, englishUpdatedAt: null, workingDraftVersion: 0,
        workingDraftUpdatedAt: null, canonicalStatus: "draft" },
      publicationState: "not-requested", revalidationState: "scheduled", destination: `/articles/edit?id=${articleId}&saved=1` });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.publication).not.toHaveBeenCalled();
    expect(view.revalidatePath).not.toHaveBeenCalled(); expect(view.after).toHaveBeenCalledTimes(1);
    expect(view.normalizeForm).toHaveBeenCalledTimes(2); expect(view.translate).not.toHaveBeenCalled();
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_expected_article_updated_at: previous,
      p_article_payload: { title: formFields.title, content_html: formFields.content_html, content_json: document } });
    expect(Object.keys(view.rpc.mock.calls[0][1] as object)).not.toContain("p_operation_id");
    await view.afterCallbacks[0]();
    expect(view.revalidatePath.mock.calls).toEqual([["/dashboard"], ["/articles"]]); safe(result);
  });
  it("returns the new created identity for a new/copy submission rather than a source article identity", async () => {
    const createdId = "33333333-3333-4333-8333-333333333333";
    const view = setup({ rpcData: bundleReply({ article_id: createdId }) });
    const result = await view.action(receiptForm({ id: undefined, expected_updated_at: undefined,
      english_expected_updated_at: undefined }));
    expect(result).toMatchObject({ outcome: "saved", persistence: "article-bundle",
      receipt: { articleId: createdId, articleUpdatedAt: next }, destination: `/articles/edit?id=${createdId}&saved=1` });
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_article_id: null, p_expected_article_updated_at: null });
    expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("returns an actual bilingual receipt with separate microsecond versions and unchanged manual English", async () => {
    const view = setup({ englishData: { ...englishRow }, rpcData: bundleReply({ english_updated_at: englishNext }) });
    const result = await view.action(receiptForm({ english_enabled: "on" }));
    expect(result).toMatchObject({ outcome: "saved", receipt: { articleUpdatedAt: next, englishUpdatedAt: englishNext } });
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_english_mode: "save", p_expected_english_updated_at: englishPrevious,
      p_english_payload: { title: formFields.english_title, content_html: formFields.english_content_html } });
    expect(view.translate).not.toHaveBeenCalled();
  });
  it("acknowledges EN mode none with null returned stamp while keeping the existing prewrite CAS check", async () => {
    const view = setup({ englishData: { ...englishRow } });
    const result = await view.action(receiptForm());
    expect(result).toMatchObject({ outcome: "saved", receipt: { englishUpdatedAt: null } });
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_english_mode: "none", p_expected_english_updated_at: null });
  });
  it.each(["save", "preview"])("returns working-draft receipt for %s using original live CAS and actual next private version", async intent => {
    const view = setup({ previousData: publishedArticle, rpcData: { articleId, version: 5, updatedAt: next } });
    const result = await view.action(receiptForm({ intent, working_draft_version: "4", status: "published" }));
    expect(result).toMatchObject({ outcome: "saved", persistence: "working-draft",
      receipt: { articleId, articleUpdatedAt: previous, englishUpdatedAt: englishPrevious, workingDraftVersion: 5,
        workingDraftUpdatedAt: next, canonicalStatus: "published" }, publicationState: "not-requested", revalidationState: "scheduled" });
    expect(result.destination).toBe(intent === "preview" ? `/articles/${articleId}/preview?locale=en`
      : `/articles/edit?id=${articleId}&saved=working-draft`);
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_base_article_updated_at: previous,
      p_expected_english_updated_at: englishPrevious, p_expected_version: 4 });
    expect(view.publication).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled();
    await view.afterCallbacks[0](); expect(view.revalidatePath.mock.calls).toEqual([["/articles/edit"], [`/articles/${articleId}/preview`]]);
  });
  it("returns a preview target after acknowledged bundle save without triggering a native redirect", async () => {
    const view = setup(); const result = await view.action(receiptForm({ intent: "preview", preview_locale: "ru" }));
    expect(result).toMatchObject({ outcome: "saved", destination: `/articles/${articleId}/preview?locale=ru` });
  });
  it("acknowledges a working-draft promotion separately from public-site delivery", async () => {
    const view = setup(); const result = await view.action(receiptForm({ intent: "publish", status: "hidden", working_draft_version: "4" }));
    expect(result).toMatchObject({ outcome: "saved", persistence: "working-draft-promotion",
      receipt: { articleUpdatedAt: next, workingDraftVersion: 0, workingDraftUpdatedAt: null, canonicalStatus: "hidden" },
      publicationState: "queued", revalidationState: "scheduled" });
    expect(view.rpc.mock.calls[0][0]).toBe("promote_article_working_draft");
    expect(view.rpc.mock.calls[0][1]).toMatchObject({ p_expected_working_draft_version: 4 });
    expect(view.publication).toHaveBeenCalledTimes(1); expect(result.destination).toContain("publish=queued");
  });
  it("retains a published live article when failed release checks acknowledge only its working draft", async () => {
    const view = setup({ previousData: publishedArticle });
    const result = await view.action(receiptForm({ intent: "publish", status: "published" }));
    expect(result).toMatchObject({ outcome: "saved", persistence: "working-draft",
      receipt: { canonicalStatus: "published", articleUpdatedAt: previous }, publicationState: "not-requested" });
    expect(result.destination).toContain("error="); expect(view.publication).not.toHaveBeenCalled();
    expect(view.rpc.mock.calls[0][0]).toBe("save_article_working_draft");
  });
  it.each(["started", "queued", "queue-error"])("reports %s publication independently after known commit", async publicationState => {
    const view = setup({ publicationState });
    const result = await view.action(receiptForm({ intent: "publish", status: "hidden" }));
    expect(result).toMatchObject({ outcome: "saved", publicationState, receipt: { articleUpdatedAt: next } });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.publication).toHaveBeenCalledTimes(1);
  });
  it.each([{ publicationThrow: new Error(privateError) }, { publicationState: "invalid" }, { publicationState: null }])(
    "keeps confirmed commit when publication completion is unconfirmed %j", async options => {
      const view = setup(options); const result = await view.action(receiptForm({ intent: "publish", status: "hidden" }));
      expect(result).toMatchObject({ outcome: "saved", publicationState: "unknown", receipt: { articleUpdatedAt: next } });
      expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.after).toHaveBeenCalledTimes(1); safe(result);
    });
  it("keeps confirmed commit when deferred cache registration fails", async () => {
    const view = setup({ afterThrow: new Error(privateError) }); const result = await view.action(receiptForm());
    expect(result).toMatchObject({ outcome: "saved", revalidationState: "unknown", receipt: { articleUpdatedAt: next } });
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.revalidatePath).not.toHaveBeenCalled(); safe(result);
  });
  it("does not claim completed cache work or revoke receipt if the after callback later fails", async () => {
    const view = setup({ revalidationThrow: new Error(privateError) }); const result = await view.action(receiptForm());
    expect(result).toMatchObject({ outcome: "saved", revalidationState: "scheduled" });
    await expect(Promise.resolve().then(view.afterCallbacks[0])).resolves.toBeUndefined();
    expect(result).toMatchObject({ outcome: "saved", revalidationState: "scheduled" }); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([null, [], [bundleReply()[0], bundleReply()[0]], { article_id: articleId },
    bundleReply({ article_id: "not-a-uuid" }), bundleReply({ article_id: categoryId }), bundleReply({ article_id: [articleId] }),
    bundleReply({ article_updated_at: previous }), bundleReply({ article_updated_at: "2026-09-30T12:00:00.1234560Z" }),
    bundleReply({ article_updated_at: "invalid" }), bundleReply({ article_updated_at: 123 }),
    bundleReply({ english_updated_at: false }), bundleReply({ english_updated_at: 0 }),
    bundleReply({ homepage_replaced: "0" }), bundleReply({ homepage_replaced: -1 }), bundleReply({ homepage_replaced: 0.5 }),
    bundleReply({ homepage_replaced: null }), bundleReply({ homepage_replaced: 2_147_483_648 }),
  ])("holds invalid or unchanged original bundle receipt before any post-save effect %#", async rpcData => {
    const view = setup({ rpcData }); const result = await view.action(receiptForm());
    expect(result).toEqual({ outcome: "unknown-outcome" }); expect(view.rpc).toHaveBeenCalledTimes(1);
    expect(view.publication).not.toHaveBeenCalled(); expect(view.after).not.toHaveBeenCalled(); expect(view.revalidatePath).not.toHaveBeenCalled(); safe(result);
  });
  it.each([null, englishPrevious, "2026-09-30T11:00:00.6543210Z"])("holds missing/unchanged EN-save acknowledgement %s", async english_updated_at => {
    const view = setup({ englishData: { ...englishRow }, rpcData: bundleReply({ english_updated_at }) });
    expect(await view.action(receiptForm({ english_enabled: "on" }))).toEqual({ outcome: "unknown-outcome" });
    expect(view.after).not.toHaveBeenCalled(); expect(view.publication).not.toHaveBeenCalled();
  });
  it("holds an EN timestamp unexpectedly returned for mode none", async () => {
    const view = setup({ rpcData: bundleReply({ english_updated_at: englishNext }) });
    expect(await view.action(receiptForm())).toEqual({ outcome: "unknown-outcome" }); expect(view.after).not.toHaveBeenCalled();
  });
  it.each([{ articleId: categoryId, version: 1, updatedAt: next }, { articleId, version: 0, updatedAt: next },
    { articleId, version: 2, updatedAt: next }, { articleId, version: Number.MAX_SAFE_INTEGER + 1, updatedAt: next },
    { articleId, version: true, updatedAt: next },
    { articleId, version: 1, updatedAt: null }])("holds invalid original working-draft acknowledgement %#", async rpcData => {
    const view = setup({ previousData: publishedArticle, rpcData });
    expect(await view.action(receiptForm())).toEqual({ outcome: "unknown-outcome" });
    expect(view.after).not.toHaveBeenCalled(); expect(view.publication).not.toHaveBeenCalled(); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s from postcommit publication", async kind => {
    const native = signal(kind), view = setup({ publicationThrow: native });
    await expect(view.action(receiptForm({ intent: "publish", status: "hidden" }))).rejects.toBe(native);
    expect(view.rpc).toHaveBeenCalledTimes(1); expect(view.after).not.toHaveBeenCalled();
  });
  it.each(["redirect", "notFound"] as const)("preserves native %s from after registration", async kind => {
    const native = signal(kind), view = setup({ afterThrow: native });
    await expect(view.action(receiptForm())).rejects.toBe(native); expect(view.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not use unsupported response mode to bypass legacy native transition", async () => {
    const view = setup(); const native = await redirectResult(view.action(form({ article_result_mode: "unknown" })));
    expect(native.digest).toContain("saved=1"); expect(view.after).not.toHaveBeenCalled();
  });
});
