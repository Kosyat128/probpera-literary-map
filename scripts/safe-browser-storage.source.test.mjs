import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migratedFiles = [
  "src/community/sessionIdentity.ts",
  "src/community/ActivityTracker.tsx",
  "src/community/ArticleEngagement.tsx",
  "src/community/EditorialWorkbench.tsx",
  "src/hooks/useDisplayMode.ts",
  "src/hooks/useReadingLibrary.ts",
  "src/hooks/useSubscriptions.ts",
];

describe("non-fatal browser storage contract", () => {
  it.each(migratedFiles)("routes %s through safe storage helpers", (filename) => {
    const source = readFileSync(path.join(root, filename), "utf8");
    expect(source).toContain("safeWebStorage");
    expect(source).not.toMatch(/window\.(?:local|session)Storage/gu);
  });

  it("keeps the diagnostic identity available even without persistence", () => {
    const source = readFileSync(
      path.join(root, "src/community/sessionIdentity.ts"),
      "utf8"
    );
    expect(source).toContain("let transientVisitorId: string | null = null");
    expect(source).toContain("transientVisitorId = existing");
    expect(source).toContain("transientVisitorId = created");
    expect(source).toContain('writeWebStorage("session", legacySessionKey, created)');
    expect(source).toContain("return created");
  });

  it("installs compatibility storage before public providers and admin editors", () => {
    const publicEntrypoint = readFileSync(path.join(root, "src/main.tsx"), "utf8");
    const adminLayout = readFileSync(
      path.join(root, "apps/admin/app/layout.tsx"),
      "utf8"
    );
    const adminBootstrap = readFileSync(
      path.join(root, "apps/admin/components/SafeBrowserStorageBootstrap.tsx"),
      "utf8"
    );

    expect(publicEntrypoint).toContain("installSafeWebStorage();");
    expect(publicEntrypoint.indexOf("installSafeWebStorage();")).toBeLessThan(
      publicEntrypoint.indexOf("const cmsPage")
    );
    expect(adminBootstrap).toContain('"use client"');
    expect(adminBootstrap).toContain("installSafeWebStorage();");
    expect(adminLayout.indexOf("<SafeBrowserStorageBootstrap />")).toBeLessThan(
      adminLayout.indexOf("{children}")
    );
  });
});
