import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { getSchema, type AnyExtension, type Extensions } from "@tiptap/core";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import type * as Recovery from "./article-recovery-snapshot";
import type { ArticleRecoverySnapshot } from "./article-recovery-snapshot";
import type * as Producer from "./article-translation-machine-ownership";
import type * as Pending from "./article-pending-operation";

// SAME fixture loads the actual captured implementation when a proof runner
// supplies an execution root. The editor schema, producer, parser and journal
// are real; no provider, Auth, DB, browser or network boundary is exercised.
const repository = path.resolve(import.meta.dirname, "../../..");
const executionRoot = process.env.PROBPERA_RECOVERY_EXECUTION_ROOT || repository;
const nativeRequire = createRequire(import.meta.url);
const modules = new Map<string, Record<string, unknown>>();
const sourceGraph: { file: string; sha256: string }[] = [];
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function actual(file: string): Record<string, unknown> {
  if (modules.has(file)) return modules.get(file)!;
  const bytes = readFileSync(file), unit = { exports: {} as Record<string, unknown> };
  modules.set(file, unit.exports);
  sourceGraph.push({ file, sha256: hash(bytes) });
  const require = (name: string): unknown => {
    if (!name.startsWith("@/") && !name.startsWith(".")) return nativeRequire(name);
    const target = name.startsWith("@/") ? path.join(executionRoot, "apps/admin", name.slice(2)) : path.resolve(path.dirname(file), name);
    const resolved = [target, target + ".ts", target + ".tsx"].find(existsSync);
    if (!resolved) throw new Error(`Missing actual recovery dependency: ${name}`);
    return actual(resolved);
  };
  new Function("require", "module", "exports", ts.transpileModule(bytes.toString(), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText)(require, unit, unit.exports);
  modules.set(file, unit.exports);
  return unit.exports;
}
const admin = (file: string) => path.join(executionRoot, "apps/admin", file);
const recovery = actual(admin("lib/article-recovery-snapshot.ts")) as typeof Recovery;
const producer = actual(admin("lib/article-translation-machine-ownership.ts")) as typeof Producer;
const pending = actual(admin("lib/article-pending-operation.ts")) as typeof Pending;
const factory = actual(admin("components/rich-editor/RichEditorExtensions.ts")).createRichEditorExtensions as
  (options: { placeholder: string; afterStarterKit: Extensions; afterImage: Extensions }) => Extensions;
const schema = getSchema(factory({ placeholder: "",
  afterStarterKit: [actual(admin("components/EditorialBlock.ts")).EditorialBlock as AnyExtension],
  afterImage: [actual(admin("components/ArticleTextTone.ts")).ArticleTextTone as AnyExtension,
    actual(admin("components/ArticleTypographyScope.ts")).ArticleTypographyScope as AnyExtension],
}));
afterAll(() => {
  expect(sourceGraph.every(row => hash(readFileSync(row.file)) === row.sha256)).toBe(true);
  const file = process.env.PROBPERA_RECOVERY_SOURCE_TRACE;
  if (file) writeFileSync(file, JSON.stringify({ executionRoot, sourceGraph, sourceUnchanged: true,
    fixtureSha256: hash(readFileSync(import.meta.filename)),
    scope: "Actual producer/schema/recovery/pending journal only; no Auth/DB/provider/browser/network mocks or calls." }, null, 2) + "\n", { flag: "wx" });
});

const sourceHash = "a".repeat(64), mediaId = "88888888-8888-4888-8888-888888888888";
const licensedImage = '<img src="https://media.fixture.invalid/original.webp" alt="Original authored illustration" data-media-id="' + mediaId + '" data-decorative="false" data-credit="Original author" data-source="https://source.fixture.invalid/original" data-license="Author permission retained" data-license-url="https://source.fixture.invalid/license" />';
const englishHtml = '<h2>Literary source</h2><p>  Exact authored English \u2014 text - retained.  </p>' + licensedImage;
const meta: Producer.PremiumArticleMachineTranslationMetadata = { sourceHash, model: "@cf/google/gemma-4-26b-a4b-it",
  reviewerModel: "@cf/openai/gpt-oss-120b", translatorRequestId: "original-translation-response-id", reviewerRequestId: "original-review-response-id",
  generatedAt: "2026-10-08T06:01:14.202Z" };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function copy(): ArticleRecoverySnapshot {
  return { version: 2, activeLocale: "en", title: "  Ручной русский заголовок  ", subtitle: "Авторский подзаголовок", excerpt: "Ручное авторское описание",
    slug: "authored-ru", slugEdited: true, categoryId: "99999999-9999-4999-8999-999999999999",
    contentHtml: "<p>  Ручной русский текст \u2014 и - сохраняется.  </p>",
    contentJson: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "  Ручной русский текст \u2014 и - сохраняется.  " }] },
      { type: "image", attrs: { src: "https://media.fixture.invalid/original.webp", alt: "Original authored illustration", mediaId,
        credit: "  Original author  ", source: "https://source.fixture.invalid/original", license: "Author permission retained",
        licenseUrl: "https://source.fixture.invalid/license", caption: "  Original caption  ", decorative: false } }] }),
    status: "published", scheduledAt: "", featured: false, showOnHomepage: false, pinned: false,
    coverUrl: "https://media.fixture.invalid/original.webp", coverAlt: "Original cover author",
    seoTitle: "Manual RU SEO", seoDescription: "Manual RU description", seoKeywords: "Manual RU keywords",
    canonicalUrl: "https://public.fixture.invalid/authored-ru", canonicalEdited: true, ogTitle: "Manual RU OG", ogDescription: "Manual RU OG description",
    sourceText: "  Ручной источник\r\nhttps://source.fixture.invalid/original  ", bibliographyText: "  Авторская библиография\nИсходная запись  ",
    legacyPath: "/original/author/path", allowIndexing: true, russianSourceChanged: false,
    english: { enabled: true, title: "Original English title", subtitle: "Original English subtitle", excerpt: "Original English excerpt", slug: "original-en",
      slugEdited: true, contentHtml: englishHtml, contentJson: JSON.stringify(producer.premiumArticleMachineContentJson(meta, englishHtml)),
      coverAlt: "English author credit", seoTitle: "Manual EN SEO", seoDescription: "Manual EN description", seoKeywords: "Manual EN keywords",
      canonicalUrl: "https://public.fixture.invalid/original-en", canonicalEdited: true, ogTitle: "Manual EN OG", ogDescription: "Manual EN OG description",
      sourceText: "  Original English source\r\nhttps://source.fixture.invalid/original  ", bibliographyText: "  English original citation\nSecond citation  ",
      status: "draft", confirmedCurrentSource: false } };
}
function accepted(value: ArticleRecoverySnapshot) {
  const before = JSON.stringify(value), current = copy(); current.title = "Different current title";
  const currentBefore = JSON.stringify(current);
  const result = recovery.prepareArticleRecoverySnapshot(freeze(value), freeze(current), schema);
  expect(result).not.toBeNull();
  expect(JSON.stringify(result!.snapshot)).toBe(before);
  expect(JSON.stringify(value)).toBe(before); expect(JSON.stringify(current)).toBe(currentBefore);
  expect(result!.snapshot.english.status).toBe(value.english.status);
  expect(result!.snapshot.english.confirmedCurrentSource).toBe(value.english.confirmedCurrentSource);
  expect(result!.snapshot.russianSourceChanged).toBe(value.russianSourceChanged);
  return result!;
}
function refused(value: unknown) {
  const before = JSON.stringify(value), current = copy(), currentBefore = JSON.stringify(current);
  expect(recovery.prepareArticleRecoverySnapshot(freeze(value), freeze(current), schema)).toBeNull();
  expect(JSON.stringify(value)).toBe(before); expect(JSON.stringify(current)).toBe(currentBefore);
}
function patchDocument(change: (document: Record<string, unknown>) => void) {
  const value = copy(), document = JSON.parse(value.english.contentJson) as Record<string, unknown>;
  change(document); value.english.contentJson = JSON.stringify(document); return value;
}

describe("M07 actual producer EN sentinel recovery compatibility without authority", () => {
  it("accepts the actual premium producer sentinel and keeps complete raw bilingual bytes and rights", () => {
    const value = copy(), result = accepted(value);
    expect(result.content).toBe(englishHtml);
    expect(result.snapshot.english.contentJson).toBe(value.english.contentJson);
    expect(JSON.parse(result.snapshot.english.contentJson).__probperaMediaReferences).toEqual([{ mediaId,
      src: "https://media.fixture.invalid/original.webp", alt: "Original authored illustration", decorative: false }]);
  });
  it("accepts the actual media-only machine producer sentinel without adding premium metadata", () => {
    const value = copy(); value.english.contentJson = JSON.stringify(producer.machineArticleContentJsonFromHtml(englishHtml));
    const result = accepted(value); expect(result.content).toBe(englishHtml);
    expect(Object.hasOwn(JSON.parse(result.snapshot.english.contentJson), "__probperaPremiumTranslation")).toBe(false);
  });
  it("accepts the actual premium producer without media and nullable reviewer/correlation metadata", () => {
    const value = copy(); value.english.contentHtml = "<p>Original complete English without an image.</p>";
    value.english.contentJson = JSON.stringify(producer.premiumArticleMachineContentJson({ ...meta, reviewerModel: null,
      translatorRequestId: null, reviewerRequestId: null }, value.english.contentHtml));
    expect(accepted(value).content).toBe(value.english.contentHtml);
  });
  it("preserves repeated authorized image references instead of deduplicating their occurrences", () => {
    const value = copy(); value.english.contentHtml += licensedImage;
    value.english.contentJson = JSON.stringify(producer.premiumArticleMachineContentJson(meta, value.english.contentHtml));
    expect(JSON.parse(accepted(value).snapshot.english.contentJson).__probperaMediaReferences).toHaveLength(2);
  });
  it("validates supported EN metadata even when the RU locale is active", () => {
    const value = copy(); value.activeLocale = "ru";
    expect(accepted(value).content).toEqual(JSON.parse(value.contentJson));
  });
  it("retains a disabled EN body without enabling it or confirming human review", () => {
    const value = copy(); value.english.enabled = false;
    expect(accepted(value).snapshot.english.enabled).toBe(false);
  });
  it("recovers a historical source hash without treating machine provenance as current human review", () => {
    const value = copy(); value.russianSourceChanged = true; value.english.status = "stale";
    value.english.contentJson = JSON.stringify(producer.premiumArticleMachineContentJson({ ...meta, sourceHash: "b".repeat(64) }, englishHtml));
    const result = accepted(value); expect(result.snapshot.english.confirmedCurrentSource).toBe(false);
    expect(result.snapshot.english.status).toBe("stale");
  });
  it("preserves all shared metadata when the complete smaller legacy EN copy contains the real sentinel", () => {
    const current = copy(), value = { title: "Legacy RU", slug: "legacy-ru", contentHtml: current.contentHtml, contentJson: current.contentJson,
      english: { enabled: true, title: current.english.title, subtitle: current.english.subtitle, excerpt: current.english.excerpt,
        slug: current.english.slug, contentHtml: current.english.contentHtml, contentJson: current.english.contentJson } };
    const bytes = JSON.stringify(value), result = recovery.prepareArticleRecoverySnapshot(freeze(value), freeze(current), schema);
    expect(result).not.toBeNull(); expect(result!.content).toBe(englishHtml);
    expect(result!.snapshot.categoryId).toBe(current.categoryId); expect(result!.snapshot.sourceText).toBe(current.sourceText);
    expect(result!.snapshot.english.contentJson).toBe(value.english.contentJson); expect(JSON.stringify(value)).toBe(bytes);
  });
});

const badPremium: [string, (value: Record<string, unknown>) => void][] = [
  ["unknown authority field", value => { value.humanReviewed = true; }],
  ["missing reviewer correlation", value => { delete value.reviewerRequestId; }],
  ["wrong version", value => { value.version = "1"; }],
  ["wrong ownership method", value => { value.method = "human-reviewed"; }],
  ["malformed source hash", value => { value.sourceHash = "unconfirmed-source"; }],
  ["coercing source hash object", value => { value.sourceHash = { value: sourceHash }; }],
  ["blank model", value => { value.model = " "; }],
  ["coercing reviewer model", value => { value.reviewerModel = ["reviewer"]; }],
  ["non-string translation correlation", value => { value.translatorRequestId = 7; }],
  ["invalid generation instant", value => { value.generatedAt = "unknown"; }],
];
describe("M07 producer metadata never bypasses strict recovery validation", () => {
  it.each(badPremium)("refuses premium metadata with %s", (_name, mutate) => {
    refused(patchDocument(document => mutate(document.__probperaPremiumTranslation as Record<string, unknown>)));
  });
  it.each([null, [], "machine"])("refuses a malformed premium metadata value %j", metadata => {
    refused(patchDocument(document => { document.__probperaPremiumTranslation = metadata; }));
  });
  it.each(["authorMetadata", "reviewedBy", "sourceAuthority"])("refuses unregistered root field %s beside a valid producer envelope", field => {
    refused(patchDocument(document => { document[field] = { originalAuthor: "Retain exact author value" }; }));
  });
  it("refuses producer metadata attached to a nonempty EN document", () => {
    refused(patchDocument(document => { document.content = [{ type: "paragraph", content: [{ type: "text", text: "Structured text" }] }]; }));
  });
  it("refuses producer metadata on RU without treating it as a known Russian author schema", () => {
    const value = copy(); value.contentJson = value.english.contentJson; refused(value);
  });
  it.each([
    ["unknown rights field", (r: Record<string, unknown>) => { r.authorRights = "Preserve author rights"; }],
    ["missing alt", (r: Record<string, unknown>) => { delete r.alt; }],
    ["malformed UUID", (r: Record<string, unknown>) => { r.mediaId = "missing-media"; }],
    ["non-string source", (r: Record<string, unknown>) => { r.src = ["https://media.fixture.invalid/original.webp"]; }],
    ["coercing decorative flag", (r: Record<string, unknown>) => { r.decorative = "false"; }],
  ] as const)("refuses a media row with %s", (_name, mutate) => {
    refused(patchDocument(document => mutate((document.__probperaMediaReferences as Record<string, unknown>[])[0])));
  });
  it.each([null, {}, "references"])("refuses malformed reference collection %j", references => {
    refused(patchDocument(document => { document.__probperaMediaReferences = references; }));
  });
  it.each([
    ["ID", (r: Record<string, unknown>) => { r.mediaId = "77777777-7777-4777-8777-777777777777"; }],
    ["URL", (r: Record<string, unknown>) => { r.src = "https://media.fixture.invalid/different.webp"; }],
    ["alt", (r: Record<string, unknown>) => { r.alt = "A different original illustration"; }],
    ["decorative", (r: Record<string, unknown>) => { r.decorative = true; }],
  ] as const)("refuses JSON/HTML media %s mismatch", (_name, mutate) => {
    refused(patchDocument(document => mutate((document.__probperaMediaReferences as Record<string, unknown>[])[0])));
  });
  it("refuses an omitted required identity sidecar while EN HTML references a registered image", () => {
    refused(patchDocument(document => { delete document.__probperaMediaReferences; }));
  });
  it("refuses an extra media occurrence absent from the same HTML", () => {
    refused(patchDocument(document => { (document.__probperaMediaReferences as unknown[]).push(clone((document.__probperaMediaReferences as unknown[])[0])); }));
  });
  it("refuses incomplete full DTO despite otherwise valid EN provenance", () => {
    const value = copy() as unknown as Record<string, unknown>; delete value.categoryId; refused(value);
  });
  it.each([
    ["unknown RU author-rights attrs", { type: "doc", content: [{ type: "paragraph", attrs: { authorRights: "Preserve original license" } }] }],
    ["unknown RU mark attrs", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Author text", marks: [{ type: "bold", attrs: { authorSource: "Keep source" } }] }] }] }],
    ["unknown RU node", { type: "doc", content: [{ type: "unsupported" }] }],
  ] as const)("validates the inactive Russian document and refuses %s", (_name, document) => {
    const value = copy(); value.contentJson = JSON.stringify(document); refused(value);
  });
  it("refuses damaged JSON in the inactive locale without clearing valid EN", () => {
    const value = copy(); value.contentJson = "{damaged"; refused(value);
  });
});

describe("M07 complete original operation journal admits real producer EN without mutable replacement", () => {
  it("retains original form/CAS/working-draft version and complete A/B through reload parsing", () => {
    const a = copy(), b = copy(); b.english.title = "Later authored English title";
    const form = new FormData(), ruMap = { title: "title", subtitle: "subtitle", excerpt: "excerpt", slug: "slug", categoryId: "category_id",
      contentHtml: "content_html", contentJson: "content_json", status: "status", scheduledAt: "scheduled_at", coverUrl: "cover_external_url", coverAlt: "cover_alt",
      seoTitle: "seo_title", seoDescription: "seo_description", seoKeywords: "seo_keywords", canonicalUrl: "canonical_url", ogTitle: "og_title", ogDescription: "og_description",
      sourceText: "sources", bibliographyText: "bibliography", legacyPath: "legacy_path" } as const;
    const enMap = { title: "title", subtitle: "subtitle", excerpt: "excerpt", slug: "slug", contentHtml: "content_html", contentJson: "content_json", coverAlt: "cover_alt",
      seoTitle: "seo_title", seoDescription: "seo_description", seoKeywords: "seo_keywords", canonicalUrl: "canonical_url", ogTitle: "og_title", ogDescription: "og_description",
      sourceText: "sources", bibliographyText: "bibliography", status: "status" } as const;
    for (const [key, name] of Object.entries(ruMap)) form.set(name, a[key as keyof typeof ruMap]);
    for (const [key, name] of Object.entries(enMap)) form.set("english_" + name, a.english[key as keyof typeof enMap]);
    const articleId = "11111111-1111-4111-8111-111111111111", actorId = "22222222-2222-4222-8222-222222222222", operationId = "33333333-3333-4333-8333-333333333333";
    for (const [key, value] of Object.entries({ id: articleId, expected_updated_at: "2026-10-08T10:00:00.123456+00:00",
      english_expected_updated_at: "", working_draft_version: "1", preview_locale: "en", previous_status: "published", intent: "save", article_operation_id: operationId,
      article_result_mode: "receipt", publication_ready: "no", russian_publication_ready: "yes", publication_override: "0", english_enabled: "on",
      english_confirm_current_source: "", featured: "", show_on_homepage: "", pinned: "", allow_indexing: "on" })) form.set(key, value);
    const identity = { actorId, originRecoveryKey: `probpera-editor-${articleId}`, draftScope: null }, before = [...form.entries()];
    const journal = pending.createArticlePendingOperation(form, freeze(a), freeze(b), { ...identity, expiresAt: Date.now() + 60_000 }, schema);
    expect(journal).not.toBeNull(); expect([...form.entries()]).toEqual(before);
    const restored = pending.parseArticlePendingOperation(clone(journal), identity, copy(), schema);
    expect(restored).not.toBeNull(); expect(restored!.snapshotA).toEqual(a); expect(restored!.latestSnapshotB).toEqual(b);
    expect(restored!.context).toEqual({ operationId, articleId, articleUpdatedAt: "2026-10-08T10:00:00.123456+00:00", englishUpdatedAt: null, workingDraftVersion: 1 });
    expect([...pending.articlePendingOperationFormData(restored!).entries()]).toEqual(before.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
    expect(restored!.snapshotA.english.contentJson).toBe(a.english.contentJson);
  });
});
