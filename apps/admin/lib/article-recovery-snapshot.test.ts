import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getSchema, type AnyExtension, type Extensions, type JSONContent } from "@tiptap/core";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { prepareArticleRecoverySnapshot, type ArticleRecoverySnapshot } from "./article-recovery-snapshot";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "..");

// Root Vitest has no admin @/ alias. Resolve the actual pure modules locally;
// dependencies, schema implementations and attribute functions remain real.
function articleSchema() {
  const modules = new Map<string, Record<string, unknown>>();
  function load(filename: string): Record<string, unknown> {
    const cached = modules.get(filename);
    if (cached) return cached;
    const module = { exports: {} as Record<string, unknown> };
    modules.set(filename, module.exports);
    const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function require(name: string): unknown {
      if (name.startsWith("@/") || name.startsWith(".")) {
        const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const resolved = [target, target + ".ts"].find(existsSync);
        if (!resolved) throw new Error(`Unresolved actual schema dependency: ${name}`);
        return load(resolved);
      }
      return nativeRequire(name);
    }
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    modules.set(filename, module.exports);
    return module.exports;
  }
  const factory = load(path.join(adminRoot, "components/rich-editor/RichEditorExtensions.ts")).createRichEditorExtensions as
    (options: { placeholder: string; afterStarterKit: Extensions; afterImage: Extensions }) => Extensions;
  return getSchema(factory({ placeholder: "",
    afterStarterKit: [load(path.join(adminRoot, "components/EditorialBlock.ts")).EditorialBlock as AnyExtension],
    afterImage: [load(path.join(adminRoot, "components/ArticleTextTone.ts")).ArticleTextTone as AnyExtension,
      load(path.join(adminRoot, "components/ArticleTypographyScope.ts")).ArticleTypographyScope as AnyExtension],
  }));
}

const schema = articleSchema();
const doc = (text: string): JSONContent => ({ type: "doc", content: [
  { type: "paragraph", content: [{ type: "text", text }] },
] });
const blankDocument = JSON.stringify({ type: "doc", content: [] });

function snapshot(label = "recovery"): ArticleRecoverySnapshot {
  return {
    version: 2, activeLocale: "ru", title: `${label}: RU title`, subtitle: `${label}: RU subtitle`,
    excerpt: `${label}: RU manual excerpt`, slug: `${label}-ru`, slugEdited: true,
    categoryId: "88888888-8888-4888-8888-888888888888", contentHtml: `<p>${label}: RU body</p>`,
    contentJson: JSON.stringify(doc(`${label}: RU body`)), status: "review", scheduledAt: "",
    featured: true, showOnHomepage: false, pinned: true, coverUrl: "https://example.invalid/cover.jpg",
    coverAlt: `${label}: RU cover credit \u2014 unchanged`, seoTitle: `${label}: RU manual SEO title`,
    seoDescription: `${label}: RU manual SEO description`, seoKeywords: `${label}: RU keywords`,
    canonicalUrl: `https://example.invalid/${label}/ru`, canonicalEdited: true,
    ogTitle: `${label}: RU OG title`, ogDescription: `${label}: RU OG description`,
    sourceText: `  ${label}: RU source \u2014 retained - exact\nhttps://example.invalid/ru-source  `,
    bibliographyText: `  ${label}: RU bibliography\nOriginal citation  `, legacyPath: "/old/author/path",
    allowIndexing: false, russianSourceChanged: true,
    english: {
      enabled: true, title: `${label}: EN title`, subtitle: `${label}: EN subtitle`, excerpt: `${label}: EN manual excerpt`,
      slug: `${label}-en`, slugEdited: false, contentHtml: `<p>${label}: EN body</p>`,
      contentJson: JSON.stringify(doc(`${label}: EN body`)), coverAlt: `${label}: EN cover credit`,
      seoTitle: `${label}: EN manual SEO title`, seoDescription: `${label}: EN manual SEO description`,
      seoKeywords: `${label}: EN keywords`, canonicalUrl: `https://example.invalid/${label}/en`, canonicalEdited: true,
      ogTitle: `${label}: EN OG title`, ogDescription: `${label}: EN OG description`,
      sourceText: `  ${label}: EN source \u2014 retained - exact\nhttps://example.invalid/en-source  `,
      bibliographyText: `  ${label}: EN bibliography\nOriginal citation  `,
      status: "approved", confirmedCurrentSource: true,
    },
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function rejected(value: unknown) {
  const current = freeze(snapshot("current"));
  const currentBefore = JSON.stringify(current), valueBefore = JSON.stringify(value);
  freeze(value);
  expect(prepareArticleRecoverySnapshot(value, current, schema)).toBeNull();
  expect(JSON.stringify(current)).toBe(currentBefore);
  expect(JSON.stringify(value)).toBe(valueBefore);
}

const russianKeys = Object.keys(snapshot()) as (keyof ArticleRecoverySnapshot)[];
const englishKeys = Object.keys(snapshot().english) as (keyof ArticleRecoverySnapshot["english"])[];

describe("M02 ArticleEditor complete recovery DTO before any mutation", () => {
  it.each(russianKeys)("refuses a v2 copy missing required RU/shared field %s", key => {
    const value: Record<string, unknown> = { ...snapshot() };
    delete value[key];
    rejected(value);
  });
  it.each(englishKeys)("refuses a v2 copy missing required English field %s", key => {
    const value = snapshot();
    delete (value.english as Partial<ArticleRecoverySnapshot["english"]>)[key];
    rejected(value);
  });
  it.each(russianKeys)("refuses a v2 copy with wrong type for RU/shared field %s", key => {
    const value = snapshot();
    (value as unknown as Record<string, unknown>)[key] = typeof value[key] === "boolean" ? "false" : null;
    rejected(value);
  });
  it.each(englishKeys)("refuses a v2 copy with wrong type for English field %s", key => {
    const value = snapshot();
    (value.english as Record<string, unknown>)[key] = typeof value.english[key] === "boolean" ? "false" : 0;
    rejected(value);
  });
  it.each([null, [], false, 7, "metadata", {}, { version: 2, title: "Partial RU" },
    { version: 2, seoTitle: "Metadata only", english: { seoTitle: "English metadata only" } },
    { title: "Unversioned metadata only" }])("holds incomplete or primitive snapshot %j", value => rejected(value));
  it.each([0, 1, 3, "2", null, false])("refuses unsupported explicit version %j", version => {
    rejected({ ...snapshot(), version });
  });
  it.each(["de", "", "EN", false])("refuses invalid locale %j", activeLocale => {
    rejected({ ...snapshot(), activeLocale });
  });
  it.each(["approved", "stale", "unknown", "", "DRAFT"])("refuses invalid RU status %s", status => {
    rejected({ ...snapshot(), status });
  });
  it.each(["scheduled", "hidden", "unknown", "", "APPROVED"])("refuses invalid English status %s", status => {
    const value = snapshot(); (value.english as Record<string, unknown>).status = status; rejected(value);
  });
  it.each([NaN, Infinity, "2026-09-30", null])("refuses malformed savedAt metadata %j", savedAt => {
    rejected({ ...snapshot(), savedAt });
  });
  it("refuses malformed reason metadata without changing the current form", () => {
    rejected({ ...snapshot(), reason: { unsafe: "metadata" } });
  });
});

const malformedDocuments: { name: string; serialized: string }[] = [
  { name: "broken JSON", serialized: "{broken" },
  { name: "null", serialized: "null" },
  { name: "number", serialized: "42" },
  { name: "string", serialized: '"doc"' },
  { name: "array", serialized: "[]" },
  { name: "missing document type", serialized: JSON.stringify({ content: [] }) },
  { name: "unknown root", serialized: JSON.stringify({ type: "unknown", content: [] }) },
  { name: "non-document root", serialized: JSON.stringify({ type: "paragraph", content: [{ type: "text", text: "body" }] }) },
  { name: "string child list", serialized: JSON.stringify({ type: "doc", content: "body" }) },
  { name: "unknown child node", serialized: JSON.stringify({ type: "doc", content: [{ type: "unsupported" }] }) },
  { name: "primitive child node", serialized: JSON.stringify({ type: "doc", content: ["text"] }) },
  { name: "invalid block nesting", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "paragraph" }] }] }) },
  { name: "non-string text", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: 123 }] }] }) },
  { name: "empty text node", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] }) },
  { name: "primitive node attributes", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: "broken" }] }) },
  { name: "array node attributes", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: [] }] }) },
  { name: "unknown author-rights attribute", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { authorRights: "Keep exact rights" } }] }) },
  { name: "unknown document property", serialized: JSON.stringify({ type: "doc", authorSource: "Keep source", content: [{ type: "paragraph" }] }) },
  { name: "unknown text mark", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "body", marks: [{ type: "unsupported" }] }] }] }) },
  { name: "primitive mark attributes", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "body", marks: [{ type: "bold", attrs: false }] }] }] }) },
  { name: "unknown mark attributes", serialized: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "body", marks: [{ type: "textTone", attrs: { tone: "plum", authorLicense: "CC BY" } }] }] }] }) },
  { name: "array image source", serialized: JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: ["https://example.invalid/image.jpg"] } }] }) },
  { name: "object image credit", serialized: JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "https://example.invalid/image.jpg", credit: { author: "Original author" } } }] }) },
  { name: "numeric image source provenance", serialized: JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "https://example.invalid/image.jpg", source: 123 } }] }) },
];

describe("M02 recovery actual Article TipTap schema with unchanged author values", () => {
  it.each(malformedDocuments.flatMap(item => (["ru", "en"] as const).map(locale => ({ ...item, locale }))))
    ("refuses $name in $locale, including the inactive locale", ({ serialized, locale }) => {
      const value = snapshot(); value.activeLocale = locale === "ru" ? "en" : "ru";
      if (locale === "ru") value.contentJson = serialized; else value.english.contentJson = serialized;
      rejected(value);
    });
  it.each(["ru", "en"] as const)("accepts a full bilingual copy byte-for-byte with %s active", activeLocale => {
    const value = freeze({ ...snapshot(), activeLocale, savedAt: 1790780400000, reason: "manual" });
    const before = JSON.stringify(value), current = freeze(snapshot("current"));
    const prepared = prepareArticleRecoverySnapshot(value, current, schema);
    expect(prepared).not.toBeNull(); expect(JSON.stringify(prepared!.snapshot)).toBe(before);
    expect(prepared!.content).toEqual(JSON.parse(activeLocale === "ru" ? value.contentJson : value.english.contentJson));
    expect(current).toEqual(snapshot("current"));
  });
  it("preserves image rights, sources, captions, identities and gallery settings exactly", () => {
    const value = snapshot();
    const image = { type: "image", attrs: {
      src: "https://example.invalid/author-image.jpg", alt: "  Авторская подпись \u2014 без изменений  ",
      title: "Original title", mediaId: "ABCDEF00-1111-4111-8111-000000000001",
      caption: "  Original author caption  ", credit: "  Author photo credit  ",
      source: "https://example.invalid/author-source", license: "CC BY-SA 4.0",
      licenseUrl: "https://example.invalid/license", decorative: false, lightbox: false,
      focusX: 0.13, focusY: 0.91, width: 66, maxWidth: 640, layout: "left",
      aspect: "4-3", fit: "contain", appearance: "shadow", reveal: "fade-up",
    } };
    const document = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "  Ручной текст \u2014 и - как есть  ", marks: [
        { type: "link", attrs: { href: "https://example.invalid/source", target: null, rel: null, class: null } },
        { type: "textTone", attrs: { tone: "plum" } }, { type: "typographyScope", attrs: { scope: "lead" } },
      ] }] },
      { type: "editorialBlock", attrs: { kind: "gallery", galleryId: "  original-gallery-id  ", galleryVersion: 1,
        galleryColumnsDesktop: 3, galleryColumnsTablet: 2, galleryColumnsMobile: 1, galleryGap: "spacious",
        galleryAspect: "16-9", galleryFit: "contain", galleryCaptions: false, galleryLightbox: true,
        sliderArrows: false, sliderDots: true, sliderAutoplay: false, sliderInterval: 7000, sliderLoop: false }, content: [image] },
    ] };
    schema.nodeFromJSON(document).check();
    expect(schema.nodeFromJSON(document).toJSON()).toMatchObject(document);
    value.contentJson = JSON.stringify(document);
    value.english.contentJson = JSON.stringify(document);
    const bytes = JSON.stringify(value);
    const prepared = prepareArticleRecoverySnapshot(freeze(value), freeze(snapshot("current")), schema);
    expect(prepared).not.toBeNull(); expect(JSON.stringify(prepared!.snapshot)).toBe(bytes);
    expect(prepared!.content).toEqual(document);
  });
  it("keeps a complete snapshot's released RU and English statuses without changing confirmation", () => {
    const value = snapshot(); value.status = "published"; value.english.status = "published";
    const prepared = prepareArticleRecoverySnapshot(value, snapshot("current"), schema);
    expect(prepared?.snapshot.status).toBe("published");
    expect(prepared?.snapshot.english.status).toBe("published");
    expect(prepared?.snapshot.english.confirmedCurrentSource).toBe(true);
  });
  it("accepts existing table attributes, numeric column widths and original cell text", () => {
    const value = snapshot();
    const document = { type: "doc", content: [{ type: "table", content: [{ type: "tableRow", content: [
      { type: "tableHeader", attrs: { colspan: 1, rowspan: 1, colwidth: [120] }, content: [doc("Original heading").content![0]] },
      { type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: [240] }, content: [doc("Original cell \u2014 and -").content![0]] },
    ] }] }] };
    value.contentJson = JSON.stringify(document);
    expect(prepareArticleRecoverySnapshot(value, snapshot("current"), schema)?.content).toEqual(document);
  });
  it("preserves disabled English body and manual metadata rather than clearing them", () => {
    const value = snapshot(); value.english.enabled = false;
    expect(prepareArticleRecoverySnapshot(value, snapshot("current"), schema)?.snapshot.english).toEqual(value.english);
  });
  it.each(["ru", "en"] as const)("accepts intentional empty %s document without replacing it with current text", activeLocale => {
    const value = snapshot(); value.activeLocale = activeLocale;
    value.contentJson = blankDocument; value.contentHtml = "";
    value.english.contentJson = blankDocument; value.english.contentHtml = "";
    const prepared = prepareArticleRecoverySnapshot(value, snapshot("current"), schema);
    expect(prepared?.content).toBe(""); expect(prepared?.snapshot.contentHtml).toBe("");
    expect(prepared?.snapshot.english.contentHtml).toBe("");
  });
  it.each(["", blankDocument])("retains complete legacy HTML path for JSON %j", contentJson => {
    const value = snapshot(); value.contentJson = contentJson;
    value.contentHtml = '<p>Manual legacy HTML \u2014 exact</p><img src="https://example.invalid/image.jpg" data-image-credit="Author" data-image-source="https://example.invalid/source" data-image-license="CC BY">';
    const prepared = prepareArticleRecoverySnapshot(value, snapshot("current"), schema);
    expect(prepared?.content).toBe(value.contentHtml); expect(prepared?.snapshot).toEqual(value);
  });
});

function legacyCopy() {
  return { title: "Legacy RU title", slug: "legacy-ru", contentHtml: "<p>Legacy RU body</p>",
    contentJson: JSON.stringify(doc("Legacy RU body")) };
}
function legacyEnglish() {
  return { enabled: true, title: "Legacy EN title", subtitle: "Legacy EN subtitle", excerpt: "Legacy EN excerpt",
    slug: "legacy-en", contentHtml: "<p>Legacy EN body</p>", contentJson: JSON.stringify(doc("Legacy EN body")) };
}

describe("M02 complete smaller unversioned recovery compatibility", () => {
  it("restores the old RU body while keeping current category, media, sources and manual English metadata", () => {
    const current = freeze(snapshot("current")), before = JSON.stringify(current), legacy = freeze(legacyCopy());
    const prepared = prepareArticleRecoverySnapshot(legacy, current, schema);
    expect(prepared?.snapshot).toEqual({ ...current, ...legacy, slugEdited: true, russianSourceChanged: true,
      english: { ...current.english, status: "stale", confirmedCurrentSource: false } });
    expect(prepared?.content).toEqual(doc("Legacy RU body")); expect(JSON.stringify(current)).toBe(before);
  });
  it.each(["ru", "en"] as const)("accepts the complete smaller bilingual format with %s active and current rights/source metadata", activeLocale => {
    const current = snapshot("current"); current.activeLocale = activeLocale;
    const value = { ...legacyCopy(), english: legacyEnglish() };
    const prepared = prepareArticleRecoverySnapshot(freeze(value), freeze(current), schema);
    expect(prepared?.snapshot.english).toEqual({ ...current.english, ...value.english, slugEdited: true,
      status: "stale", confirmedCurrentSource: false });
    expect(prepared?.snapshot.categoryId).toBe(current.categoryId);
    expect(prepared?.snapshot.sourceText).toBe(current.sourceText);
    expect(prepared?.snapshot.coverUrl).toBe(current.coverUrl);
    expect(prepared?.content).toEqual(doc(activeLocale === "ru" ? "Legacy RU body" : "Legacy EN body"));
  });
  it("uses legacy HTML when JSON was absent instead of attaching current unrelated JSON", () => {
    const value: Partial<ReturnType<typeof legacyCopy>> = legacyCopy(); delete value.contentJson;
    const prepared = prepareArticleRecoverySnapshot(value, snapshot("current"), schema);
    expect(prepared?.snapshot.contentJson).toBe(blankDocument); expect(prepared?.content).toBe(value.contentHtml);
  });
  it("preserves current English content when no legacy English copy exists and English is active", () => {
    const current = snapshot("current"); current.activeLocale = "en";
    const prepared = prepareArticleRecoverySnapshot(legacyCopy(), current, schema);
    expect(prepared?.content).toEqual(JSON.parse(current.english.contentJson));
    expect(prepared?.snapshot.english.contentHtml).toBe(current.english.contentHtml);
    expect(prepared?.snapshot.english.contentJson).toBe(current.english.contentJson);
  });
  it.each(["title", "slug", "contentHtml"] as const)("refuses smaller RU copy without %s", key => {
    const value: Partial<ReturnType<typeof legacyCopy>> = legacyCopy(); delete value[key]; rejected(value);
  });
  it.each(["enabled", "title", "subtitle", "excerpt", "slug", "contentHtml"] as const)("refuses partial smaller English copy without %s", key => {
    const english: Partial<ReturnType<typeof legacyEnglish>> = legacyEnglish(); delete english[key];
    rejected({ ...legacyCopy(), english });
  });
  it.each([null, [], "partial", { title: "Only English title" }, { ...legacyEnglish(), enabled: "true" },
    { ...legacyEnglish(), contentJson: null }])("refuses malformed or partial legacy English object %j", english => {
    rejected({ ...legacyCopy(), english });
  });
  it("refuses an unversioned richer copy instead of silently discarding its metadata", () => {
    rejected({ ...legacyCopy(), categoryId: "Original category", sourceText: "Original author's source" });
  });
  it("refuses an unversioned English copy with unknown richer metadata instead of silently discarding it", () => {
    rejected({ ...legacyCopy(), english: { ...legacyEnglish(), sourceText: "Original English author's source" } });
  });
  it.each(["draft", "review", "stale", "archived"] as const)("retains non-released English status %s for legacy source changes", status => {
    const current = snapshot("current"); current.english.status = status;
    expect(prepareArticleRecoverySnapshot(legacyCopy(), current, schema)?.snapshot.english.status).toBe(status);
  });
  it.each(["approved", "published"] as const)("marks released English %s stale when a legacy RU body is restored", status => {
    const current = snapshot("current"); current.english.status = status;
    expect(prepareArticleRecoverySnapshot(legacyCopy(), current, schema)?.snapshot.english.status).toBe("stale");
  });
});
