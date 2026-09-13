import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dependencySecurityAttestation,
  projectReviewedDependencySecurity,
} from "./reviewed-dependency-security.mjs";

const sha256 = source => createHash("sha256").update(source).digest("hex");
const read = relativePath => readFileSync(relativePath, "utf8").replace(/\r\n?/gu, "\n");
const before = relativePath => projectReviewedDependencySecurity(relativePath, read(relativePath));
const allowedPaths = [
  ".github/workflows/quality.yml",
  "apps/admin/package.json",
  "package-lock.json",
  "package.json",
];
const tiptapDependencies = [
  "@tiptap/core",
  "@tiptap/extension-bubble-menu",
  "@tiptap/extension-floating-menu",
  "@tiptap/extension-image",
  "@tiptap/extension-link",
  "@tiptap/extension-placeholder",
  "@tiptap/extension-table",
  "@tiptap/extension-text-align",
  "@tiptap/extension-underline",
  "@tiptap/react",
  "@tiptap/starter-kit",
];

describe("September 12 dependency security forward review", () => {
  it("pins the bounded package patch, unchanged early audit and complete browser matrix", () => {
    expect(sha256(JSON.stringify(dependencySecurityAttestation))).toBe("a019f91983b719d33840260482ccc979f351b51f039ff53fe4ef1e20c13489d8");
    expect(dependencySecurityAttestation).toMatchObject({
      schemaVersion: 1,
      id: "DEPENDENCY-SECURITY-REVIEWED-20260912",
      authorizedOn: "2026-09-12",
      baselineMainSha: "cfbd444b279c4aa7a5abe44a661cf16815253b5d",
      auditCommand: "npm audit --omit=dev --audit-level=high",
    });
    expect(dependencySecurityAttestation.allowedPaths).toEqual(allowedPaths);
    expect([...new Set(dependencySecurityAttestation.projections.map(delta => delta.path))]).toEqual(allowedPaths);
    expect(Object.keys(dependencySecurityAttestation.sourceBaselines)).toEqual(allowedPaths);
    expect(Object.keys(dependencySecurityAttestation.reviewedSources)).toEqual(allowedPaths);
    const ids = dependencySecurityAttestation.projections.map(delta => delta.id);
    expect(new Set(ids).size).toBe(ids.length);
    const reportSource = read("reports/dependency-security-reviewed-20260912.json");
    expect(sha256(reportSource)).toBe("110b98488570fd3de3c6876e31c3026ff7fdcbb004fddf936777e0a64d026dbd");
    const report = JSON.parse(reportSource);
    expect(report.manifest.sha256).toBe(sha256(read(report.manifest.path)));
    expect(report.sourceFileHashes).toEqual(dependencySecurityAttestation.reviewedSources);
    expect(report.productionAudit.exitCode).toBe(0);
    expect(report.productionAudit.result.metadata.vulnerabilities.total).toBe(0);
  });

  for (const relativePath of allowedPaths) {
    it(`restores exact prior bytes and rejects changed or duplicated fragments in ${relativePath}`, () => {
      const source = read(relativePath);
      const projected = before(relativePath);
      expect(sha256(source)).toBe(dependencySecurityAttestation.reviewedSources[relativePath]);
      expect(sha256(projected)).toBe(dependencySecurityAttestation.sourceBaselines[relativePath]);
      const unrelated = "\n/* Unreviewed changes remain visible to historical locks. */\n";
      expect(projectReviewedDependencySecurity(relativePath, source + unrelated)).toBe(projected + unrelated);
      expect(sha256(projected + unrelated)).not.toBe(dependencySecurityAttestation.sourceBaselines[relativePath]);
      for (const delta of dependencySecurityAttestation.projections.filter(item => item.path === relativePath)) {
        expect(delta.before).not.toBe(delta.after);
        expect(delta.before).not.toBe("");
        expect(delta.after).not.toBe("");
        expect(source.split(delta.after)).toHaveLength(2);
        for (const changed of [
          source.replace(delta.after, ""),
          source + delta.after,
          source.replace(delta.after, delta.after.replace(/\S/u, "?")),
        ]) {
          expect(() => projectReviewedDependencySecurity(relativePath, changed))
            .toThrow("Missing or duplicate reviewed dependency-security delta");
        }
      }
    });
  }

  it("changes only the eleven admin Tiptap pins and root sharp pin", () => {
    const rootBefore = JSON.parse(before("package.json"));
    const rootAfter = JSON.parse(read("package.json"));
    expect(rootBefore.devDependencies.sharp).toBe("0.35.3");
    expect(rootAfter.devDependencies.sharp).toBe("0.35.4");
    rootAfter.devDependencies.sharp = rootBefore.devDependencies.sharp;
    expect(rootAfter).toEqual(rootBefore);

    const adminBefore = JSON.parse(before("apps/admin/package.json"));
    const adminAfter = JSON.parse(read("apps/admin/package.json"));
    expect(Object.keys(adminAfter.dependencies).filter(key => key.startsWith("@tiptap/"))).toEqual(tiptapDependencies);
    for (const name of tiptapDependencies) {
      expect(adminBefore.dependencies[name]).toBe("3.30.4");
      expect(adminAfter.dependencies[name]).toBe("3.30.5");
      adminAfter.dependencies[name] = adminBefore.dependencies[name];
    }
    expect(adminAfter).toEqual(adminBefore);
  });

  it("retains every unrelated lock record and aligns the patched native and editor packages", () => {
    const previous = JSON.parse(before("package-lock.json"));
    const current = JSON.parse(read("package-lock.json"));
    const packagePaths = [...new Set([...Object.keys(previous.packages), ...Object.keys(current.packages)])];
    const permitted = /^node_modules\/(?:@tiptap\/[^/]+|@img\/sharp[^/]*|sharp)$/u;
    for (const packagePath of packagePaths) {
      if (["", "apps/admin"].includes(packagePath) || permitted.test(packagePath)) continue;
      expect(current.packages[packagePath], packagePath).toEqual(previous.packages[packagePath]);
    }
    expect(current.lockfileVersion).toBe(previous.lockfileVersion);
    expect(current.packages[""].devDependencies).toEqual(JSON.parse(read("package.json")).devDependencies);
    expect(current.packages["apps/admin"].dependencies).toEqual(JSON.parse(read("apps/admin/package.json")).dependencies);
    const tiptap = Object.entries(current.packages).filter(([key]) => /node_modules\/@tiptap\/[^/]+$/u.test(key));
    expect(tiptap).toHaveLength(32);
    for (const [key, entry] of tiptap) {
      expect(entry.version, key).toBe("3.30.5");
      expect(entry.integrity, key).toMatch(/^sha512-/u);
      expect(entry.resolved, key).toMatch(/^https:\/\/registry\.npmjs\.org\/@tiptap\//u);
    }
    for (const [key, entry] of Object.entries(current.packages)) {
      if (!/^node_modules\/(?:@img\/sharp[^/]*|sharp)$/u.test(key)) continue;
      expect(entry.version, key).toBe(key.includes("sharp-libvips-") ? "1.3.3" : "0.35.4");
      expect(entry.integrity, key).toMatch(/^sha512-/u);
    }
  });

  it("runs the unchanged mandatory audit before the complete preflight and dependent browser matrix", () => {
    const relativePath = ".github/workflows/quality.yml";
    const splitSteps = source => source.split(/(?=^      - name: )/mu).map(block => block.trimEnd());
    const oldBlocks = splitSteps(before(relativePath));
    const source = read(relativePath);
    const preflight = source.split("  preflight:\n")[1].split("\n  browser:\n")[0];
    const newBlocks = splitSteps(preflight);
    const isAudit = block => block.startsWith("      - name: Check production dependencies\n");
    const expectedAudit = "      - name: Check production dependencies\n        run: npm audit --omit=dev --audit-level=high";
    expect(oldBlocks.filter(isAudit)).toEqual([expectedAudit]);
    expect(newBlocks.filter(isAudit)).toEqual([expectedAudit]);
    const oldPreflightEnd = oldBlocks.findIndex(block => block.startsWith("      - name: Install browser quality tools\n"));
    const oldPreflight = oldBlocks.slice(1, oldPreflightEnd).filter(block => !isAudit(block));
    expect(newBlocks.slice(1).filter(block => !isAudit(block)).slice(0, oldPreflight.length)).toEqual(oldPreflight);
    expect(source.split("run: npm audit --omit=dev --audit-level=high")).toHaveLength(2);
    const installIndex = newBlocks.findIndex(block => block.startsWith("      - name: Install exact dependencies\n"));
    expect(newBlocks[installIndex]).toBe("      - name: Install exact dependencies\n        run: npm ci");
    expect(newBlocks[installIndex + 1]).toBe(expectedAudit);
    expect(newBlocks.findIndex(isAudit)).toBeLessThan(
      newBlocks.findIndex(block => block.startsWith("      - name: Check types and admin code\n"))
    );
    expect(source).toContain("  browser:\n    name: Browser / ${{ matrix.id }}\n    needs: preflight\n");
    expect(source).toContain("    needs: [preflight, browser]\n");
    expect(source).toContain("    if: ${{ always() }}\n");
    expect(source).toContain("results.some(result => result !== 'success')");
  });

  it("does not exempt application content, evidence gates, or historical attestation files", () => {
    for (const relativePath of [
      "src/App.tsx",
      "src/data/bookArchive.ts",
      "data/book-canon-source-registry.json",
      "scripts/sync-literary-archive.mjs",
      "scripts/governance/header-library-owner-refinement-20260912.json",
      "scripts/governance/book-r49n-package-reviewed-20260912.json",
    ]) {
      expect(dependencySecurityAttestation.allowedPaths).not.toContain(relativePath);
      expect(projectReviewedDependencySecurity(relativePath, "protected content\n")).toBe("protected content\n");
    }
    expect(sha256(read("scripts/governance/header-library-owner-refinement-20260912.json")))
      .toBe("eb0df84d46bdded81f3e820fd7479ec3d8462a4920c6208348acda6900945cc4");
  });
});
