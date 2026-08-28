import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const stylesRoot = path.join(root, "apps", "admin", "app", "styles");
const styleFiles = [
  "tokens.css",
  "base.css",
  "layout.css",
  "forms.css",
  "tables.css",
  "editors.css",
  "site-studio.css",
  "responsive.css",
  "utilities.css",
];
const expectedImports = styleFiles.map(
  (fileName) => `@import "./styles/${fileName}";`
);
const approvedAggregate = JSON.parse(
  readFileSync(
    path.join(root, "scripts", "fixtures", "admin-globals-css-approved.json"),
    "utf8"
  )
);

function normalizeCss(source) {
  return source.replace(/\r\n?/gu, "\n");
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

describe("admin global CSS split", () => {
  it("keeps globals.css as the complete ordered import entrypoint", () => {
    const entrypoint = normalizeCss(
      readFileSync(path.join(root, "apps", "admin", "app", "globals.css"), "utf8")
    ).trim();

    expect(entrypoint.split("\n")).toEqual(expectedImports);
    expect(new Set(expectedImports).size).toBe(styleFiles.length);
    expect(entrypoint).not.toMatch(/[{}]/u);
  });

  it("preserves the approved aggregate byte-for-byte after EOL normalization", () => {
    const aggregate = normalizeCss(
      styleFiles
        .map((fileName) =>
          readFileSync(path.join(stylesRoot, fileName), "utf8")
        )
        .join("")
    );

    expect(aggregate.length).toBe(approvedAggregate.normalizedLength);
    expect(aggregate.split("\n").length).toBe(
      approvedAggregate.normalizedLineCount
    );
    expect(aggregate.endsWith("\n")).toBe(true);
    expect(sha256(aggregate)).toBe(approvedAggregate.sha256);
  });
});
