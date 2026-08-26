import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "../..");
const approvedConceptPath = path.join(
  projectRoot,
  "docs",
  "stage5-reference",
  "STAGE_5_BOOKSHELF_CONCEPT_APPROVED.png"
);
const approvedConceptSha256 =
  "46727d471384d42919f872d53a15c6047e6023ee02414c1300252e02a5dad0df";
const shelfStyles = readFileSync(
  path.join(projectRoot, "src/styles/stage5-book-shelf.css"),
  "utf8"
).replace(/\r\n/gu, "\n");

function parseSource(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const text = readFileSync(absolutePath, "utf8").replace(/\r\n/gu, "\n");
  return {
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

function visit(source, visitor) {
  const walk = (node) => {
    visitor(node);
    ts.forEachChild(node, walk);
  };
  walk(source);
}

function jsxNodes(parsed) {
  const nodes = [];
  visit(parsed.sourceFile, (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      nodes.push(node);
    }
  });
  return nodes;
}

function jsxTagName(node, sourceFile) {
  return (ts.isJsxElement(node)
    ? node.openingElement.tagName
    : node.tagName
  ).getText(sourceFile);
}

function jsxAttributes(node) {
  return ts.isJsxElement(node)
    ? node.openingElement.attributes.properties
    : node.attributes.properties;
}

function jsxAttributeText(node, name, sourceFile) {
  const attribute = jsxAttributes(node).find(
    (candidate) =>
      ts.isJsxAttribute(candidate) && candidate.name.getText(sourceFile) === name
  );
  return attribute?.initializer?.getText(sourceFile) ?? "";
}

function stateOwnerNames(parsed) {
  const names = new Set();
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

function variableInitializer(parsed, variableName) {
  let initializer = null;
  visit(parsed.sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      initializer = node.initializer.getText(parsed.sourceFile);
    }
  });
  return initializer;
}

function typeAliasText(parsed, typeName) {
  const declaration = parsed.sourceFile.statements.find(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName
  );
  return declaration?.getText(parsed.sourceFile) ?? "";
}

function hookCallsWithDependency(parsed, hookName, dependencyName) {
  const calls = [];
  visit(parsed.sourceFile, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== hookName ||
      node.arguments.length < 2 ||
      !ts.isArrayLiteralExpression(node.arguments[1])
    ) {
      return;
    }
    const dependencies = node.arguments[1].elements.map((element) =>
      element.getText(parsed.sourceFile)
    );
    if (dependencies.includes(dependencyName)) {
      calls.push(node.getText(parsed.sourceFile));
    }
  });
  return calls;
}

function productionFiles(directory, predicate = () => true) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(absolutePath, predicate);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(entry.name)) return [];
    return predicate(absolutePath) ? [absolutePath] : [];
  });
}

const controller = parseSource("src/components/BookArchiveSection.tsx");
const controls = parseSource("src/components/BookShelfControls.tsx");
const frame = parseSource("src/components/BookShelfFrame.tsx");
const scene = parseSource("src/components/BookShelfScene.tsx");
const sceneCanvas = parseSource("src/components/BookShelfSceneCanvas.tsx");
const completeShelfModel = parseSource("src/books/completeShelfModel.ts");

describe("Stage 5D-1 Complete Shelf architecture contract", () => {
  it("keeps BookArchiveSection as the complete controller and Canvas presentation-only", () => {
    const owners = stateOwnerNames(controller);
    expect([...owners]).toEqual(
      expect.arrayContaining([
        "filterState",
        "query",
        "searchScope",
        "focusedBookKey",
        "selectedBook",
        "relatedArticles",
        "advancedFiltersOpen",
        "shelfFailure",
      ])
    );
    expect(controller.text).toContain('const [query, setQuery] = useState("")');
    expect(variableInitializer(controller, "viewMode")).toMatch(
      /forcedColors\s*\?\s*"catalog"\s*:\s*shelfState\.effectiveViewMode/u
    );
    expect(controller.text).toContain("useReducer(");
    expect(controller.text).toMatch(/\bactiveCollection(?:Id|Key)?\b/u);
    expect(controller.text).toContain("useReadingLibrary()");
    expect(variableInitializer(controller, "facetResult")).toMatch(
      /filterBookArchiveFacetIndex/u
    );
    expect(variableInitializer(controller, "filteredItems")).toMatch(
      /facetResult\.items/u
    );
    expect(variableInitializer(controller, "visibleItems")).toMatch(
      /filteredItems\.slice/u
    );

    const presentationContracts = [
      typeAliasText(scene, "BookShelfSceneProps"),
      typeAliasText(sceneCanvas, "BookShelfSceneCanvasProps"),
    ];
    for (const contract of presentationContracts) {
      expect(contract).toContain("items");
      expect(contract).toContain("focusedBookKey");
      expect(contract).toContain("selectedBookKey");
      expect(contract).not.toMatch(
        /BookArchiveEntry|query|filterState|sort|CMS|history|URL|rights|relations?|collections?/iu
      );
    }
    for (const parsed of [scene, sceneCanvas]) {
      expect(parsed.text).not.toMatch(
        /useReadingLibrary|bookArchiveFacets|bookMentions|cmsBook|window\.history|window\.location/u
      );
    }
  });

  it("mounts exactly one demand Canvas through the Shelf scene inside #books", () => {
    const shelfSources = [controller, controls, frame, scene, sceneCanvas];
    const canvasOwners = shelfSources.flatMap((parsed) =>
      jsxNodes(parsed)
        .filter((node) => jsxTagName(node, parsed.sourceFile) === "Canvas")
        .map((node) => ({ node, parsed }))
    );
    expect(canvasOwners).toHaveLength(1);
    expect(canvasOwners[0].parsed.relativePath).toBe(
      "src/components/BookShelfSceneCanvas.tsx"
    );
    expect(
      jsxAttributeText(
        canvasOwners[0].node,
        "frameloop",
        canvasOwners[0].parsed.sourceFile
      )
    ).toBe('"demand"');

    const booksSections = jsxNodes(controller).filter(
      (node) =>
        jsxTagName(node, controller.sourceFile) === "section" &&
        jsxAttributeText(node, "id", controller.sourceFile) === '"books"'
    );
    expect(booksSections).toHaveLength(1);
    const sceneInstances = [];
    visit(booksSections[0], (node) => {
      if (
        (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
        jsxTagName(node, controller.sourceFile) === "BookShelfScene"
      ) {
        sceneInstances.push(node);
      }
    });
    expect(sceneInstances).toHaveLength(1);
    const retryableLazyCanvas = variableInitializer(
      scene,
      "LazyBookShelfSceneCanvas"
    );
    expect(retryableLazyCanvas).toContain("useMemo");
    expect(retryableLazyCanvas).toContain(
      "lazy(() => loadSceneCanvas(props.loadAttempt))"
    );
    expect(scene.text).toContain(
      'query: { stage5Load: "primary" }'
    );
    expect(scene.text).toContain(
      'query: { stage5Load: "retry" }'
    );
    expect(
      jsxAttributeText(sceneInstances[0], "key", controller.sourceFile)
    ).toContain("sceneLoadGeneration");
    expect(
      jsxAttributeText(sceneInstances[0], "loadAttempt", controller.sourceFile)
    ).toContain("sceneLoadGeneration");
    expect(
      jsxAttributeText(sceneInstances[0], "phase", controller.sourceFile)
    ).toContain("shelfState.phase");
    expect(
      jsxAttributeText(sceneInstances[0], "requestId", controller.sourceFile)
    ).toContain("shelfState.requestId");
    const sceneRegions = jsxNodes(scene).filter(
      (node) =>
        jsxTagName(node, scene.sourceFile) === "div" &&
        jsxAttributeText(node, "className", scene.sourceFile) ===
          '"book-shelf-scene"'
    );
    expect(sceneRegions).toHaveLength(1);
    expect(jsxAttributeText(sceneRegions[0], "role", scene.sourceFile)).toBe(
      '"region"'
    );
    expect(
      jsxAttributeText(sceneRegions[0], "aria-label", scene.sourceFile)
    ).toContain("props.sceneLabel");

    expect(shelfStyles).toMatch(
      /\.book-shelf-controls\.book-archive-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u
    );

    expect(controls.text).toMatch(/<input\s[\s\S]*type="search"/u);
    expect(controls.text).toMatch(/<button\b/u);
    expect(sceneCanvas.text).not.toMatch(/<(?:input|button|select|dialog)\b/u);
  });

  it("typing changes focus but detail and history remain explicit actions", () => {
    const filteredEffects = hookCallsWithDependency(
      controller,
      "useEffect",
      "filteredItems"
    );
    expect(filteredEffects).toHaveLength(1);
    expect(filteredEffects[0]).toContain("setFocusedBookKey");
    expect(filteredEffects[0]).not.toMatch(
      /openBookDetail|setSelectedBook|replaceBookLocation|pushState|replaceState/u
    );

    for (const dependency of ["query", "deferredQuery", "filterState"]) {
      for (const effect of hookCallsWithDependency(
        controller,
        "useEffect",
        dependency
      )) {
        expect(effect).not.toMatch(
          /openBookDetail|setSelectedBook|replaceBookLocation|pushState|replaceState/u
        );
      }
    }

    const searchInputs = jsxNodes(controller).filter(
      (node) =>
        jsxTagName(node, controller.sourceFile) === "input" &&
        jsxAttributeText(node, "type", controller.sourceFile) === '"search"'
    );
    const directSearchHandlers = searchInputs.map((node) =>
      jsxAttributeText(node, "onChange", controller.sourceFile)
    );
    const delegatedSearchHandlers = jsxNodes(controller)
      .filter(
        (node) => jsxTagName(node, controller.sourceFile) === "BookShelfControls"
      )
      .map((node) =>
        jsxAttributeText(node, "onQueryChange", controller.sourceFile)
      );
    const queryHandlers = [...directSearchHandlers, ...delegatedSearchHandlers];
    expect(queryHandlers.length).toBeGreaterThan(0);
    expect(queryHandlers.some((handler) => handler.includes("setQuery"))).toBe(
      true
    );
    for (const handler of queryHandlers) {
      expect(handler).not.toMatch(
        /openBookDetail|setSelectedBook|replaceBookLocation|history/u
      );
    }

    const sceneInstance = jsxNodes(controller).find(
      (node) => jsxTagName(node, controller.sourceFile) === "BookShelfScene"
    );
    expect(sceneInstance).toBeDefined();
    const focusHandler = jsxAttributeText(
      sceneInstance,
      "onFocusBook",
      controller.sourceFile
    );
    expect(focusHandler).toContain("requestFocusBook");
    const focusInitializer = variableInitializer(controller, "requestFocusBook");
    expect(focusInitializer).toContain("setFocusedBookKey");
    expect(focusInitializer).toContain('"request-focus"');
    expect(focusInitializer).not.toMatch(
      /setSelectedBook|replaceBookLocation|history/u
    );
    expect(focusHandler).not.toContain("openBookDetail");
    expect(
      jsxAttributeText(sceneInstance, "onOpenBook", controller.sourceFile)
    ).toContain("openBookDetail");
    expect(controller.text).toMatch(
      /const openBookDetail[\s\S]*?setSelectedBook\(book\)[\s\S]*?replaceBookLocation/u
    );
  });

  it("forces Catalog for unsupported WebGL, context loss and render failure", () => {
    expect(scene.text).toContain('onFailureRef.current("unsupported")');
    expect(scene.text).toContain('onFailureRef.current("render-error")');
    expect(scene.text).toContain('props.onFailure("context-lost")');
    expect(sceneCanvas.text).toContain('"webglcontextlost"');
    expect(scene.text).toContain('getExtension("WEBGL_lose_context")');
    expect(scene.text).toContain("}, [props.active]);");
    expect(scene.text).not.toContain("[props.active, props.onFailure]");

    const failureInitializer = variableInitializer(
      controller,
      "handleShelfFailure"
    );
    expect(failureInitializer).toContain("setShelfFailure(reason)");
    expect(failureInitializer).toMatch(
      /setViewMode\("catalog"\)|shelfDispatch\(\{ type: "set-view-mode", viewMode: "catalog" \}\)/u
    );
    const sceneInstance = jsxNodes(controller).find(
      (node) => jsxTagName(node, controller.sourceFile) === "BookShelfScene"
    );
    expect(
      jsxAttributeText(sceneInstance, "onFailure", controller.sourceFile)
    ).toContain("handleShelfFailure");
  });

  it("keeps the full filtered collection separate from paged DOM and capped scene items", () => {
    const sceneItems = variableInitializer(controller, "sceneItems");
    const sceneQueueItems = variableInitializer(controller, "sceneQueueItems");
    const visibleItems = variableInitializer(controller, "visibleItems");

    expect(sceneQueueItems).toMatch(
      /if\s*\(!selectedBook\)\s*return filteredItems/u
    );
    expect(sceneQueueItems).toContain("[selectedQueueItem, ...filteredItems]");
    expect(sceneItems).toMatch(/sceneQueueItems\.map/u);
    expect(sceneItems).not.toContain("visibleItems");
    expect(sceneItems).not.toMatch(/\.slice\(/u);
    expect(visibleItems).toMatch(/filteredItems\.slice\(0,\s*visibleCount\)/u);
    expect(sceneCanvas.text).toContain("<CompleteShelfRenderer");
    expect(sceneCanvas.text).toContain("items={items}");
    expect(completeShelfModel.text).toContain(
      "COMPLETE_SHELF_MAX_WORKING_SET = 13"
    );
    expect(completeShelfModel.text).toContain(
      "COMPLETE_SHELF_ECONOMICAL_WORKING_SET = 11"
    );
    expect(completeShelfModel.text).toContain(
      "Array.from({ length: count }, (_, slotIndex) =>"
    );
    expect(completeShelfModel.text).toContain(
      "(anchorSourceIndex + slotIndex - anchorSlot + items.length) %"
    );
    expect(controller.text).toMatch(/<BookShelfScene[\s\S]*?items=\{sceneItems\}/u);
  });

  it("contains no audio implementation or media payload in the 5D-1 surface", () => {
    const explicitFiles = [
      "src/components/BookArchiveSection.tsx",
      "src/components/BookShelfControls.tsx",
      "src/components/BookShelfFrame.tsx",
      "src/components/BookShelfScene.tsx",
      "src/components/BookShelfSceneCanvas.tsx",
      "src/components/GlobalSearch.tsx",
      "src/search/globalSearchIndex.ts",
      "src/data/cms/homepage.ts",
      "src/styles/stage5-book-shelf.css",
      "apps/admin/app/(dashboard)/homepage/actions.ts",
      "apps/admin/app/(dashboard)/homepage/page.tsx",
      "apps/admin/components/HomepageMediaField.tsx",
      "apps/admin/lib/book-archive-media-policy.ts",
      "apps/admin/lib/book-archive-scene-settings.ts",
      "scripts/build-book-scene-theme-manifest.mjs",
      "scripts/lib/book-scene-theme-manifest.mjs",
    ].map((relativePath) => path.join(projectRoot, relativePath));
    const bookSources = productionFiles(
      path.join(projectRoot, "src", "books"),
      (absolutePath) => /\.(?:ts|tsx|json)$/u.test(absolutePath)
    );
    const forbidden =
      /AudioContext|webkitAudioContext|new\s+Audio\s*\(|<audio\b|\.(?:mp3|wav)(?:[?"'\s]|$)|\b(?:mute|volume|autoplay|foley|music)\b/iu;

    for (const absolutePath of [...explicitFiles, ...bookSources]) {
      const source = readFileSync(absolutePath, "utf8");
      expect(source, path.relative(projectRoot, absolutePath)).not.toMatch(
        forbidden
      );
    }
  });

  it("pins the owner-approved Complete Shelf concept by SHA-256", () => {
    const digest = createHash("sha256")
      .update(readFileSync(approvedConceptPath))
      .digest("hex");
    expect(digest).toBe(approvedConceptSha256);
  });
});
