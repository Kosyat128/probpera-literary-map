import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { normalizeShortHyphens } from "./short-hyphens.mjs";

const registryUrl = new URL("../governance/r10-exact-source-punctuation-20260930.json", import.meta.url);
const registrySha256 = "52124a630bf7c1fb63312d8c763c034ef264fad5bc09b4f9d4aa75fbed873690";
const sha = value => createHash("sha256").update(value).digest("hex");
const key = path => JSON.stringify(path);
let registry;

// Exact paths and values only. This grants no publication or rights approval.
export function loadR10ExactSourcePunctuation({ readRegistry = () => readFileSync(registryUrl, "utf8") } = {}) {
  const value = JSON.parse(readRegistry());
  if (value.id !== "R10-EXACT-SOURCE-PUNCTUATION-20260930"
    || sha(JSON.stringify(value)) !== registrySha256 || !Array.isArray(value.files)) {
    throw new Error("R10 exact-source punctuation registry hash mismatch.");
  }
  return value;
}

/** Parse literal positions without importing or evaluating source modules. */
export function r10PunctuationLiteralRanges(relativePath, source) {
  const json = relativePath.endsWith(".json");
  const file = json ? ts.parseJsonText(relativePath, source)
    : ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) throw new Error("Invalid R10 punctuation source syntax.");
  const ranges = new Map();
  function visit(node, parts) {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)
          || (!ts.isStringLiteral(property.name) && !ts.isIdentifier(property.name))) {
          throw new Error("R10 punctuation source requires explicit object properties.");
        }
        const name = property.name.text;
        if (names.has(name)) throw new Error("Duplicate JSON key in R10 punctuation source.");
        names.add(name); visit(property.initializer, [...parts, name]);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((child, index) => visit(child, [...parts, String(index)]));
    } else if (ts.isStringLiteral(node)) {
      ranges.set(key(parts), { path: parts, start: node.getStart(file), end: node.end, value: node.text });
    } else if (ts.isNumericLiteral(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword,
      ts.SyntaxKind.NullKeyword].includes(node.kind)) {
      ranges.set(key(parts), { path: parts, value: JSON.parse(node.getText(file)) });
    }
  }
  if (json) {
    JSON.parse(source);
    const node = file.statements[0]?.expression;
    if (!node || (!ts.isObjectLiteralExpression(node) && !ts.isArrayLiteralExpression(node))) {
      throw new Error("Expected R10 JSON artifact.");
    }
    visit(node, []);
  } else {
    const declarations = file.statements.filter(ts.isVariableStatement)
      .flatMap(statement => [...statement.declarationList.declarations])
      .filter(declaration => ts.isIdentifier(declaration.name)
        && ["R10_SOURCE_PROFILES", "R10_SOURCE_GEOGRAPHY"].includes(declaration.name.text));
    if (declarations.length !== 2 || new Set(declarations.map(item => item.name.text)).size !== 2) {
      throw new Error("Invalid R10 source-profile declaration identity.");
    }
    for (const declaration of declarations) {
      if (!declaration.initializer || (!ts.isObjectLiteralExpression(declaration.initializer)
        && !ts.isArrayLiteralExpression(declaration.initializer))) throw new Error("Invalid R10 source-profile initializer.");
      visit(declaration.initializer, [declaration.name.text]);
    }
  }
  return ranges;
}

// Unknown paths remain subject to the ordinary editorial policy. Only exact
// approved literal spans survive; changed/missing quotes or source IDs reject.
export function normalizeR10ExactSourcePunctuation(relativePath, source, getRegistry = () => registry ??= loadR10ExactSourcePunctuation()) {
  relativePath = relativePath.replaceAll("\\", "/");
  if (relativePath !== "data/news/reviewed.json" && relativePath !== "data/news/r10-source-candidates.json"
    && relativePath !== "scripts/lib/literary-news-source-profiles.mjs"
    && relativePath !== "reports/r10/calendar/scoped-wikidata-evidence.json"
    && relativePath !== "reports/r10/publication/current-news-reviewed-20260929.json"
    && !/^reports\/r10\/sources\/[a-z0-9-]+\.json$/u.test(relativePath)) return null;
  const entry = getRegistry().files.find(item => item.path === relativePath);
  if (!entry) return null;
  if (entry.immutableArtifactSha256
    && sha(source.replace(/\r\n?/gu, "\n")) !== entry.immutableArtifactSha256) {
    throw new Error("R10 immutable source artifact hash mismatch.");
  }
  const ranges = r10PunctuationLiteralRanges(relativePath, source), preserved = [];
  for (const pin of entry.fields) {
    const range = ranges.get(key(pin.path));
    if (!range || typeof range.value !== "string" || sha(range.value) !== pin.valueSha256) {
      throw new Error("R10 exact-source punctuation value drift: " + relativePath + " " + pin.path.join("."));
    }
    for (const identity of pin.identities) {
      const observed = ranges.get(key(identity.path));
      if (!observed || sha(JSON.stringify(observed.value)) !== identity.valueSha256) {
        throw new Error("R10 exact-source punctuation identity drift: " + relativePath);
      }
    }
    preserved.push(range);
  }
  let cursor = 0, normalized = "";
  for (const { start, end } of preserved.sort((left, right) => left.start - right.start)) {
    if (start < cursor) throw new Error("Overlapping R10 exact-source punctuation spans.");
    normalized += normalizeShortHyphens(source.slice(cursor, start)) + source.slice(start, end);
    cursor = end;
  }
  return normalized + normalizeShortHyphens(source.slice(cursor));
}
