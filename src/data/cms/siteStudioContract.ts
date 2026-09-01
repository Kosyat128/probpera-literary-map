export const siteStudioTokenCategories = [
  "color",
  "typography",
  "spacing",
  "radius",
  "shadow",
  "motion",
  "layout",
] as const;

export const siteStudioTokenValueTypes = [
  "color",
  "length",
  "number",
  "shadow",
  "duration",
  "easing",
  "effect",
  "layout",
] as const;

export const siteStudioLayers = [
  "site",
  "component",
  "template",
  "page",
  "instance",
] as const;

export const siteStudioBreakpoints = [
  "base",
  "mobile",
  "tablet",
  "desktop",
] as const;

export const siteStudioStates = [
  "default",
  "hover",
  "focus",
  "active",
  "selected",
  "open",
  "disabled",
] as const;

export const siteStudioEasings = [
  "linear",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
] as const;

export type SiteStudioTokenCategory =
  (typeof siteStudioTokenCategories)[number];
export type SiteStudioTokenValueType =
  (typeof siteStudioTokenValueTypes)[number];
export type SiteStudioLayer = (typeof siteStudioLayers)[number];
export type SiteStudioBreakpoint = (typeof siteStudioBreakpoints)[number];
export type SiteStudioState = (typeof siteStudioStates)[number];
export type SiteStudioEasing = (typeof siteStudioEasings)[number];

export const siteStudioTokenCategoryValueTypes = {
  color: ["color"],
  typography: ["color", "length", "number"],
  spacing: ["length"],
  radius: ["length"],
  shadow: ["shadow"],
  motion: ["duration", "easing", "effect"],
  layout: ["layout", "length", "number"],
} as const satisfies Record<
  SiteStudioTokenCategory,
  readonly SiteStudioTokenValueType[]
>;

export type SiteStudioLengthUnit = "px" | "rem" | "em" | "%" | "vw" | "vh";

export type SiteStudioLength = Readonly<{
  value: number;
  unit: SiteStudioLengthUnit;
}>;

export type SiteStudioShadow = Readonly<{
  x: SiteStudioLength;
  y: SiteStudioLength;
  blur: SiteStudioLength;
  spread: SiteStudioLength;
  color: string;
  inset: boolean;
}>;

export type SiteStudioLayout = Readonly<{
  display: "block" | "flex" | "grid";
  columns?: number;
  gap?: SiteStudioLength;
  padding?: SiteStudioLength;
  maxWidth?: SiteStudioLength;
  borderRadius?: SiteStudioLength;
  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "space-between";
  overflow?: "visible" | "hidden" | "clip" | "auto";
}>;

export type SiteStudioEffectName =
  | "none"
  | "fade"
  | "reveal-up"
  | "zoom-soft";

export type SiteStudioEffect = Readonly<{
  name: SiteStudioEffectName;
  durationMs: number;
  easing: SiteStudioEasing;
  reducedMotionFallback: "none" | "fade";
}>;

export type SiteStudioTokenValue =
  | string
  | number
  | SiteStudioLength
  | SiteStudioShadow
  | SiteStudioLayout
  | SiteStudioEffect;

const tokenNamePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const lengthPattern = /^(-?(?:\d+|\d*\.\d+))(px|rem|em|%|vw|vh)$/u;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error("site_studio_property_unknown");
  }
}

function enumValue<const Values extends readonly string[]>(
  value: unknown,
  allowed: Values,
  code: string
): Values[number] {
  if (typeof value !== "string" || !allowed.includes(value as Values[number])) {
    throw new Error(code);
  }
  return value as Values[number];
}

function boundedNumber(
  value: unknown,
  min: number,
  max: number,
  integer = false
) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (integer && !Number.isInteger(number))
  ) {
    throw new Error("site_studio_number_invalid");
  }
  return integer ? number : Number(number.toFixed(4));
}

export function normalizeSiteStudioColor(value: unknown) {
  if (value === "transparent") return "transparent";
  if (typeof value !== "string") throw new Error("site_studio_color_invalid");
  const normalized = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/u.test(normalized)) {
    throw new Error("site_studio_color_invalid");
  }
  if (normalized.length === 4 || normalized.length === 5) {
    return `#${[...normalized.slice(1)].map((part) => part + part).join("")}`;
  }
  return normalized;
}

export function normalizeSiteStudioLength(
  value: unknown,
  options: Readonly<{
    min?: number;
    max?: number;
    units?: readonly SiteStudioLengthUnit[];
  }> = {}
): SiteStudioLength {
  const min = options.min ?? -2048;
  const max = options.max ?? 8192;
  const units = options.units ?? ["px", "rem", "em", "%", "vw", "vh"];
  const source = record(value);
  if (source) {
    assertOnlyKeys(source, ["value", "unit"]);
    const unit = enumValue(
      source.unit,
      units,
      "site_studio_length_invalid"
    );
    return {
      value: boundedNumber(source.value, min, max),
      unit,
    };
  }
  if (typeof value === "number") {
    return { value: boundedNumber(value, min, max), unit: "px" };
  }
  if (typeof value !== "string") throw new Error("site_studio_length_invalid");
  const match = lengthPattern.exec(value.trim().toLowerCase());
  if (!match) throw new Error("site_studio_length_invalid");
  const unit = match[2] as SiteStudioLengthUnit;
  if (!units.includes(unit)) throw new Error("site_studio_length_invalid");
  return { value: boundedNumber(match[1], min, max), unit };
}

export function normalizeSiteStudioShadow(value: unknown): SiteStudioShadow {
  const source = record(value);
  if (!source) throw new Error("site_studio_shadow_invalid");
  assertOnlyKeys(source, ["x", "y", "blur", "spread", "color", "inset"]);
  return {
    x: normalizeSiteStudioLength(source.x, { min: -128, max: 128, units: ["px"] }),
    y: normalizeSiteStudioLength(source.y, { min: -128, max: 128, units: ["px"] }),
    blur: normalizeSiteStudioLength(source.blur, { min: 0, max: 256, units: ["px"] }),
    spread: normalizeSiteStudioLength(source.spread ?? 0, {
      min: -128,
      max: 128,
      units: ["px"],
    }),
    color: normalizeSiteStudioColor(source.color),
    inset: source.inset === true,
  };
}

export function normalizeSiteStudioDuration(value: unknown) {
  let milliseconds: number;
  if (typeof value === "number") {
    milliseconds = value;
  } else if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const match = /^(\d+(?:\.\d+)?)(ms|s)$/u.exec(normalized);
    if (!match) throw new Error("site_studio_duration_invalid");
    milliseconds = Number(match[1]) * (match[2] === "s" ? 1000 : 1);
  } else {
    throw new Error("site_studio_duration_invalid");
  }
  return Math.round(boundedNumber(milliseconds, 0, 5000));
}

export function normalizeSiteStudioEasing(value: unknown): SiteStudioEasing {
  return enumValue(value, siteStudioEasings, "site_studio_easing_invalid");
}

export function normalizeSiteStudioLayout(value: unknown): SiteStudioLayout {
  const source = record(value);
  if (!source) throw new Error("site_studio_layout_invalid");
  assertOnlyKeys(source, [
    "display",
    "columns",
    "gap",
    "padding",
    "maxWidth",
    "borderRadius",
    "alignItems",
    "justifyContent",
    "overflow",
  ]);
  const display = enumValue(
    source.display,
    ["block", "flex", "grid"] as const,
    "site_studio_layout_invalid"
  );
  const result: {
    display: SiteStudioLayout["display"];
    columns?: number;
    gap?: SiteStudioLength;
    padding?: SiteStudioLength;
    maxWidth?: SiteStudioLength;
    borderRadius?: SiteStudioLength;
    alignItems?: SiteStudioLayout["alignItems"];
    justifyContent?: SiteStudioLayout["justifyContent"];
    overflow?: SiteStudioLayout["overflow"];
  } = { display };
  if (source.columns !== undefined) {
    if (display !== "grid") throw new Error("site_studio_layout_invalid");
    result.columns = boundedNumber(source.columns, 1, 12, true);
  }
  if (source.gap !== undefined) {
    result.gap = normalizeSiteStudioLength(source.gap, { min: 0, max: 512 });
  }
  if (source.padding !== undefined) {
    result.padding = normalizeSiteStudioLength(source.padding, { min: 0, max: 512 });
  }
  if (source.maxWidth !== undefined) {
    result.maxWidth = normalizeSiteStudioLength(source.maxWidth, {
      min: 1,
      max: 8192,
      units: ["px", "rem"],
    });
  }
  if (source.borderRadius !== undefined) {
    result.borderRadius = normalizeSiteStudioLength(source.borderRadius, {
      min: 0,
      max: 512,
    });
  }
  if (source.alignItems !== undefined) {
    result.alignItems = enumValue(
      source.alignItems,
      ["start", "center", "end", "stretch"] as const,
      "site_studio_layout_invalid"
    );
  }
  if (source.justifyContent !== undefined) {
    result.justifyContent = enumValue(
      source.justifyContent,
      ["start", "center", "end", "space-between"] as const,
      "site_studio_layout_invalid"
    );
  }
  if (source.overflow !== undefined) {
    result.overflow = enumValue(
      source.overflow,
      ["visible", "hidden", "clip", "auto"] as const,
      "site_studio_layout_invalid"
    );
  }
  return result;
}

export const siteStudioEffectRegistry = {
  none: { durationMs: 0, easing: "linear", reducedMotionFallback: "none" },
  fade: { durationMs: 180, easing: "ease-out", reducedMotionFallback: "none" },
  "reveal-up": {
    durationMs: 320,
    easing: "ease-out",
    reducedMotionFallback: "fade",
  },
  "zoom-soft": {
    durationMs: 240,
    easing: "ease-out",
    reducedMotionFallback: "fade",
  },
} as const satisfies Record<
  SiteStudioEffectName,
  Omit<SiteStudioEffect, "name">
>;

export function normalizeSiteStudioEffect(
  value: unknown,
  reducedMotion = false
): SiteStudioEffect {
  const source = typeof value === "string" ? { name: value } : record(value);
  if (!source) throw new Error("site_studio_effect_invalid");
  assertOnlyKeys(source, [
    "name",
    "durationMs",
    "easing",
    "reducedMotionFallback",
  ]);
  const name = enumValue(
    source.name,
    Object.keys(siteStudioEffectRegistry) as SiteStudioEffectName[],
    "site_studio_effect_invalid"
  );
  const preset = siteStudioEffectRegistry[name];
  if (
    source.reducedMotionFallback !== undefined &&
    source.reducedMotionFallback !== preset.reducedMotionFallback
  ) {
    throw new Error("site_studio_effect_invalid");
  }
  if (reducedMotion) {
    const fallback = preset.reducedMotionFallback;
    return {
      name: fallback,
      durationMs: 0,
      easing: "linear",
      reducedMotionFallback: fallback,
    };
  }
  return {
    name,
    durationMs:
      source.durationMs === undefined
        ? preset.durationMs
        : normalizeSiteStudioDuration(source.durationMs),
    easing:
      source.easing === undefined
        ? preset.easing
        : normalizeSiteStudioEasing(source.easing),
    reducedMotionFallback: preset.reducedMotionFallback,
  };
}

export function normalizeSiteStudioTokenValue(
  category: SiteStudioTokenCategory,
  valueType: SiteStudioTokenValueType,
  value: unknown
): SiteStudioTokenValue {
  const safeCategory = enumValue(
    category,
    siteStudioTokenCategories,
    "site_studio_token_category_invalid"
  );
  const safeValueType = enumValue(
    valueType,
    siteStudioTokenValueTypes,
    "site_studio_token_value_type_invalid"
  );
  if (
    !(siteStudioTokenCategoryValueTypes[safeCategory] as readonly string[])
      .includes(safeValueType)
  ) {
    throw new Error("site_studio_token_type_forbidden");
  }
  if (safeValueType === "color") return normalizeSiteStudioColor(value);
  if (safeValueType === "length") {
    const max = safeCategory === "typography" ? 256 : safeCategory === "layout" ? 8192 : 512;
    return normalizeSiteStudioLength(value, { min: 0, max });
  }
  if (safeValueType === "number") return boundedNumber(value, -10000, 10000);
  if (safeValueType === "shadow") return normalizeSiteStudioShadow(value);
  if (safeValueType === "duration") return normalizeSiteStudioDuration(value);
  if (safeValueType === "easing") return normalizeSiteStudioEasing(value);
  if (safeValueType === "effect") return normalizeSiteStudioEffect(value);
  return normalizeSiteStudioLayout(value);
}

export const siteStudioComponentCapabilities = [
  "tokens",
  "layout",
  "effects",
  "visibility",
  "content",
] as const;

export type SiteStudioComponentCapability =
  (typeof siteStudioComponentCapabilities)[number];
export type SiteStudioComponentId = keyof typeof siteStudioComponentRegistry;
export type SiteStudioRole = "owner" | "admin" | "editor";

type SiteStudioComponentDefinition = Readonly<{
  capabilities: readonly SiteStudioComponentCapability[];
  slots: readonly string[];
  states: readonly SiteStudioState[];
  ownerLocked: boolean;
}>;

export const siteStudioComponentRegistry = {
  "site-header": {
    capabilities: ["tokens", "layout", "effects", "visibility"],
    slots: ["brand", "navigation", "actions"],
    states: ["default", "hover", "focus", "active"],
    ownerLocked: false,
  },
  magazine: {
    capabilities: ["tokens", "layout", "effects", "visibility", "content"],
    slots: ["heading", "featured", "feed"],
    states: ["default", "hover", "focus", "selected"],
    ownerLocked: false,
  },
  journal: {
    capabilities: ["tokens", "layout", "effects", "visibility", "content"],
    slots: ["heading", "filters", "entries"],
    states: ["default", "hover", "focus", "selected"],
    ownerLocked: false,
  },
  "article-reader": {
    capabilities: ["tokens", "layout", "visibility", "content"],
    slots: ["header", "lead", "body", "footer"],
    states: ["default", "focus"],
    ownerLocked: false,
  },
  "cms-page-reader": {
    capabilities: ["tokens", "layout", "visibility", "content"],
    slots: ["header", "body", "footer"],
    states: ["default", "focus"],
    ownerLocked: false,
  },
  "literary-globe": {
    capabilities: ["tokens", "visibility"],
    slots: ["canvas", "markers", "labels", "controls"],
    states: ["default", "focus", "active", "selected"],
    ownerLocked: true,
  },
  bookshelf: {
    capabilities: ["tokens", "visibility"],
    slots: ["scene", "shelf", "books", "details", "controls"],
    states: ["default", "focus", "active", "selected", "open"],
    ownerLocked: true,
  },
  "site-footer": {
    capabilities: ["tokens", "layout", "effects", "visibility", "content"],
    slots: ["navigation", "legal", "social"],
    states: ["default", "hover", "focus"],
    ownerLocked: false,
  },
} as const satisfies Record<string, SiteStudioComponentDefinition>;

export function canMutateSiteStudioComponent(
  componentId: SiteStudioComponentId,
  role: SiteStudioRole
) {
  const component = siteStudioComponentRegistry[componentId];
  return role === "owner" || (!component.ownerLocked && role === "admin");
}

export type SiteStudioCascadeOverride = Readonly<{
  id: string;
  layer: SiteStudioLayer;
  targetKey: string;
  breakpoint: SiteStudioBreakpoint;
  state: SiteStudioState;
  values: Readonly<Record<string, SiteStudioTokenValue>>;
}>;

export type SiteStudioCascadeContext = Readonly<{
  breakpoint: SiteStudioBreakpoint;
  state?: SiteStudioState;
  targetKeys?: Readonly<
    Partial<Record<Exclude<SiteStudioLayer, "site">, string>>
  >;
}>;

export type ResolvedSiteStudioCascade = Readonly<{
  values: Readonly<Record<string, SiteStudioTokenValue>>;
  sources: Readonly<Record<string, string>>;
}>;

const layerRank = new Map(siteStudioLayers.map((value, index) => [value, index]));

function assertTokenName(value: string) {
  if (
    !tokenNamePattern.test(value) ||
    value === "constructor" ||
    value === "prototype" ||
    value === "__proto__"
  ) {
    throw new Error("site_studio_token_name_invalid");
  }
}

export function resolveSiteStudioCascade(
  overrides: readonly SiteStudioCascadeOverride[],
  context: SiteStudioCascadeContext
): ResolvedSiteStudioCascade {
  const state = context.state ?? "default";
  const breakpoints =
    context.breakpoint === "base"
      ? ["base"]
      : ["base", context.breakpoint];
  const states = state === "default" ? ["default"] : ["default", state];
  const ids = new Set<string>();
  for (const override of overrides) {
    if (!override.id || ids.has(override.id)) {
      throw new Error("site_studio_override_id_invalid");
    }
    ids.add(override.id);
    for (const name of Object.keys(override.values)) assertTokenName(name);
  }

  const selected = overrides
    .filter((override) => {
      const target =
        override.layer === "site"
          ? "site"
          : context.targetKeys?.[override.layer];
      return (
        override.targetKey === target &&
        breakpoints.includes(override.breakpoint) &&
        states.includes(override.state)
      );
    })
    .sort(
      (left, right) =>
        (layerRank.get(left.layer) ?? 99) -
          (layerRank.get(right.layer) ?? 99) ||
        states.indexOf(left.state) - states.indexOf(right.state) ||
        breakpoints.indexOf(left.breakpoint) -
          breakpoints.indexOf(right.breakpoint) ||
        left.id.localeCompare(right.id, "en")
    );

  const values: Record<string, SiteStudioTokenValue> = {};
  const sources: Record<string, string> = {};
  for (const override of selected) {
    for (const [name, value] of Object.entries(override.values)) {
      values[name] = value;
      sources[name] = override.id;
    }
  }
  return { values, sources };
}
