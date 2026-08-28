import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, "src");
const dictionaryPath = join(sourceRoot, "i18n", "InterfaceLanguage.tsx");
const cyrillicPattern = /[\u0400-\u04ff]/u;
const accessibilityAttributes = new Set([
  "alt",
  "aria-label",
  "placeholder",
  "title",
]);

// The audit follows the imports from main.tsx. These exact literals are either
// inside an explicit Russian-only branch or are intentional brand/control glyphs;
// everything else in reachable JSX and accessibility attributes must be localized.
const intentionalCyrillicLiterals = [
  ["src/App.tsx", "В выбранной коллекции -"],
  ["src/App.tsx", "уже"],
  ["src/App.tsx", "проверку по открытым музейным источникам"],
  ["src/App.tsx", "без генерации лиц"],
  ["src/App.tsx", "Ещё"],
  [
    "src/App.tsx",
    "в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
  ],
  ["src/components/ArticleLibrarySection.tsx", "Найдено"],
  ["src/components/ArticleReader.tsx", "А−"],
  ["src/components/ArticleReader.tsx", "А+"],
  ["src/components/ArticleReader.tsx", "Проба Пера"],
  ["src/components/ArticleReader.tsx", "ПП"],
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [entryPath] : [];
  });
}

function parse(filePath) {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function dictionaryKeys() {
  const source = parse(dictionaryPath);
  const keys = new Set();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "englishInterfaceText" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        if (
          ts.isIdentifier(property.name) ||
          ts.isStringLiteralLike(property.name) ||
          ts.isNumericLiteral(property.name)
        ) {
          keys.add(property.name.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return keys;
}

function staticTranslationCalls() {
  const calls = new Map();
  for (const filePath of sourceFiles(sourceRoot)) {
    const source = parse(filePath);
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "t" ||
          node.expression.text === "translateInterfaceText") &&
        node.arguments.length > 0 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        const phrase = node.arguments[0].text;
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        calls.set(phrase, [
          ...(calls.get(phrase) || []),
          `${relative(projectRoot, filePath)}:${line}`,
        ]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return calls;
}

function untranslatedCyrillicInAccessibility(node, insideTranslation = false) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    (node.expression.text === "t" ||
      node.expression.text === "translateInterfaceText")
  ) {
    return [];
  }

  const findings = [];
  if (
    !insideTranslation &&
    (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    cyrillicPattern.test(node.text)
  ) {
    findings.push(node.text);
  }
  ts.forEachChild(node, (child) => {
    findings.push(...untranslatedCyrillicInAccessibility(child, insideTranslation));
  });
  return findings;
}

function rawVisitorLeaks(relativePaths) {
  const leaks = [];
  for (const relativePath of relativePaths) {
    const filePath = resolve(projectRoot, relativePath);
    const source = parse(filePath);
    const addLeak = (node, kind, text) => {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      leaks.push({ file: `${relativePath}:${line}`, kind, text: text.trim() });
    };
    const visit = (node) => {
      if (ts.isJsxText(node) && cyrillicPattern.test(node.text)) {
        addLeak(node, "JSXText", node.text);
      }
      if (
        ts.isJsxAttribute(node) &&
        accessibilityAttributes.has(node.name.getText(source)) &&
        node.initializer
      ) {
        for (const text of untranslatedCyrillicInAccessibility(node.initializer)) {
          addLeak(node, node.name.getText(source), text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return leaks;
}

function resolveLocalModule(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const basePath = resolve(dirname(fromFile), specifier);
  const candidates = extname(basePath)
    ? [basePath]
    : [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        join(basePath, "index.ts"),
        join(basePath, "index.tsx"),
      ];
  return (
    candidates.find(
      (candidate) =>
        existsSync(candidate) &&
        statSync(candidate).isFile() &&
        !relative(sourceRoot, candidate).startsWith("..")
    ) || null
  );
}

function reachableVisitorFiles() {
  const pending = [join(sourceRoot, "main.tsx")];
  const visited = new Set();
  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!filePath || visited.has(filePath)) continue;
    visited.add(filePath);
    const source = parse(filePath);
    const visit = (node) => {
      let specifier = null;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        specifier = node.moduleSpecifier.text;
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        specifier = node.arguments[0].text;
      }
      if (specifier) {
        const resolved = resolveLocalModule(filePath, specifier);
        if (resolved && !visited.has(resolved)) pending.push(resolved);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...visited]
    .filter((filePath) => filePath.endsWith(".tsx") && !/\.test\.tsx$/u.test(filePath))
    .map((filePath) => relative(projectRoot, filePath).replaceAll("\\", "/"))
    .sort();
}

const registered = dictionaryKeys();
const missingCalls = [...staticTranslationCalls()]
  .filter(([phrase]) => !registered.has(phrase))
  .map(([phrase, locations]) => ({ phrase, locations }));
const reportAllReachable = process.argv.includes("--report-all-reachable");
const reachableFiles = reachableVisitorFiles();
const reachableLeaks = rawVisitorLeaks(reachableFiles);
const normalizeLiteral = (value) => value.replace(/\s+/gu, " ").trim();
const literalKey = (file, value) => `${file}|${normalizeLiteral(value)}`;
const intentionalKeys = new Set(
  intentionalCyrillicLiterals.map(([file, value]) => literalKey(file, value))
);
const unexpectedRawLeaks = reachableLeaks.filter((leak) => {
  const file = leak.file.replace(/:\d+$/u, "");
  return !intentionalKeys.has(literalKey(file, leak.text));
});

if (reportAllReachable) {
  console.log(
    JSON.stringify(
      {
        reachableTsxFiles: reachableFiles.length,
        filesWithRawCyrillic: [...new Set(reachableLeaks.map((leak) => leak.file.split(":")[0]))],
        intentionalLiterals: reachableLeaks.filter((leak) => {
          const file = leak.file.replace(/:\d+$/u, "");
          return intentionalKeys.has(literalKey(file, leak.text));
        }),
        unexpectedLeaks: unexpectedRawLeaks,
      },
      null,
      2
    )
  );
}

if (missingCalls.length > 0) {
  console.error("Unregistered static interface translations:");
  console.error(JSON.stringify(missingCalls, null, 2));
}
if (unexpectedRawLeaks.length > 0) {
  console.error("Raw Cyrillic visitor-interface leaks:");
  console.error(JSON.stringify(unexpectedRawLeaks, null, 2));
}
if (missingCalls.length > 0 || unexpectedRawLeaks.length > 0) process.exitCode = 1;
else {
  console.log(
    `Interface i18n audit passed: ${registered.size} registered phrases, ${reachableFiles.length} reachable visitor surfaces, ${reachableLeaks.length} explicit Russian-only or brand exceptions.`
  );
}
