import { z } from "zod";
import { isReadRecord, isReadRecordList, readAdminResult, type AdminReadResult } from "@/lib/admin-read-result";

export type BannerLoadedRecord = {
  id: string; name: string; title: string; description: string; target_url: string | null;
  button_text: string; desktop_media_id: string | null; tablet_media_id: string | null;
  mobile_media_id: string | null; starts_at: string | null; ends_at: string | null;
  display_order: number; is_active: boolean; page_patterns: string[]; updated_at: string;
};
export type HomepageLoadedBlock = {
  id: string; block_type: string; title: string; settings: unknown; display_order: number;
  is_enabled: boolean; background_style: string; background_media_id: string | null; updated_at: string;
};
export type PickerMediaRecord = {
  id: string; bucket: string; object_path: string; alt_text: string;
  original_name?: string; collection_name?: string; mime_type?: string;
  creator?: string; source_url?: string | null; license_name?: string; license_url?: string | null;
};
export function isPickerUuid(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value);
}
function nullableUuid(value: unknown) { return value === null || isPickerUuid(value); }
function timestamp(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function sqlInteger(value: unknown) { return typeof value === "number" && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647; }
function uniqueIds(rows: Record<string, unknown>[]) { return new Set(rows.map((row) => String(row.id).toLowerCase())).size === rows.length; }
function jsonValue(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean"
    || typeof value === "number" && Number.isFinite(value)
    || Array.isArray(value) && value.every(jsonValue)
    || isReadRecord(value) && Object.values(value).every(jsonValue);
}
export function isBannerLoadedList(value: unknown): value is BannerLoadedRecord[] {
  return isReadRecordList(value) && value.every((row) =>
    isPickerUuid(row.id) && typeof row.name === "string" && Array.from(row.name).length >= 2 && Array.from(row.name).length <= 160
    && [row.title, row.description, row.button_text].every((field) => typeof field === "string")
    && (row.target_url === null || typeof row.target_url === "string")
    && [row.desktop_media_id, row.tablet_media_id, row.mobile_media_id].every(nullableUuid)
    && (row.starts_at === null || timestamp(row.starts_at)) && (row.ends_at === null || timestamp(row.ends_at))
    && (row.starts_at === null || row.ends_at === null || Date.parse(String(row.ends_at)) > Date.parse(String(row.starts_at)))
    && sqlInteger(row.display_order) && typeof row.is_active === "boolean"
    && Array.isArray(row.page_patterns) && row.page_patterns.every((pattern) => typeof pattern === "string")
    && timestamp(row.updated_at)) && uniqueIds(value);
}
export function isHomepageLoadedList(value: unknown): value is HomepageLoadedBlock[] {
  return isReadRecordList(value) && value.every((row) =>
    isPickerUuid(row.id) && typeof row.block_type === "string"
    && ["hero", "article-grid", "carousel", "editors-choice", "popular", "latest", "categories", "book-vs-screen", "literary-map", "awards", "subscription", "text"].includes(row.block_type)
    && typeof row.title === "string" && Object.hasOwn(row, "settings") && jsonValue(row.settings)
    && sqlInteger(row.display_order) && typeof row.is_enabled === "boolean"
    && typeof row.background_style === "string" && ["light", "violet", "orange", "paper", "transparent"].includes(row.background_style)
    && nullableUuid(row.background_media_id) && timestamp(row.updated_at)) && uniqueIds(value);
}
function isMediaBase(row: unknown): row is PickerMediaRecord {
  return isReadRecord(row) && isPickerUuid(row.id) && typeof row.bucket === "string"
    && typeof row.object_path === "string" && typeof row.alt_text === "string" && Array.from(row.alt_text).length <= 500;
}
export function isBannerMediaList(value: unknown): value is PickerMediaRecord[] {
  return isReadRecordList(value) && value.every((row) => isMediaBase(row) && typeof row.original_name === "string") && uniqueIds(value);
}
export function isHomepageMediaList(value: unknown): value is PickerMediaRecord[] {
  return isReadRecordList(value) && value.every((row) => isMediaBase(row)
    && [row.collection_name, row.mime_type, row.creator, row.license_name].every((field) => typeof field === "string")
    && [row.source_url, row.license_url].every((field) => field === null || typeof field === "string")) && uniqueIds(value);
}
export function readPickerBundle(
  responses: PromiseSettledResult<{ data: unknown; error?: unknown }>[],
  validate: (value: unknown) => boolean,
  referencedIds: string[],
): { media: PickerMediaRecord[]; dependency: AdminReadResult<null> } {
  const reads = responses.map((response) => readAdminResult(response, validate));
  const failed = reads.find((read) => read.status === "failed");
  const media = new Map<string, PickerMediaRecord>();
  let conflicting = false;
  for (const read of reads) {
    if (read.status !== "success") continue;
    for (const row of read.data as PickerMediaRecord[]) {
      const key = row.id.toLowerCase();
      const old = media.get(key);
      if (old && Object.keys(row).some((field) => row[field as keyof PickerMediaRecord] !== old[field as keyof PickerMediaRecord])) conflicting = true;
      media.set(key, row);
    }
  }
  if (failed?.status === "failed") return { media: Array.from(media.values()), dependency: failed };
  const refRead = reads.at(-1);
  const refs = new Set(referencedIds.map((id) => id.toLowerCase()));
  const returnedRefs = referencedIds.length && refRead?.status === "success" ? refRead.data as PickerMediaRecord[] : [];
  const complete = !referencedIds.length || returnedRefs.length === refs.size && returnedRefs.every((row) => refs.has(row.id.toLowerCase()));
  return { media: Array.from(media.values()), dependency: conflicting || !complete
    ? { status: "failed", issue: "invalid" } : { status: "success", data: null } };
}
const actionId = z.string().uuid();
const actionVersion = z.string().datetime({ offset: true });
export function pickerActionIdentity(id: string, updatedAt?: string): boolean {
  return actionId.safeParse(id).success && (updatedAt === undefined || actionVersion.safeParse(updatedAt).success);
}
export function homepagePickerActionIdentity(id: string, updatedAt?: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)
    && (updatedAt === undefined || updatedAt.length <= 80 && timestamp(updatedAt));
}
export function homepageBlockActionIdentity(id: string, updatedAt: string): boolean {
  return isPickerUuid(id) && id.length <= 80 && updatedAt.length <= 80 && timestamp(updatedAt);
}
export function homepageSettingsEditable(value: unknown): boolean {
  if (!isReadRecord(value)) return false;
  for (const key of ["eyebrow", "description", "copy", "buttonText", "buttonUrl", "systemKey", "coreSectionKey"]) {
    if (Object.hasOwn(value, key) && typeof value[key] !== "string") return false;
  }
  if (Object.hasOwn(value, "articleIds") && (!Array.isArray(value.articleIds) || !value.articleIds.every((id) => typeof id === "string"))) return false;
  const enums: Record<string, readonly unknown[]> = {
    imageFit: ["cover", "contain", "fill"], imagePosition: ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"],
    titleAlign: ["left", "center", "right"], bodyAlign: ["left", "center", "right"], titleWeight: [400, 500, 600, 700, 800], bodyWeight: [400, 500, 600, 700, 800],
    bookScenePreset: ["dynamic", "violet-library", "warm-paper", "museum-ivory", "midnight-archive", "amber-reading-room", "orange-violet-twilight", "ink-room", "deep-blue-study", "muted-green-library", "burgundy-edition", "charcoal-gallery", "cream-publishing-room"],
    bookSceneAmbientTint: ["theme", "probpera-violet", "warm-amber", "deep-blue", "muted-green", "burgundy", "neutral-ivory"],
    bookSceneShelfMaterial: ["dark-walnut", "smoked-oak", "ink-lacquer", "museum-brass"], bookSceneDynamicThemes: [true, false, "true", "false"],
  };
  const numbers: Record<string, [number, number, number]> = {
    imageZoom: [50, 200, 1], imageBrightness: [0, 200, 1], imageContrast: [0, 200, 1], imageSaturation: [0, 200, 1], imageBlur: [0, 20, 0.1], imageOverlay: [0, 90, 1],
    titleFontSize: [20, 112, 1], titleLineHeight: [0.8, 1.6, 0.05], bodyFontSize: [12, 32, 1], bodyLineHeight: [1, 2.2, 0.05], bookSceneDarkness: [0, 90, 1], bookSceneIntensity: [0, 100, 1],
  };
  for (const [key, values] of Object.entries(enums)) {
    if (key.startsWith("bookScene") && value.coreSectionKey !== "book-archive") continue;
    if (!Object.hasOwn(value, key)) continue;
    const candidate = typeof values[0] === "number" && typeof value[key] === "string" ? Number(value[key]) : value[key];
    if (!values.includes(candidate)) return false;
  }
  for (const [key, [min, max, step]] of Object.entries(numbers)) {
    if (!Object.hasOwn(value, key)) continue;
    if (key.startsWith("bookScene") && value.coreSectionKey !== "book-archive") continue;
    const item = typeof value[key] === "number" ? value[key] : typeof value[key] === "string" && value[key].trim() ? Number(value[key]) : NaN;
    if (typeof item !== "number" || !Number.isFinite(item) || item < min || item > max || Math.abs((item - min) / step - Math.round((item - min) / step)) >= 1e-8) return false;
  }
  if (value.coreSectionKey === "featured-journal" && Object.hasOwn(value, "headerShowcasePins")) {
    if (!Array.isArray(value.headerShowcasePins) || value.headerShowcasePins.length > 7) return false;
    const ids = new Set<string>();
    for (const pin of value.headerShowcasePins) {
      if (!isReadRecord(pin) || Object.keys(pin).some((key) => !["articleId", "order", "startsAt", "endsAt", "timezone"].includes(key))
        || typeof pin.articleId !== "string" || !pin.articleId.trim() || pin.articleId.length > 200 || ids.has(pin.articleId)
        || typeof pin.order !== "number" || !Number.isInteger(pin.order) || pin.order < 0 || pin.order > 6 || pin.timezone !== "UTC" || !timestamp(pin.startsAt) || !timestamp(pin.endsAt)
        || !pin.startsAt.endsWith("Z") || !pin.endsAt.endsWith("Z") || Date.parse(pin.endsAt) <= Date.parse(pin.startsAt)) return false;
      ids.add(pin.articleId);
    }
  }
  return true;
}

export function pickerPublicUrl(value: unknown): string | null {
  if (!isReadRecord(value) || !isReadRecord(value.data) || typeof value.data.publicUrl !== "string") return null;
  try { return new URL(value.data.publicUrl).protocol === "https:" ? value.data.publicUrl : null; } catch { return null; }
}
