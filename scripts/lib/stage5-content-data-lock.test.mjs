import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import { parseCss } from "../audit-stage5-baseline.mjs";
import {
  currentIntegrationGovernanceFingerprintRegistry,
  governanceFingerprintRegistry,
  ownerCssClasses,
  stage5D1AdditiveI18nAttestation,
  stage5FinalInterfaceCopyAttestation,
} from "../stage5-baseline-registry.mjs";

const root = path.resolve(process.cwd());
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

function repositoryPath(absolutePath) {
  return path.relative(root, absolutePath).replaceAll("\\", "/");
}

function walk(absolutePath) {
  if (!statSync(absolutePath).isDirectory()) return [absolutePath];
  return readdirSync(absolutePath, { withFileTypes: true })
    .sort((first, second) => first.name.localeCompare(second.name, "en"))
    .flatMap((entry) => {
      const child = path.join(absolutePath, entry.name);
      return entry.isDirectory() ? walk(child) : [child];
    });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((first, second) => first.localeCompare(second, "en"))
        .map((key) => [key, canonicalJson(value[key])])
    );
  }
  return value;
}

function canonicalContent(absolutePath) {
  const extension = path.extname(absolutePath).toLocaleLowerCase("en");
  const text = readFileSync(absolutePath, "utf8")
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n/gu, "\n");
  if (extension === ".json" || extension === ".geojson") {
    return JSON.stringify(canonicalJson(JSON.parse(text)));
  }
  if (extension === ".ts" || extension === ".tsx") {
    const sourceFile = ts.createSourceFile(
      repositoryPath(absolutePath),
      text,
      ts.ScriptTarget.Latest,
      true,
      extension === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    return printer.printFile(sourceFile);
  }
  return text;
}

function fingerprint(paths, include) {
  const files = [
    ...new Set(
      paths
        .flatMap((entry) => walk(path.join(root, entry)))
        .filter((absolutePath) =>
          include(repositoryPath(absolutePath))
        )
    ),
  ]
    .sort((first, second) =>
      repositoryPath(first).localeCompare(repositoryPath(second), "en")
    );
  const aggregate = createHash("sha256");
  for (const absolutePath of files) {
    const relativePath = repositoryPath(absolutePath);
    const contentHash = createHash("sha256")
      .update(canonicalContent(absolutePath))
      .digest("hex");
    aggregate.update(`${relativePath}\0${contentHash}\n`);
  }
  return { files: files.length, sha256: aggregate.digest("hex") };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function codeUnitCompare(first, second) {
  return first < second ? -1 : first > second ? 1 : 0;
}

function jsonSha256(value) {
  return sha256(JSON.stringify(value));
}

function canonicalJsonSha256(value) {
  return jsonSha256(canonicalJson(value));
}

function sortedTranslationPairs(entries) {
  return [...entries].sort(([first], [second]) =>
    codeUnitCompare(first, second)
  );
}

function syntaxVisit(node, visitor) {
  visitor(node);
  ts.forEachChild(node, (child) => syntaxVisit(child, visitor));
}

function staticPropertyName(property, sourceFile) {
  const name = property.name;
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  throw new Error(
    `Non-static englishInterfaceText key: ${name.getText(sourceFile)}`
  );
}

function readEnglishInterfaceText() {
  const absolutePath = path.join(root, "src/i18n/InterfaceLanguage.tsx");
  const text = readFileSync(absolutePath, "utf8")
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n");
  const sourceFile = ts.createSourceFile(
    "src/i18n/InterfaceLanguage.tsx",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const matches = [];
  syntaxVisit(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === stage5D1AdditiveI18nAttestation.interfaceLanguage.declaration
    ) {
      matches.push(node);
    }
  });
  if (matches.length !== 1) {
    throw new Error(
      `Expected one englishInterfaceText declaration, found ${matches.length}`
    );
  }
  const declaration = matches[0];
  if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
    throw new Error("englishInterfaceText must remain one static object literal");
  }
  const entries = new Map();
  for (const property of declaration.initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(
        `Non-static englishInterfaceText member: ${property.getText(sourceFile)}`
      );
    }
    const key = staticPropertyName(property, sourceFile);
    if (entries.has(key)) {
      throw new Error(`Duplicate englishInterfaceText key: ${key}`);
    }
    if (
      !ts.isStringLiteral(property.initializer) &&
      !ts.isNoSubstitutionTemplateLiteral(property.initializer)
    ) {
      throw new Error(`Dynamic englishInterfaceText value: ${key}`);
    }
    entries.set(key, property.initializer.text);
  }

  const projectedText =
    text.slice(0, declaration.initializer.getStart(sourceFile)) +
    "__ENGLISH_INTERFACE_TEXT_SENTINEL__" +
    text.slice(declaration.initializer.getEnd());
  const projectedSource = ts.createSourceFile(
    "src/i18n/InterfaceLanguage.tsx",
    projectedText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const codeOutsideInitializerSha256 = sha256(
    printer.printFile(projectedSource).replace(/\r\n?/gu, "\n")
  );
  return { entries, codeOutsideInitializerSha256 };
}

function readStage5D1I18nFixture() {
  return JSON.parse(
    readFileSync(
      path.join(root, stage5D1AdditiveI18nAttestation.fixturePath),
      "utf8"
    )
  );
}

function readInterfaceCopyCatalog() {
  const catalog = JSON.parse(
    readFileSync(
      path.join(
        root,
        "apps/admin/catalog-assets/interface-copy-catalog.json"
      ),
      "utf8"
    )
  );
  if (!Array.isArray(catalog)) {
    throw new Error("interface-copy catalog must remain an array");
  }
  const byKey = new Map();
  for (const entry of catalog) {
    if (!entry || typeof entry !== "object" || typeof entry.key !== "string") {
      throw new Error("interface-copy catalog contains an invalid entry");
    }
    if (byKey.has(entry.key)) {
      throw new Error(`Duplicate interface-copy key: ${entry.key}`);
    }
    byKey.set(entry.key, entry);
  }
  return { catalog, byKey };
}

function exactClassTokenPattern(classToken) {
  const escaped = classToken.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(^|[^\\w-])\\.${escaped}(?![\\w-])`, "u");
}

function ownerCssFingerprint() {
  const classTokens = [...ownerCssClasses].toSorted((first, second) =>
    first.localeCompare(second, "en")
  );
  const patterns = classTokens.map(exactClassTokenPattern);
  const rules = parseCss(
    readFileSync(path.join(root, "src/index.css"), "utf8"),
    "src/index.css"
  )
    .filter((rule) => patterns.some((pattern) => pattern.test(rule.selector)))
    .map(({ selector, contexts, declarations }) => ({
      selector,
      contexts,
      declarations,
    }));
  const aggregate = createHash("sha256");
  aggregate.update(`${classTokens.join("\n")}\n\0`);
  aggregate.update(JSON.stringify(rules));
  return { rules: rules.length, sha256: aggregate.digest("hex") };
}

const lockedScopes = [
  {
    name: "authorial article documents",
    paths: ["public/articles", "public/cms/articles"],
    include: (relativePath) =>
      relativePath.endsWith(".json") &&
      relativePath !== "public/articles/book-mentions.json",
    expected: {
      files: 320,
      sha256: "e1f092a4e14c78a01335662135cc5c47ba2295b05ca1b6c0d5c1dab0ed644ace",
    },
  },
  {
    name: "published CMS article snapshots",
    paths: [
      "public/cms/published-content.json",
      "public/cms/published-articles.json",
      "src/data/articles/catalog.generated.ts",
      "src/data/articles/cms.generated.ts",
    ],
    include: () => true,
    expected: {
      files: 4,
      sha256: "9184bc4a1dc07222ca1a1e2fdac0adda6d957dfcbf39786eff4b8a767f10b36c",
    },
  },
  {
    name: "canonical country, book and writer records",
    paths: [
      "src/data/countries",
      "src/data/writers",
      "src/data/literaryMap",
      "src/data/world",
      "src/data",
    ],
    include: (relativePath) => {
      if (/\.test\.[cm]?[jt]sx?$/u.test(relativePath)) return false;
      if (!/\.(?:geo)?json$|\.tsx?$/u.test(relativePath)) return false;
      return (
        relativePath.startsWith("src/data/countries/") ||
        relativePath.startsWith("src/data/writers/") ||
        relativePath.startsWith("src/data/literaryMap/") ||
        relativePath.startsWith("src/data/world/") ||
        /^src\/data\/writers[^/]*\.ts$/u.test(relativePath)
      );
    },
    expected: {
      files: 510,
      sha256: "008055a29f40a52aa9afd04b9b9ceded0b47522c5a3c6e65a8512af96f0620dc",
    },
  },
];

describe("Stage 5 authorial content and canonical data lock", () => {
  for (const scope of lockedScopes) {
    it(`keeps ${scope.name} semantically unchanged`, () => {
      expect(fingerprint(scope.paths, scope.include)).toEqual(scope.expected);
    });
  }
});

describe("Stage 5 owner and production-pipeline governance locks", () => {
  for (const scope of currentIntegrationGovernanceFingerprintRegistry.filter(
    (entry) => !entry.classTokens
  )) {
    it(`keeps ${scope.id} immutable projection unchanged`, () => {
      const enforced = scope.enforced || scope;
      expect(fingerprint(enforced.paths, () => true)).toEqual(
        enforced.expected
      );
    });
  }

  it("preserves the approved Stage 5D-1 delta and pins final interface copy", () => {
    const attestation = stage5D1AdditiveI18nAttestation;
    expect(attestation.allowedPaths).toEqual([
      "src/i18n/InterfaceLanguage.tsx",
      "apps/admin/catalog-assets/interface-copy-catalog.json",
    ]);

    const fixture = readStage5D1I18nFixture();
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      id: attestation.id,
      sourceIntegrationSha: attestation.sourceIntegrationSha,
    });
    expect(Object.keys(fixture).sort()).toEqual([
      "entries",
      "id",
      "schemaVersion",
      "sourceIntegrationSha",
    ]);
    expect(fixture.entries).toHaveLength(
      attestation.interfaceLanguage.additions.entries
    );
    const approvedPairs = fixture.entries.map((entry) => {
      expect(Object.keys(entry).sort()).toEqual(["english", "source"]);
      expect(typeof entry.source).toBe("string");
      expect(entry.source.trim()).toBe(entry.source);
      expect(typeof entry.english).toBe("string");
      expect(entry.english.trim()).toBe(entry.english);
      return [entry.source, entry.english];
    });
    const sortedApprovedPairs = sortedTranslationPairs(approvedPairs);
    expect(approvedPairs).toEqual(sortedApprovedPairs);
    const approvedKeys = sortedApprovedPairs.map(([source]) => source);
    expect(new Set(approvedKeys).size).toBe(approvedKeys.length);
    expect(jsonSha256(approvedKeys)).toBe(
      attestation.interfaceLanguage.additions.keysSha256
    );
    expect(jsonSha256(sortedApprovedPairs)).toBe(
      attestation.interfaceLanguage.additions.pairsSha256
    );

    const interfaceState = readEnglishInterfaceText();
    expect(interfaceState.codeOutsideInitializerSha256).toBe(
      attestation.interfaceLanguage.codeOutsideInitializerSha256
    );
    for (const [source, english] of sortedApprovedPairs) {
      expect(interfaceState.entries.get(source)).toBe(english);
    }
    const finalPairs = sortedTranslationPairs(interfaceState.entries);
    expect(finalPairs).toHaveLength(
      stage5FinalInterfaceCopyAttestation.interfaceLanguage.entries
    );
    expect(jsonSha256(finalPairs.map(([source]) => source))).toBe(
      stage5FinalInterfaceCopyAttestation.interfaceLanguage.keysSha256
    );
    expect(jsonSha256(finalPairs)).toBe(
      stage5FinalInterfaceCopyAttestation.interfaceLanguage.pairsSha256
    );

    const { catalog, byKey } = readInterfaceCopyCatalog();
    expect(catalog).toHaveLength(
      stage5FinalInterfaceCopyAttestation.catalog.entries
    );
    const approvedCatalogEntries = sortedApprovedPairs.map(
      ([source, english]) => {
        const expected = {
          key: `interface.${source}`,
          group: "Весь интерфейс",
          label: source,
          defaultRu: source,
          defaultEn: english,
          multiline: source.length > 90 || english.length > 90,
        };
        expect(byKey.get(expected.key)).toEqual(expected);
        return expected;
      }
    );
    expect(jsonSha256(approvedCatalogEntries.map(({ key }) => key))).toBe(
      attestation.catalog.additions.keysSha256
    );
    expect(canonicalJsonSha256(approvedCatalogEntries)).toBe(
      attestation.catalog.additions.contentSha256
    );
    expect(jsonSha256(catalog.map(({ key }) => key))).toBe(
      stage5FinalInterfaceCopyAttestation.catalog.keysSha256
    );
    expect(canonicalJsonSha256(catalog)).toBe(
      stage5FinalInterfaceCopyAttestation.catalog.contentSha256
    );
  });

  it("preserves historical Stage 4 and current premium raw evidence records", () => {
    const stage4 = governanceFingerprintRegistry.find(
      (entry) => entry.id === "STAGE4-PRODUCTION-SURFACE"
    );
    expect(stage4.paths).toHaveLength(20);
    expect(stage4.expected).toEqual({
      files: 20,
      sha256: "bdf233f3996f069798908abc42e21f13e620a88c2fe293b3aa633004f7f23f60",
    });

    const premium = currentIntegrationGovernanceFingerprintRegistry.find(
      (entry) => entry.id === "PREMIUM-TRANSLATION-AND-HEALTH-PIPELINE"
    );
    expect(premium.sourceMainSha).toBe(
      "97f4a8d191989f454b5625caae0bafc6a22b47d6"
    );
    expect(premium.paths).toHaveLength(47);
    expect(premium.expected).toEqual({
      files: 47,
      sha256: "8fe4558f9539ecc52b67421e8208661ce5e25f44e1b759f4a27d476c0218d6f3",
    });
    expect(premium.enforced.paths).not.toContain(
      "apps/admin/app/(dashboard)/articles/actions-legacy.ts"
    );
    expect(premium.enforced.paths).not.toContain(
      "apps/admin/app/(dashboard)/articles/atomic-auto-publish-action.ts"
    );
    expect(premium.enforced.expected.files).toBe(43);
  });

  it("preserves the historical Stage 5A premium-pipeline evidence", () => {
    const scope = governanceFingerprintRegistry.find(
      (entry) => entry.id === "PREMIUM-TRANSLATION-AND-HEALTH-PIPELINE"
    );
    expect(scope.paths).toHaveLength(44);
    expect(scope.expected).toEqual({
      files: 44,
      sha256: "2b4bdaa25e526d7839297330befe68f121539443ba68634e3bf036dbae7afe9f",
    });
  });

  it("preserves historical Book Archive evidence and attests the current owner", () => {
    const historical = governanceFingerprintRegistry.find(
      (entry) => entry.id === "BOOK-ARCHIVE-OWNER-LOCK"
    );
    expect(historical.expected).toEqual({
      files: 9,
      sha256: "0cc93c1437b7829a9657557b4f26038d2e0d79df41b7791160316c168411cd41",
    });

    const current = currentIntegrationGovernanceFingerprintRegistry.find(
      (entry) => entry.id === "BOOK-ARCHIVE-OWNER-LOCK"
    );
    expect(current.sourceIntegrationSha).toBe(
      "fdd981381e859ab0ceaa44b48e9236af70c43db7"
    );
    expect(current.expected).toEqual({
      files: 9,
      sha256: "dd720968c269372c4caa3521273d9eea9b1ead231e5733e334c993402da38942",
    });
  });

  it("keeps Header/Hero owner CSS rules unchanged", () => {
    const scope = currentIntegrationGovernanceFingerprintRegistry.find(
      (entry) => entry.id === "HEADER-HERO-CSS-OWNER-LOCK"
    );
    expect(ownerCssFingerprint()).toEqual(scope.enforced.expected);
  });
});
