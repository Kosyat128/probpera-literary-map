import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

import {
  assertInterfaceTranslationsComplete,
  hasInterfaceTranslation,
  resolveInitialInterfaceLanguage,
  selectInterfacePlural,
  translateInterfaceText,
} from "./InterfaceLanguage";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [entryPath] : [];
  });
}

function registeredStaticInterfacePhrases() {
  const phrases = new Map<string, string[]>();
  for (const filePath of sourceFiles(join(process.cwd(), "src"))) {
    const source = ts.createSourceFile(
      filePath,
      readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const visit = (node: ts.Node) => {
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
        phrases.set(phrase, [
          ...(phrases.get(phrase) || []),
          `${filePath}:${line}`,
        ]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return phrases;
}

describe("interface language", () => {
  it("translates the main navigation into English", () => {
    expect(translateInterfaceText("Карта", "en")).toBe("Map");
    expect(translateInterfaceText("Литературная планета", "en")).toBe(
      "Literary Planet"
    );
    expect(translateInterfaceText("Статьи", "en")).toBe("Articles");
    expect(translateInterfaceText("Книжный архив", "en")).toBe(
      "Book archive"
    );
  });

  it("preserves editorial text without an approved translation", () => {
    const original = "Авторский текст статьи";
    expect(translateInterfaceText(original, "en")).toBe(original);
    expect(translateInterfaceText(original, "ru")).toBe(original);
  });

  it("uses the language of a localized static route before stored preference", () => {
    expect(resolveInitialInterfaceLanguage("ru", "en")).toBe("en");
    expect(resolveInitialInterfaceLanguage("en", undefined)).toBe("en");
    expect(resolveInitialInterfaceLanguage("invalid", undefined)).toBe("ru");
  });

  it("uses English plural rules for counts ending in 1 or 2", () => {
    const forms = ["автор", "автора", "авторов"] as const;
    expect([1, 2, 21, 22].map((count) => selectInterfacePlural(count, "en", forms))).toEqual([
      "автор",
      "авторов",
      "авторов",
      "авторов",
    ]);
    expect([1, 2, 21, 22].map((count) => selectInterfacePlural(count, "ru", forms))).toEqual([
      "автор",
      "автора",
      "автор",
      "автора",
    ]);
  });

  it("has non-empty Russian and English text for every registered phrase", () => {
    const audit = assertInterfaceTranslationsComplete();
    expect(audit.registered).toBeGreaterThan(0);
    expect(audit.missingRussian).toEqual([]);
    expect(audit.missingEnglish).toEqual([]);
  });

  it("registers every statically translated interface phrase used in src", () => {
    const missing = [...registeredStaticInterfacePhrases()]
      .filter(([phrase]) => !hasInterfaceTranslation(phrase))
      .map(([phrase, locations]) => ({ phrase, locations }));
    expect(missing).toEqual([]);
  }, 30_000);

  it("passes the raw Cyrillic visitor-interface AST audit", () => {
    const audit = spawnSync(
      process.execPath,
      [join(process.cwd(), "scripts", "audit-interface-i18n.mjs")],
      { encoding: "utf8" }
    );

    expect(audit.error).toBeUndefined();
    expect(audit.stderr).toBe("");
    expect(audit.status).toBe(0);
  }, 15_000);
});
