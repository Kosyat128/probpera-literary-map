import { z } from "zod";

export const MAX_BULK_MEDIA_ASSETS = 100;
export const MAX_ORPHAN_CLEANUP_ASSETS = 50;
export const ORPHAN_CLEANUP_CONFIRMATION = "MOVE_UNUSED_TO_TRASH";
export const MEDIA_PURGE_CONFIRMATION = "УДАЛИТЬ ФАЙЛ НАВСЕГДА";

const mediaSnapshotSchema = z.object({
  id: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

const httpUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Допустима только ссылка HTTP или HTTPS");

const mediaRightsStatusSchema = z.enum([
  "verified",
  "editorial",
  "public-domain",
  "licensed",
  "unknown",
]);

export type MediaVersionSnapshot = z.infer<typeof mediaSnapshotSchema>;

export type BulkMediaMetadataPatch = Partial<{
  caption: string;
  creator: string;
  source_url: string | null;
  license_name: string;
  license_url: string | null;
  collection_name: string;
  rights_status: z.infer<typeof mediaRightsStatusSchema>;
}>;

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function parseMediaVersionSnapshots(
  values: readonly unknown[],
  options: { max?: number; allowEmpty?: boolean } = {}
): ParseResult<MediaVersionSnapshot[]> {
  const max = options.max ?? MAX_BULK_MEDIA_ASSETS;
  if (!Number.isSafeInteger(max) || max < 1) {
    return { success: false, error: "Некорректный лимит выбора файлов." };
  }
  if ((!options.allowEmpty && values.length === 0) || values.length > max) {
    return {
      success: false,
      error: values.length === 0
        ? "Выберите хотя бы один файл."
        : `За один раз можно обработать не более ${max} файлов.`,
    };
  }

  const snapshots: MediaVersionSnapshot[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(String(value));
    } catch {
      return { success: false, error: "Список выбранных файлов повреждён." };
    }
    const parsed = mediaSnapshotSchema.safeParse(decoded);
    if (!parsed.success || ids.has(parsed.data.id)) {
      return { success: false, error: "Список выбранных файлов повреждён." };
    }
    ids.add(parsed.data.id);
    snapshots.push(parsed.data);
  }
  return { success: true, data: snapshots };
}

function hasFlag(value: unknown) {
  return value === "1" || value === "on" || value === true;
}

function stringValue(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

export function parseBulkMediaMetadataPatch(
  input: Record<string, unknown>
): ParseResult<BulkMediaMetadataPatch> {
  const patch: BulkMediaMetadataPatch = {};

  const readString = (
    flag: string,
    field: string,
    schema: z.ZodType<string>,
    databaseField: keyof BulkMediaMetadataPatch
  ) => {
    if (!hasFlag(input[flag])) return null;
    const parsed = schema.safeParse(stringValue(input[field]));
    if (!parsed.success) {
      return parsed.error.issues[0]?.message || "Проверьте массовые метаданные.";
    }
    Object.assign(patch, { [databaseField]: parsed.data });
    return null;
  };

  const validationError =
    readString("apply_caption", "caption", z.string().max(1000), "caption")
    || readString("apply_creator", "creator", z.string().max(240), "creator")
    || readString(
      "apply_license_name",
      "license_name",
      z.string().max(180),
      "license_name"
    )
    || readString(
      "apply_collection_name",
      "collection_name",
      z.string().min(2).max(180),
      "collection_name"
    );
  if (validationError) return { success: false, error: validationError };

  for (const [flag, field, databaseField] of [
    ["apply_source_url", "source_url", "source_url"],
    ["apply_license_url", "license_url", "license_url"],
  ] as const) {
    if (!hasFlag(input[flag])) continue;
    const value = stringValue(input[field]);
    const parsed = value ? httpUrlSchema.safeParse(value) : null;
    if (parsed && !parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Проверьте ссылку.",
      };
    }
    patch[databaseField] = value || null;
  }

  if (hasFlag(input.apply_rights_status)) {
    const parsed = mediaRightsStatusSchema.safeParse(input.rights_status);
    if (!parsed.success) {
      return { success: false, error: "Выберите допустимый статус прав." };
    }
    patch.rights_status = parsed.data;
  }

  if (Object.keys(patch).length === 0) {
    return {
      success: false,
      error: "Отметьте хотя бы одно поле, которое нужно изменить.",
    };
  }
  return { success: true, data: patch };
}

export function mediaSnapshotSetsMatch(
  expected: readonly MediaVersionSnapshot[],
  current: readonly MediaVersionSnapshot[]
) {
  if (expected.length !== current.length) return false;
  const canonical = (items: readonly MediaVersionSnapshot[]) => items
    .map((item) => `${item.id}:${item.updatedAt}`)
    .sort();
  const expectedCanonical = canonical(expected);
  const currentCanonical = canonical(current);
  return expectedCanonical.every((value, index) => value === currentCanonical[index]);
}

export function isOrphanCleanupConfirmed(value: unknown) {
  return value === ORPHAN_CLEANUP_CONFIRMATION;
}

export function isMediaPurgeConfirmed(value: unknown) {
  return value === MEDIA_PURGE_CONFIRMATION;
}
