import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

describe("Evidence V2 release gate", () => {
  it("runs the evidence audit in strict mode through every books:audit release path", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("package.json", root), "utf8")
    );
    const pagesWorkflow = await readFile(
      new URL(".github/workflows/deploy-pages.yml", root),
      "utf8"
    );
    const qualityWorkflow = await readFile(
      new URL(".github/workflows/quality.yml", root),
      "utf8"
    );

    expect(packageJson.scripts["books:audit"]).toContain(
      "audit-book-evidence-v2.mjs --strict"
    );
    expect(packageJson.scripts["release:check"]).toContain("npm run books:audit");
    expect(pagesWorkflow).toContain("npm run books:audit");
    expect(qualityWorkflow).toContain("npm run books:audit");
  });
});
