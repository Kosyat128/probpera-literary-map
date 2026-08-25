import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import * as ts from "typescript";
import { describe, expect, it } from "vitest";

import { parseCss } from "../audit-stage5-baseline.mjs";
import {
  governanceFingerprintRegistry,
  ownerCssClasses,
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
      files: 319,
      sha256: "9da44d1c03f109151f54103f2e3b458e938b972d588177ed29da6df9c4097d18",
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
      sha256: "ae6736595b3748224eaac449fd366629498051e087f1c231097b92d17edf3e33",
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
      sha256: "94257f9da0bc1d522b46290b2c67c7dda49c7ae8efac03f505402970903a55db",
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
  for (const scope of governanceFingerprintRegistry.filter(
    (entry) => !entry.classTokens
  )) {
    it(`keeps ${scope.id} semantically unchanged`, () => {
      expect(fingerprint(scope.paths, () => true)).toEqual(scope.expected);
    });
  }

  it("keeps Header/Hero owner CSS rules unchanged", () => {
    const scope = governanceFingerprintRegistry.find(
      (entry) => entry.id === "HEADER-HERO-CSS-OWNER-LOCK"
    );
    expect(ownerCssFingerprint()).toEqual(scope.expected);
  });
});
