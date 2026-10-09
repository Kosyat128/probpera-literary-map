import type { Schema } from "@tiptap/pm/model";
import { z } from "zod";

import { capturePageOperationIntent } from "./page-operation-intent";
import { pagePendingOperationReferenceSchema, preparePageRecoverySnapshot,
  type PagePendingOperationReference, type PageRecoverySnapshot } from "./page-recovery-snapshot";
import { EDITOR_AUTOSAVE_RETENTION_DAYS } from "./editor-autosave";

export const PAGE_PENDING_OPERATION_MAX_BYTES = 20 * 1024 * 1024;
export const PAGE_PENDING_OPERATION_RETENTION_MS = EDITOR_AUTOSAVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const uuid = z.string().uuid();
const stamp = z.string().max(80).datetime({ offset: true });
const contextSchema = z.object({ operationId: uuid, pageId: uuid, expectedUpdatedAt: stamp }).strict();
const journalSchema = z.object({
  version: z.literal(1), actorId: uuid, pageId: uuid, context: contextSchema,
  formFields: z.array(z.tuple([z.string().max(100).regex(/^[a-z][a-z0-9_]*$/u), z.string().max(2_000_000)])).max(128),
  snapshotA: z.unknown(), latestSnapshotB: z.unknown(), expiresAt: z.number().int().safe().positive(),
}).strict();

export type PagePendingOperationContext = z.infer<typeof contextSchema>;
export type PagePendingOperationIdentity = { actorId: string; pageId: string };
export type { PagePendingOperationReference } from "./page-recovery-snapshot";
export type PagePendingOperation = PagePendingOperationIdentity & {
  version: 1; context: PagePendingOperationContext; formFields: Array<[string, string]>;
  snapshotA: PageRecoverySnapshot; latestSnapshotB: PageRecoverySnapshot; expiresAt: number;
};
const authorFields = {
  title: "title", excerpt: "excerpt", slug: "slug", contentHtml: "content_html", contentJson: "content_json",
  status: "status", seoTitle: "seo_title", seoDescription: "seo_description", canonicalUrl: "canonical_url",
} as const;

function validExpiry(expiresAt: number) {
  const now = Date.now();
  return expiresAt > now && expiresAt <= now + PAGE_PENDING_OPERATION_RETENTION_MS;
}
function formFromFields(fields: Array<[string, string]>) {
  const form = new FormData(); fields.forEach(([name, value]) => form.append(name, value)); return form;
}
function fullSnapshot(value: unknown, schema: Schema) {
  if (!value || typeof value !== "object" || Object.hasOwn(value, "pendingPageOperation")) return null;
  return preparePageRecoverySnapshot(value, schema)?.snapshot ?? null;
}

export function pagePendingOperationStorageKey(actorId: string, pageId: string): string | null {
  return uuid.safeParse(actorId).success && uuid.safeParse(pageId).success
    ? `probpera-page-operation:${actorId.toLowerCase()}:${pageId.toLowerCase()}` : null;
}

export function parsePagePendingOperationReference(value: unknown): PagePendingOperationReference | null {
  const parsed = pagePendingOperationReferenceSchema.safeParse(value);
  return parsed.success && validExpiry(parsed.data.expiresAt) ? parsed.data : null;
}

/** A/B and frozen request are untrusted storage, never a receipt or a CAS proof. */
export function parsePagePendingOperation(value: unknown, identity: PagePendingOperationIdentity, schema: Schema): PagePendingOperation | null {
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > PAGE_PENDING_OPERATION_MAX_BYTES) return null;
    const parsed = journalSchema.safeParse(value);
    if (!parsed.success) return null;
    const result = parsed.data;
    if (!uuid.safeParse(identity.actorId).success || !uuid.safeParse(identity.pageId).success
      || result.actorId !== identity.actorId || result.pageId !== identity.pageId
      || result.context.pageId !== result.pageId || !validExpiry(result.expiresAt)) return null;
    for (let index = 0; index < result.formFields.length; index += 1) {
      if (index > 0 && result.formFields[index - 1][0] >= result.formFields[index][0]) return null;
    }
    const fields = new Map(result.formFields);
    if (fields.get("page_operation_id") !== result.context.operationId || fields.get("page_result_mode") !== "receipt") return null;
    const intent = capturePageOperationIntent(formFromFields(result.formFields));
    if (!intent || intent.entityId !== result.pageId || intent.expectedUpdatedAt !== result.context.expectedUpdatedAt) return null;
    const snapshotA = fullSnapshot(result.snapshotA, schema), latestSnapshotB = fullSnapshot(result.latestSnapshotB, schema);
    if (!snapshotA || !latestSnapshotB || !Object.entries(authorFields).every(([key, name]) => fields.get(name) === snapshotA[key as keyof typeof authorFields])
      || (snapshotA.allowIndexing ? fields.get("allow_indexing") !== "on"
        : fields.has("allow_indexing") && fields.get("allow_indexing") !== "")) return null;
    return JSON.parse(JSON.stringify({ ...result, snapshotA, latestSnapshotB })) as PagePendingOperation;
  } catch { return null; }
}

export function createPagePendingOperation(formData: FormData, snapshotA: PageRecoverySnapshot, latestSnapshotB: PageRecoverySnapshot,
  options: PagePendingOperationIdentity & { expiresAt: number }, schema: Schema): PagePendingOperation | null {
  const formFields: Array<[string, string]> = [];
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("$ACTION_")) continue;
    if (typeof value !== "string") return null;
    formFields.push([name, value]);
  }
  formFields.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const intent = capturePageOperationIntent(formFromFields(formFields));
  if (!intent) return null;
  return parsePagePendingOperation({ version: 1, ...options, context: {
    operationId: formData.get("page_operation_id"), pageId: intent.entityId, expectedUpdatedAt: intent.expectedUpdatedAt,
  }, formFields, snapshotA, latestSnapshotB }, options, schema);
}

export function pagePendingOperationFormData(journal: PagePendingOperation): FormData { return formFromFields(journal.formFields); }
export function pagePendingOperationReference(journal: PagePendingOperation): PagePendingOperationReference {
  return { version: 1, actorId: journal.actorId, pageId: journal.pageId, operationId: journal.context.operationId,
    context: { ...journal.context }, expiresAt: journal.expiresAt };
}
export function updatePagePendingOperationSnapshot(journal: PagePendingOperation, latestSnapshotB: PageRecoverySnapshot,
  schema: Schema): PagePendingOperation | null {
  return parsePagePendingOperation({ ...journal, latestSnapshotB }, journal, schema);
}
