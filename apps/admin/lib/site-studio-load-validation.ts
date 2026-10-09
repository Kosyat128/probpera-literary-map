import { isReadRecord, readAdminResult, type AdminReadIssue } from "@/lib/admin-read-result";
import { safeCount } from "@/lib/format";
import { siteStudioBreakpoints, siteStudioLayers, siteStudioStates, siteStudioTokenCategories, siteStudioTokenCategoryValueTypes, siteStudioTokenValueTypes } from "@/lib/site-studio-contract";
import { siteTypographyPropertyKeys, typographyBreakpoints, typographyLayers, typographySemanticScopes, typographySystemFamilies, typographyFontStyles, typographyTextAlignments, typographyTextTransforms, typographyTextDecorations } from "@/lib/site-typography";

export type StudioReadRow = Record<string, unknown>;
export function studioUuid(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value); }
export function studioActionUuid(value: unknown, typography = false): boolean {
  return typeof value === "string" && (typography
    ? /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu
    : /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu).test(value);
}
function version(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function stamp(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function nullableStamp(value: unknown) { return value === null || stamp(value); }
function sqlText(value: unknown, min: number, max: number): value is string { return typeof value === "string" && Array.from(value).length >= min && Array.from(value).length <= max; }
function enumValue(value: unknown, values: readonly string[]): value is string { return typeof value === "string" && values.includes(value); }
export function studioJson(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)
    || Array.isArray(value) && value.every(studioJson) || isReadRecord(value) && Object.values(value).every(studioJson);
}
export function readStudioRows(
  result: PromiseSettledResult<{ data: unknown; count?: number | null; error?: unknown }>,
  validate: (row: StudioReadRow) => boolean,
  identity: (row: StudioReadRow) => string,
  complete = true,
): { rows: StudioReadRow[]; issue: AdminReadIssue | null } {
  const read = readAdminResult(result, Array.isArray);
  if (read.status === "failed") return { rows: [], issue: read.issue };
  const rows: StudioReadRow[] = [];
  const seen = new Set<string>();
  let invalid = false;
  for (const value of read.data as unknown[]) {
    if (!isReadRecord(value) || !validate(value)) { invalid = true; continue; }
    const key = identity(value).toLowerCase();
    if (seen.has(key)) { invalid = true; continue; }
    seen.add(key); rows.push(value);
  }
  const count = result.status === "fulfilled" ? safeCount({ count: result.value.count ?? null, error: result.value.error }) : null;
  const length = (read.data as unknown[]).length;
  if (count === null || count < length || complete && count !== length || length === 0 && count !== 0) invalid = true;
  return { rows, issue: invalid ? "invalid" : null };
}
export function isStudioToken(row: StudioReadRow): boolean {
  return studioUuid(row.id) && enumValue(row.layer, siteStudioLayers)
    && typeof row.target_key === "string" && /^[a-z][a-z0-9_-]{0,119}$/u.test(row.target_key)
    && (row.layer !== "site" || row.target_key === "site")
    && typeof row.token_key === "string" && /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/u.test(row.token_key) && row.token_key.length <= 160
    && !["constructor", "prototype", "__proto__"].includes(row.token_key)
    && enumValue(row.category, siteStudioTokenCategories) && enumValue(row.value_type, siteStudioTokenValueTypes)
    && (siteStudioTokenCategoryValueTypes[row.category as keyof typeof siteStudioTokenCategoryValueTypes] as readonly string[]).includes(row.value_type)
    && enumValue(row.breakpoint, siteStudioBreakpoints) && enumValue(row.state, siteStudioStates)
    && sqlText(row.description, 0, 500) && Object.hasOwn(row, "draft_value") && row.draft_value !== null && studioJson(row.draft_value)
    && Object.hasOwn(row, "published_value") && studioJson(row.published_value) && version(row.cas_version) && stamp(row.updated_at)
    && studioTokenValue(String(row.category), String(row.value_type), row.draft_value)
    && (row.published_value === null || studioTokenValue(String(row.category), String(row.value_type), row.published_value));
}
function studioTokenValue(category: string, type: string, value: unknown): boolean {
  const number = (item: unknown, min: number, max: number, integer = false) => typeof item === "number" && Number.isFinite(item) && item >= min && item <= max && (!integer || Number.isInteger(item));
  const keys = (item: unknown, allowed: string[], required = allowed): item is StudioReadRow => isReadRecord(item) && Object.keys(item).every((key) => allowed.includes(key)) && required.every((key) => Object.hasOwn(item, key));
  const length = (item: unknown, min: number, max: number, units = ["px", "rem", "em", "%", "vw", "vh"]) => keys(item, ["value", "unit"]) && number(item.value, min, max) && enumValue(item.unit, units);
  if (type === "color") return value === "transparent" || typeof value === "string" && /^(?:#[a-f0-9]{3,4}|#[a-f0-9]{6}(?:[a-f0-9]{2})?)$/iu.test(value);
  if (type === "length") return length(value, 0, category === "typography" ? 256 : category === "layout" ? 8192 : 512);
  if (type === "number") return number(value, -10000, 10000);
  if (type === "duration") return number(value, 0, 5000, true);
  if (type === "easing") return enumValue(value, ["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);
  if (type === "shadow") return keys(value, ["x", "y", "blur", "spread", "color", "inset"])
    && length(value.x, -128, 128, ["px"]) && length(value.y, -128, 128, ["px"]) && length(value.blur, 0, 256, ["px"])
    && length(value.spread, -128, 128, ["px"]) && studioTokenValue("color", "color", value.color) && typeof value.inset === "boolean";
  if (type === "effect") return keys(value, ["name", "durationMs", "easing", "reducedMotionFallback"])
    && enumValue(value.name, ["none", "fade", "reveal-up", "zoom-soft"]) && studioTokenValue("motion", "duration", value.durationMs)
    && studioTokenValue("motion", "easing", value.easing) && value.reducedMotionFallback === (["none", "fade"].includes(String(value.name)) ? "none" : "fade");
  if (type !== "layout" || !keys(value, ["display", "columns", "gap", "padding", "maxWidth", "borderRadius", "alignItems", "justifyContent", "overflow"], ["display"]) || !enumValue(value.display, ["block", "flex", "grid"])) return false;
  return (!Object.hasOwn(value, "columns") || value.display === "grid" && number(value.columns, 1, 12, true))
    && ["gap", "padding", "borderRadius"].every((key) => !Object.hasOwn(value, key) || length(value[key], 0, 512))
    && (!Object.hasOwn(value, "maxWidth") || length(value.maxWidth, 1, 8192, ["px", "rem"]))
    && (!Object.hasOwn(value, "alignItems") || enumValue(value.alignItems, ["start", "center", "end", "stretch"]))
    && (!Object.hasOwn(value, "justifyContent") || enumValue(value.justifyContent, ["start", "center", "end", "space-between"]))
    && (!Object.hasOwn(value, "overflow") || enumValue(value.overflow, ["visible", "hidden", "clip", "auto"]));
}
export function isStudioComponent(row: StudioReadRow): boolean {
  return typeof row.component_key === "string" && /^[a-z][a-z0-9-]{0,79}$/u.test(row.component_key)
    && typeof row.display_name === "string" && sqlText(row.display_name.replace(/^ +| +$/gu, ""), 1, 120) && typeof row.owner_lock === "boolean";
}
export function isStudioDraftSet(row: StudioReadRow): boolean {
  return studioUuid(row.id) && typeof row.name === "string" && sqlText(row.name.replace(/^ +| +$/gu, ""), 1, 160) && version(row.cas_version);
}
export function isStudioChangeSet(row: StudioReadRow): boolean {
  return isStudioDraftSet(row) && sqlText(row.description, 0, 1200)
    && enumValue(row.status, ["draft", "review", "approved", "published", "cancelled"])
    && nullableStamp(row.scheduled_at) && nullableStamp(row.submitted_at) && nullableStamp(row.approved_at) && nullableStamp(row.published_at) && stamp(row.updated_at)
    && (row.scheduled_at === null || ["approved", "published"].includes(String(row.status)))
    && (row.status === "draft" ? row.submitted_at === null && row.approved_at === null && row.published_at === null
      : row.status === "review" ? row.submitted_at !== null && row.approved_at === null && row.published_at === null
        : row.status === "approved" ? row.submitted_at !== null && row.approved_at !== null && row.published_at === null
          : row.status === "published" ? row.submitted_at !== null && row.approved_at !== null && row.published_at !== null : row.published_at === null);
}
export function isStudioItem(row: StudioReadRow): boolean {
  return version(row.id) && studioUuid(row.change_set_id) && studioUuid(row.token_id) && version(row.expected_token_cas_version)
    && Object.hasOwn(row, "proposed_value") && studioJson(row.proposed_value);
}
export function isStudioTokenIdentity(row: StudioReadRow): boolean {
  return studioUuid(row.id) && enumValue(row.layer, siteStudioLayers)
    && typeof row.target_key === "string" && /^[a-z][a-z0-9_-]{0,119}$/u.test(row.target_key)
    && typeof row.token_key === "string" && /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/u.test(row.token_key) && row.token_key.length <= 160;
}
export function isStudioRelease(row: StudioReadRow): boolean {
  return studioUuid(row.id) && version(row.release_number) && enumValue(row.action, ["publish", "rollback"])
    && (row.change_set_id === null || studioUuid(row.change_set_id)) && (row.rollback_of_release_id === null || studioUuid(row.rollback_of_release_id))
    && (row.action === "publish" ? row.change_set_id !== null && row.rollback_of_release_id === null : row.change_set_id === null && row.rollback_of_release_id !== null)
    && version(row.token_count) && row.token_count <= 256 && stamp(row.created_at);
}
export function isStudioFont(row: StudioReadRow): boolean {
  return studioUuid(row.id) && sqlText(row.display_name, 1, 120) && sqlText(row.family_name, 1, 120)
    && enumValue(row.source_type, ["system", "bundled", "uploaded"]) && (row.format === null || enumValue(row.format, ["woff", "woff2"]))
    && enumValue(row.font_style, typographyFontStyles) && version(row.weight_min) && row.weight_min <= 1000
    && version(row.weight_max) && row.weight_max <= 1000 && row.weight_min <= row.weight_max && typeof row.is_variable === "boolean"
    && (row.is_variable || row.weight_min === row.weight_max)
    && (row.byte_size === null || version(row.byte_size) && row.byte_size <= 2097152)
    && (row.source_type === "system" ? row.format === null && row.byte_size === null : row.format !== null && row.byte_size !== null && row.license_name !== null)
    && (row.license_name === null || sqlText(row.license_name, 1, 180))
    && (row.license_url === null || sqlText(row.license_url, 0, 2048) && /^https?:\/\//iu.test(row.license_url))
    && stamp(row.created_at) && version(row.cas_version);
}
export function isStudioTypography(row: StudioReadRow): boolean {
  return studioUuid(row.id) && enumValue(row.layer, typographyLayers)
    && typeof row.target_key === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/u.test(row.target_key) && (row.layer !== "site" || row.target_key === "site")
    && enumValue(row.semantic_scope, typographySemanticScopes) && enumValue(row.breakpoint, typographyBreakpoints)
    && isReadRecord(row.draft_settings) && studioJson(row.draft_settings)
    && (row.published_settings === null || isReadRecord(row.published_settings) && studioJson(row.published_settings))
    && version(row.cas_version) && stamp(row.updated_at);
}
export function isStudioTypographyRevision(row: StudioReadRow): boolean {
  return version(row.id) && studioUuid(row.override_id) && version(row.revision_number)
    && enumValue(row.action, ["publish", "restore"]) && isReadRecord(row.snapshot) && studioJson(row.snapshot) && stamp(row.created_at);
}
export function studioTypographyRevisionIdentity(snapshot: unknown): snapshot is StudioReadRow {
  return isReadRecord(snapshot) && enumValue(snapshot.layer, typographyLayers)
    && typeof snapshot.targetKey === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/u.test(snapshot.targetKey)
    && (snapshot.layer !== "site" || snapshot.targetKey === "site")
    && enumValue(snapshot.semanticScope, typographySemanticScopes) && enumValue(snapshot.breakpoint, typographyBreakpoints);
}
export function studioTypographyEditorSettings(value: unknown): boolean {
  if (!isReadRecord(value) || Object.keys(value).some((key) => !(siteTypographyPropertyKeys as readonly string[]).includes(key))) return false;
  if (value.familyId && value.systemFamily) return false;
  const numeric: Record<string, [number, number, boolean?]> = { fontSize: [8, 144], fontWeight: [1, 1000, true], lineHeight: [0.8, 3], letterSpacing: [-0.2, 1], textIndent: [0, 12], wordSpacing: [-0.2, 2] };
  const enums: Record<string, readonly string[]> = { systemFamily: typographySystemFamilies, fontStyle: typographyFontStyles, textAlign: typographyTextAlignments, textTransform: typographyTextTransforms, textDecoration: typographyTextDecorations };
  return Object.entries(value).every(([key, item]) => {
    if (item === null || item === "") return true;
    if (key === "familyId") return typeof item === "string" && studioActionUuid(item.trim(), true);
    if (Object.hasOwn(numeric, key)) {
      const candidate = typeof item === "number" ? item : typeof item === "string" && item.trim() ? Number(item) : NaN;
      return Number.isFinite(candidate) && candidate >= numeric[key][0] && candidate <= numeric[key][1] && (!numeric[key][2] || Number.isInteger(candidate));
    }
    return enumValue(item, enums[key] ?? []);
  });
}
