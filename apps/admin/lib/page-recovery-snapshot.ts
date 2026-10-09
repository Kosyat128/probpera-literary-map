import type { JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { z } from "zod";

const uuid = z.string().uuid();
const stamp = z.string().max(80).datetime({ offset: true });
export const pagePendingOperationReferenceSchema = z.object({
  version: z.literal(1), actorId: uuid, pageId: uuid, operationId: uuid,
  context: z.object({ operationId: uuid, pageId: uuid, expectedUpdatedAt: stamp }).strict(),
  expiresAt: z.number().int().safe().positive(),
}).strict().refine(value => value.operationId === value.context.operationId && value.pageId === value.context.pageId);

export type PagePendingOperationReference = z.infer<typeof pagePendingOperationReferenceSchema>;
export type PageRecoverySnapshot = {
  version: 2; title: string; excerpt: string; slug: string; slugEdited: boolean;
  contentHtml: string; contentJson: string; status: string; seoTitle: string; seoDescription: string;
  canonicalUrl: string; canonicalEdited: boolean; allowIndexing: boolean;
  savedAt?: number | string; reason?: string; pendingPageOperation?: PagePendingOperationReference;
  recoveryActorId?: string;
};
const text = z.string().max(2_000_000);
const snapshotSchema = z.object({
  version: z.literal(2), title: text, excerpt: text, slug: text, slugEdited: z.boolean(),
  contentHtml: text, contentJson: text, status: z.enum(["draft", "published", "hidden"]), seoTitle: text,
  seoDescription: text, canonicalUrl: text, canonicalEdited: z.boolean(), allowIndexing: z.boolean(),
  savedAt: z.union([z.number().finite(), stamp]).optional(), reason: z.string().max(200).optional(),
  pendingPageOperation: pagePendingOperationReferenceSchema.optional(),
  recoveryActorId: uuid.optional(),
}).strict();
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function validNode(value: unknown): boolean {
  if (!record(value) || typeof value.type !== "string"
    || value.type === "text" && (typeof value.text !== "string" || value.text.length === 0)
    || Object.hasOwn(value, "text") && typeof value.text !== "string") return false;
  if (value.attrs !== undefined && value.attrs !== null) {
    if (!record(value.attrs)) return false;
    const attrs = value.attrs;
    if (!Object.entries(attrs).every(([name, item]) => item === null
      || typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)
      || name === "colwidth" && Array.isArray(item) && item.every(width => typeof width === "number" && Number.isFinite(width)))) return false;
    if (value.type === "image" && ["src", "alt", "title", "caption", "mediaId", "credit", "source", "license", "licenseUrl", "link"]
      .some(name => Object.hasOwn(attrs, name) && attrs[name] !== null && typeof attrs[name] !== "string")) return false;
  }
  return (value.content === undefined || Array.isArray(value.content) && value.content.every(validNode))
    && (value.marks === undefined || Array.isArray(value.marks) && value.marks.every(validNode));
}

function preserved(original: unknown, parsed: unknown): boolean {
  if (!record(original) || !record(parsed)) return false;
  return Object.entries(original).every(([key, value]) => {
    if (key === "attrs") return value === null || record(value) && record(parsed.attrs)
      && Object.entries(value).every(([name, item]) => Object.hasOwn(parsed.attrs as object, name)
        && JSON.stringify(item) === JSON.stringify((parsed.attrs as Record<string, unknown>)[name]));
    if (key === "content" || key === "marks") return Array.isArray(value)
      && (value.length === 0 && parsed[key] === undefined || Array.isArray(parsed[key])
        && value.length === parsed[key].length && value.every((item, index) => preserved(item, (parsed[key] as unknown[])[index])));
    return Object.hasOwn(parsed, key) && JSON.stringify(value) === JSON.stringify(parsed[key]);
  });
}

/** Validate the complete author copy before either editor or React state changes. */
export function preparePageRecoverySnapshot(value: unknown, schema: Schema): { snapshot: PageRecoverySnapshot; content: JSONContent | string } | null {
  try {
    const parsed = snapshotSchema.safeParse(value);
    if (!parsed.success) return null;
    const snapshot = parsed.data;
    if (snapshot.contentJson === "") return { snapshot, content: snapshot.contentHtml };
    const document: unknown = JSON.parse(snapshot.contentJson);
    if (!record(document) || document.type !== "doc" || !validNode(document)) return null;
    const node = schema.nodeFromJSON(document);
    if (!preserved(document, node.toJSON())) return null;
    // Full legacy HTML copies and the intentional empty document remain usable.
    if (node.childCount === 0) return { snapshot, content: snapshot.contentHtml };
    node.check();
    return { snapshot, content: document as JSONContent };
  } catch { return null; }
}
