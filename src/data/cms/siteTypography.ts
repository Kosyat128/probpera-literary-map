export const cmsTypographyLayers = [
  "site",
  "component",
  "template",
  "page",
  "instance",
] as const;

export const cmsTypographyBreakpoints = [
  "base",
  "mobile",
  "tablet",
  "desktop",
] as const;

export const cmsTypographyScopes = [
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

type CmsTypographyLayer = (typeof cmsTypographyLayers)[number];
type CmsTypographyBreakpoint = (typeof cmsTypographyBreakpoints)[number];
type CmsTypographyScope = (typeof cmsTypographyScopes)[number];

type CmsFontAsset = {
  id: string;
  familyName: string;
  sourceType: "bundled" | "uploaded";
  format: "woff" | "woff2";
  publicPath: string;
  fontStyle: "normal" | "italic" | "oblique";
  isVariable: boolean;
  weightMin: number;
  weightMax: number;
};

type CmsTypographyOverride = {
  layer: CmsTypographyLayer;
  targetKey: string;
  semanticScope: CmsTypographyScope;
  breakpoint: CmsTypographyBreakpoint;
  settings: Record<string, unknown>;
};

export type CmsTypographySnapshot = {
  fonts: CmsFontAsset[];
  overrides: CmsTypographyOverride[];
};

const systemFontStacks = {
  "system-sans": "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "system-serif": "ui-serif, Georgia, Cambria, \"Times New Roman\", serif",
  georgia: "Georgia, \"Times New Roman\", serif",
  arial: "Arial, Helvetica, sans-serif",
  times: "\"Times New Roman\", Times, serif",
} as const;

const selectorByScope: Record<CmsTypographyScope, string> = {
  body: "body",
  navigation: ":is(nav, .topbar, .site-navigation)",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  article: ":is(.article-reader-content, [data-typography-scope=\"article\"])",
  page: ":is(.cms-page-prose, [data-typography-scope=\"page\"])",
  lead: ":is(.article-lead, [data-typography-scope=\"lead\"])",
  quote: ":is(blockquote, [data-typography-scope=\"quote\"])",
  caption: ":is(figcaption, [data-typography-scope=\"caption\"])",
  button: ":is(button, .button, [data-typography-scope=\"button\"])",
  card: ":is(.card, [data-card], [data-typography-scope=\"card\"])",
  footer: ":is(footer, [data-typography-scope=\"footer\"])",
};

const breakpointQuery: Record<Exclude<CmsTypographyBreakpoint, "base">, string> = {
  mobile: "(max-width: 639px)",
  tablet: "(min-width: 640px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
};

const layerRank = new Map(
  cmsTypographyLayers.map((layer, index) => [layer, index] as const)
);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function enumValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values
): Values[number] | null {
  return typeof value === "string" && values.includes(value as Values[number])
    ? (value as Values[number])
    : null;
}

function boundedNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

function targetKey(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/u.test(value)
    ? value
    : null;
}

function readFontAsset(value: unknown): CmsFontAsset | null {
  const source = record(value);
  if (!source) return null;
  const id = typeof source.id === "string" && uuidPattern.test(source.id)
    ? source.id.toLowerCase()
    : null;
  const sourceType = enumValue(source.sourceType ?? source.source_type, ["bundled", "uploaded"] as const);
  const format = enumValue(source.format, ["woff", "woff2"] as const);
  const fontStyle = enumValue(source.fontStyle ?? source.font_style, ["normal", "italic", "oblique"] as const);
  const weightMin = boundedNumber(source.weightMin ?? source.weight_min, 1, 1000);
  const weightMax = boundedNumber(source.weightMax ?? source.weight_max, 1, 1000);
  const isVariable = source.isVariable ?? source.is_variable;
  const publicPath = typeof (source.publicPath ?? source.public_path) === "string"
    ? String(source.publicPath ?? source.public_path)
    : "";
  const familyName = typeof (source.familyName ?? source.family_name) === "string"
    ? String(source.familyName ?? source.family_name).trim()
    : "";
  if (
    !id || !sourceType || !format || !fontStyle || typeof isVariable !== "boolean" || weightMin === null ||
    weightMax === null || weightMin > weightMax || !familyName || familyName.length > 120 ||
    (!isVariable && weightMin !== weightMax) ||
    !/^cms\/fonts\/[0-9a-f]{64}\.(?:woff2?|WOFF2?)$/u.test(publicPath)
  ) {
    return null;
  }
  return { id, familyName, sourceType, format, publicPath, fontStyle, isVariable, weightMin, weightMax };
}

function readOverride(value: unknown): CmsTypographyOverride | null {
  const source = record(value);
  if (!source) return null;
  const layer = enumValue(source.layer, cmsTypographyLayers);
  const semanticScope = enumValue(
    source.semanticScope ?? source.semantic_scope,
    cmsTypographyScopes
  );
  const breakpoint = enumValue(source.breakpoint, cmsTypographyBreakpoints);
  const target = targetKey(source.targetKey ?? source.target_key);
  const settings = record(source.settings ?? source.published_settings);
  return layer && semanticScope && breakpoint && target && settings
    ? { layer, targetKey: target, semanticScope, breakpoint, settings }
    : null;
}

export function readCmsTypographySnapshot(value: unknown): CmsTypographySnapshot {
  const source = record(value);
  return {
    fonts: Array.isArray(source?.fonts)
      ? source.fonts.flatMap((font) => {
          const normalized = readFontAsset(font);
          return normalized ? [normalized] : [];
        })
      : [],
    overrides: Array.isArray(source?.overrides)
      ? source.overrides.flatMap((override) => {
          const normalized = readOverride(override);
          return normalized ? [normalized] : [];
        })
      : [],
  };
}

function quotedFontFamily(value: string) {
  return `\"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}\"`;
}

function cssString(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function settingsDeclarations(
  value: Record<string, unknown>,
  fonts: ReadonlyMap<string, CmsFontAsset>
) {
  const declarations: string[] = [];
  const familyId =
    typeof value.familyId === "string" && uuidPattern.test(value.familyId)
      ? value.familyId.toLowerCase()
      : value.familyId;
  const systemFamily = value.systemFamily;
  if (typeof familyId === "string" && fonts.has(familyId)) {
    declarations.push(`font-family:${quotedFontFamily(`cms-font-${familyId}`)}`);
  } else if (
    typeof systemFamily === "string" &&
    Object.prototype.hasOwnProperty.call(systemFontStacks, systemFamily)
  ) {
    declarations.push(
      `font-family:${systemFontStacks[systemFamily as keyof typeof systemFontStacks]}`
    );
  }

  const numericRules = [
    ["fontSize", "font-size", 8, 144, "px"],
    ["fontWeight", "font-weight", 1, 1000, ""],
    ["lineHeight", "line-height", 0.8, 3, ""],
    ["letterSpacing", "letter-spacing", -0.2, 1, "em"],
    ["textIndent", "text-indent", 0, 12, "em"],
    ["wordSpacing", "word-spacing", -0.2, 2, "em"],
  ] as const;
  for (const [key, cssName, min, max, unit] of numericRules) {
    const normalized = boundedNumber(value[key], min, max);
    if (normalized !== null) declarations.push(`${cssName}:${normalized}${unit}`);
  }

  const enumRules = [
    ["fontStyle", "font-style", ["normal", "italic", "oblique"]],
    ["textAlign", "text-align", ["left", "center", "right", "justify"]],
    ["textTransform", "text-transform", ["none", "uppercase", "lowercase", "capitalize"]],
    ["textDecoration", "text-decoration-line", ["none", "underline", "line-through"]],
  ] as const;
  for (const [key, cssName, allowed] of enumRules) {
    const normalized = enumValue(value[key], allowed);
    if (normalized) declarations.push(`${cssName}:${normalized}`);
  }
  return declarations;
}

function contextPrefix(layer: CmsTypographyLayer, target: string) {
  if (layer === "site") return "";
  return `[data-typography-${layer}=\"${cssString(target)}\"]`;
}

function scopedSelector(override: CmsTypographyOverride) {
  const prefix = contextPrefix(override.layer, override.targetKey);
  const scope = selectorByScope[override.semanticScope];
  // Public defaults live in cascade layers. Keep every published selector at
  // zero specificity so layer/breakpoint order also works across semantic scopes.
  if (!prefix) return `:where(${scope})`;
  if (override.semanticScope === "body") return `:where(${prefix})`;

  const self = `${prefix}:is(${scope})`;
  let descendants = `${prefix} ${scope}`;
  if (
    (override.layer === "component" || override.layer === "instance") &&
    /^h[1-6]$/u.test(override.semanticScope)
  ) {
    // A magazine heading rule must not reach headings in its nested reader.
    // Page/template/site rules intentionally span the components on that page.
    const boundary = ":is([data-typography-component], [data-typography-instance])";
    descendants += `:not(${prefix} ${boundary}, ${prefix} ${boundary} *)`;
  }
  return `:where(${self}, ${descendants})`;
}

function normalizedBasePath(basePath: string) {
  const value = basePath.trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/gu, "")}/`;
}

function decodedPathBeneathBase(pathname: string, basePath: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return "";
  }
  const base = normalizedBasePath(basePath);
  const baseRoot = base === "/" ? "/" : base.slice(0, -1);
  if (base !== "/" && decoded === baseRoot) return "";
  if (base !== "/" && decoded.startsWith(base)) {
    return decoded.slice(base.length).replace(/^\/+|\/+$/gu, "");
  }
  return decoded.replace(/^\/+|\/+$/gu, "");
}

function stableTargetHash(value: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${
    (right >>> 0).toString(16).padStart(8, "0")
  }`;
}

export function cmsTypographyTargetKey(value: string) {
  const source = String(value || "home").normalize("NFKC").toLowerCase();
  let encoded = "";
  for (const character of source) {
    if (/^[a-z0-9]$/u.test(character)) encoded += character;
    else if (character === "/") encoded += "_sl_";
    else if (character === "-") encoded += "-";
    else if (character === "_") encoded += "_us_";
    else encoded += `_u${character.codePointAt(0)?.toString(16) || "0"}_`;
  }
  encoded = encoded.replace(/^_+|_+$/gu, "") || "home";
  if (!/^[a-z0-9]/u.test(encoded)) encoded = `x${encoded}`;
  return encoded.length <= 80
    ? encoded
    : `${encoded.slice(0, 62)}_h${stableTargetHash(source)}`;
}

export function buildCmsTypographyStylesheet(value: unknown, basePath = "/") {
  const snapshot = readCmsTypographySnapshot(value);
  const fonts = new Map(snapshot.fonts.map((font) => [font.id, font]));
  const orderedOverrides = [...snapshot.overrides].sort((left, right) =>
    (layerRank.get(left.layer) ?? Number.MAX_SAFE_INTEGER) -
      (layerRank.get(right.layer) ?? Number.MAX_SAFE_INTEGER) ||
    left.targetKey.localeCompare(right.targetKey, "en") ||
    cmsTypographyScopes.indexOf(left.semanticScope) -
      cmsTypographyScopes.indexOf(right.semanticScope)
  );
  const rules: string[] = [
    ...snapshot.fonts.map((font) => {
      const weight = font.weightMin === font.weightMax
        ? String(font.weightMin)
        : `${font.weightMin} ${font.weightMax}`;
      const url = `${normalizedBasePath(basePath)}${font.publicPath}`;
      return `@font-face{font-family:${quotedFontFamily(`cms-font-${font.id}`)};src:url(\"${cssString(url)}\") format(\"${font.format}\");font-style:${font.fontStyle};font-weight:${weight};font-display:swap;}`;
    }),
  ];

  for (const layer of cmsTypographyLayers) {
    for (const breakpoint of cmsTypographyBreakpoints) {
      const scopedRules = orderedOverrides
        .filter(
          (override) =>
            override.layer === layer && override.breakpoint === breakpoint
        )
        .flatMap((override) => {
          const declarations = settingsDeclarations(override.settings, fonts);
          return declarations.length
            ? [`${scopedSelector(override)}{${declarations.join(";")}}`]
            : [];
        });
      if (!scopedRules.length) continue;
      rules.push(
        breakpoint === "base"
          ? scopedRules.join("")
          : `@media ${breakpointQuery[breakpoint]}{${scopedRules.join("")}}`
      );
    }
  }
  return rules.join("\n");
}

export function cmsTypographyPageTarget(pathname: string, basePath = "/") {
  return cmsTypographyTargetKey(
    decodedPathBeneathBase(pathname, basePath) || "home"
  );
}

export function cmsTypographyTemplateTarget(pathname: string, basePath = "/") {
  const firstSegment = decodedPathBeneathBase(pathname, basePath)
    .toLowerCase()
    .split("/", 1)[0];
  if (firstSegment === "stati") return "article";
  if (firstSegment === "stranitsy") return "page";
  return "home";
}
