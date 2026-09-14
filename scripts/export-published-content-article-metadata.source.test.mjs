import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./export-published-content.mjs", import.meta.url),
  "utf8"
).replace(/\r\n/gu, "\n");

describe("published article document metadata", () => {
  it("resolves every exporter free name and detects a missing extracted cover-helper import", () => {
    const filename = fileURLToPath(new URL("./export-published-content.mjs", import.meta.url));
    const options = { allowJs: true, checkJs: true, noEmit: true, noResolve: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ESNext };
    const unboundNames = (text) => {
      const host = ts.createCompilerHost(options);
      const originalGetSourceFile = host.getSourceFile;
      host.getSourceFile = (path, version, ...rest) => path.replaceAll("\\", "/") === filename.replaceAll("\\", "/")
        ? ts.createSourceFile(path, text, version, true)
        : originalGetSourceFile(path, version, ...rest);
      const program = ts.createProgram([filename], options, host);
      return program.getSemanticDiagnostics(program.getSourceFile(filename))
        .filter(diagnostic => diagnostic.code === 2304)
        .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
    };
    expect(unboundNames(source)).toEqual([]);
    const missingImport = source.replace("{ imageAltLooksTechnical, prepareProjectedArticleDocument }", "{ prepareProjectedArticleDocument }");
    expect(missingImport).not.toBe(source);
    const missing = unboundNames(missingImport);
    expect(missing).toHaveLength(2);
    expect(missing.every(message => message.includes("imageAltLooksTechnical"))).toBe(true);
  });

  it("reuses normalized English metadata in standalone article documents", () => {
    const documentWriter = source.slice(
      source.indexOf("const normalizedEnglishEntry = entry.translations?.en;"),
      source.indexOf("const {\n  homepageBlocks: publicHomepageBlocks")
    );

    expect(documentWriter).toContain(
      "const normalizedEnglishEntry = entry.translations?.en;"
    );
    expect(documentWriter).toContain("normalizedEnglishEntry && englishDocument");
    expect(documentWriter).toContain("...normalizedEnglishEntry");
    expect(documentWriter).not.toContain("...englishEntry");
    expect(documentWriter).toContain(
      "payload: normalizeArticlePublicMetadata(\n      applyEditorialPublicationFix(articleDocument)\n    )"
    );
  });
});
