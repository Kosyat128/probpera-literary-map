import {
  normalizeSiteStudioTokenValue,
  siteStudioBreakpoints,
  siteStudioComponentRegistry,
  siteStudioLayers,
  siteStudioStates,
  siteStudioTokenCategories,
  siteStudioTokenValueTypes,
  type SiteStudioBreakpoint,
  type SiteStudioComponentId,
  type SiteStudioLayer,
  type SiteStudioState,
  type SiteStudioTokenCategory,
  type SiteStudioTokenValue,
  type SiteStudioTokenValueType,
} from "./siteStudioContract";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const targetPattern = /^[a-z][a-z0-9_-]{0,119}$/u;
const tokenPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;

type SiteDesignToken = Readonly<{
  id: string;
  layer: SiteStudioLayer;
  targetKey: string;
  key: string;
  category: SiteStudioTokenCategory;
  valueType: SiteStudioTokenValueType;
  breakpoint: SiteStudioBreakpoint;
  state: SiteStudioState;
  value: SiteStudioTokenValue;
}>;

export type CmsSiteDesignSnapshot = Readonly<{
  release: Readonly<{ id: string; number: number; action: "publish" | "rollback" }> | null;
  tokens: readonly SiteDesignToken[];
}>;

const emptySnapshot: CmsSiteDesignSnapshot = { release: null, tokens: [] };

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

function readToken(value: unknown): SiteDesignToken | null {
  const source = record(value);
  if (!source || Object.keys(source).some((key) => ![
    "id", "layer", "targetKey", "key", "category", "valueType",
    "breakpoint", "state", "value",
  ].includes(key))) return null;
  const layer = enumValue(source.layer, siteStudioLayers);
  const category = enumValue(source.category, siteStudioTokenCategories);
  const valueType = enumValue(source.valueType, siteStudioTokenValueTypes);
  const breakpoint = enumValue(source.breakpoint, siteStudioBreakpoints);
  const state = enumValue(source.state, siteStudioStates);
  if (
    typeof source.id !== "string" || !uuidPattern.test(source.id) ||
    !layer || !category || !valueType || !breakpoint || !state ||
    typeof source.targetKey !== "string" || !targetPattern.test(source.targetKey) ||
    (layer === "site" && source.targetKey !== "site") ||
    typeof source.key !== "string" || source.key.length > 160 ||
    !tokenPattern.test(source.key) ||
    ["constructor", "prototype", "__proto__"].includes(source.key)
  ) return null;
  if (
    layer === "component" &&
    !Object.prototype.hasOwnProperty.call(siteStudioComponentRegistry, source.targetKey)
  ) return null;
  try {
    return {
      id: source.id.toLowerCase(),
      layer,
      targetKey: source.targetKey,
      key: source.key,
      category,
      valueType,
      breakpoint,
      state,
      value: normalizeSiteStudioTokenValue(category, valueType, source.value),
    };
  } catch {
    return null;
  }
}

export function readCmsSiteDesignSnapshot(value: unknown): CmsSiteDesignSnapshot {
  const source = record(value);
  if (!source || !Array.isArray(source.tokens) || source.tokens.length > 1024) {
    return emptySnapshot;
  }
  const tokens = source.tokens.map(readToken);
  if (tokens.some((token) => token === null)) return emptySnapshot;
  const safeTokens = tokens as SiteDesignToken[];
  if (new Set(safeTokens.map((token) => token.id)).size !== safeTokens.length) {
    return emptySnapshot;
  }
  const releaseSource = record(source.release);
  const releaseAction = enumValue(
    releaseSource?.action,
    ["publish", "rollback"] as const
  );
  const release = releaseSource &&
    typeof releaseSource.id === "string" && uuidPattern.test(releaseSource.id) &&
    Number.isSafeInteger(releaseSource.number) && Number(releaseSource.number) > 0 &&
    releaseAction
      ? {
          id: releaseSource.id.toLowerCase(),
          number: Number(releaseSource.number),
          action: releaseAction,
        }
      : null;
  if (source.release !== null && !release) return emptySnapshot;
  return { release, tokens: safeTokens };
}

const componentSelectors: Record<SiteStudioComponentId, string> = {
  "site-header": ".site-header",
  magazine: '[data-typography-component="magazine"]',
  journal: '[data-typography-component="journal"]',
  "article-reader": '[data-typography-component="article-reader"]',
  "cms-page-reader": '[data-typography-component="cms-page-reader"]',
  "literary-globe": ".literary-globe",
  bookshelf: ".book-archive-section",
  "site-footer": ".site-footer",
};

const mediaQueries: Record<Exclude<SiteStudioBreakpoint, "base">, string> = {
  mobile: "(max-width:639px)",
  tablet: "(min-width:640px) and (max-width:1023px)",
  desktop: "(min-width:1024px)",
};

function selectorFor(token: SiteDesignToken) {
  if (token.layer === "site") return ":root";
  if (token.layer === "component") {
    return componentSelectors[token.targetKey as SiteStudioComponentId];
  }
  if (token.layer === "template") {
    return `body[data-site-studio-template="${token.targetKey}"]`;
  }
  if (token.layer === "page") {
    return `body[data-site-studio-page="${token.targetKey}"]`;
  }
  return `[data-typography-instance="${token.targetKey}"]`;
}

function stateSelector(selector: string, state: SiteStudioState) {
  if (state === "default") return selector;
  if (state === "hover") return `${selector}:hover`;
  if (state === "focus") return `${selector}:focus-within`;
  if (state === "active") return `${selector}:active`;
  if (state === "selected") return `${selector}[aria-selected="true"],${selector} [aria-selected="true"]`;
  if (state === "open") return `${selector}[open],${selector} [open]`;
  return `${selector}[aria-disabled="true"],${selector} :disabled`;
}

function length(value: unknown) {
  const source = value as { value: number; unit: string };
  return `${source.value}${source.unit}`;
}

function shadow(value: unknown) {
  const source = value as {
    x: unknown; y: unknown; blur: unknown; spread: unknown; color: string; inset: boolean;
  };
  return `${source.inset ? "inset " : ""}${length(source.x)} ${length(source.y)} ${length(source.blur)} ${length(source.spread)} ${source.color}`;
}

function scalar(valueType: SiteStudioTokenValueType, value: SiteStudioTokenValue) {
  if (valueType === "length") return length(value);
  if (valueType === "shadow") return shadow(value);
  if (valueType === "duration") return `${value}ms`;
  return String(value);
}

function declarations(token: SiteDesignToken) {
  const cssKey = token.key.split(".").join("-");
  if (token.valueType === "layout") {
    const value = token.value as {
      display: string; columns?: number; gap?: unknown; padding?: unknown;
      maxWidth?: unknown; borderRadius?: unknown; alignItems?: string;
      justifyContent?: string; overflow?: string;
    };
    return [
      `--${cssKey}-display:${value.display}`,
      `display:${value.display}`,
      value.columns ? `grid-template-columns:repeat(${value.columns},minmax(0,1fr))` : "",
      value.gap ? `gap:${length(value.gap)}` : "",
      value.padding ? `padding:${length(value.padding)}` : "",
      value.maxWidth ? `max-width:${length(value.maxWidth)}` : "",
      value.borderRadius ? `border-radius:${length(value.borderRadius)}` : "",
      value.alignItems ? `align-items:${value.alignItems}` : "",
      value.justifyContent ? `justify-content:${value.justifyContent}` : "",
      value.overflow ? `overflow:${value.overflow}` : "",
    ].filter(Boolean);
  }
  if (token.valueType === "effect") {
    const value = token.value as { name: string; durationMs: number; easing: string };
    return value.name === "none"
      ? [`--${cssKey}-effect:none`, "animation:none"]
      : [
          `--${cssKey}-effect:${value.name}`,
          `animation:site-studio-${value.name} ${value.durationMs}ms ${value.easing} both`,
        ];
  }
  const value = scalar(token.valueType, token.value);
  const output = [`--${cssKey}:${value}`];
  if (token.category === "shadow") output.push(`box-shadow:${value}`);
  if (token.category === "radius") output.push(`border-radius:${value}`);
  if (token.category === "spacing" && token.key === "gap") output.push(`gap:${value}`);
  if (token.category === "spacing" && token.key === "padding") output.push(`padding:${value}`);
  if (token.category === "typography" && ["font-size", "line-height", "font-weight", "letter-spacing", "color"].includes(token.key)) {
    output.push(`${token.key}:${value}`);
  }
  return output;
}

export function buildCmsSiteDesignStylesheet(value: unknown) {
  const snapshot = readCmsSiteDesignSnapshot(value);
  if (!snapshot.tokens.length) return "";
  const rank = new Map(siteStudioBreakpoints.map((item, index) => [item, index]));
  const groups = new Map<string, string[]>();
  [...snapshot.tokens]
    .sort((left, right) =>
      (rank.get(left.breakpoint) ?? 99) - (rank.get(right.breakpoint) ?? 99) ||
      left.id.localeCompare(right.id, "en")
    )
    .forEach((token) => {
      const selector = stateSelector(selectorFor(token), token.state);
      const key = `${token.breakpoint}\u0000${selector}`;
      const current = groups.get(key) || [];
      current.push(...declarations(token));
      groups.set(key, current);
    });
  const rules = [
    "@keyframes site-studio-fade{from{opacity:0}to{opacity:1}}",
    "@keyframes site-studio-reveal-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
    "@keyframes site-studio-zoom-soft{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}",
  ];
  const controlledSelectors = new Set<string>();
  for (const [key, values] of groups) {
    const [breakpoint, selector] = key.split("\u0000");
    controlledSelectors.add(selector);
    const rule = `${selector}{${values.join(";")}}`;
    rules.push(breakpoint === "base" ? rule : `@media ${mediaQueries[breakpoint as Exclude<SiteStudioBreakpoint, "base">]}{${rule}}`);
  }
  rules.push(
    `@media (prefers-reduced-motion:reduce){${[...controlledSelectors].join(",")}{animation:none!important}}`
  );
  return rules.join("\n");
}
