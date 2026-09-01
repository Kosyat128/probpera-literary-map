export const typographySemanticScopes = [
  "body",
  "navigation",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "article",
  "page",
  "lead",
  "quote",
  "caption",
  "button",
  "card",
  "footer",
] as const;

export const typographyLayers = [
  "site",
  "component",
  "template",
  "page",
  "instance",
] as const;

export const typographyBreakpoints = [
  "base",
  "mobile",
  "tablet",
  "desktop",
] as const;

export const typographySystemFamilies = [
  "system-sans",
  "system-serif",
  "georgia",
  "arial",
  "times",
] as const;

export const typographyFontStyles = ["normal", "italic", "oblique"] as const;
export const typographyTextAlignments = [
  "left",
  "center",
  "right",
  "justify",
] as const;
export const typographyTextTransforms = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
export const typographyTextDecorations = [
  "none",
  "underline",
  "line-through",
] as const;

export type TypographySemanticScope =
  (typeof typographySemanticScopes)[number];
export type TypographyLayer = (typeof typographyLayers)[number];
export type TypographyBreakpoint = (typeof typographyBreakpoints)[number];
export type TypographySystemFamily =
  (typeof typographySystemFamilies)[number];
export type TypographyFontStyle = (typeof typographyFontStyles)[number];
export type TypographyTextAlignment =
  (typeof typographyTextAlignments)[number];
export type TypographyTextTransform =
  (typeof typographyTextTransforms)[number];
export type TypographyTextDecoration =
  (typeof typographyTextDecorations)[number];

export type SiteTypographyProperties = {
  familyId?: string;
  systemFamily?: TypographySystemFamily;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: TypographyFontStyle;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: TypographyTextAlignment;
  textTransform?: TypographyTextTransform;
  textDecoration?: TypographyTextDecoration;
  textIndent?: number;
  wordSpacing?: number;
};

export type SiteTypographyTarget = {
  layer: TypographyLayer;
  targetKey: string;
  semanticScope: TypographySemanticScope;
  breakpoint: TypographyBreakpoint;
};

export type SiteTypographyOverride = SiteTypographyTarget & {
  id?: string;
  version?: number;
  settings: SiteTypographyProperties;
};

export type SiteTypographyResolutionContext = {
  semanticScope: TypographySemanticScope;
  breakpoint: TypographyBreakpoint;
  targetKeys?: Partial<Record<Exclude<TypographyLayer, "site">, string>>;
};

export type SiteTypographyErrorCode =
  | "typography_target_invalid"
  | "typography_value_invalid"
  | "typography_target_key_invalid"
  | "typography_site_key_invalid"
  | "typography_settings_invalid"
  | "typography_property_unknown"
  | "typography_font_id_invalid"
  | "typography_number_invalid"
  | "typography_font_source_conflict"
  | "typography_family_kind_invalid"
  | "typography_asset_required"
  | "typography_system_required"
  | "typography_version_invalid"
  | "typography_id_invalid"
  | "typography_request_invalid"
  | "typography_empty"
  | "typography_stale"
  | "typography_font_in_use"
  | "typography_forbidden"
  | "typography_database_unavailable"
  | "typography_save_failed"
  | "typography_reset_failed"
  | "typography_reset_publish_failed"
  | "typography_publish_failed"
  | "typography_revision_invalid"
  | "typography_restore_failed"
  | "typography_font_archive_failed";

export class SiteTypographyValidationError extends Error {
  constructor(readonly code: SiteTypographyErrorCode) {
    super(code);
    this.name = "SiteTypographyValidationError";
  }
}

export const siteTypographyPropertyKeys = [
  "familyId",
  "systemFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecoration",
  "textIndent",
  "wordSpacing",
] as const satisfies readonly (keyof SiteTypographyProperties)[];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const targetKeyPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const typographyPropertyKeySet = new Set<string>(siteTypographyPropertyKeys);

type NumericRule = {
  min: number;
  max: number;
  integer?: boolean;
};

const numericRules = {
  fontSize: { min: 8, max: 144 },
  fontWeight: { min: 1, max: 1000, integer: true },
  lineHeight: { min: 0.8, max: 3 },
  letterSpacing: { min: -0.2, max: 1 },
  textIndent: { min: 0, max: 12 },
  wordSpacing: { min: -0.2, max: 2 },
} as const satisfies Partial<
  Record<keyof SiteTypographyProperties, NumericRule>
>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseEnum<const Values extends readonly string[]>(
  value: unknown,
  values: Values
): Values[number] {
  if (typeof value !== "string" || !values.includes(value as Values[number])) {
    throw new SiteTypographyValidationError("typography_value_invalid");
  }
  return value as Values[number];
}

function parseNumber(value: unknown, rule: NumericRule) {
  const candidate =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (
    !Number.isFinite(candidate) ||
    candidate < rule.min ||
    candidate > rule.max ||
    (rule.integer && !Number.isInteger(candidate))
  ) {
    throw new SiteTypographyValidationError("typography_number_invalid");
  }
  return Number(candidate.toFixed(4));
}

export function parseTypographyTarget(input: unknown): SiteTypographyTarget {
  if (!isPlainRecord(input)) {
    throw new SiteTypographyValidationError("typography_target_invalid");
  }
  const layer = parseEnum(input.layer, typographyLayers);
  const targetKey =
    typeof input.targetKey === "string" ? input.targetKey.trim() : "";
  if (!targetKeyPattern.test(targetKey)) {
    throw new SiteTypographyValidationError("typography_target_key_invalid");
  }
  if (layer === "site" && targetKey !== "site") {
    throw new SiteTypographyValidationError("typography_site_key_invalid");
  }
  return {
    layer,
    targetKey,
    semanticScope: parseEnum(input.semanticScope, typographySemanticScopes),
    breakpoint: parseEnum(input.breakpoint, typographyBreakpoints),
  };
}

/**
 * Strictly parses the JSON settings accepted by the publication pipeline.
 * Unknown keys, raw CSS and arbitrary font-family strings are rejected.
 */
export function parseSiteTypographyProperties(
  input: unknown
): SiteTypographyProperties {
  if (!isPlainRecord(input)) {
    throw new SiteTypographyValidationError("typography_settings_invalid");
  }
  const unknownKeys = Object.keys(input).filter(
    (key) => !typographyPropertyKeySet.has(key)
  );
  if (unknownKeys.length) {
    throw new SiteTypographyValidationError("typography_property_unknown");
  }

  const parsed: SiteTypographyProperties = {};
  for (const key of siteTypographyPropertyKeys) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    if (key === "familyId") {
      if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
        throw new SiteTypographyValidationError("typography_font_id_invalid");
      }
      parsed.familyId = value.trim().toLowerCase();
      continue;
    }
    if (key in numericRules) {
      parsed[key as keyof typeof numericRules] = parseNumber(
        value,
        numericRules[key as keyof typeof numericRules]
      );
      continue;
    }
    if (key === "systemFamily") {
      parsed.systemFamily = parseEnum(value, typographySystemFamilies);
    } else if (key === "fontStyle") {
      parsed.fontStyle = parseEnum(value, typographyFontStyles);
    } else if (key === "textAlign") {
      parsed.textAlign = parseEnum(value, typographyTextAlignments);
    } else if (key === "textTransform") {
      parsed.textTransform = parseEnum(value, typographyTextTransforms);
    } else if (key === "textDecoration") {
      parsed.textDecoration = parseEnum(value, typographyTextDecorations);
    }
  }

  if (parsed.familyId && parsed.systemFamily) {
    throw new SiteTypographyValidationError(
      "typography_font_source_conflict"
    );
  }
  return parsed;
}

/** Invalid persisted settings fail closed instead of becoming CSS. */
export function readSiteTypographyProperties(
  input: unknown
): SiteTypographyProperties {
  try {
    return parseSiteTypographyProperties(input);
  } catch {
    return {};
  }
}

export function typographyTargetFromForm(formData: FormData) {
  return parseTypographyTarget({
    layer: formData.get("layer"),
    targetKey: formData.get("target_key"),
    semanticScope: formData.get("semantic_scope"),
    breakpoint: formData.get("breakpoint"),
  });
}

export function typographyPropertiesInputFromForm(formData: FormData) {
  const familyKind = String(formData.get("family_kind") || "inherit");
  if (!["inherit", "system", "asset"].includes(familyKind)) {
    throw new SiteTypographyValidationError(
      "typography_family_kind_invalid"
    );
  }
  const input: Record<string, unknown> = {};
  if (familyKind === "asset") {
    const familyId = formData.get("familyId");
    if (typeof familyId !== "string" || !familyId.trim()) {
      throw new SiteTypographyValidationError("typography_asset_required");
    }
    input.familyId = familyId;
  }
  if (familyKind === "system") {
    const systemFamily = formData.get("systemFamily");
    if (typeof systemFamily !== "string" || !systemFamily.trim()) {
      throw new SiteTypographyValidationError("typography_system_required");
    }
    input.systemFamily = systemFamily;
  }
  for (const key of siteTypographyPropertyKeys) {
    if (key === "familyId" || key === "systemFamily") continue;
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) input[key] = value.trim();
  }
  return parseSiteTypographyProperties(input);
}

export function expectedTypographyVersionFromForm(formData: FormData) {
  const raw = formData.get("expected_version");
  const version =
    typeof raw === "string" && /^[0-9]+$/u.test(raw.trim())
      ? Number(raw)
      : Number.NaN;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new SiteTypographyValidationError("typography_version_invalid");
  }
  return version;
}
