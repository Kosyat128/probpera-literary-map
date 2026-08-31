import { createHash } from "node:crypto";

const layers = new Set(["site", "component", "template", "page", "instance"]);
const breakpoints = new Set(["base", "mobile", "tablet", "desktop"]);
const scopes = new Set([
  "body", "navigation", "h1", "h2", "h3", "h4", "h5", "h6",
  "article", "page", "lead", "quote", "caption", "button", "card", "footer",
]);
const systemFamilies = new Set([
  "system-sans", "system-serif", "georgia", "arial", "times",
]);
const settingKeys = new Set([
  "familyId", "systemFamily", "fontSize", "fontWeight",
  "fontStyle", "lineHeight", "letterSpacing", "textAlign", "textTransform",
  "textDecoration", "textIndent", "wordSpacing",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const layerRank = new Map(
  [...layers].map((layer, index) => [layer, index])
);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Published typography is invalid: ${message}.`);
}

function numberInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function normalizeSettings(value) {
  const source = record(value);
  assert(source, "settings must be an object");
  for (const key of Object.keys(source)) {
    assert(settingKeys.has(key), `unknown setting ${key}`);
  }
  const familyId = source.familyId;
  if (familyId !== undefined) {
    assert(typeof familyId === "string" && uuidPattern.test(familyId), "invalid font asset ID");
  }
  if (source.systemFamily !== undefined) {
    assert(systemFamilies.has(source.systemFamily), "invalid system font family");
  }
  assert(!(familyId && source.systemFamily), "font asset and system family are mutually exclusive");
  const numeric = [
    ["fontSize", 8, 144], ["fontWeight", 1, 1000], ["lineHeight", 0.8, 3],
    ["letterSpacing", -0.2, 1], ["textIndent", 0, 12], ["wordSpacing", -0.2, 2],
  ];
  for (const [key, min, max] of numeric) {
    if (source[key] !== undefined) assert(numberInRange(source[key], min, max), `invalid ${key}`);
  }
  const enums = [
    ["fontStyle", new Set(["normal", "italic", "oblique"])],
    ["textAlign", new Set(["left", "center", "right", "justify"])],
    ["textTransform", new Set(["none", "uppercase", "lowercase", "capitalize"])],
    ["textDecoration", new Set(["none", "underline", "line-through"])],
  ];
  for (const [key, allowed] of enums) {
    if (source[key] !== undefined) assert(allowed.has(source[key]), `invalid ${key}`);
  }
  return {
    ...source,
    ...(familyId ? { familyId: familyId.toLowerCase() } : {}),
  };
}

function normalizeOverride(row) {
  const source = record(row);
  assert(source, "override row must be an object");
  const layer = source.layer;
  const targetKey = source.target_key ?? source.targetKey;
  const semanticScope = source.semantic_scope ?? source.semanticScope;
  const breakpoint = source.breakpoint;
  assert(layers.has(layer), "invalid layer");
  assert(typeof targetKey === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/u.test(targetKey), "invalid target key");
  assert(scopes.has(semanticScope), "invalid semantic scope");
  assert(breakpoints.has(breakpoint), "invalid breakpoint");
  return {
    layer,
    targetKey,
    semanticScope,
    breakpoint,
    settings: normalizeSettings(source.published_settings ?? source.settings),
  };
}

function fontReferenceIds(overrides) {
  return new Set(
    overrides.flatMap((override) => {
      const id = override.settings.familyId;
      return typeof id === "string" ? [id.toLowerCase()] : [];
    })
  );
}

function normalizeFont(row) {
  const source = record(row);
  assert(source, "font row must be an object");
  const id = typeof source.id === "string" ? source.id.toLowerCase() : "";
  const sourceType = source.source_type ?? source.sourceType;
  const familyName = String(source.family_name ?? source.familyName ?? "").trim();
  const format = source.format;
  const fontStyle = source.font_style ?? source.fontStyle;
  const isVariable = source.is_variable ?? source.isVariable;
  const weightMin = source.weight_min ?? source.weightMin;
  const weightMax = source.weight_max ?? source.weightMax;
  const sha256Hex = String(source.sha256_hex ?? source.sha256Hex ?? "").toLowerCase();
  const bucket = String(source.storage_bucket ?? source.bucket ?? "");
  const objectPath = String(source.object_path ?? source.objectPath ?? "");
  const byteSize = source.byte_size ?? source.byteSize;
  assert(uuidPattern.test(id), "invalid font ID");
  assert(sourceType === "uploaded" || sourceType === "bundled", "referenced font is not self-hosted");
  assert(familyName.length > 0 && familyName.length <= 120, "invalid family name");
  assert(format === "woff" || format === "woff2", "invalid font format");
  assert(["normal", "italic", "oblique"].includes(fontStyle), "invalid font style");
  assert(typeof isVariable === "boolean", "invalid variable-font flag");
  assert(numberInRange(weightMin, 1, 1000) && numberInRange(weightMax, weightMin, 1000), "invalid font weight range");
  assert(isVariable || weightMin === weightMax, "static font cannot declare a weight range");
  assert(/^[0-9a-f]{64}$/u.test(sha256Hex), "invalid font SHA-256");
  assert(bucket === "site-fonts", "invalid font storage bucket");
  assert(
    objectPath === `sha256/${sha256Hex.slice(0, 2)}/${sha256Hex}.${format}`,
    "font object path is not content-addressed"
  );
  assert(Number.isInteger(byteSize) && byteSize > 0 && byteSize <= 2 * 1024 * 1024, "invalid font byte size");
  return {
    id, familyName, sourceType, format, fontStyle, isVariable, weightMin, weightMax,
    sha256Hex, bucket, objectPath, byteSize,
    publicPath: `cms/fonts/${sha256Hex}.${format}`,
  };
}

export function normalizePublishedTypography(overrideRows, fontRows) {
  const overrides = (Array.isArray(overrideRows) ? overrideRows : [])
    .map(normalizeOverride)
    .sort((left, right) =>
      (layerRank.get(left.layer) ?? Number.MAX_SAFE_INTEGER) -
        (layerRank.get(right.layer) ?? Number.MAX_SAFE_INTEGER) ||
      left.targetKey.localeCompare(right.targetKey, "en") ||
      left.semanticScope.localeCompare(right.semanticScope, "en") ||
      left.breakpoint.localeCompare(right.breakpoint, "en")
    );
  const referenced = fontReferenceIds(overrides);
  const available = new Map(
    (Array.isArray(fontRows) ? fontRows : []).map((row) => {
      const id = typeof row?.id === "string" ? row.id.toLowerCase() : "";
      return [id, row];
    })
  );
  const fonts = [...referenced].sort().map((id) => {
    assert(available.has(id), `referenced font ${id} is unavailable`);
    return normalizeFont(available.get(id));
  });
  return { overrides, fonts };
}

export function assertPublishedFontBytes(font, bytes) {
  assert(Buffer.isBuffer(bytes), "font download is not binary");
  assert(bytes.byteLength === font.byteSize, "font byte size changed after publication");
  const magic = bytes.subarray(0, 4).toString("ascii");
  assert(
    (font.format === "woff2" && magic === "wOF2") ||
      (font.format === "woff" && magic === "wOFF"),
    "font signature does not match its format"
  );
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert(digest === font.sha256Hex, "font SHA-256 changed after publication");
  return bytes;
}

export function publicFontMetadata(font) {
  return {
    id: font.id,
    familyName: font.familyName,
    sourceType: font.sourceType,
    format: font.format,
    publicPath: font.publicPath,
    fontStyle: font.fontStyle,
    isVariable: font.isVariable,
    weightMin: font.weightMin,
    weightMax: font.weightMax,
  };
}
