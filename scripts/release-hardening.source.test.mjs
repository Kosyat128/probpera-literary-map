import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

describe("release workflow hardening", () => {
  it("does not let a scheduled Pages poll cancel an active release", () => {
    const source = read(".github/workflows/deploy-pages.yml");
    expect(source).toContain("cancel-in-progress: ${{ github.event_name != 'schedule' }}");
    expect(source).not.toContain("cancel-in-progress: true\n\njobs:\n  build:");
  });

  it("uses the supported v7 checkout and setup-node actions in deploy workflows", () => {
    for (const workflow of ["deploy-pages.yml", "deploy-admin.yml"]) {
      const source = read(`.github/workflows/${workflow}`);
      const checkoutVersions = [...source.matchAll(/actions\/checkout@(v\d+)/gu)].map(
        (match) => match[1]
      );
      const setupNodeVersions = [...source.matchAll(/actions\/setup-node@(v\d+)/gu)].map(
        (match) => match[1]
      );
      expect(checkoutVersions.length).toBeGreaterThan(0);
      expect(setupNodeVersions.length).toBeGreaterThan(0);
      expect(new Set(checkoutVersions)).toEqual(new Set(["v7"]));
      expect(new Set(setupNodeVersions)).toEqual(new Set(["v7"]));
    }
  });

  it("keeps the live audit independent from code deployment", () => {
    const source = read(".github/workflows/audit-live-security.yml");
    expect(source).toContain("workflow_run:");
    expect(source).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(source).toContain("github.event.workflow_run.head_sha || 'main'");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("npm run release:smoke:live");
    expect(read(".github/workflows/deploy-pages.yml")).not.toContain("release:smoke:live");
    expect(read(".github/workflows/deploy-admin.yml")).not.toContain("release:smoke:live");
  });

  it("ships security.txt for both the public site and admin", () => {
    expect(existsSync(path.join(root, "public/.well-known/security.txt"))).toBe(true);
    expect(existsSync(path.join(root, "apps/admin/app/.well-known/security.txt/route.ts"))).toBe(true);
    const deployPages = read(".github/workflows/deploy-pages.yml");
    expect(deployPages).toContain("run: test -s dist/.well-known/security.txt");
    expect(deployPages).toContain("include-hidden-files: true");
    const articleBuilder = read("scripts/build-article-pages.mjs");
    expect(articleBuilder).toContain("/.well-known/security.txt");
    expect(articleBuilder).toContain("Content-Type: text/plain; charset=utf-8");
  });
});
