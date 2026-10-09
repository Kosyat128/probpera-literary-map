import { z } from "zod";

export const PAGE_OPERATION_INTENT_MAX_BYTES = 5 * 1024 * 1024;
const intentSchema = z.object({
  version: z.literal(1),
  entityType: z.literal("page"),
  entityId: z.string().uuid(),
  expectedUpdatedAt: z.string().max(80).datetime({ offset: true }),
  intent: z.enum(["save", "publish"]),
  fields: z.array(z.tuple([
    z.string().max(100).regex(/^[a-z][a-z0-9_]*$/u), z.string().max(2_000_000),
  ])).max(128),
}).strict();

/** The original request binding; it is never evidence of a committed write. */
export type PageOperationIntent = z.infer<typeof intentSchema>;

function excludedField(name: string) {
  return name === "page_operation_id" || name === "page_result_mode" || name.startsWith("$ACTION_");
}

export function parsePageOperationIntent(value: unknown): PageOperationIntent | null {
  const parsed = intentSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > PAGE_OPERATION_INTENT_MAX_BYTES) return null;
  for (let index = 0; index < result.fields.length; index += 1) {
    const name = result.fields[index][0];
    if (excludedField(name) || index > 0 && result.fields[index - 1][0] >= name) return null;
  }
  const fields = new Map(result.fields);
  if ((fields.get("id")?.trim() || null) !== result.entityId
    || (fields.get("expected_updated_at")?.trim() || null) !== result.expectedUpdatedAt
    || (fields.get("intent") || "save") !== result.intent) return null;
  return result;
}

/** Capture before the existing normalization, retaining every raw author value. */
export function capturePageOperationIntent(formData: FormData): PageOperationIntent | null {
  const fields: Array<[string, string]> = [];
  const names = new Set<string>();
  for (const [name, value] of formData.entries()) {
    if (excludedField(name)) continue;
    if (typeof value !== "string" || names.has(name)) return null;
    names.add(name);
    fields.push([name, value]);
  }
  fields.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const values = new Map(fields);
  return parsePageOperationIntent({
    version: 1, entityType: "page", entityId: values.get("id")?.trim() || null,
    expectedUpdatedAt: values.get("expected_updated_at")?.trim() || null,
    intent: values.get("intent") || "save", fields,
  });
}
