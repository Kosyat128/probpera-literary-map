import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { projectV12S03Package, projectV12S03Source, v12S03Compatibility, v12S03CanonicalIntegration } from "./v12-s03-compatibility.mjs";

const read = path => readFileSync(path, "utf8").replace(/\r\n/gu, "\n");
const sha = value => createHash("sha256").update(value).digest("hex");
const syntaxHash = source => sha(ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  .printFile(ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)));

describe("exact V12 S03 historical compatibility projection", () => {
  it("pins only four source files and two exact additive package properties", () => {
    expect(v12S03Compatibility.baseMainSha).toBe("0a348bd4202e3fa1558d88183549f7576a361c4b");
    expect(v12S03Compatibility.projections).toHaveLength(14);
    expect([...new Set(v12S03Compatibility.projections.map(delta => delta.path))].sort()).toEqual([
      "src/App.tsx", "src/components/BookArchiveSection.tsx", "src/components/HeaderArticlesMenu.tsx", "src/i18n/InterfaceLanguage.tsx",
    ]);
    expect(v12S03Compatibility.packageProjections.map(delta => [delta.path.join("."), delta.after.value])).toEqual([
      ["scripts.build:pwa", "tsc --noEmit && node scripts/mobile/build-pwa.mjs"],
      ["devDependencies.@electric-sql/pglite", "0.5.8"],
    ]);
  });

  it("bounds the later canonical-runtime and book-scoped navigation integration", () => {
    expect(v12S03CanonicalIntegration.canonicalMainSha).toBe("f406a7de9e16e8cf63545cbce6681ed9278761a4");
    expect(v12S03CanonicalIntegration.projections).toHaveLength(16);
    expect([...new Set(v12S03CanonicalIntegration.projections.map(delta => delta.path))]).toEqual([
      "src/components/WriterPanel.tsx", "src/components/BookArchiveSection.tsx",
    ]);
  });

  for (const delta of [...v12S03CanonicalIntegration.projections, ...v12S03Compatibility.projections]) {
    it(`${delta.id}: requires the exact delta once and preserves unrelated bytes`, () => {
      const source = read(delta.path);
      expect(source.split(delta.after)).toHaveLength(2);
      expect(delta.before).not.toBe(delta.after);
      const projected = projectV12S03Source(delta.path, source);
      for (const changed of [source.replace(delta.after, delta.before), source + delta.after,
        source.replace(delta.after, delta.after.replace("\n", "\n/* unapproved delta edit */"))]) {
        expect(() => projectV12S03Source(delta.path, changed)).toThrow("compatibility delta");
      }
      const suffix = "\nconst unrelatedDrift = true;\n";
      expect(projectV12S03Source(delta.path, source + suffix)).toBe(projected + suffix);
    });
  }

  it("leaves unknown files untouched", () => {
    const source = read("src/App.tsx");
    expect(projectV12S03Source("src/components/LiteraryGlobe.tsx", source)).toBe(source);
  });

  it.each([
    ["header body", 'className="header-actions"', 'className="header-actions" data-unapproved="yes"'],
    ["hero body", 'className="hero-editorial"', 'className="hero-editorial" data-unapproved="yes"'],
    ["community body", 'className="community-copy"', 'className="community-copy" data-unapproved="yes"'],
  ])("does not erase changes inside the %s", (_name, before, after) => {
    const source = read("src/App.tsx");
    expect(source.split(before)).toHaveLength(2);
    const projected = projectV12S03Source("src/App.tsx", source);
    const changed = projectV12S03Source("src/App.tsx", source.replace(before, after));
    expect(changed).toContain(after);
    expect(syntaxHash(changed)).not.toBe(syntaxHash(projected));
  });

  it("preserves English copy changes for the existing dictionary fingerprint", () => {
    const source = read("src/i18n/InterfaceLanguage.tsx");
    expect(source).toContain('"Explore the globe"');
    const changed = source.replace('"Explore the globe"', '"Unreviewed replacement"');
    expect(projectV12S03Source("src/i18n/InterfaceLanguage.tsx", changed)).toContain('"Unreviewed replacement"');
  });

  it("removes only the exact package additions, without mutating input or hiding other drift", () => {
    const source = JSON.parse(read("package.json"));
    const snapshot = structuredClone(source);
    const projected = projectV12S03Package(source);
    expect(source).toEqual(snapshot);
    expect(projected.scripts).not.toHaveProperty("build:pwa");
    expect(projected.devDependencies).not.toHaveProperty("@electric-sql/pglite");
    for (const delta of v12S03Compatibility.packageProjections) {
      const [group, key] = delta.path;
      for (const mode of ["missing", "changed"]) {
        const changed = structuredClone(source);
        if (mode === "missing") delete changed[group][key]; else changed[group][key] += " changed";
        expect(() => projectV12S03Package(changed)).toThrow("package property");
      }
    }
    const changed = structuredClone(source);
    changed.scripts.build = "unapproved build command";
    changed.devDependencies.unapproved = "1.0.0";
    const visible = projectV12S03Package(changed);
    expect(visible.scripts.build).toBe(changed.scripts.build);
    expect(visible.devDependencies.unapproved).toBe("1.0.0");
    expect(sha(JSON.stringify(visible))).not.toBe(sha(JSON.stringify(projected)));
  });
});
