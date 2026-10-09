import { z } from "zod";

const MAX_INTENT_BYTES = 5 * 1024 * 1024;
const contextStamp = z.string().max(80).datetime({ offset: true }).nullable();
const intentSchema = z.object({
  version: z.literal(1),
  entityType: z.literal("article"),
  entityId: z.string().uuid().nullable(),
  intent: z.enum(["save", "preview", "publish"]),
  expectedUpdatedAt: contextStamp,
  englishExpectedUpdatedAt: contextStamp,
  workingDraftVersion: z.number().int().safe().nonnegative(),
  previewLocale: z.enum(["ru", "en"]),
  fields: z.array(z.tuple([
    z.string().max(100).regex(/^[a-z][a-z0-9_]*$/u),
    z.string().max(2_000_000),
  ])).max(128),
}).strict();

/** Frozen submitted command; its fingerprint is a binding, never commit proof. */
export type ArticleOperationIntent = z.infer<typeof intentSchema>;

function optionalField(fields: Map<string, string>, name: string) {
  return fields.get(name)?.trim() || null;
}

function fieldContext(fields: Map<string, string>) {
  const version = fields.get("working_draft_version") || "0";
  if (!/^\d+$/u.test(version)) return null;
  return {
    entityId: optionalField(fields, "id"),
    intent: fields.get("intent") || "save",
    expectedUpdatedAt: optionalField(fields, "expected_updated_at"),
    englishExpectedUpdatedAt: optionalField(fields, "english_expected_updated_at"),
    workingDraftVersion: Number(version),
    previewLocale: fields.get("preview_locale") || "ru",
  };
}

function excludedField(name: string) {
  return name === "article_result_mode" || name === "article_operation_id" || name.startsWith("$ACTION_");
}

export function parseArticleOperationIntent(value: unknown): ArticleOperationIntent | null {
  const parsed = intentSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_INTENT_BYTES) return null;
  for (let index = 0; index < result.fields.length; index += 1) {
    const name = result.fields[index][0];
    if (excludedField(name) || index > 0 && result.fields[index - 1][0] >= name) return null;
  }
  const context = fieldContext(new Map(result.fields));
  if (!context || context.entityId !== result.entityId || context.intent !== result.intent
    || context.expectedUpdatedAt !== result.expectedUpdatedAt
    || context.englishExpectedUpdatedAt !== result.englishExpectedUpdatedAt
    || context.workingDraftVersion !== result.workingDraftVersion
    || context.previewLocale !== result.previewLocale) return null;
  if (result.entityId === null
    ? result.expectedUpdatedAt !== null || result.workingDraftVersion !== 0
    : result.expectedUpdatedAt === null) return null;
  return result;
}

/** Capture after the existing publication adapter, without changing author fields. */
export function captureArticleOperationIntent(formData: FormData): ArticleOperationIntent | null {
  const fields: Array<[string, string]> = [];
  const names = new Set<string>();
  for (const [name, value] of formData.entries()) {
    if (excludedField(name)) continue;
    if (typeof value !== "string" || names.has(name)) return null;
    names.add(name);
    fields.push([name, value]);
  }
  fields.sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  const context = fieldContext(new Map(fields));
  if (!context) return null;
  return parseArticleOperationIntent({ version: 1, entityType: "article", ...context, fields });
}
