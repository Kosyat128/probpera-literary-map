import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  hasInterfaceTranslation,
  translateInterfaceText,
} from "./InterfaceLanguage";

const D1_COMPONENT_FILES = [
  "BookArchiveSection.tsx",
  "BookShelfControls.tsx",
  "BookShelfFrame.tsx",
  "BookShelfScene.tsx",
] as const;

const D1_DYNAMIC_LABEL_CONSTANTS = new Set([
  "archiveFilters",
  "periodLabels",
  "audienceLabels",
  "coverLabels",
  "relationLabels",
  "sortLabels",
  "searchGroupLabels",
]);

const IDENTICAL_SYMBOL_ALLOWLIST = new Set(["1900-1945", "1946-1999"]);
const CYRILLIC_TEXT = /[\u0400-\u04ff]/u;

function sourceFile(filePath: string) {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(property: ts.PropertyAssignment) {
  return ts.isIdentifier(property.name) ||
    ts.isStringLiteralLike(property.name) ||
    ts.isNumericLiteral(property.name)
    ? property.name.text
    : "";
}

function addStringInitializer(
  phrases: Set<string>,
  expression: ts.Expression | undefined
) {
  if (!expression) return;
  const value = unwrapExpression(expression);
  if (ts.isStringLiteralLike(value)) phrases.add(value.text);
}

function collectLocalDynamicLabels(
  declaration: ts.VariableDeclaration,
  phrases: Set<string>
) {
  if (
    !ts.isIdentifier(declaration.name) ||
    !D1_DYNAMIC_LABEL_CONSTANTS.has(declaration.name.text) ||
    !declaration.initializer
  ) {
    return;
  }

  const initializer = unwrapExpression(declaration.initializer);
  if (
    declaration.name.text === "archiveFilters" &&
    ts.isArrayLiteralExpression(initializer)
  ) {
    for (const element of initializer.elements) {
      const record = unwrapExpression(element as ts.Expression);
      if (!ts.isObjectLiteralExpression(record)) continue;
      for (const property of record.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          (propertyName(property) === "label" ||
            propertyName(property) === "description")
        ) {
          addStringInitializer(phrases, property.initializer);
        }
      }
    }
    return;
  }

  if (!ts.isObjectLiteralExpression(initializer)) return;
  for (const property of initializer.properties) {
    if (ts.isPropertyAssignment(property)) {
      addStringInitializer(phrases, property.initializer);
    }
  }
}

function collectD1ComponentPhrases() {
  const phrases = new Set<string>();

  for (const fileName of D1_COMPONENT_FILES) {
    const filePath = join(process.cwd(), "src", "components", fileName);
    const source = sourceFile(filePath);

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t" &&
        node.arguments.length > 0 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        phrases.add(node.arguments[0].text);
      }

      if (ts.isVariableDeclaration(node)) {
        collectLocalDynamicLabels(node, phrases);
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return phrases;
}

function collectControlledOptionLabels() {
  const filePath = join(
    process.cwd(),
    "src",
    "books",
    "bookArchiveFacets.ts"
  );
  const source = sourceFile(filePath);
  const labels = new Set<string>();
  const controlledDefinitions = new Set([
    "BOOK_ARCHIVE_GENRES",
    "BOOK_ARCHIVE_LANGUAGES",
  ]);

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      controlledDefinitions.has(node.name.text) &&
      node.initializer
    ) {
      const definitions = unwrapExpression(node.initializer);
      if (!ts.isArrayLiteralExpression(definitions)) return;

      for (const element of definitions.elements) {
        const definition = unwrapExpression(element as ts.Expression);
        if (!ts.isObjectLiteralExpression(definition)) continue;
        const aliases = definition.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            propertyName(property) === "aliases"
        );
        if (!aliases) continue;
        const values = unwrapExpression(aliases.initializer);
        if (!ts.isArrayLiteralExpression(values)) continue;
        const displayedRussianAlias = values.elements.find(
          (value) =>
            ts.isStringLiteralLike(value) && CYRILLIC_TEXT.test(value.text)
        );
        if (displayedRussianAlias && ts.isStringLiteralLike(displayedRussianAlias)) {
          labels.add(displayedRussianAlias.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return labels;
}

describe("Stage 5D-1 English interface coverage", () => {
  it("translates every visible library-frame phrase and controlled option", () => {
    const componentPhrases = collectD1ComponentPhrases();
    const controlledOptionLabels = collectControlledOptionLabels();
    const inventory = new Set([
      ...componentPhrases,
      ...controlledOptionLabels,
    ]);

    expect(componentPhrases.size).toBe(215);
    expect(controlledOptionLabels.size).toBe(61);
    expect(inventory.size).toBe(276);
    expect(
      [...IDENTICAL_SYMBOL_ALLOWLIST].filter((phrase) => !inventory.has(phrase))
    ).toEqual([]);

    const translatable = [...inventory].filter(
      (phrase) => !IDENTICAL_SYMBOL_ALLOWLIST.has(phrase)
    );
    const missing = translatable.filter(
      (phrase) => !hasInterfaceTranslation(phrase)
    );
    const untranslated = translatable
      .filter((phrase) => hasInterfaceTranslation(phrase))
      .filter((phrase) => translateInterfaceText(phrase, "en") === phrase);

    expect(translatable).toHaveLength(274);
    expect(missing).toEqual([]);
    expect(untranslated).toEqual([]);
  });
});
