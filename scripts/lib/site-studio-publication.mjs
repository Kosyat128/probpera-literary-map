const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TARGET_PATTERN = /^[a-z][a-z0-9_-]{0,119}$/u;
const TOKEN_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9-]{0,79}$/u;

const layers = new Set(["site", "component", "template", "page", "instance"]);
const categories = new Set([
  "color",
  "typography",
  "spacing",
  "radius",
  "shadow",
  "motion",
  "layout",
]);
const valueTypes = new Set([
  "color",
  "length",
  "number",
  "shadow",
  "duration",
  "easing",
  "effect",
  "layout",
]);
const breakpoints = new Set(["base", "mobile", "tablet", "desktop"]);
const states = new Set([
  "default",
  "hover",
  "focus",
  "active",
  "selected",
  "open",
  "disabled",
]);
const capabilities = new Set(["tokens", "layout", "effects", "visibility", "content"]);
const componentKeys = new Set([
  "site-header",
  "magazine",
  "journal",
  "article-reader",
  "cms-page-reader",
  "literary-globe",
  "bookshelf",
  "site-footer",
]);
const units = new Set(["px", "rem", "em", "%", "vw", "vh"]);
const easings = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);
const categoryTypes = {
  color: new Set(["color"]),
  typography: new Set(["color", "length", "number"]),
  spacing: new Set(["length"]),
  radius: new Set(["length"]),
  shadow: new Set(["shadow"]),
  motion: new Set(["duration", "easing", "effect"]),
  layout: new Set(["layout", "length", "number"]),
};

function record(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value;
}

function exactKeys(value, allowed, code) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(code);
  }
}

function text(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(code);
  return value;
}

function list(value, allowed, maximum, code) {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    new Set(value).size !== value.length ||
    value.some((item) => typeof item !== "string" || !allowed.has(item))
  ) {
    throw new Error(code);
  }
  return [...value];
}

function identifierList(value, maximum, code) {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    new Set(value).size !== value.length ||
    value.some((item) => typeof item !== "string" || !IDENTIFIER_PATTERN.test(item))
  ) {
    throw new Error(code);
  }
  return [...value];
}

function boundedNumber(value, minimum, maximum, integer = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error("site_design_token_value_invalid");
  }
  return value;
}

function normalizeLength(value, minimum, maximum, allowedUnits = units) {
  const source = record(value, "site_design_token_value_invalid");
  exactKeys(source, ["value", "unit"], "site_design_token_value_invalid");
  if (!allowedUnits.has(source.unit)) throw new Error("site_design_token_value_invalid");
  return {
    value: boundedNumber(source.value, minimum, maximum),
    unit: source.unit,
  };
}

function normalizeColor(value) {
  if (
    typeof value !== "string" ||
    (value !== "transparent" && !/^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value))
  ) {
    throw new Error("site_design_token_value_invalid");
  }
  return value.toLowerCase();
}

export function normalizeSiteStudioPublicTokenValue(category, valueType, value) {
  if (!categoryTypes[category]?.has(valueType)) {
    throw new Error("site_design_token_value_invalid");
  }
  if (valueType === "color") return normalizeColor(value);
  if (valueType === "number") return boundedNumber(value, -10000, 10000);
  if (valueType === "duration") return boundedNumber(value, 0, 5000, true);
  if (valueType === "easing") {
    if (!easings.has(value)) throw new Error("site_design_token_value_invalid");
    return value;
  }
  if (valueType === "length") {
    const maximum = category === "typography" ? 256 : category === "layout" ? 8192 : 512;
    return normalizeLength(value, 0, maximum);
  }
  if (valueType === "shadow") {
    const source = record(value, "site_design_token_value_invalid");
    exactKeys(source, ["x", "y", "blur", "spread", "color", "inset"], "site_design_token_value_invalid");
    if (typeof source.inset !== "boolean") throw new Error("site_design_token_value_invalid");
    const px = new Set(["px"]);
    return {
      x: normalizeLength(source.x, -128, 128, px),
      y: normalizeLength(source.y, -128, 128, px),
      blur: normalizeLength(source.blur, 0, 256, px),
      spread: normalizeLength(source.spread, -128, 128, px),
      color: normalizeColor(source.color),
      inset: source.inset,
    };
  }
  if (valueType === "effect") {
    const source = record(value, "site_design_token_value_invalid");
    exactKeys(
      source,
      ["name", "durationMs", "easing", "reducedMotionFallback"],
      "site_design_token_value_invalid"
    );
    const fallback = source.name === "reveal-up" || source.name === "zoom-soft" ? "fade" : "none";
    if (
      !["none", "fade", "reveal-up", "zoom-soft"].includes(source.name) ||
      source.reducedMotionFallback !== fallback ||
      !easings.has(source.easing)
    ) {
      throw new Error("site_design_token_value_invalid");
    }
    return {
      name: source.name,
      durationMs: boundedNumber(source.durationMs, 0, 5000, true),
      easing: source.easing,
      reducedMotionFallback: source.reducedMotionFallback,
    };
  }
  const source = record(value, "site_design_token_value_invalid");
  exactKeys(
    source,
    ["display", "columns", "gap", "padding", "maxWidth", "borderRadius", "alignItems", "justifyContent", "overflow"],
    "site_design_token_value_invalid"
  );
  if (!["block", "flex", "grid"].includes(source.display)) {
    throw new Error("site_design_token_value_invalid");
  }
  const result = { display: source.display };
  if (source.columns !== undefined) {
    if (source.display !== "grid") throw new Error("site_design_token_value_invalid");
    result.columns = boundedNumber(source.columns, 1, 12, true);
  }
  if (source.gap !== undefined) result.gap = normalizeLength(source.gap, 0, 512);
  if (source.padding !== undefined) result.padding = normalizeLength(source.padding, 0, 512);
  if (source.maxWidth !== undefined) {
    result.maxWidth = normalizeLength(source.maxWidth, 1, 8192, new Set(["px", "rem"]));
  }
  if (source.borderRadius !== undefined) {
    result.borderRadius = normalizeLength(source.borderRadius, 0, 512);
  }
  if (source.alignItems !== undefined) {
    if (!["start", "center", "end", "stretch"].includes(source.alignItems)) {
      throw new Error("site_design_token_value_invalid");
    }
    result.alignItems = source.alignItems;
  }
  if (source.justifyContent !== undefined) {
    if (!["start", "center", "end", "space-between"].includes(source.justifyContent)) {
      throw new Error("site_design_token_value_invalid");
    }
    result.justifyContent = source.justifyContent;
  }
  if (source.overflow !== undefined) {
    if (!["visible", "hidden", "clip", "auto"].includes(source.overflow)) {
      throw new Error("site_design_token_value_invalid");
    }
    result.overflow = source.overflow;
  }
  return result;
}

function normalizeRelease(value) {
  if (value === null || value === undefined) return null;
  const source = record(value, "site_design_release_invalid");
  exactKeys(source, ["id", "number", "action"], "site_design_release_invalid");
  const id = text(source.id, UUID_PATTERN, "site_design_release_invalid").toLowerCase();
  const number = Number(source.number);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error("site_design_release_invalid");
  }
  if (source.action !== "publish" && source.action !== "rollback") {
    throw new Error("site_design_release_invalid");
  }
  return { id, number, action: source.action };
}

function normalizeToken(sourceValue, normalizeValue) {
  const source = record(sourceValue, "site_design_token_invalid");
  exactKeys(
    source,
    ["id", "layer", "targetKey", "key", "category", "valueType", "breakpoint", "state", "value"],
    "site_design_token_invalid"
  );
  const id = text(source.id, UUID_PATTERN, "site_design_token_invalid").toLowerCase();
  if (!layers.has(source.layer) || !categories.has(source.category) || !valueTypes.has(source.valueType)) {
    throw new Error("site_design_token_invalid");
  }
  if (!breakpoints.has(source.breakpoint) || !states.has(source.state)) {
    throw new Error("site_design_token_invalid");
  }
  const targetKey = text(source.targetKey, TARGET_PATTERN, "site_design_token_invalid");
  if (source.layer === "site" && targetKey !== "site") {
    throw new Error("site_design_token_invalid");
  }
  const key = text(source.key, TOKEN_PATTERN, "site_design_token_invalid");
  if (key.length > 160 || ["constructor", "prototype", "__proto__"].includes(key)) {
    throw new Error("site_design_token_invalid");
  }
  let value;
  try {
    value = normalizeValue(source.category, source.valueType, source.value);
  } catch {
    throw new Error("site_design_token_value_invalid");
  }
  return {
    id,
    layer: source.layer,
    targetKey,
    key,
    category: source.category,
    valueType: source.valueType,
    breakpoint: source.breakpoint,
    state: source.state,
    value,
  };
}

function normalizeComponent(sourceValue) {
  const source = record(sourceValue, "site_design_component_invalid");
  exactKeys(
    source,
    ["key", "capabilities", "slots", "states", "ownerLock"],
    "site_design_component_invalid"
  );
  if (!componentKeys.has(source.key) || typeof source.ownerLock !== "boolean") {
    throw new Error("site_design_component_invalid");
  }
  return {
    key: source.key,
    capabilities: list(source.capabilities, capabilities, 5, "site_design_component_invalid"),
    slots: identifierList(source.slots, 24, "site_design_component_invalid"),
    states: list(source.states, states, 7, "site_design_component_invalid"),
    ownerLock: source.ownerLock,
  };
}

export function normalizePublishedSiteDesign(
  value,
  normalizeValue = normalizeSiteStudioPublicTokenValue
) {
  const source = record(value, "site_design_snapshot_invalid");
  exactKeys(source, ["release", "tokens", "components"], "site_design_snapshot_invalid");
  if (!Array.isArray(source.tokens) || source.tokens.length > 1024) {
    throw new Error("site_design_snapshot_invalid");
  }
  if (!Array.isArray(source.components) || source.components.length > 256) {
    throw new Error("site_design_snapshot_invalid");
  }
  const tokens = source.tokens.map((token) => normalizeToken(token, normalizeValue));
  const components = source.components.map(normalizeComponent);
  if (new Set(tokens.map((token) => token.id)).size !== tokens.length) {
    throw new Error("site_design_token_duplicate");
  }
  if (new Set(components.map((component) => component.key)).size !== components.length) {
    throw new Error("site_design_component_duplicate");
  }
  return { release: normalizeRelease(source.release), tokens, components };
}
