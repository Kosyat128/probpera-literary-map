import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("admin external link boundary", () => {
  it("routes all flagged public href sinks through the shared sanitizer", () => {
    const article = read("../app/(dashboard)/articles/[id]/page.tsx");
    const homepage = read("../app/(dashboard)/homepage/page.tsx");
    const siteCopy = read("../app/(dashboard)/site-copy/page.tsx");
    const shell = read("../components/AdminShell.tsx");
    expect(article).toContain("safePublicSiteHref(");
    expect(homepage).toContain("safePublicSiteOrigin(adminEnv.publicSiteUrl)");
    expect(homepage).toContain("safePublicSiteHref(adminEnv.publicSiteUrl, section.buttonUrl)");
    expect(siteCopy).toContain("safePublicSiteOrigin(adminEnv.publicSiteUrl)");
    expect(shell).toContain("safePublicSiteOrigin(publicSiteUrl)");
  });

  it("uses prefix slicing instead of an environment-derived regular expression", () => {
    const shell = read("../components/AdminShell.tsx");
    expect(shell).toContain("pathname.startsWith(`${adminBasePath}/`)");
    expect(shell).not.toContain("new RegExp");
  });

  it("normalizes timeline fields without a backtracking expression", () => {
    const page = read("../app/(dashboard)/editorial-database/page.tsx");
    expect(page).toContain(".filter(Boolean)");
    expect(page).not.toContain("(?:\\s*\\|\\s*)+$");
  });
});
