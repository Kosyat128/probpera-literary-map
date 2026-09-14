import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { isShortHyphenExactSource, loadShortHyphenExactSources } from "./short-hyphen-exact-source.mjs";
import { normalizeShortHyphens } from "./short-hyphens.mjs";

const generatedModule = "src/data/cms/literaryWorks.generated.ts";
const generatedSnapshot = "public/cms/published-content.json";
const sourcePaths = {
  dickens: "src/data/countries/bookR49nDickensReviewed20260912.ts",
  existing: "src/data/countries/bookR49nExistingReviewed20260912.ts",
};

// Only these historical bibliographic notes retain their source punctuation.
// An extension requires a reviewed identity/path and an immutable source pin.
const reviewedNotes = [
  ["dickens", "england:charles_dickens:article-series-1tdjfsi", "ru", ["evidence", "1", "editionStatement"]],
  ["dickens", "england:charles_dickens:openlibrary-works-ol14868510w", "ru", ["evidence", "1", "editionStatement"]],
  ["dickens", "england:charles_dickens:openlibrary-works-ol14869167w", "en", ["evidence", "1", "editionStatement"]],
  ["dickens", "england:charles_dickens:openlibrary-works-ol8300174w", "ru", ["evidence", "0", "editionStatement"]],
  ["existing", "france:jules_verne:openlibrary-works-ol1099280w", "en", ["evidence", "0", "editionStatement"]],
  ["existing", "russia:buninin:the-village", "ru", ["selectionNote"]],
  ["existing", "russia:turgenev:article-series-men9bv", "ru", ["selectionNote"]],
];

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
function at(value, keys) {
  for (const key of keys) {
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

function jsonObject(source, file, node) {
  if (!node || !ts.isObjectLiteralExpression(node)) throw new Error("Expected a JSON object in CMS punctuation source.");
  const value = JSON.parse(source.slice(node.getStart(file), node.end));
  if (!object(value)) throw new Error("Expected an object in CMS punctuation source.");
  return value;
}

export function loadCmsExactSourcePunctuation(projectRoot, {
  readSource = relativePath => readFileSync(path.join(projectRoot, relativePath), "utf8"),
} = {}) {
  const pins = loadShortHyphenExactSources(projectRoot);
  const profiles = new Map();
  for (const [kind, relativePath] of Object.entries(sourcePaths)) {
    const source = readSource(relativePath);
    if (!isShortHyphenExactSource(relativePath, source, pins)) throw new Error("Missing immutable CMS evidence source pin.");
    const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const declarations = file.statements.filter(ts.isVariableStatement)
      .flatMap(statement => [...statement.declarationList.declarations])
      .filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === "reviewedProfiles");
    if (file.parseDiagnostics.length || declarations.length !== 1) throw new Error("Invalid pinned reviewedProfiles source.");
    profiles.set(kind, jsonObject(source, file, declarations[0].initializer));
  }
  return Object.freeze(reviewedNotes.map(([kind, legacyId, locale, suffix]) => {
    const evidence = at(profiles.get(kind), [legacyId, "localizedTitles", locale]);
    const value = at(evidence, suffix);
    if (evidence?.expressionId !== `${legacyId}:${locale}` || evidence?.locale !== locale
      || typeof value !== "string" || normalizeShortHyphens(value) === value) {
      throw new Error(`Pinned CMS punctuation identity is invalid: ${legacyId}`);
    }
    return Object.freeze({ legacyId, locale, suffix: Object.freeze([...suffix]), value });
  }));
}

function parseArtifact(relativePath, source) {
  if (relativePath === generatedSnapshot) {
    const value = JSON.parse(source);
    const file = ts.parseJsonText(relativePath, source);
    const node = file.statements[0]?.expression;
    if (file.parseDiagnostics.length || !object(value) || !ts.isObjectLiteralExpression(node)) {
      throw new Error("Invalid generated CMS snapshot JSON.");
    }
    return { value, file, node, prefix: ["literaryWorksByLegacyId"] };
  }
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = file.statements[0];
  if (file.parseDiagnostics.length || file.statements.length !== 1 || !ts.isVariableStatement(statement)
    || statement.modifiers?.length !== 1 || statement.modifiers[0].kind !== ts.SyntaxKind.ExportKeyword
    || !(statement.declarationList.flags & ts.NodeFlags.Const) || statement.declarationList.declarations.length !== 1) {
    throw new Error("Invalid generated CMS module declaration.");
  }
  const declaration = statement.declarationList.declarations[0], initializer = declaration.initializer;
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "cmsLiteraryWorksByLegacyId"
    || declaration.type || !initializer || !ts.isAsExpression(initializer)
    || initializer.type.getText(file) !== "const") throw new Error("Invalid generated CMS module initializer.");
  const node = initializer.expression;
  return { value: jsonObject(source, file, node), file, node, prefix: [] };
}

function stringRanges(node, file, keys, ranges) {
  if (ts.isObjectLiteralExpression(node)) {
    const names = new Set();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) {
        throw new Error("CMS punctuation source must contain JSON properties only.");
      }
      const name = property.name.text;
      if (names.has(name)) throw new Error("Duplicate JSON key in CMS punctuation source.");
      names.add(name);
      stringRanges(property.initializer, file, [...keys, name], ranges);
    }
  } else if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach((child, index) => stringRanges(child, file, [...keys, String(index)], ranges));
  } else if (ts.isStringLiteral(node)) {
    ranges.set(JSON.stringify(keys), { start: node.getStart(file), end: node.end });
  }
}

// Return null for every other path. Preserve only verified literal spans, so
// check and --write use the same rule without replacing values globally.
export function normalizeCmsExactSourcePunctuation(relativePath, source, getReviewedNotes) {
  relativePath = relativePath.replaceAll("\\", "/");
  if (relativePath !== generatedModule && relativePath !== generatedSnapshot) return null;
  const { value, file, node, prefix } = parseArtifact(relativePath, source);
  const works = at(value, prefix);
  if (!object(works)) throw new Error("Generated CMS work map is missing.");
  const ranges = new Map();
  stringRanges(node, file, [], ranges);
  const preserved = [];
  for (const note of getReviewedNotes()) {
    if (!Object.hasOwn(works, note.legacyId)) continue;
    const work = works[note.legacyId], [countryId, writerId, ...localId] = note.legacyId.split(":");
    if (!object(work) || work.legacyId !== note.legacyId || work.countryId !== countryId
      || work.writerId !== writerId || work.localId !== localId.join(":")) {
      throw new Error(`CMS punctuation work identity drift: ${note.legacyId}`);
    }
    for (const location of [["localizedTitles", note.locale], ["translations", note.locale, "titleEvidence"]]) {
      const evidence = at(work, location), keys = [...prefix, note.legacyId, ...location, ...note.suffix];
      if (evidence?.expressionId !== `${note.legacyId}:${note.locale}` || evidence?.locale !== note.locale
        || at(evidence, note.suffix) !== note.value) {
        throw new Error(`CMS exact source metadata drift: ${note.legacyId} ${location.join(".")}`);
      }
      const range = ranges.get(JSON.stringify(keys));
      if (!range) throw new Error("CMS exact source literal span is missing.");
      preserved.push(range);
    }
  }
  let cursor = 0, normalized = "";
  for (const { start, end } of preserved.sort((left, right) => left.start - right.start)) {
    if (start < cursor) throw new Error("Overlapping CMS exact source spans.");
    normalized += normalizeShortHyphens(source.slice(cursor, start)) + source.slice(start, end);
    cursor = end;
  }
  return normalized + normalizeShortHyphens(source.slice(cursor));
}
