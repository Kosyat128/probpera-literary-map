import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const audit = readFileSync(
  path.join(root, "scripts", "audit-live-admin-browser.mjs"),
  "utf8"
);
const workflow = readFileSync(
  path.join(root, ".github", "workflows", "live-admin-browser-smoke.yml"),
  "utf8"
);

describe("live admin browser audit", () => {
  it("is locked to the HTTPS admin origin", () => {
    expect(audit).toContain(
      'const DEFAULT_ADMIN_URL = "https://admin.probpera.ru"'
    );
    expect(audit).toContain(
      'const ALLOWED_ADMIN_HOST = "admin.probpera.ru"'
    );
    expect(audit).toContain('url.protocol !== "https:"');
  });

  it("checks the nonce CSP and anti-indexing response headers", () => {
    expect(audit).toContain('headers["content-security-policy"]');
    expect(audit).toContain("'nonce-");
    expect(audit).toContain("'strict-dynamic'");
    expect(audit).toContain("'unsafe-eval'");
    expect(audit).toContain("frame-ancestors");
    expect(audit).toContain("object-src");
    expect(audit).toContain('headers["cache-control"]');
    expect(audit).toContain('headers["x-robots-tag"]');
    expect(audit).toContain('headers["x-frame-options"]');
    expect(audit).toContain('headers["strict-transport-security"]');
  });

  it("remains a read-only login-page inspection", () => {
    expect(audit).toContain('input[type="email"]');
    expect(audit).toContain('input[type="password"]');
    expect(audit).toContain('emailAutocomplete !== "email"');
    expect(audit).toContain('passwordAutocomplete !== "current-password"');
    expect(audit).toContain("document.documentElement.scrollWidth");
    expect(audit).not.toMatch(/\.fill\s*\(/u);
    expect(audit).not.toMatch(/\.click\s*\(/u);
    expect(audit).not.toMatch(/request\.(?:post|put|patch|delete)\s*\(/u);
  });

  it("runs daily with read-only repository permissions and no secrets", () => {
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain('cron: "47 3 * * *"');
    expect(workflow).toContain(
      "ADMIN_SITE_URL: https://admin.probpera.ru"
    );
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("contents: write");
  });
});
