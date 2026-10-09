import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { getSchema, type AnyExtension, type Extensions, type JSONContent } from "@tiptap/core";
import ts from "typescript";

import { capturePageOperationIntent } from "./page-operation-intent";
import type { PageOperationResultContext } from "./page-operation-result";
import type { PageRecoverySnapshot } from "./page-recovery-snapshot";

export const pageId = "11111111-1111-4111-8111-111111111111";
export const actorId = "22222222-2222-4222-8222-222222222222";
export const operationId = "33333333-3333-4333-8333-333333333333";
export const foreignId = "44444444-4444-4444-8444-444444444444";
export const previous = "2026-10-07T10:00:00.123456+00:00";
export const next = "2026-10-07T10:00:00.123457+00:00";
export const now = Date.parse("2026-10-07T12:00:00Z");
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function document(label: string): JSONContent {
  return { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: `  ${label}: авторский текст - \u2014 café\nManual second line  ` }] },
    { type: "image", attrs: { src: "https://fixture.invalid/manual.webp", alt: `${label} exact authored alt`,
      caption: `${label} manual caption`, credit: `${label} rights owner`, source: "https://fixture.invalid/source?a=1&b=2",
      license: "Author permission", licenseUrl: "https://fixture.invalid/license", mediaId: foreignId } },
  ] };
}
export function snapshot(label = "A"): PageRecoverySnapshot {
  return { version: 2, title: `  ${label} Ручное название  `, excerpt: `${label} original excerpt\r\nExact line`,
    slug: `${label.toLowerCase()}-manual-page`, slugEdited: true, contentHtml: `<p>${label} author - \u2014 café</p>`,
    contentJson: JSON.stringify(document(label)), status: "draft", seoTitle: `${label} authored SEO`,
    seoDescription: `${label} description  Two spaces.`, canonicalUrl: `https://fixture.invalid/${label.toLowerCase()}/`,
    canonicalEdited: true, allowIndexing: true };
}
export function form(value = snapshot(), patch: Record<string, string | undefined> = {}) {
  const fields: Record<string, string | undefined> = {
    id: pageId, expected_updated_at: previous, intent: "save", page_operation_id: operationId, page_result_mode: "receipt",
    title: value.title, excerpt: value.excerpt, slug: value.slug, content_html: value.contentHtml, content_json: value.contentJson,
    status: value.status, seo_title: value.seoTitle, seo_description: value.seoDescription, canonical_url: value.canonicalUrl,
    allow_indexing: value.allowIndexing ? "on" : undefined, catalog_q: "  Ручной поиск  ", catalog_status: "all",
    catalog_page: "3", editor_revision_page: "2",
  };
  const result = new FormData();
  for (const [name, value] of Object.entries({ ...fields, ...patch })) if (value !== undefined) result.append(name, value);
  return result;
}
export function context(patch: Record<string, string | undefined> = {}): PageOperationResultContext {
  const intent = capturePageOperationIntent(form(snapshot(), patch));
  if (!intent) throw Error("Invalid test command");
  return { operationId, submittedIntent: intent };
}
export function envelope(contextValue = context(), replayed = false) {
  return { version: 1 as const, operationId: contextValue.operationId, entityType: "page" as const,
    requestedEntityId: contextValue.submittedIntent.entityId, intent: contextValue.submittedIntent.intent,
    persistence: "page" as const, replayed,
    receipt: { page_id: pageId, page_updated_at: next,
      page_status: contextValue.submittedIntent.intent === "publish" ? "published" : new Map(contextValue.submittedIntent.fields).get("status") || "draft" } };
}
export function payload() {
  const value = snapshot();
  return { title: value.title.trim(), slug: value.slug, excerpt: value.excerpt, content_html: value.contentHtml,
    content_json: document("A"), status: "draft", seo_title: value.seoTitle, seo_description: value.seoDescription,
    canonical_url: value.canonicalUrl, allow_indexing: true, updated_by: actorId };
}

/** Actual Page schema/rights nodes; no model or normalizer mocks. */
export function actualPageSchema() {
  const root = path.resolve(import.meta.dirname, ".."), nativeRequire = createRequire(import.meta.url);
  const cache = new Map<string, any>();
  function load(filename: string): any {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} as any }; cache.set(filename, module.exports);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const require = (name: string): any => {
      if (name.startsWith("@/") || name.startsWith(".")) {
        const target = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const file = [target, target + ".ts"].find(existsSync);
        if (!file) throw Error(`Unresolved actual Page schema dependency ${name}`);
        return load(file);
      }
      return nativeRequire(name);
    };
    new Function("require", "module", "exports", source)(require, module, module.exports);
    cache.set(filename, module.exports); return module.exports;
  }
  const factory = load(path.join(root, "components/rich-editor/RichEditorExtensions.ts")).createRichEditorExtensions as
    (options: { placeholder: string; afterStarterKit: Extensions; afterImage: Extensions }) => Extensions;
  return getSchema(factory({ placeholder: "", afterStarterKit: [load(path.join(root, "components/EditorialBlock.ts")).EditorialBlock as AnyExtension],
    afterImage: [load(path.join(root, "components/ArticleTextTone.ts")).ArticleTextTone as AnyExtension,
      load(path.join(root, "components/ArticleTypographyScope.ts")).ArticleTypographyScope as AnyExtension] }));
}
