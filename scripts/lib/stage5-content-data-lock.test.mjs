import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import { parseCss } from "../audit-stage5-baseline.mjs";
import {
  adminArticlePublicationPermissionsAttestation,
  bookDatabaseEditorialOwnerAttestation,
  currentIntegrationGovernanceFingerprintRegistry,
  governanceFingerprintRegistry,
  ownerCssClasses,
  russianBiographyEditorialOwnerAttestation,
  stage5D1AdditiveI18nAttestation,
  stage5FinalInterfaceCopyAttestation,
} from "../stage5-baseline-registry.mjs";

const root = path.resolve(process.cwd());
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const bookshelfRefinement = JSON.parse(readFileSync(
  path.join(root, "scripts/governance/bookshelf-owner-refinement-20260905.json"), "utf8"
));

function projectApprovedBookshelfRefinement(relativePath, source) {
  let result = source;
  for (const delta of bookshelfRefinement.projections) {
    if (delta.path !== relativePath) continue;
    if (result.split(delta.after).length !== 2) throw new Error(`Missing or duplicate bookshelf delta: ${relativePath}`);
    result = result.replace(delta.after, delta.before);
  }
  return result;
}

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
    const value = JSON.parse(text);
    if (repositoryPath(absolutePath) === "package.json") {
      // Keep the existing release/dependency fingerprint while checking the exact
      // additive typography gate authorized on 2026-09-04. No other script drift
      // is projected out of the governance lock.
      expect(value.scripts["typography:audit"]).toBe("node scripts/audit-typography.mjs");
      expect(value.scripts["lint:public"]).toBe("tsc --noEmit && npm run typography:audit");
      delete value.scripts["typography:audit"];
      value.scripts["lint:public"] = "tsc --noEmit";
      const deliveryGate = " && node scripts/audit-book-dossier-delivery.mjs";
      expect(value.scripts["build:from-snapshot"].endsWith(deliveryGate)).toBe(true);
      expect(value.scripts["build:from-snapshot"].split(deliveryGate)).toHaveLength(2);
      value.scripts["build:from-snapshot"] = value.scripts["build:from-snapshot"].slice(0, -deliveryGate.length);
    }
    return JSON.stringify(canonicalJson(value));
  }
  if (extension === ".ts" || extension === ".tsx") {
    const sourceFile = ts.createSourceFile(
      repositoryPath(absolutePath),
      projectApprovedBookshelfRefinement(repositoryPath(absolutePath), text),
      ts.ScriptTarget.Latest,
      true,
      extension === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    return printer.printFile(sourceFile);
  }
  return projectApprovedAdminPublicationDelta(repositoryPath(absolutePath), text);
}

function projectApprovedAdminPublicationDelta(relativePath, source) {
  let projected = source;
  for (const delta of adminArticlePublicationPermissionsAttestation.projections) {
    if (delta.path !== relativePath) continue;
    if (projected.split(delta.after).length !== 2) {
      throw new Error(`Missing or duplicate reviewed publication delta: ${relativePath}`);
    }
    projected = projected.replace(delta.after, delta.before);
  }
  return projected;
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
  // The historical registry omitted the Articles trigger despite protecting
  // its Sections counterpart; freeze both while excluding popup contents.
  const classTokens = [...new Set([...ownerCssClasses, "articles-menu"])].toSorted((first, second) =>
    first.localeCompare(second, "en")
  );
  const patterns = classTokens.map(exactClassTokenPattern);
  const preservedRules = parseCss(
    readFileSync(path.join(root, "src/styles/header-preserved.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//gu, ""),
    "src/styles/header-preserved.css"
  );
  const contextKey = (contexts) => contexts.filter((context) => !context.startsWith("@layer "))
    .map((context) => context.replace(/\s+/gu, " ").trim()).join("|");
  const sharedOverrides = preservedRules.filter((rule) => rule.selector === ".site-header .interface-language-control button");
  expect(sharedOverrides).toHaveLength(2);
  for (const rule of sharedOverrides) {
    expect(rule.declarations.every((declaration) =>
      ["font-size", "font-weight", "transition"].includes(declaration.property)
    )).toBe(true);
  }
  const rules = parseCss(
    readFileSync(path.join(root, "src/index.css"), "utf8"),
    "src/index.css"
  )
    .filter((rule) => patterns.some((pattern) => pattern.test(rule.selector)))
    // These explicitly unrelated surfaces reuse the language-control class.
    // The 2026-09-04 preservation request covers the Header and Hero themselves.
    .filter((rule) => !/\.(?:atlas-|literary-globe|article-reader)/u.test(rule.selector))
    // The later, explicit menu refinement applies only inside these popups.
    // Keep .sections-menu/.articles-menu themselves and their summary triggers
    // in the Header lock, including hover/open states of those triggers.
    .filter((rule) => !/\.(?:sections-mega-(?:menu|groups)|articles-mega-(?:menu|content|lead|lead-media|loading))(?![\w-])/u.test(rule.selector))
    .map(({ selector, contexts, declarations }) => ({
      selector: selector.replace(/\s+/gu, " ").trim(),
      contexts: contexts.filter((context) => !context.startsWith("@layer ")).map((context) =>
        context.replace(/\s+/gu, " ").trim()
      ),
      declarations: selector === ".interface-language-control button"
        ? declarations.map((declaration) => sharedOverrides
          .find((rule) => contextKey(rule.contexts) === contextKey(contexts))
          ?.declarations.find((candidate) => candidate.property === declaration.property) || declaration)
        : declarations,
    }));
  // Comma-separated selectors with identical declarations can be split without
  // changing any cascade result. Preserve ordering everywhere else.
  for (let start = 0; start < rules.length;) {
    const signature = JSON.stringify({ contexts: rules[start].contexts, declarations: rules[start].declarations });
    let end = start + 1;
    while (end < rules.length && JSON.stringify({ contexts: rules[end].contexts, declarations: rules[end].declarations }) === signature) end += 1;
    const equivalent = rules.slice(start, end).sort((left, right) => left.selector.localeCompare(right.selector, "en"));
    rules.splice(start, end - start, ...equivalent);
    start = end;
  }
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
      files: 325,
      sha256: "9ae59b16eeaba20b8e60a4688a500eb6f0921f9736107f5b203fb1f51878b1d3",
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
      sha256: "438361af3402081dfbab8cffae86165b1f982541ec9e0138cdf19fe83770de17",
    },
  },
  {
    name: "canonical country, book and writer records",
    ownerAttestationId: "BOOK-DATABASE-EDITORIAL-2026-09-02",
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
      files: 557,
      sha256: "35947967c805bb1a6973c702b296ffd1a56e28cac512b9635bb9cd2a162dbb55",
    },
  },
];

describe("Stage 5 authorial content and canonical data lock", () => {
  for (const scope of lockedScopes) {
    it(`keeps ${scope.name} semantically unchanged`, () => {
      expect(fingerprint(scope.paths, scope.include)).toEqual(scope.expected);
    }, 30_000);
  }
});

describe("Stage 5 owner and production-pipeline governance locks", () => {
  it("bounds the owner-requested bookshelf UI and private progress refinement", () => {
    expect(bookshelfRefinement.sourceMainSha).toBe("0a348bd4202e3fa1558d88183549f7576a361c4b");
    expect([...new Set(bookshelfRefinement.projections.map(delta => delta.path))]).toEqual([
      "src/components/BookArchiveSection.tsx", "src/hooks/useReadingLibrary.ts",
    ]);
    expect(bookshelfRefinement.ownerReferenceSha256).toBe("5330fd14a4c180700a8c7e82db161542aba7c09f3973ccdfe46d0cf17e907ffb");
    for (const relativePath of new Set(bookshelfRefinement.projections.map(delta => delta.path))) {
      const source = readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/gu, "\n");
      const projected = projectApprovedBookshelfRefinement(relativePath, source);
      expect(projectApprovedBookshelfRefinement(relativePath, source + "\n")).toBe(projected + "\n");
      for (const delta of bookshelfRefinement.projections.filter(entry => entry.path === relativePath)) {
        expect(delta.before).not.toBe(delta.after);
        expect(() => projectApprovedBookshelfRefinement(relativePath, source + delta.after)).toThrow("Missing or duplicate bookshelf delta");
        expect(() => projectApprovedBookshelfRefinement(relativePath, source.replace(delta.after, ""))).toThrow("Missing or duplicate bookshelf delta");
      }
    }
  });

  it("attests only the reviewed additive article-publication repair", () => {
    const attestation = adminArticlePublicationPermissionsAttestation;
    expect(attestation).toMatchObject({
      id: "ADMIN-ARTICLE-PUBLICATION-PERMISSIONS-2026-09-05",
      authorizedOn: "2026-09-05",
      sourceMainSha: "a38fa5e554f01de40da27a1aa023216a4d81f12b",
      migrationPath: "supabase/migrations/20260905_article_publication_permissions.sql",
      migrationSha256: "1f9b4b9a9efb00488010cb6719cb36967a395038089b2ca3091657e144f0fcc8",
    });
    expect(attestation.projections.map(({ path: entry }) => entry)).toEqual([
      "scripts/database/build-production-migration-plan.mjs",
      ".github/workflows/reconcile-production-database.yml",
      ".github/workflows/reconcile-production-database.yml",
    ]);
    const migration = readFileSync(path.join(root, attestation.migrationPath), "utf8")
      .replace(/\r\n/gu, "\n");
    expect(sha256(migration)).toBe(attestation.migrationSha256);
    for (const delta of attestation.projections) {
      const source = readFileSync(path.join(root, delta.path), "utf8")
        .replace(/\r\n/gu, "\n");
      expect(() => projectApprovedAdminPublicationDelta(
        delta.path, source.replace(delta.after, delta.before)
      )).toThrow("Missing or duplicate reviewed publication delta");
      expect(() => projectApprovedAdminPublicationDelta(
        delta.path, source + delta.after
      )).toThrow("Missing or duplicate reviewed publication delta");
      // Projection must not discard unrelated bytes: the original full-scope
      // fingerprint below still detects every change outside the exact delta.
      expect(projectApprovedAdminPublicationDelta(delta.path, source + "\n"))
        .toBe(projectApprovedAdminPublicationDelta(delta.path, source) + "\n");
    }
  });

  it("preserves the Russian-biography authorization and records the book-database authorization", () => {
    expect(russianBiographyEditorialOwnerAttestation).toEqual({
      id: "RUSSIAN-BIOGRAPHY-EDITORIAL-2026-09-01",
      authorizedOn: "2026-09-01",
      scopes: [
        "canonical-writer-biographies",
        "book-quality-russian-copy",
        "premium-translation-and-health-russian-copy",
      ],
    });
    expect(bookDatabaseEditorialOwnerAttestation).toEqual({
      id: "BOOK-DATABASE-EDITORIAL-2026-09-02",
      authorizedOn: "2026-09-02",
      sourceIntegrationSha: "d87db7674de685bed86f78d93212246ab41fe804",
      scopes: [
        "canonical-book-audit-and-localization",
        "canon-source-and-evidence-v2-adjudication",
        "book-admin-and-atomic-release-pipeline",
      ],
    });
    expect(
      lockedScopes.find(
        (scope) => scope.name === "canonical country, book and writer records"
      )?.ownerAttestationId
    ).toBe(bookDatabaseEditorialOwnerAttestation.id);
    for (const id of [
      "BOOK-ARCHIVE-OWNER-LOCK",
      "PREMIUM-TRANSLATION-AND-HEALTH-PIPELINE",
    ]) {
      expect(
        currentIntegrationGovernanceFingerprintRegistry.find(
          (entry) => entry.id === id
        )?.enforced?.ownerAttestationId
      ).toBe(bookDatabaseEditorialOwnerAttestation.id);
    }
  });

  for (const scope of currentIntegrationGovernanceFingerprintRegistry.filter(
    (entry) => !entry.classTokens
  )) {
    it(`keeps ${scope.id} immutable projection unchanged`, () => {
      const enforced = scope.enforced || scope;
      expect(fingerprint(enforced.paths, () => true)).toEqual(
        enforced.expected
      );
    }, 30_000);
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
    expect(premium.sourceBookIntegrationSha).toBe(
      bookDatabaseEditorialOwnerAttestation.sourceIntegrationSha
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
    expect(premium.enforced.expected).toEqual({
      files: 72,
      sha256: "d9821155e4397b05aad0143c60ca3b3ca40885c834ec38fd2cd2a50919da09c3",
    });
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
      "d87db7674de685bed86f78d93212246ab41fe804"
    );
    expect(current.expected).toEqual({
      files: 9,
      sha256: "dd720968c269372c4caa3521273d9eea9b1ead231e5733e334c993402da38942",
    });
    expect(current.enforced.expected).toEqual({
      files: 9,
      sha256: "5f9a3fc115e4022b6a128cb592191b8e0a3c317e55e383e5b95651d45f97e383",
    });
  });

  it("keeps Header/Hero owner CSS rules unchanged", () => {
    const scope = currentIntegrationGovernanceFingerprintRegistry.find(
      (entry) => entry.id === "HEADER-HERO-CSS-OWNER-LOCK"
    );
    expect(scope.enforced.expected).toEqual({
      rules: 225,
      sha256: "576898463bc2f981e3ddfdbb283ac82b961d2eaeb5a5fb316d35f89fd528d743",
    });
    // Full declarations, including fonts, paint and geometry. This narrower
    // selector projection (excluding the later authorized popup refinement)
    // was independently measured from pre-work e073b21a;
    // no current styling values are accepted merely by replacing its hash.
    expect(ownerCssFingerprint()).toEqual({
      rules: 188,
      sha256: "66b469445d98e80e7e1210903bba9df6ec348790ed928ac87538e8a668880de2",
    });
  }, 30_000);
});
