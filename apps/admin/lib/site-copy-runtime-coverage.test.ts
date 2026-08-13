import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { siteCopyCatalog } from "./site-copy-catalog";

const projectRoot = path.resolve(process.cwd());
const visitorFiles = [
  "src/App.tsx",
  "src/components/GlobalSearch.tsx",
  "src/components/LiteraryGlobe.tsx",
];
const atlasDynamicLabels = new Set([
  "Все страны",
  "Нобелевские лауреаты",
  "10+ авторов",
  "С реальными портретами",
  "Есть проверенные карточки",
  "Старинный",
  "Классический",
  "Современный",
]);

function directTranslationSources() {
  const translated = new Set<string>();
  for (const relativePath of visitorFiles) {
    const filename = path.join(projectRoot, relativePath);
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t" &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        translated.add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return translated;
}

describe("site-copy visitor coverage", () => {
  it("routes every friendly editor field through the universal translator", () => {
    const directSources = directTranslationSources();
    const appSource = readFileSync(path.join(projectRoot, "src/App.tsx"), "utf8");
    expect(appSource).toContain("{t(label)}");

    for (const definition of siteCopyCatalog) {
      expect(
        directSources.has(definition.defaultRu) ||
          atlasDynamicLabels.has(definition.defaultRu),
        `${definition.key} is not consumed by t()`
      ).toBe(true);
    }
  });

  it("resolves all t() calls and contextual country names from the CMS snapshot", () => {
    const languageSource = readFileSync(
      path.join(projectRoot, "src/i18n/InterfaceLanguage.tsx"),
      "utf8"
    );
    const siteCopySource = readFileSync(
      path.join(projectRoot, "src/data/cms/siteCopy.ts"),
      "utf8"
    );
    expect(languageSource).toContain("`interface.${russianText}`");
    expect(languageSource).toContain("getCountrySiteCopy(");
    expect(siteCopySource).toContain("`country.${normalizedCode}`");
  });
});
