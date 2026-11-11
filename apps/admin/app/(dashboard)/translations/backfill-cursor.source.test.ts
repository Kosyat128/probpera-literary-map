import { readFileSync } from "node:fs";
import ts from "typescript";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const page = ts.createSourceFile("page.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function descendants<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
  const result: T[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(root);
  return result;
}

function attribute(attributes: ts.JsxAttributes, name: string) {
  return attributes.properties.find((value): value is ts.JsxAttribute => ts.isJsxAttribute(value) && value.name.getText(page) === name);
}

function expressionAttribute(attributes: ts.JsxAttributes, name: string) {
  const initializer = attribute(attributes, name)?.initializer;
  return initializer && ts.isJsxExpression(initializer) ? initializer.expression : undefined;
}

function property(expression: ts.Expression | undefined, name: string, owner: string): expression is ts.PropertyAccessExpression {
  return Boolean(expression && ts.isPropertyAccessExpression(expression) && expression.name.text === name &&
    ts.isIdentifier(expression.expression) && expression.expression.text === owner);
}

describe("premium translation backfill cursor wiring", () => {
  it("uses each server action's cursor or durable article receipt", () => {
    expect(pageSource).not.toContain('name="backfill_cursor"');
    expect(pageSource).toContain('name="libraryCursor"');
    expect(pageSource).toContain('name="writerCursor"');
    expect(pageSource).toContain('name="countryCursor"');
    expect(pageSource).toContain('name="articleJob"');
    const fields = descendants(page, (node): node is ts.JsxSelfClosingElement =>
      ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === "BackfillCursorFields");
    // Site-copy is a single durable operation; a fresh command has its own UUID.
    expect(fields).toHaveLength(4);
    expect(fields.every(field => expressionAttribute(field.attributes, "query") !== undefined)).toBe(true);
    const libraryForm = descendants(page, (node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(page) === "form")
      .find(form => { const action = expressionAttribute(form.openingElement.attributes, "action"); return action && ts.isIdentifier(action) && action.text === "translatePremiumLibraryBatchAction"; });
    expect(libraryForm).toBeDefined();
    const libraryFields = descendants(libraryForm!, (node): node is ts.JsxSelfClosingElement =>
      ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === "BackfillCursorFields");
    expect(libraryFields).toHaveLength(1);
    const query = expressionAttribute(libraryFields[0].attributes, "query");
    expect(query && ts.isObjectLiteralExpression(query)).toBe(true);
    const assignments = (query as ts.ObjectLiteralExpression).properties.filter(ts.isPropertyAssignment);
    const job = assignments.find(value => value.name.getText(page) === "libraryJob")?.initializer;
    const cursor = assignments.find(value => value.name.getText(page) === "libraryCursor")?.initializer;
    expect(job && ts.isBinaryExpression(job) && job.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && property(job.left, "jobId", "selectedLibraryScan")).toBe(true);
    expect(cursor && ts.isConditionalExpression(cursor) && ts.isIdentifier(cursor.condition) && cursor.condition.text === "selectedLibraryScan").toBe(true);
    const confirmedCursor = cursor as ts.ConditionalExpression;
    expect(ts.isStringLiteral(confirmedCursor.whenFalse) && confirmedCursor.whenFalse.text === "0").toBe(true);
    const receiptFields = descendants(confirmedCursor.whenTrue, (node): node is ts.PropertyAccessExpression =>
      ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "selectedLibraryScan");
    expect(receiptFields.map(value => value.name.text).sort()).toEqual(["nextPosition", "windowIndex"]);
    const selectedReceipt = descendants(page, ts.isVariableDeclaration).find(value => value.name.getText(page) === "selectedLibraryScan")?.initializer;
    expect(selectedReceipt && ts.isConditionalExpression(selectedReceipt) && property(selectedReceipt.whenTrue, "data", "selectedLibraryRead") &&
      ts.isBinaryExpression(selectedReceipt.condition) && property(selectedReceipt.condition.left, "status", "selectedLibraryRead") &&
      ts.isStringLiteral(selectedReceipt.condition.right) && selectedReceipt.condition.right.text === "success").toBe(true);
    const freshButton = descendants(libraryForm!, (node): node is ts.JsxOpeningElement => ts.isJsxOpeningElement(node) && node.tagName.getText(page) === "button")
      .find(button => { const name = attribute(button.attributes, "name")?.initializer; return name && ts.isStringLiteral(name) && name.text === "libraryScanIntent"; });
    const freshIntent = freshButton && expressionAttribute(freshButton.attributes, "value");
    expect(freshIntent && ts.isIdentifier(freshIntent) && freshIntent.text === "libraryScanIntent").toBe(true);
    const newIntent = descendants(page, ts.isVariableDeclaration).find(value => value.name.getText(page) === "libraryScanIntent")?.initializer;
    expect(newIntent && ts.isCallExpression(newIntent) && property(newIntent.expression, "randomUUID", "crypto")).toBe(true);
    const siteCopyForm = descendants(page, (node): node is ts.JsxElement => ts.isJsxElement(node) && node.openingElement.tagName.getText(page) === "form")
      .find(form => { const action = expressionAttribute(form.openingElement.attributes, "action"); return action && ts.isIdentifier(action) && action.text === "translatePremiumSiteCopyBatchAction"; });
    expect(siteCopyForm).toBeDefined();
    expect(descendants(siteCopyForm!, (node): node is ts.JsxSelfClosingElement =>
      ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === "BackfillCursorFields")).toHaveLength(0);
    const siteCopyButton = descendants(siteCopyForm!, (node): node is ts.JsxOpeningElement => ts.isJsxOpeningElement(node) && node.tagName.getText(page) === "button")
      .find(button => { const name = attribute(button.attributes, "name")?.initializer; return name && ts.isStringLiteral(name) && name.text === "siteCopyIntent"; });
    const siteCopyIntent = siteCopyButton && expressionAttribute(siteCopyButton.attributes, "value");
    expect(siteCopyIntent && ts.isIdentifier(siteCopyIntent) && siteCopyIntent.text === "siteCopyIntent").toBe(true);
    const freshSiteCopy = descendants(page, ts.isVariableDeclaration).find(value => value.name.getText(page) === "siteCopyIntent")?.initializer;
    expect(freshSiteCopy && ts.isCallExpression(freshSiteCopy) && property(freshSiteCopy.expression, "randomUUID", "crypto")).toBe(true);
  });
});
