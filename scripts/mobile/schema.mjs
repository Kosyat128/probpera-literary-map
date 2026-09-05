// Deliberately limited to the keywords used by immutable V12 schemas 43 and 57.
// Unsupported validation keywords fail instead of silently weakening a schema.
const supported = new Set([
  "$schema", "$id", "title", "description", "type", "const", "enum",
  "required", "properties", "additionalProperties", "items", "minLength",
  "minimum", "maximum", "format",
]);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (left, right) => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => same(item, right[index]));
  }
  return object(left) && object(right) && Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(key => own(right, key) && same(left[key], right[key]));
};
const matchesType = (value, type) => {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return object(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return Number.isInteger(value);
  if (["string", "boolean"].includes(type)) return typeof value === type;
  throw new Error(`Unsupported schema type: ${type}`);
};
function dateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([0-2]\d):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-]([0-2]\d):([0-5]\d))$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, , , offset] = match.map(Number);
  return month >= 1 && month <= 12 && day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && hour <= 23 &&
    (Number.isNaN(offset) || offset <= 23) && Number.isFinite(Date.parse(value));
}
function inspectSchema(schema, location = "schema") {
  if (typeof schema === "boolean") return;
  if (!object(schema)) throw new Error(`${location}: invalid schema`);
  for (const keyword of Object.keys(schema)) {
    if (!supported.has(keyword)) throw new Error(`${location}: unsupported keyword ${keyword}`);
  }
  if (schema.format && schema.format !== "date-time") throw new Error(`${location}: unsupported format`);
  if (schema.properties) for (const [key, child] of Object.entries(schema.properties)) inspectSchema(child, `${location}.${key}`);
  if (own(schema, "items")) inspectSchema(schema.items, `${location}.items`);
  if (object(schema.additionalProperties)) inspectSchema(schema.additionalProperties, `${location}.additionalProperties`);
}
export function validateSchema(schema, value) {
  inspectSchema(schema);
  const errors = [];
  const fail = (location, message) => errors.push(`${location}: ${message}`);
  function visit(rule, item, location) {
    if (rule === true) return;
    if (rule === false) return fail(location, "not allowed");
    if (rule.type && ![].concat(rule.type).some(type => matchesType(item, type))) {
      return fail(location, `expected ${[].concat(rule.type).join(" or ")}`);
    }
    if (own(rule, "const") && !same(item, rule.const)) fail(location, "const mismatch");
    if (rule.enum && !rule.enum.some(allowed => same(item, allowed))) fail(location, "invalid enum value");
    if (typeof item === "string") {
      if (rule.minLength !== undefined && [...item].length < rule.minLength) fail(location, "string too short");
      if (rule.format === "date-time" && !dateTime(item)) fail(location, "invalid date-time");
    }
    if (typeof item === "number") {
      if (rule.minimum !== undefined && item < rule.minimum) fail(location, "below minimum");
      if (rule.maximum !== undefined && item > rule.maximum) fail(location, "above maximum");
    }
    if (Array.isArray(item) && rule.items !== undefined) item.forEach((entry, index) => visit(rule.items, entry, `${location}[${index}]`));
    if (object(item)) {
      for (const key of rule.required ?? []) if (!own(item, key)) fail(`${location}.${key}`, "required");
      for (const [key, child] of Object.entries(item)) {
        if (own(rule.properties ?? {}, key)) visit(rule.properties[key], child, `${location}.${key}`);
        else if (rule.additionalProperties === false) fail(`${location}.${key}`, "additional property");
        else if (object(rule.additionalProperties)) visit(rule.additionalProperties, child, `${location}.${key}`);
      }
    }
  }
  visit(schema, value, "$");
  return errors;
}
