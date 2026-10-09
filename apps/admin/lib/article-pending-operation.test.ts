import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getSchema, type AnyExtension, type Extensions, type JSONContent } from "@tiptap/core";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ARTICLE_PENDING_OPERATION_MAX_BYTES,
  ARTICLE_PENDING_OPERATION_RETENTION_MS,
  articlePendingOperationFormData,
  articlePendingOperationReference,
  articlePendingOperationStorageKey,
  createArticlePendingOperation,
  parseArticlePendingOperation,
  parseArticlePendingOperationReference,
  updateArticlePendingOperationSnapshot,
  type ArticlePendingOperation,
} from "./article-pending-operation";
import type { ArticleRecoverySnapshot } from "./article-recovery-snapshot";

// Use the actual article schema and rights attributes; no editor/schema mocks.
const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "..");
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
const actorId = "11111111-1111-4111-8111-111111111111";
const foreignActor = "22222222-2222-4222-8222-222222222222";
const articleId = "33333333-3333-4333-8333-333333333333";
const foreignArticle = "44444444-4444-4444-8444-444444444444";
const operationId = "55555555-5555-4555-8555-555555555555";
const otherOperation = "66666666-6666-4666-8666-666666666666";
const ruCAS = "2026-10-07T11:00:00.123456+00:00";
const enCAS = "2026-10-07T10:00:00.654321+00:00";
const now = Date.parse("2026-10-07T12:00:00Z");
const existingIdentity = { actorId, originRecoveryKey: `probpera-editor-${articleId}`, draftScope: null };
const newIdentity = { actorId, originRecoveryKey: "probpera-editor-draft-new-77777777-7777-4777-8777-777777777777", draftScope: "new" };
const copyIdentity = { actorId, originRecoveryKey: `probpera-editor-draft-copy-${foreignArticle}-copy-tab`, draftScope: `copy-${foreignArticle}` };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); });
afterEach(() => { vi.restoreAllMocks(); });

function document(label: string): JSONContent {
  return { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: `  ${label}: ручной текст - \u2014 exact\nSecond line  ` }] },
    { type: "image", attrs: { src: "https://images.fixture.invalid/manual.webp", alt: `${label} authored alt`,
      credit: `${label} rights owner`, source: "https://sources.fixture.invalid/manual", license: "Manual permission",
      licenseUrl: "https://sources.fixture.invalid/license", mediaId: "88888888-8888-4888-8888-888888888888" } },
  ] };
}
function snapshot(label = "A"): ArticleRecoverySnapshot {
  return {
    version: 2, activeLocale: "en", title: `  ${label} RU title  `, subtitle: `${label} RU subtitle\r\nExact line`,
    excerpt: `${label} manual excerpt`, slug: `${label}-ru`, slugEdited: true,
    categoryId: "99999999-9999-4999-8999-999999999999", contentHtml: `<p>${label} RU - \u2014 text</p>`,
    contentJson: JSON.stringify(document(`${label} RU`)), status: "published", scheduledAt: "2026-10-09T15:00",
    featured: true, showOnHomepage: false, pinned: true, coverUrl: "https://images.fixture.invalid/cover.webp",
    coverAlt: `${label} cover author`, seoTitle: `${label} SEO`, seoDescription: `${label} SEO description`,
    seoKeywords: `${label} manual keywords`, canonicalUrl: `https://public.fixture.invalid/${label}/ru`, canonicalEdited: true,
    ogTitle: `${label} manual OG`, ogDescription: `${label} manual OG description`,
    sourceText: `  ${label} RU authored source\r\nhttps://sources.fixture.invalid/ru  `,
    bibliographyText: `  ${label} RU original bibliography\nSecond citation  `, legacyPath: "/legacy/author/path", allowIndexing: false,
    russianSourceChanged: true, english: {
      enabled: true, title: `  ${label} EN title  `, subtitle: `${label} EN subtitle\r\nSecond line`, excerpt: `${label} EN manual excerpt`,
      slug: `${label}-en`, slugEdited: true, contentHtml: `<p>${label} EN manual text - \u2014</p>`,
      contentJson: JSON.stringify(document(`${label} EN`)), coverAlt: `${label} EN image owner`,
      seoTitle: `${label} EN SEO`, seoDescription: `${label} EN SEO description`, seoKeywords: `${label} EN keywords`,
      canonicalUrl: `https://public.fixture.invalid/${label}/en`, canonicalEdited: true, ogTitle: `${label} EN OG`,
      ogDescription: `${label} EN OG description`, sourceText: `  ${label} manual EN source\r\nhttps://sources.fixture.invalid/en  `,
      bibliographyText: `  ${label} EN bibliography\nOriginal citation  `, status: "draft", confirmedCurrentSource: false,
    },
  };
}

const ruTextFields = {
  title: "title", subtitle: "subtitle", excerpt: "excerpt", slug: "slug", categoryId: "category_id",
  contentHtml: "content_html", contentJson: "content_json", status: "status", scheduledAt: "scheduled_at",
  coverUrl: "cover_external_url", coverAlt: "cover_alt", seoTitle: "seo_title", seoDescription: "seo_description",
  seoKeywords: "seo_keywords", canonicalUrl: "canonical_url", ogTitle: "og_title", ogDescription: "og_description",
  sourceText: "sources", bibliographyText: "bibliography", legacyPath: "legacy_path",
} as const;
const enTextFields = {
  title: "english_title", subtitle: "english_subtitle", excerpt: "english_excerpt", slug: "english_slug",
  contentHtml: "english_content_html", contentJson: "english_content_json", coverAlt: "english_cover_alt",
  seoTitle: "english_seo_title", seoDescription: "english_seo_description", seoKeywords: "english_seo_keywords",
  canonicalUrl: "english_canonical_url", ogTitle: "english_og_title", ogDescription: "english_og_description",
  sourceText: "english_sources", bibliographyText: "english_bibliography", status: "english_status",
} as const;
function form(value = snapshot(), patch: Record<string, string | undefined> = {}) {
  const fields: Record<string, string | undefined> = {
    article_operation_id: operationId, article_result_mode: "receipt", id: articleId, expected_updated_at: ruCAS,
    english_expected_updated_at: enCAS, working_draft_version: "3", preview_locale: value.activeLocale,
    previous_status: "published", intent: "preview", russian_publication_ready: "yes", publication_ready: "yes",
    publication_override: "0", featured: value.featured ? "on" : "", show_on_homepage: value.showOnHomepage ? "on" : "",
    pinned: value.pinned ? "on" : "", english_enabled: value.english.enabled ? "on" : "",
    english_confirm_current_source: value.english.confirmedCurrentSource ? "on" : "", allow_indexing: value.allowIndexing ? "on" : undefined,
  };
  for (const [key, name] of Object.entries(ruTextFields)) fields[name] = value[key as keyof typeof ruTextFields];
  for (const [key, name] of Object.entries(enTextFields)) fields[name] = value.english[key as keyof typeof enTextFields];
  const result = new FormData();
  for (const [key, item] of Object.entries({ ...fields, ...patch })) if (item !== undefined) result.append(key, item);
  return result;
}
function pending(): ArticlePendingOperation {
  const result = createArticlePendingOperation(form(), snapshot(), snapshot("B"), {
    ...existingIdentity, expiresAt: now + ARTICLE_PENDING_OPERATION_RETENTION_MS,
  }, schema);
  expect(result).not.toBeNull();
  return result!;
}
function parse(value: unknown, identity = existingIdentity) {
  const current = snapshot("fresh server props");
  const before = JSON.stringify(value), currentBefore = JSON.stringify(current);
  const result = parseArticlePendingOperation(value, identity, current, schema);
  expect(JSON.stringify(value)).toBe(before);
  expect(JSON.stringify(current)).toBe(currentBefore);
  return result;
}

describe("M02 frozen operation A and full later copy B reload journal", () => {
  it("round-trips exact frozen form bytes and both full copies without shared mutable references", () => {
    const a = snapshot(), b = snapshot("B"), input = form(a);
    input.append("$ACTION_ID_opaque", "React internal marker");
    const before = [...input.entries()];
    const result = createArticlePendingOperation(input, a, b, { ...existingIdentity, expiresAt: now + 1000 }, schema)!;
    expect(result).not.toBeNull();
    expect([...input.entries()]).toEqual(before);
    const restored = parse(JSON.parse(JSON.stringify(result)))!;
    expect(restored.context).toEqual({ operationId, articleId, articleUpdatedAt: ruCAS, englishUpdatedAt: enCAS, workingDraftVersion: 3 });
    expect(restored.snapshotA).toEqual(a);
    expect(restored.latestSnapshotB).toEqual(b);
    expect([...articlePendingOperationFormData(restored).entries()]).toEqual(
      before.filter(([name]) => !name.startsWith("$ACTION_")).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    );
    a.english.sourceText = "later mutation";
    b.contentHtml = "later B mutation";
    expect(result.snapshotA.english.sourceText).not.toBe(a.english.sourceText);
    expect(result.latestSnapshotB.contentHtml).not.toBe(b.contentHtml);
    restored.formFields[0][1] = "later journal mutation";
    expect(restored.formFields).not.toEqual(result.formFields);
  });
  it.each(["save", "preview", "publish", "publish-ru"])("preserves original %s request before the publication adapter", intent => {
    const input = form(snapshot(), { intent, russian_publication_ready: "no" });
    const original = [...input.entries()];
    const result = createArticlePendingOperation(input, snapshot(), snapshot("B"), { ...existingIdentity, expiresAt: now + 1000 }, schema)!;
    expect(result).not.toBeNull();
    expect([...input.entries()]).toEqual(original);
    const reconstructed = articlePendingOperationFormData(result);
    expect(reconstructed.get("intent")).toBe(intent);
    expect(reconstructed.get("english_enabled")).toBe("on");
    expect(reconstructed.get("publication_ready")).toBe("yes");
    expect(reconstructed.get("skip_automatic_translation")).toBeNull();
  });
  it.each([newIdentity, copyIdentity])("keeps distinct new/copy origin with initial null ID and after adopted own ID: $draftScope", identity => {
    const input = form(snapshot(), { id: undefined, expected_updated_at: undefined, working_draft_version: "0" });
    const first = createArticlePendingOperation(input, snapshot(), snapshot("B"), { ...identity, expiresAt: now + 1000 }, schema)!;
    expect(first).not.toBeNull();
    expect(parseArticlePendingOperation(first, identity, snapshot(), schema)?.context.articleId).toBeNull();
    const second = createArticlePendingOperation(form(snapshot("B"), { article_operation_id: otherOperation,
      expected_updated_at: "2026-10-07T11:00:01.123456+00:00", working_draft_version: "0" }),
    snapshot("B"), snapshot("C"), { ...identity, expiresAt: now + 1000 }, schema)!;
    expect(second).not.toBeNull();
    expect(second.originRecoveryKey).toBe(first.originRecoveryKey);
    expect(second.context.articleId).toBe(articleId);
    expect(second.context.operationId).toBe(otherOperation);
    expect(first.context.articleId).toBeNull();
    expect(first.snapshotA.title).toBe(snapshot().title);
  });
  it("updates only latest B and never advances the original operation/CAS or expiry", () => {
    const original = pending(), before = JSON.stringify(original);
    const result = updateArticlePendingOperationSnapshot(original, snapshot("late C"), schema)!;
    expect(result).not.toBeNull();
    expect(result.latestSnapshotB).toEqual(snapshot("late C"));
    expect(result.snapshotA).toEqual(original.snapshotA);
    expect(result.context).toEqual(original.context);
    expect(result.formFields).toEqual(original.formFields);
    expect(result.expiresAt).toBe(original.expiresAt);
    expect(JSON.stringify(original)).toBe(before);
  });
  it("accepts complete HTML-only or empty-document sentinel legacy full copies without rewriting HTML", () => {
    const a = snapshot(); a.contentJson = ""; a.english.contentJson = '{"type":"doc","content":[]}';
    const result = createArticlePendingOperation(form(a), a, snapshot("B"), { ...existingIdentity, expiresAt: now + 1000 }, schema)!;
    expect(result).not.toBeNull();
    expect(result.snapshotA.contentHtml).toBe(a.contentHtml);
    expect(result.snapshotA.english.contentHtml).toBe(a.english.contentHtml);
  });
  it("retains unchecked English text, rights and sources as full authored A", () => {
    const a = snapshot(); a.english.enabled = false; a.allowIndexing = true;
    const result = createArticlePendingOperation(form(a), a, snapshot("B"), { ...existingIdentity, expiresAt: now + 1000 }, schema)!;
    expect(result).not.toBeNull();
    expect(result.snapshotA.english).toEqual(a.english);
    expect(articlePendingOperationFormData(result).get("english_content_json")).toBe(a.english.contentJson);
    expect(articlePendingOperationFormData(result).get("allow_indexing")).toBe("on");
  });
});

describe("M02 journal actor, entry, request and receipt boundaries", () => {
  it("creates actor-separated bounded session keys and refuses actorless or arbitrary keys", () => {
    expect(articlePendingOperationStorageKey(actorId, existingIdentity.originRecoveryKey)).toBe(`probpera-editor-operation:${actorId}:${existingIdentity.originRecoveryKey}`);
    expect(articlePendingOperationStorageKey(foreignActor, newIdentity.originRecoveryKey)).not.toBe(articlePendingOperationStorageKey(actorId, newIdentity.originRecoveryKey));
    for (const invalid of ["", "actor", "null"]) expect(articlePendingOperationStorageKey(invalid, existingIdentity.originRecoveryKey)).toBeNull();
    for (const invalid of ["global", "../probpera-editor-new", "probpera-editor-new", "probpera-editor-pending-save-key"])
      expect(articlePendingOperationStorageKey(actorId, invalid)).toBeNull();
  });
  it("projects a strict small reference with no private form fields, A/B, baselines or cached receipt", () => {
    const result = pending(), reference = articlePendingOperationReference(result);
    expect(parseArticlePendingOperationReference(reference)).toEqual(reference);
    expect(JSON.stringify(parseArticlePendingOperationReference(JSON.parse(JSON.stringify(reference))))).toBe(JSON.stringify(reference));
    expect(Object.keys(reference).sort()).toEqual(["actorId", "context", "draftScope", "expiresAt", "operationId", "originRecoveryKey", "version"]);
    expect(JSON.stringify(reference)).not.toContain(result.snapshotA.title);
    reference.context.operationId = otherOperation;
    expect(result.context.operationId).toBe(operationId);
  });
  it("rejects a forged existing-article reference and mismatched operation binding", () => {
    const reference = articlePendingOperationReference(pending());
    expect(parseArticlePendingOperationReference({ ...reference, originRecoveryKey: `probpera-editor-${foreignArticle}` })).toBeNull();
    expect(parseArticlePendingOperationReference({ ...reference, operationId: otherOperation })).toBeNull();
  });
  it.each(["receipt", "snapshotA", "latestSnapshotB", "formFields", "canonicalEnglishBaseline", "privateEnglishBaseline", "initiallyAbsentEnglish"])("rejects stored extra %s as a reference", key => {
    expect(parseArticlePendingOperationReference({ ...articlePendingOperationReference(pending()), [key]: snapshot() })).toBeNull();
  });
  it.each(["actorId", "originRecoveryKey", "draftScope"])("refuses hydration under foreign %s without mutating either copy", key => {
    const identity = { ...existingIdentity, [key]: key === "actorId" ? foreignActor : key === "originRecoveryKey" ? `probpera-editor-${foreignArticle}` : "new" };
    expect(parseArticlePendingOperation(pending(), identity, snapshot(), schema)).toBeNull();
  });
  it("requires exact copy tab token and copy scope", () => {
    const result = createArticlePendingOperation(form(), snapshot(), snapshot("B"), { ...copyIdentity, expiresAt: now + 1000 }, schema)!;
    expect(parseArticlePendingOperation(result, { ...copyIdentity, originRecoveryKey: `${copyIdentity.originRecoveryKey}-other` }, snapshot(), schema)).toBeNull();
    result.draftScope = "new";
    expect(parseArticlePendingOperation(result, result, snapshot(), schema)).toBeNull();
  });
  it.each(["operationId", "articleId", "articleUpdatedAt", "englishUpdatedAt", "workingDraftVersion"])("refuses changed frozen context %s", key => {
    const value = pending();
    (value.context as unknown as Record<string, unknown>)[key] = key === "operationId" ? otherOperation : key === "articleId" ? foreignArticle
      : key === "workingDraftVersion" ? 4 : "2026-10-07T10:00:00.654320+00:00";
    expect(parse(value)).toBeNull();
  });
  it("refuses a foreign original existing ID even if context and raw fields agree", () => {
    const value = pending(); value.context.articleId = foreignArticle;
    value.formFields.find(([name]) => name === "id")![1] = foreignArticle;
    expect(parse(value)).toBeNull();
  });
  it.each([0, -1, now, now - 1, now + ARTICLE_PENDING_OPERATION_RETENTION_MS + 1, Infinity, "2026-11-07"])("refuses expired/unbounded expiry %s while preserving input", expiresAt => {
    const value = { ...pending(), expiresAt };
    expect(parse(value)).toBeNull();
    expect(parseArticlePendingOperationReference({ ...articlePendingOperationReference(pending()), expiresAt })).toBeNull();
  });
  it("rejects cached receipts and provenance assertions in a full journal", () => {
    expect(parse({ ...pending(), receipt: { articleId }, canonicalEnglishBaseline: snapshot().english })).toBeNull();
  });
  it.each(["article_result_mode", "article_operation_id"])("refuses missing or changed request control %s", name => {
    const value = pending(); value.formFields = value.formFields.filter(([key]) => key !== name);
    expect(parse(value)).toBeNull();
    const altered = pending(); altered.formFields.find(([key]) => key === name)![1] = name === "article_operation_id" ? otherOperation : "redirect";
    expect(parse(altered)).toBeNull();
  });
  it("refuses duplicate, unsorted, file or unknown action fields rather than guessing original bytes", () => {
    const duplicate = form(); duplicate.append("title", snapshot().title);
    expect(createArticlePendingOperation(duplicate, snapshot(), snapshot(), { ...existingIdentity, expiresAt: now + 1000 }, schema)).toBeNull();
    const file = form(); file.append("upload", new Blob(["synthetic bytes"]), "fixture.txt");
    expect(createArticlePendingOperation(file, snapshot(), snapshot(), { ...existingIdentity, expiresAt: now + 1000 }, schema)).toBeNull();
    const unsorted = pending(); unsorted.formFields.reverse(); expect(parse(unsorted)).toBeNull();
    const rawAction = pending(); rawAction.formFields.unshift(["$ACTION_ID", "opaque"]); expect(parse(rawAction)).toBeNull();
  });
  it("allows a journal larger than autosave's individual cap without shrinking existing intent capacity", () => {
    const value = pending(); value.latestSnapshotB.contentHtml = "B".repeat(3_300_000);
    const serialized = JSON.stringify(value);
    expect(new TextEncoder().encode(serialized).byteLength).toBeGreaterThan(3_200_000);
    expect(parse(value)).not.toBeNull();
  });
  it("refuses the bounded whole-journal limit without truncating either copy", () => {
    const value = pending(); value.latestSnapshotB.contentHtml = "B".repeat(ARTICLE_PENDING_OPERATION_MAX_BYTES);
    expect(parseArticlePendingOperation(value, existingIdentity, snapshot(), schema)).toBeNull();
    expect(value.latestSnapshotB.contentHtml.length).toBe(ARTICLE_PENDING_OPERATION_MAX_BYTES);
    expect(value.snapshotA).toEqual(snapshot());
  });
  it("retains the existing 5MiB intent bound independently of larger session capacity", () => {
    const a = snapshot(); a.title = "T".repeat(1_900_000); a.subtitle = "S".repeat(1_900_000); a.excerpt = "E".repeat(1_900_000);
    expect(createArticlePendingOperation(form(a), a, snapshot(), { ...existingIdentity, expiresAt: now + 1000 }, schema)).toBeNull();
  });
});

describe("M02 both full copies and exact submitted authored field binding before hydration", () => {
  it.each(Object.entries(ruTextFields))("refuses a changed submitted RU/shared %s", (key, name) => {
    const value = pending(); value.formFields.find(([field]) => field === name)![1] += "changed";
    expect(parse(value)).toBeNull();
    expect(value.snapshotA[key as keyof typeof ruTextFields]).toBe(snapshot()[key as keyof typeof ruTextFields]);
  });
  it.each(Object.entries(enTextFields))("refuses a changed submitted EN %s even when EN is disabled", (key, name) => {
    const a = snapshot(); a.english.enabled = false;
    const value = createArticlePendingOperation(form(a), a, snapshot("B"), { ...existingIdentity, expiresAt: now + 1000 }, schema)!;
    value.formFields.find(([field]) => field === name)![1] += "changed";
    expect(parse(value)).toBeNull();
    expect(value.snapshotA.english[key as keyof typeof enTextFields]).toBe(a.english[key as keyof typeof enTextFields]);
  });
  it.each(["featured", "show_on_homepage", "pinned", "english_enabled", "english_confirm_current_source"])("refuses changed authored boolean %s", name => {
    const value = pending(), pair = value.formFields.find(([field]) => field === name)!;
    pair[1] = pair[1] === "on" ? "" : "on";
    expect(parse(value)).toBeNull();
  });
  it("binds the submitted allow-indexing checkbox and preview locale", () => {
    const value = pending(); value.formFields.push(["allow_indexing", "on"]); value.formFields.sort(([a], [b]) => a.localeCompare(b));
    expect(parse(value)).toBeNull();
    const locale = pending(); locale.formFields.find(([name]) => name === "preview_locale")![1] = "ru"; expect(parse(locale)).toBeNull();
  });
  it.each(["snapshotA", "latestSnapshotB"] as const)("rejects partial-v2/metadata-only and recursive pending metadata in %s", target => {
    for (const bad of [{ version: 2, title: "partial" }, { title: "legacy", slug: "legacy", contentHtml: "<p>legacy</p>" },
      { version: 2, english: { title: "metadata" } }, { ...snapshot(), pendingArticleOperation: articlePendingOperationReference(pending()) }]) {
      const value = pending(); (value as unknown as Record<string, unknown>)[target] = bad;
      expect(parse(value)).toBeNull();
    }
  });
  it.each(Object.keys(snapshot()))("rejects latest B missing full required field %s without substituting current data", key => {
    const value = pending(); delete (value.latestSnapshotB as unknown as Record<string, unknown>)[key];
    expect(parse(value)).toBeNull();
  });
  it.each(["snapshotA", "latestSnapshotB"] as const)("rejects invalid RU or inactive EN JSON in %s before any state", target => {
    for (const locale of ["ru", "en"] as const) {
      for (const json of ["{broken", "null", '{"type":"doc","content":[{"type":"unknown"}]}',
        JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: { unknownRights: "must not disappear" } }] })]) {
        const value = pending(); value[target].activeLocale = "ru";
        if (locale === "ru") value[target].contentJson = json; else value[target].english.contentJson = json;
        if (target === "snapshotA") {
          value.formFields.find(([name]) => name === "preview_locale")![1] = "ru";
          value.formFields.find(([name]) => name === (locale === "ru" ? "content_json" : "english_content_json"))![1] = json;
        }
        expect(parse(value)).toBeNull();
      }
    }
  });
  it("refuses malformed later B on update without erasing valid A or prior B", () => {
    const value = pending(), before = clone(value), b = snapshot("bad B"); b.english.contentJson = "{broken";
    expect(updateArticlePendingOperationSnapshot(value, b, schema)).toBeNull();
    expect(value).toEqual(before);
    expect(b.english.contentJson).toBe("{broken");
  });
  it("validates author-only UI flags but does not invent hidden server fields for them", () => {
    const a = snapshot(); a.slugEdited = false; a.canonicalEdited = false; a.russianSourceChanged = false;
    a.english.slugEdited = false; a.english.canonicalEdited = false;
    const value = createArticlePendingOperation(form(a), a, snapshot("B"), { ...existingIdentity, expiresAt: now + 1000 }, schema)!;
    expect(value).not.toBeNull();
    expect(value.snapshotA).toEqual(a);
    expect(articlePendingOperationFormData(value).has("slug_edited")).toBe(false);
  });
});
