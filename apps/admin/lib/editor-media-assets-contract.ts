export const EDITOR_MEDIA_PAGE_SIZE = 60;

export type EditorMediaAsset = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  creator: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  collectionName: string;
  width: number;
  height: number;
};

export type EditorMediaCursor = { createdAt: string; id: string };
export type EditorMediaAssetsPage = {
  ok: true;
  assets: EditorMediaAsset[];
  nextCursor: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const assetKeys = ["id", "src", "alt", "caption", "creator", "sourceUrl", "licenseName", "licenseUrl", "collectionName", "width", "height"];
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
export function isEditorMediaId(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
export function isEditorMediaTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
function dimension(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}
function publicUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}

/** Preserve the database timestamp string, including its microseconds. */
export function encodeEditorMediaCursor(cursor: EditorMediaCursor): string {
  return JSON.stringify([cursor.createdAt, cursor.id]);
}
export function parseEditorMediaCursor(value: unknown): EditorMediaCursor | null {
  if (typeof value !== "string" || value.length > 160) return null;
  try {
    const tuple: unknown = JSON.parse(value);
    return Array.isArray(tuple) && tuple.length === 2 && isEditorMediaTimestamp(tuple[0]) && isEditorMediaId(tuple[1])
      ? { createdAt: tuple[0], id: tuple[1] } : null;
  } catch { return null; }
}
export function isEditorMediaAsset(value: unknown): value is EditorMediaAsset {
  return record(value) && exactKeys(value, assetKeys) && isEditorMediaId(value.id) && publicUrl(value.src)
    && ["alt", "caption", "creator", "sourceUrl", "licenseName", "licenseUrl", "collectionName"].every((key) => typeof value[key] === "string")
    && dimension(value.width) && dimension(value.height);
}
export function parseEditorMediaAssetsPage(value: unknown): EditorMediaAssetsPage | null {
  if (!record(value) || !exactKeys(value, ["ok", "assets", "nextCursor"]) || value.ok !== true
    || !Array.isArray(value.assets) || value.assets.length > EDITOR_MEDIA_PAGE_SIZE || !value.assets.every(isEditorMediaAsset)
    || new Set(value.assets.map((asset) => asset.id.toLowerCase())).size !== value.assets.length
    || value.nextCursor !== null && (!parseEditorMediaCursor(value.nextCursor) || value.assets.length !== EDITOR_MEDIA_PAGE_SIZE
      || parseEditorMediaCursor(value.nextCursor)?.id.toLowerCase() !== value.assets.at(-1)?.id.toLowerCase())) return null;
  return value as EditorMediaAssetsPage;
}

export type EditorMediaAssetRow = {
  id: string; bucket: string; object_path: string; alt_text: string; caption: string; creator: string;
  source_url: string | null; license_name: string; license_url: string | null; collection_name: string;
  width: number | null; height: number | null; created_at: string;
};
export function isEditorMediaAssetRow(value: unknown): value is EditorMediaAssetRow {
  return record(value) && isEditorMediaId(value.id) && isEditorMediaTimestamp(value.created_at)
    && typeof value.bucket === "string" && value.bucket.length > 0 && typeof value.object_path === "string" && value.object_path.length > 0
    && ["alt_text", "caption", "creator", "license_name", "collection_name"].every((key) => typeof value[key] === "string")
    && (value.source_url === null || typeof value.source_url === "string") && (value.license_url === null || typeof value.license_url === "string")
    && (value.width === null || dimension(value.width)) && (value.height === null || dimension(value.height));
}
