import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const codeowners = readFileSync(
  path.join(root, ".github", "CODEOWNERS"),
  "utf8"
);
const dependabot = readFileSync(
  path.join(root, ".github", "dependabot.yml"),
  "utf8"
);

describe("repository governance", () => {
  it("assigns an owner to every change and all critical boundaries", () => {
    expect(codeowners).toMatch(/^\* @Kosyat128$/mu);
    for (const criticalPath of [
      "/.github/",
      "/supabase/",
      "/apps/admin/",
      "/scripts/database/",
      "/scripts/cloudflare/",
      "/public/sw.js",
      "/package-lock.json",
    ]) {
      expect(codeowners).toContain(`${criticalPath} @Kosyat128`);
    }
  });

  it("keeps npm and GitHub Actions updates on a bounded weekly cadence", () => {
    expect(dependabot).toContain("version: 2");
    expect(dependabot).toContain("package-ecosystem: npm");
    expect(dependabot).toContain("package-ecosystem: github-actions");
    expect(dependabot.match(/interval: weekly/gu)).toHaveLength(2);
    expect(dependabot).toContain("target-branch: main");
    expect(dependabot).toContain("open-pull-requests-limit: 8");
    expect(dependabot).toContain("open-pull-requests-limit: 5");
    expect(dependabot).toContain("production-minor-and-patch:");
    expect(dependabot).toContain("development-minor-and-patch:");
    expect(dependabot).toContain("actions-minor-and-patch:");
  });

  it("does not grant automated dependency updates write access or bypass review", () => {
    expect(dependabot).not.toMatch(/permissions:/u);
    expect(dependabot).not.toMatch(/allow:\s*\n\s*- dependency-type: all/gu);
    expect(dependabot).not.toContain("target-branch: production");
  });
});
