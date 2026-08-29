import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

type ParsedSource = {
  absolutePath: string;
  relativePath: string;
  sourceFile: ts.SourceFile;
  text: string;
};

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

const root = path.resolve(process.cwd());
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

function parseSource(relativePath: string): ParsedSource {
  const absolutePath = path.join(root, relativePath);
  const text = readFileSync(absolutePath, "utf8").replace(/\r\n/gu, "\n");
  return {
    absolutePath,
    relativePath: relativePath.replace(/\\/gu, "/"),
    sourceFile: ts.createSourceFile(
      relativePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    ),
    text,
  };
}

function visit(source: ts.Node, visitor: (node: ts.Node) => void) {
  const walk = (node: ts.Node) => {
    visitor(node);
    ts.forEachChild(node, walk);
  };
  walk(source);
}

function jsxTagName(node: JsxNode, sourceFile: ts.SourceFile) {
  return (ts.isJsxElement(node)
    ? node.openingElement.tagName
    : node.tagName
  ).getText(sourceFile);
}

function jsxAttributes(node: JsxNode) {
  return ts.isJsxElement(node)
    ? node.openingElement.attributes.properties
    : node.attributes.properties;
}

function jsxAttributeText(
  node: JsxNode,
  name: string,
  sourceFile: ts.SourceFile
) {
  const attribute = jsxAttributes(node).find(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) && candidate.name.getText(sourceFile) === name
  );
  return attribute?.initializer?.getText(sourceFile) ?? "";
}

function jsxNodes(parsed: ParsedSource) {
  const nodes: JsxNode[] = [];
  visit(parsed.sourceFile, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      nodes.push(node);
    }
  });
  return nodes;
}

function singleJsxNodeByClass(parsed: ParsedSource, classToken: string) {
  const matches = jsxNodes(parsed).filter((node) =>
    jsxAttributeText(node, "className", parsed.sourceFile).includes(classToken)
  );
  expect(matches, `unique JSX owner for .${classToken}`).toHaveLength(1);
  return matches[0];
}

function canonicalNodeHash(node: ts.Node, sourceFile: ts.SourceFile) {
  const canonical = printer.printNode(
    ts.EmitHint.Unspecified,
    node,
    sourceFile
  );
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalFileHash(parsed: ParsedSource) {
  return createHash("sha256")
    .update(printer.printFile(parsed.sourceFile))
    .digest("hex");
}

function descendantTagNames(node: ts.Node, sourceFile: ts.SourceFile) {
  const names = new Set<string>();
  visit(node, (candidate) => {
    if (ts.isJsxElement(candidate) || ts.isJsxSelfClosingElement(candidate)) {
      names.add(jsxTagName(candidate, sourceFile));
    }
  });
  return names;
}

function homepageLandmark(node: ts.JsxChild, sourceFile: ts.SourceFile) {
  if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return null;
  const tagName = jsxTagName(node, sourceFile);
  if (tagName === "CmsHomepageBanners") return "cms-banners";
  if (tagName === "DeferredBookArchive") return "book-archive";
  if (tagName === "DeferredArticleLibrary") return "article-library";

  if (tagName === "Suspense") {
    const descendants = descendantTagNames(node, sourceFile);
    if (descendants.has("CmsHomepageBlocks")) return "cms-homepage-blocks";
    if (descendants.has("BookArchiveSection")) return "book-archive";
    if (descendants.has("ArticleLibrarySection")) return "article-library";
    return null;
  }

  if (tagName !== "section") return null;
  const className = jsxAttributeText(node, "className", sourceFile);
  const sectionClasses = [
    ["magazine-hero", "hero"],
    ["atlas-section", "atlas"],
    ["daily-grid", "book-month-and-editorial-standard"],
    ["editorial-section", "featured-journal"],
    ["community-section", "community"],
    ["authors-section", "authors"],
    ["sections-directory", "sections"],
    ["trust-center", "trust"],
    ["calendar-section", "calendar"],
  ] as const;
  return sectionClasses.find(([classToken]) =>
    className.includes(classToken)
  )?.[1] ?? null;
}

function importedNames(parsed: ParsedSource, moduleName: string) {
  const names = new Set<string>();
  for (const statement of parsed.sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName
    ) {
      continue;
    }
    const clause = statement.importClause;
    if (clause?.name) names.add(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        names.add(element.name.text);
      }
    }
  }
  return names;
}

function stateOwnerNames(parsed: ParsedSource) {
  const names = new Set<string>();
  visit(parsed.sourceFile, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isArrayBindingPattern(node.name) ||
      !node.initializer ||
      !ts.isCallExpression(node.initializer) ||
      !ts.isIdentifier(node.initializer.expression) ||
      node.initializer.expression.text !== "useState"
    ) {
      return;
    }
    const owner = node.name.elements[0];
    if (owner && ts.isBindingElement(owner) && ts.isIdentifier(owner.name)) {
      names.add(owner.name.text);
    }
  });
  return names;
}

function callCount(parsed: ParsedSource, functionName: string) {
  let count = 0;
  visit(parsed.sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === functionName
    ) {
      count += 1;
    }
  });
  return count;
}

function stringLiterals(node: ts.Node) {
  const values = new Set<string>();
  visit(node, (candidate) => {
    if (
      ts.isStringLiteral(candidate) ||
      ts.isNoSubstitutionTemplateLiteral(candidate)
    ) {
      values.add(candidate.text);
    }
  });
  return values;
}

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionTsxFiles(absolutePath);
    if (!entry.name.endsWith(".tsx") || entry.name.includes(".test.")) return [];
    return [path.relative(root, absolutePath)];
  });
}

const app = parseSource("src/App.tsx");
const headerArticlesMenu = parseSource("src/components/HeaderArticlesMenu.tsx");
const languageControl = parseSource(
  "src/components/InterfaceLanguageControl.tsx"
);
const bookArchive = parseSource("src/components/BookArchiveSection.tsx");
const deferredHomepageArchives = parseSource(
  "src/loading/DeferredHomepageArchives.tsx"
);
const bookArchiveLocation = parseSource("src/books/bookArchiveLocation.ts");
const literaryGlobe = parseSource("src/components/LiteraryGlobe.tsx");

describe("Stage 5A governance baseline", () => {
  it("keeps the owner-approved Header and Hero syntax trees unchanged", () => {
    const ownerNodes = {
      topline: singleJsxNodeByClass(app, "topline"),
      desktopHeader: singleJsxNodeByClass(app, "site-header"),
      mobileHeader: singleJsxNodeByClass(app, "mobile-nav"),
      hero: singleJsxNodeByClass(app, "magazine-hero"),
    };

    expect(
      Object.fromEntries(
        Object.entries(ownerNodes).map(([name, node]) => [
          name,
          canonicalNodeHash(node, app.sourceFile),
        ])
      )
    ).toEqual({
      topline: "58b2e1ed1ca35df0476f111f06f38561567b223b5f8c3b8a53e5362affbd4751",
      desktopHeader: "7eaae1b0ffd97a67ab8d6d457077340d95646f839e636a93d0444fd9cd18dbe0",
      mobileHeader: "ccd21a739db9e39102af399f4edbe68f1c424738ab3e600de498f798c4ba01d2",
      hero: "939b3cb12c6e07dd1590e3481da52fb80fa18a753de250795b1ab116f190ad1f",
    });
    expect({
      headerArticlesMenu: canonicalFileHash(headerArticlesMenu),
      interfaceLanguageControl: canonicalFileHash(languageControl),
    }).toEqual({
      headerArticlesMenu: "3dc49bb30962ff80bce8d785eb1cb19a1b0269ef9518799caad74c4db311cbde",
      interfaceLanguageControl: "03819534ee01808676bb1bca4fe13d7f125feab9dabed213d6446fee2098402b",
    });
  });

  it("keeps the owner-approved logo and responsive Hero artwork references", () => {
    const headerAssets = stringLiterals(
      singleJsxNodeByClass(app, "site-header")
    );
    const heroAssets = stringLiterals(singleJsxNodeByClass(app, "magazine-hero"));

    expect(headerAssets).toContain("brand/probpera-logo.png");
    expect([...heroAssets]).toEqual(
      expect.arrayContaining([
        "brand/magazine-hero-wide.avif?v=20260813-literary-nature-final",
        "brand/magazine-hero-mobile.avif?v=20260813-literary-nature-portrait",
        "(max-width: 680px)",
        "Литература - это целый мир!",
        "Открыть глобус",
      ])
    );
  });

  it("locks the complete current Stage 5C homepage landmark order", () => {
    const main = jsxNodes(app).filter(
      (node) => jsxTagName(node, app.sourceFile) === "main"
    );
    expect(main).toHaveLength(1);
    expect(ts.isJsxElement(main[0])).toBe(true);
    if (!ts.isJsxElement(main[0])) return;

    expect(
      main[0].children
        .map((child) => homepageLandmark(child, app.sourceFile))
        .filter((label) => label !== null)
    ).toEqual([
      "cms-banners",
      "hero",
      "cms-homepage-blocks",
      "atlas",
      "book-month-and-editorial-standard",
      "book-archive",
      "featured-journal",
      "article-library",
      "authors",
      "sections",
      "calendar",
      "community",
      "trust",
    ]);
  });

  it("keeps BookArchiveSection as the canonical controller", () => {
    expect([...stateOwnerNames(bookArchive)]).toEqual(
      expect.arrayContaining([
        "filterState",
        "query",
        "activeShelfId",
        "visibleCount",
        "searchScope",
        "focusedBookKey",
        "selectedBook",
        "relatedArticles",
        "relatedArticlesLoading",
      ])
    );
    expect(bookArchive.text).toContain("const [query, setQuery] = useState(");
    expect(bookArchive.text).toContain(
      'initialNavigationContext?.search.query || ""'
    );
    expect(bookArchive.text).toContain(
      "const viewMode = shelfState.effectiveViewMode"
    );
    expect([...importedNames(bookArchive, "../data/bookArchive")]).toEqual(
      expect.arrayContaining([
        "BookArchiveEntry",
        "bookArchiveKey",
        "isCoverArtworkDisplayAllowed",
      ])
    );
    expect([...importedNames(bookArchive, "../data/bookArchiveQueue")]).toEqual(
      expect.arrayContaining([
        "classifyBookArchiveQueue",
        "presentBookArchiveEntry",
        "presentBookArchiveQueueItem",
      ])
    );
    expect(importedNames(bookArchive, "../hooks/useReadingLibrary")).toContain(
      "useReadingLibrary"
    );
    expect(callCount(app, "buildBookArchive")).toBe(0);
    expect(app.text).toContain(
      "books: runtime.buildBookArchive(bookArchiveCountries)"
    );
    expect(deferredHomepageArchives.text).not.toContain(
      "runtime.buildBookArchive"
    );
    expect(deferredHomepageArchives.text).toContain(
      'import("../components/BookArchiveSection")'
    );
    expect(callCount(bookArchive, "classifyBookArchiveQueue")).toBe(1);
    expect(
      jsxNodes(deferredHomepageArchives).filter(
        (node) =>
          jsxTagName(node, deferredHomepageArchives.sourceFile) ===
          "BookArchive"
      )
    ).toHaveLength(1);
  });

  it("keeps one Book Archive URL/history owner and the canonical RU/EN path", () => {
    const archiveStrings = new Set([
      ...stringLiterals(bookArchive.sourceFile),
      ...stringLiterals(bookArchiveLocation.sourceFile),
    ]);
    expect([...archiveStrings]).toEqual(
      expect.arrayContaining([
        "book",
        "books",
        "probperaBookDetail",
        "push",
        "replace",
        "pushState",
        "replaceState",
        "popstate",
        "ru",
        "en",
      ])
    );
    expect(bookArchiveLocation.text).toContain("params.set(name, safeValue)");
    expect(bookArchiveLocation.text).toContain("params.delete(name)");
    expect(bookArchive.text.match(/addEventListener\(\s*["']popstate["']/gu)).toHaveLength(2);
    expect(bookArchive.text).toContain("window.history.back()");

    expect([...importedNames(bookArchive, "../data/bookLocalization")]).toEqual(
      expect.arrayContaining([
        "selectBookMetadataLabels",
        "selectBookOriginalLanguage",
        "selectBookWriterName",
      ])
    );
    expect(importedNames(bookArchive, "../i18n/InterfaceLanguage")).toContain(
      "useInterfaceLanguage"
    );
    for (const localizedCall of [
      "presentBookArchiveEntry",
      "presentBookArchiveQueueItem",
      "selectBookMetadataLabels",
      "selectBookOriginalLanguage",
      "selectBookWriterName",
      "articleCatalogEntryForLanguage",
    ]) {
      expect(callCount(bookArchive, localizedCall), localizedCall).toBeGreaterThan(0);
    }
  });

  it("preserves the Stage 4 exactly-one-Canvas structure", () => {
    const stage4Files = productionTsxFiles(path.join(root, "src", "components"))
      .filter((relativePath) => /(?:Atlas|Globe)/u.test(path.basename(relativePath)))
      .map(parseSource);
    const canvasOwners = stage4Files.flatMap((parsed) =>
      jsxNodes(parsed)
        .filter((node) => jsxTagName(node, parsed.sourceFile) === "Canvas")
        .map(() => parsed.relativePath)
    );

    expect(canvasOwners).toEqual(["src/components/LiteraryGlobe.tsx"]);
    expect(
      jsxNodes(literaryGlobe).filter(
        (node) => jsxTagName(node, literaryGlobe.sourceFile) === "Canvas"
      )
    ).toHaveLength(1);
    expect([...importedNames(literaryGlobe, "@react-three/fiber")]).toEqual(
      expect.arrayContaining(["Canvas", "useFrame", "useThree"])
    );
  });
});
