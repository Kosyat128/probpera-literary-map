import { z } from "zod";
import { getSchema } from "@tiptap/core";
import { createRichEditorExtensions } from "@/components/rich-editor/RichEditorExtensions";
import { EditorialBlock } from "@/components/EditorialBlock";
import { ArticleTextTone } from "@/components/ArticleTextTone";
import { ArticleTypographyScope } from "@/components/ArticleTypographyScope";
import { isReadRecord } from "./admin-read-result";
import { parseEditorialContentJson } from "./editorial-media-identity";

export type PageListRead = { id: string; title: string; slug: string; status: string; updated_at: string };
export type PageEditorRead = PageListRead & { excerpt: string; content_html: string; content_json: unknown;
  seo_title: string | null; seo_description: string | null; canonical_url: string | null;
  allow_indexing: boolean; deleted_at: string | null };
export type PagePreviewRead = Pick<PageEditorRead, "id" | "title" | "status" | "updated_at" | "excerpt" | "content_html">;
export type PageRevisionRead = { id: number | string; page_id: string; revision_number: number; created_at: string };
const sqlUuid = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(value);
const stamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value === null || typeof value === "string";
const status = (value: unknown) => typeof value === "string" && ["draft", "published", "hidden"].includes(value);
const sameId = (value: unknown, id: string) => sqlUuid(value) && value.toLowerCase() === id.toLowerCase();

export function validPageListRead(value: unknown): value is PageListRead {
  return isReadRecord(value) && sqlUuid(value.id) && typeof value.title === "string" && typeof value.slug === "string"
    && status(value.status) && stamp(value.updated_at);
}
export function validPagePreviewRead(value: unknown, id: string): value is PagePreviewRead {
  return isReadRecord(value) && sameId(value.id, id) && typeof value.title === "string"
    && typeof value.excerpt === "string" && typeof value.content_html === "string"
    && status(value.status) && stamp(value.updated_at);
}
export function validPageEditorRead(value: unknown, id: string): value is PageEditorRead {
  if (!isReadRecord(value)) return false;
  const row: Record<string, unknown> = value;
  return ["seo_title", "seo_description", "canonical_url"].every(field => nullableText(row[field]))
    && typeof row.allow_indexing === "boolean" && Object.hasOwn(row, "content_json") && row.content_json !== undefined
    && (row.deleted_at === null || stamp(row.deleted_at))
    && validPageListRead(row) && validPagePreviewRead(row, id);
}
const actionIdentity = z.object({ id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }) });
export const canMutatePageIdentity = (value: PageListRead) => actionIdentity.safeParse(value).success;
/** Read JSONB unchanged; hold an unsupported editor document instead of replacing it. */
export function canEditPageBundle(value: PageEditorRead) {
  return canMutatePageIdentity(value) && canEditPageContent(value.content_json, value.content_html);
}
/** Use the identical document boundary for loading and explicit recovery. */
export function canEditPageContent(contentJson: unknown, contentHtml: string) {
  const node = (candidate: unknown): boolean => isReadRecord(candidate)
    && typeof candidate.type === "string" && candidate.type.length > 0
    && (candidate.type !== "text" || typeof candidate.text === "string" && candidate.text.length > 0)
    && (candidate.text === undefined || typeof candidate.text === "string")
    && (candidate.attrs === undefined || candidate.attrs === null || isReadRecord(candidate.attrs))
    && (candidate.content === undefined || Array.isArray(candidate.content) && candidate.content.every(node))
    && (candidate.marks === undefined || Array.isArray(candidate.marks) && candidate.marks.every(mark =>
      isReadRecord(mark) && typeof mark.type === "string" && mark.type.length > 0
      && (mark.attrs === undefined || mark.attrs === null || isReadRecord(mark.attrs))));
  try {
    const serialized = JSON.stringify(contentJson);
    if (typeof serialized !== "string") return false;
    parseEditorialContentJson(serialized, "Страница");
    if (!node(contentJson)) return false;
    const schema = getSchema(createRichEditorExtensions({ placeholder: "",
      afterStarterKit: [EditorialBlock], afterImage: [ArticleTextTone, ArticleTypographyScope] }));
    const document = schema.nodeFromJSON(contentJson);
    // nodeFromJSON ignores unknown attributes and other unsupported fields.
    // Added defaults are safe; supplied author values must survive intact.
    const preservesInput = (original: unknown, parsed: unknown): boolean => {
      if (!isReadRecord(original) || !isReadRecord(parsed)) return false;
      return Object.entries(original).every(([key, item]) => {
        if (key === "attrs") return item === null || isReadRecord(item)
          && Object.entries(item).every(([name, value]) => isReadRecord(parsed.attrs)
            && Object.hasOwn(parsed.attrs, name) && JSON.stringify(value) === JSON.stringify(parsed.attrs[name]));
        if (key === "content" || key === "marks") return Array.isArray(item)
          && (item.length === 0 && parsed[key] === undefined || Array.isArray(parsed[key])
            && item.length === parsed[key].length && item.every((entry, index) => preservesInput(entry, (parsed[key] as unknown[])[index])));
        return Object.hasOwn(parsed, key) && JSON.stringify(item) === JSON.stringify(parsed[key]);
      });
    };
    if (!preservesInput(contentJson, document.toJSON())) return false;
    // The create action intentionally writes an empty document for a new blank
    // draft. ProseMirror's block+ check rejects it; do not reject that producer
    // default, or open it over nonempty HTML that the editor would hide.
    if (document.type.name === "doc" && document.childCount === 0) return contentHtml.trim() === "";
    document.check();
    return true;
  }
  catch { return false; }
}
export function validPageRevisionRead(value: unknown, pageId: string): value is PageRevisionRead {
  if (!isReadRecord(value) || !sameId(value.page_id, pageId) || !stamp(value.created_at)) return false;
  const id = value.id;
  const validId = typeof id === "number" ? Number.isSafeInteger(id) && id > 0
    : typeof id === "string" && /^[1-9]\d{0,18}$/u.test(id) && (id.length < 19 || id <= "9223372036854775807");
  return validId && typeof value.revision_number === "number" && Number.isInteger(value.revision_number)
    && value.revision_number >= -2147483648 && value.revision_number <= 2147483647;
}
export const canRestorePageRevision = (value: PageRevisionRead) => Number.isSafeInteger(Number(value.id));
