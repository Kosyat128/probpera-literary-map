import { createHash, webcrypto } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

type Row = Record<string, any>;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const nativeRequire = createRequire(import.meta.url), graph = new Map<string, Row>();
const baseline = process.env.M07_ENGLISH_HUMAN_BASELINE_ROOT;
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const cache = new Map<string, Row>();
function load(file: string): Row {
  if (cache.has(file)) return cache.get(file)!;
  const actual = path.join(baseline || root, file);
  if (!existsSync(actual)) throw new Error("Missing exact source: " + actual);
  const bytes = readFileSync(actual);
  graph.set(file, { source: path.relative(root, actual).replaceAll("\\", "/"), sha256: sha(bytes) });
  const module = { exports: {} as Row }; cache.set(file, module.exports);
  const require = (name: string) => {
    if (name.startsWith(".")) {
      const resolved = path.resolve(path.dirname(path.join(root, file)), name);
      for (const extension of [".ts", ".tsx"]) {
        const relative = path.relative(root, resolved + extension);
        if (existsSync(path.join(baseline || root, relative))) return load(relative);
      }
      throw new Error("Missing captured dependency " + name);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", ts.transpileModule(bytes.toString(), {
    fileName: actual, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText)(require, module, module.exports);
  return module.exports;
}
const validation = load("apps/admin/components/article-editor/useArticleValidation.ts");
const translations = load("apps/admin/lib/article-translations.ts");
const helperFile = "apps/admin/lib/article-english-human-confirmation.ts";
const helper = existsSync(path.join(baseline || root, helperFile)) ? load(helperFile) : null;
const articleId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", englishId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actorId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", otherId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const stamp = "2026-10-08T10:00:00.123456+00:00", reviewed = "2026-10-07T10:00:00.654321Z";
const label = "Английская версия: перевод сверен с текущим оригиналом";
const clone = (value: Row) => structuredClone(value);
function source(row: Row) {
  return { title: row.title, subtitle: row.subtitle || "", excerpt: row.excerpt || "", contentJson: row.content_json || { type: "doc", content: [] },
    contentHtml: row.content_html || "", coverAlt: row.cover_alt || "", slug: row.slug, sources: row.sources || [], bibliography: row.bibliography || [],
    seoTitle: row.seo_title || row.title, seoDescription: row.seo_description || row.excerpt || "", seoKeywords: row.seo_keywords || [],
    ogTitle: row.og_title || row.seo_title || row.title, ogDescription: row.og_description || row.seo_description || row.excerpt || "" };
}
function displayed(row: Row) {
  const list = (items: any[]) => items.map(item => typeof item === "string" ? item : item.text || "").filter(Boolean).join("\n");
  return { title: row.title, subtitle: row.subtitle, excerpt: row.excerpt, slug: row.slug, contentHtml: row.content_html,
    contentJson: JSON.stringify(row.content_json), coverAlt: row.cover_alt, seoTitle: row.seo_title || "", seoDescription: row.seo_description || "",
    seoKeywords: row.seo_keywords.join(", "), canonicalUrl: row.canonical_url || "", ogTitle: row.og_title || "", ogDescription: row.og_description || "",
    sourceText: list(row.sources), bibliographyText: list(row.bibliography) };
}
function setup() {
  const row = { title: "Авторский оригинал \u2014 права и источники", subtitle: "Подзаголовок", excerpt: "Длинное авторское описание. ".repeat(5), slug: "original-ru",
    content_html: `<h2>Оригинал</h2><p>${"авторское слово ".repeat(260)}</p>`,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Авторский оригинал \u2014 ё" }] }], rights: { holder: "Автор", consent: "Не менять" } },
    cover_alt: "Авторская подпись обложки", seo_title: "Авторский SEO", seo_description: "Описание для поиска. ".repeat(7), seo_keywords: ["автор", "источники"],
    canonical_url: "https://site.invalid/articles/original-ru", og_title: "Авторский OG", og_description: "Авторское описание",
    sources: [{ text: "https://source.invalid/ru", rights: "Original source rights" }, "Exact string source"], bibliography: [{ text: "Original book", isbn: "Exact ISBN" }] };
  const article: Row = { ...row, id: articleId, updated_at: stamp, status: "published" };
  const canonical: Row = { ...clone(row), id: englishId, article_id: articleId, locale: "en", updated_at: stamp, title: "Human confirmed English", subtitle: "English subtitle",
    excerpt: "Detailed English card description. ".repeat(5), slug: "original-en", content_html: `<h2>Original</h2><p>${"original English word ".repeat(260)}</p>`,
    content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Human English \u2014 rights" }] }], rights: { holder: "Author", consent: "Exact permission" } },
    cover_alt: "Original photographer and cover", seo_title: "Original English SEO", seo_description: "Detailed English search description. ".repeat(5), seo_keywords: ["author", "sources"],
    canonical_url: "https://site.invalid/en/articles/original-en", og_title: "Original English OG", og_description: "Original English description",
    sources: [{ text: "https://source.invalid/en", rights: "Exact source rights" }], bibliography: [{ text: "Original book", isbn: "Original ISBN" }], status: "published",
    reviewed_by: actorId, reviewed_at: reviewed, approved_by: actorId, approved_at: reviewed, published_at: reviewed,
    source_content_hash: translations.articleTranslationSourceHash(source(article)), source_article_updated_at: stamp };
  const english = clone(canonical);
  const current: Row = { ...displayed(article), categoryId: "original-category", coverUrl: "https://media.invalid/cover.webp", status: "published", scheduledAt: "",
    english: { ...displayed(english), enabled: true, status: "published", confirmedCurrentSource: false }, russianSourceChanged: false };
  return { article, englishTranslation: english, canonicalEnglishTranslation: canonical, current };
}
function input(view: Row, proof: boolean) {
  const ru = view.current, en = ru.english;
  return { ...ru, englishEnabled: en.enabled, englishStatus: en.status, englishTitle: en.title, englishSubtitle: en.subtitle, englishSlug: en.slug,
    englishContentHtml: en.contentHtml, englishContentJson: en.contentJson, englishExcerpt: en.excerpt, englishCoverAlt: en.coverAlt,
    englishSeoTitle: en.seoTitle, englishSeoDescription: en.seoDescription, englishSeoKeywords: en.seoKeywords, englishOgTitle: en.ogTitle,
    englishOgDescription: en.ogDescription, englishSourceText: en.sourceText, englishBibliographyText: en.bibliographyText,
    englishConfirmedCurrentSource: en.confirmedCurrentSource, englishSourceContentHash: view.englishTranslation.source_content_hash,
    englishPreviouslyHumanConfirmed: proof };
}
const traces: Row[] = [];
async function check(name: string, mutate: (view: Row) => void, expected: boolean, crypto: any = webcrypto.subtle) {
  const view = setup(); mutate(view);
  const before = JSON.stringify(view);
  // The old runtime has no human-proof capability. Load no current fallback into its captured closure.
  const proof = helper ? await helper.isPreviouslyHumanConfirmedArticleEnglish(view, crypto) : false;
  const result = validation.buildArticleValidation(input(view, proof));
  const actual = result.checks.find((item: Row) => item.label === label)?.ok;
  traces.push({ name, expected, actual, proof, unchanged: JSON.stringify(view) === before });
  expect(JSON.stringify(view)).toBe(before);
  expect(actual).toBe(expected);
}
describe("M07 SAME English human confirmation distinguishes machine completion from editorial review", () => {
  for (const status of ["draft", "approved", "published"]) it(`does not green a private machine draft after selecting ${status}`, () => check(status, view => {
    view.article.working_draft_version = 1; view.article.working_draft_scope = "english-only";
    Object.assign(view.englishTranslation, { status: "draft", reviewed_at: null, reviewed_by: null, approved_at: null, approved_by: null, published_at: null,
      content_json: { type: "doc", content: [], __probperaPremiumTranslation: { version: 1, method: "machine-translation", sourceHash: view.englishTranslation.source_content_hash } } });
    Object.assign(view.current.english, displayed(view.englishTranslation), { status });
  }, false));
  it("keeps unchanged genuinely human confirmed canonical English", () => check("canonical human", () => {}, true));
  it("keeps human confirmed English while choosing approved", () => check("canonical approved", view => { view.current.english.status = "approved"; }, true));
  it("keeps an identical private overlay only with matching actual human marks", () => check("identical human overlay", view => {
    view.article.working_draft_version = 2; view.article.working_draft_scope = "english-only";
  }, true));
  it("accepts equivalent UTC offsets without losing microseconds", () => check("equivalent UTC", view => {
    view.canonicalEnglishTranslation.source_article_updated_at = "2026-10-08T13:00:00.123456+03:00";
    view.englishTranslation.source_article_updated_at = view.canonicalEnglishTranslation.source_article_updated_at;
  }, true));
  it("requires fresh human confirmation for a microsecond-different source revision", () => check("source precision", view => {
    view.canonicalEnglishTranslation.source_article_updated_at = "2026-10-08T10:00:00.123457Z";
  }, false));
  it("requires a matching actual source hash", () => check("source hash", view => {
    view.canonicalEnglishTranslation.source_content_hash = "f".repeat(64); view.englishTranslation.source_content_hash = "f".repeat(64);
  }, false));
  it("does not reuse approvals against an altered loaded private Russian bundle", () => check("private RU overlay", view => {
    view.article.title = "Changed private Russian title"; view.current.title = view.article.title; view.article.working_draft_version = 2;
  }, false));
  for (const field of ["title", "contentHtml", "contentJson", "sourceText", "bibliographyText", "seoDescription", "canonicalUrl"]) it(`invalidates human confirmation when current English ${field} changes`, () => check("changed EN " + field, view => {
    view.current.english[field] = field === "contentJson" ? JSON.stringify({ type: "doc", content: [] }) : view.current.english[field] + " changed";
  }, false));
  it("invalidates confirmation for changed Russian fields even without a dirty flag", () => check("changed RU", view => {
    view.current.title += " изменено";
  }, false));
  for (const field of ["reviewed_by", "reviewed_at", "approved_by", "approved_at"]) it(`does not invent missing canonical ${field}`, () => check("missing human " + field, view => {
    view.canonicalEnglishTranslation[field] = null; view.englishTranslation[field] = null;
  }, false));
  it("does not inherit older canonical approvals into a new private overlay", () => check("private copied approval", view => {
    view.englishTranslation.title = "New private English text"; view.current.english.title = view.englishTranslation.title;
  }, false));
  it("rejects a different approving actor in the private overlay", () => check("different approver", view => {
    view.englishTranslation.approved_by = otherId;
  }, false));
  it("rejects malformed human stamps", () => check("invalid human stamp", view => {
    view.canonicalEnglishTranslation.approved_at = "not-a-date"; view.englishTranslation.approved_at = "not-a-date";
  }, false));
  it("rejects a foreign English identity", () => check("foreign English", view => {
    view.englishTranslation.article_id = otherId;
  }, false));
  it("requires confirmation for canonical machine provenance carrying old automatic dates", () => check("legacy automatic dates", view => {
    const doc = { type: "doc", content: [], __probperaPremiumTranslation: { version: 1, method: "machine-translation", sourceHash: view.englishTranslation.source_content_hash } };
    view.canonicalEnglishTranslation.content_json = doc; view.englishTranslation.content_json = clone(doc); view.current.english.contentJson = JSON.stringify(doc);
  }, false));
  it("accepts the explicit human checkbox for a newly prepared draft", () => check("explicit human confirmation", view => {
    view.englishTranslation.reviewed_at = null; view.englishTranslation.approved_at = null; view.current.english.confirmedCurrentSource = true;
  }, true));
  it("keeps fresh confirmation required after Russian changes", () => check("RU dirty", view => { view.current.russianSourceChanged = true; }, false));
  it("fails closed when local WebCrypto is unavailable", () => check("unavailable local crypto", () => {}, false, null));
  it("fails closed when local WebCrypto rejects", () => check("rejected local crypto", () => {}, false, { digest: async () => { throw new Error("controlled digest failure"); } }));
  it.skipIf(!helper)("binds delayed human proof to the exact current display", async () => {
    const view = setup();
    let release!: (value: ArrayBuffer) => void;
    const digest = Uint8Array.from(Buffer.from(view.canonicalEnglishTranslation.source_content_hash, "hex")).buffer;
    const originalKey = helper!.articleEnglishHumanConfirmationKey(view);
    const pending = helper!.isPreviouslyHumanConfirmedArticleEnglish(view, { digest: () => new Promise<ArrayBuffer>(resolve => { release = resolve; }) });
    view.current.english.title += " newer edit";
    release(digest);
    const proof = await pending;
    expect(proof).toBe(true);
    expect(helper!.matchesArticleEnglishHumanConfirmation({ key: originalKey, confirmed: proof }, helper!.articleEnglishHumanConfirmationKey(view))).toBe(false);
  });
  it.skipIf(!helper)("uses the existing server source hash projection and preserves rich source representations", async () => {
    const view = setup();
    expect(await helper!.articleEnglishHumanConfirmationSourceHash(view.article, webcrypto.subtle)).toBe(translations.articleTranslationSourceHash(source(view.article)));
  });
});
afterAll(() => {
  const destination = process.env.M07_ENGLISH_HUMAN_TRACE;
  if (destination) writeFileSync(destination, JSON.stringify({ graph: Object.fromEntries(graph), traces,
    limits: ["Actual validation/helper modules with local WebCrypto and trusted loaded row fixtures; no browser/server/Auth/DB/provider/production acceptance"] }, null, 2) + "\n", { flag: "wx" });
});
