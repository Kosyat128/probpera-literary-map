import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const audit = readFileSync(
  path.join(root, "scripts", "audit-live-browser.mjs"),
  "utf8"
);
const workflow = readFileSync(
  path.join(root, ".github", "workflows", "live-browser-smoke.yml"),
  "utf8"
);

describe("live public browser audit", () => {
  it("is locked to the public Proba Pera HTTPS hosts", () => {
    expect(audit).toContain('const DEFAULT_SITE_URL = "https://probpera.ru"');
    expect(audit).toContain('new Set(["probpera.ru", "www.probpera.ru"])');
    expect(audit).toContain('url.protocol !== "https:"');
  });

  it("remains read-only and excludes private or authentication routes", () => {
    expect(audit).toContain('url.pathname.startsWith("/admin")');
    expect(audit).toContain('url.pathname.startsWith("/api/")');
    expect(audit).toContain('url.pathname.startsWith("/auth/")');
    expect(audit).toContain('url.pathname.startsWith("/reset-password")');
    expect(audit).not.toMatch(/\.fill\s*\(/u);
    expect(audit).not.toMatch(/\.click\s*\(/u);
    expect(audit).not.toMatch(/request\.(?:post|put|patch|delete)\s*\(/u);
  });

  it("checks release identity, first paint, blocked storage, mobile width and routes", () => {
    expect(audit).toContain("probpera-release-head.json");
    expect(audit).toContain(".static-home-fallback");
    expect(audit).toContain('get: () => blocked("localStorage")');
    expect(audit).toContain('get: () => blocked("sessionStorage")');
    expect(audit).toContain("document.documentElement.scrollWidth");
    expect(audit).toContain("const MAX_CRAWLED_ROUTES = 8");
    expect(audit).toContain('serviceWorkers: "block"');
  });

  it("runs with minimal permissions after deploy and every day", () => {
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain('cron: "17 3 * * *"');
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("Deploy Vite site to GitHub Pages");
    expect(workflow).toContain("PUBLIC_SITE_URL: https://probpera.ru");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("contents: write");
  });
});
