import { isReadRecord } from "./admin-read-result";

export type MediaUsage = {
  media_id: string; entity_type: string; entity_id: string; field_name: string; is_revision: boolean;
};
export type MediaStudioAsset = {
  id: string; bucket: string; object_path: string; original_name: string; mime_type: string;
  byte_size: number | string | null; width: number | null; height: number | null;
  alt_text: string; caption: string; creator: string; source_url: string | null;
  license_name: string; license_url: string | null; focus_x: number; focus_y: number;
  collection_name: string; created_at: string; updated_at: string; deleted_at: string | null;
  rights_status: "verified" | "editorial" | "public-domain" | "licensed" | "unknown";
  sha256_hex: string | null; replacement_of_media_id: string | null; replaced_by_media_id: string | null;
  usage_count: unknown; duplicate_count: unknown; total_count: unknown;
};
export type ReplacementUsageRef = {
  entity_type: "article" | "page" | "homepage" | "banner"; entity_id: string; field_name: string;
};
export type ReplacementPreview = {
  old_media_id: string; new_media_id: string; old_updated_at: string; new_updated_at: string;
  new_original_name: string; new_alt_text: string; new_sha256_hex: string;
  current_usage_refs: ReplacementUsageRef[]; history_usage_count: number | string;
};

const sqlUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function isSqlUuid(value: unknown): value is string {
  return typeof value === "string" && sqlUuidPattern.test(value);
}
function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function isText(value: unknown): value is string { return typeof value === "string"; }
function isNullableText(value: unknown): value is string | null { return value === null || isText(value); }
function isNullableUuid(value: unknown): value is string | null { return value === null || isSqlUuid(value); }
function isDimension(value: unknown): value is number | null {
  return value === null || typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}
function isFocus(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** RPC bigint counts can be numbers or decimal strings; unknown never becomes zero. */
export function mediaReadCount(value: unknown): number | null {
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/u.test(value))) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function isMediaStudioAsset(value: unknown): value is MediaStudioAsset {
  return isReadRecord(value) && isSqlUuid(value.id)
    && isText(value.bucket) && value.bucket.length > 0
    && isText(value.object_path) && value.object_path.length > 0
    && isText(value.original_name) && isText(value.mime_type)
    && (value.byte_size === null || mediaReadCount(value.byte_size) !== null)
    && isDimension(value.width) && isDimension(value.height)
    && isText(value.alt_text) && isText(value.caption) && isText(value.creator)
    && isNullableText(value.source_url) && isText(value.license_name) && isNullableText(value.license_url)
    && isFocus(value.focus_x) && isFocus(value.focus_y) && isText(value.collection_name)
    && isTimestamp(value.created_at) && isTimestamp(value.updated_at)
    && (value.deleted_at === null || isTimestamp(value.deleted_at))
    && typeof value.rights_status === "string"
    && ["verified", "editorial", "public-domain", "licensed", "unknown"].includes(value.rights_status)
    && (value.sha256_hex === null || typeof value.sha256_hex === "string" && /^[a-f0-9]{64}$/u.test(value.sha256_hex))
    && isNullableUuid(value.replacement_of_media_id) && isNullableUuid(value.replaced_by_media_id);
}

export function mediaListIdentityValid(assets: MediaStudioAsset[]) {
  return new Set(assets.map((asset) => asset.id.toLowerCase())).size === assets.length;
}

/** count(*) over () is absent on empty pages, so only the first empty page establishes zero. */
export function mediaCatalogTotal(assets: MediaStudioAsset[], page: number,
  firstCount = mediaReadCount(assets[0]?.total_count)): number | null {
  if (!assets.length) return page === 1 ? 0 : null;
  const count = firstCount;
  if (count === null || count < assets.length || !assets.every((asset) => mediaReadCount(asset.total_count) === count)) return null;
  return count;
}

export function isMediaUsage(value: unknown, mediaIds: Set<string>): value is MediaUsage {
  return isReadRecord(value) && isSqlUuid(value.media_id) && mediaIds.has(value.media_id.toLowerCase())
    && isText(value.entity_type) && value.entity_type.length > 0
    && isText(value.entity_id) && value.entity_id.length > 0
    && isText(value.field_name) && value.field_name.length > 0 && typeof value.is_revision === "boolean";
}

export function isReplacementPreview(value: unknown, oldId: string, newId: string): value is ReplacementPreview {
  return isReadRecord(value) && isSqlUuid(value.old_media_id) && isSqlUuid(value.new_media_id)
    && value.old_media_id.toLowerCase() === oldId.toLowerCase()
    && value.new_media_id.toLowerCase() === newId.toLowerCase()
    && oldId.toLowerCase() !== newId.toLowerCase()
    && isTimestamp(value.old_updated_at) && isTimestamp(value.new_updated_at)
    && isText(value.new_original_name) && isText(value.new_alt_text)
    && typeof value.new_sha256_hex === "string" && /^[a-f0-9]{64}$/u.test(value.new_sha256_hex)
    && Array.isArray(value.current_usage_refs)
    && value.current_usage_refs.every((usage) => isReadRecord(usage)
      && typeof usage.entity_type === "string" && ["article", "page", "homepage", "banner"].includes(usage.entity_type)
      && isSqlUuid(usage.entity_id) && isText(usage.field_name) && usage.field_name.length > 0)
    && mediaReadCount(value.history_usage_count) !== null;
}

/** getPublicUrl is a synchronous SDK helper; do not let an invalid helper response crash SSR. */
export function readMediaPublicUrl(read: () => unknown): string | null {
  try {
    const response = read();
    if (!isReadRecord(response) || response.error != null || !isReadRecord(response.data) || typeof response.data.publicUrl !== "string") return null;
    const url = new URL(response.data.publicUrl);
    return ["http:", "https:"].includes(url.protocol) ? response.data.publicUrl : null;
  } catch {
    return null;
  }
}
