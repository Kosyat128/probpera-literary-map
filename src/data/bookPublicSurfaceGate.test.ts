import { readFile } from "node:fs/promises";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const approvedConsumers = ["DeferredBookArchive", "GlobalSearch", "RecentHistoryPanel", "WriterPanel"];

function assertPublishedBookConsumers(app: string) {
  const parsed = ts.createSourceFile("App.tsx", app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const consumers: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "./data/bookArchive") {
      expect(node.importClause?.isTypeOnly, "raw archive remains a type-only import").toBe(true);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes = node.attributes.properties.filter((attribute): attribute is ts.JsxAttribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === "books");
      const owner = node.tagName.getText(parsed);
      if (attributes.length || approvedConsumers.includes(owner)) {
        expect(attributes, `${owner}: one explicit publication-gated books prop`).toHaveLength(1);
        expect(node.attributes.properties.some(ts.isJsxSpreadAttribute), `${owner}: no prop override through a spread`).toBe(false);
        const initializer = attributes[0].initializer;
        expect(initializer && ts.isJsxExpression(initializer) && initializer.expression &&
          ts.isIdentifier(initializer.expression) && initializer.expression.text === "verifiedBookArchive",
        `${owner}: books must be the canonical verifiedBookArchive reference`).toBe(true);
        consumers.push(owner);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  expect(consumers.sort()).toEqual(approvedConsumers);
}

describe("visitor book publication boundary", () => {
  it("passes only publication-gated books to every App search and archive surface", async () => {
    const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");

    expect(app).toContain("bookArchive.filter(isPublicBook)");
    expect(app).toContain("for (const book of verifiedBookArchive)");
    expect(app).toContain("if (!isPublicBook(book)) return;");
    expect(app).toContain("books={verifiedBookArchive}");
    assertPublishedBookConsumers(app);
    expect(app).not.toContain("books={bookArchive}");
  });

  it.each<[string, (source: string) => string]>([
    ["raw archive", (source: string) => source.replace("books={verifiedBookArchive}", "books={bookArchive}")],
    ["copied array", (source: string) => source.replace("books={verifiedBookArchive}", "books={[...verifiedBookArchive]}")],
    ["prop override", (source: string) => source.replace("books={verifiedBookArchive}", "books={verifiedBookArchive} {...otherProps}")],
    ["duplicate books prop", (source: string) => source.replace("books={verifiedBookArchive}", "books={verifiedBookArchive} books={bookArchive}")],
    ["unlisted consumer", (source: string) => source.replace("<RecentHistoryPanel", "<UnlistedRecentHistory")],
    ["unlisted additional consumer", (source: string) => source + "\nconst unreviewed = <OtherArchive books={verifiedBookArchive} />;\n"],
    ["raw archive value import", (source: string) => source.replace('import type { BookArchiveEntry } from "./data/bookArchive";', 'import { BookArchiveEntry } from "./data/bookArchive";')],
  ])("rejects %s drift", async (_name, mutate) => {
    const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
    expect(() => assertPublishedBookConsumers(mutate(app))).toThrow();
  });
});
