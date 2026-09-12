import { readFile } from "node:fs/promises";
import { matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

describe("Evidence V2 release gate", () => {
  it("keeps UI-only changes outside automatic database writes while covering every catalog dependency", async () => {
    const workflow = await readFile(
      new URL(".github/workflows/dispatch-premium-database-reconciliation.yml", root),
      "utf8"
    );
    const filters = [...workflow.slice(workflow.indexOf("    paths:"), workflow.indexOf("\npermissions:")).matchAll(/^\s+- "([^"]+)"/gmu)]
      .map((match) => match[1]);
    const triggers = (file) => filters.reduce((included, filter) => {
      const excluded = filter.startsWith("!");
      return matchesGlob(file, excluded ? filter.slice(1) : filter) ? !excluded : included;
    }, false);
    const sync = await readFile(new URL("scripts/sync-literary-archive.mjs", root), "utf8");
    const sourceImports = [...sync.matchAll(/from "(\.\/src\/data\/[^"\n]+)"/gu)]
      .map((match) => match[1]);
    expect(sourceImports.length).toBeGreaterThan(0);
    const { metafile } = await build({
      absWorkingDir: fileURLToPath(root),
      entryPoints: [...new Set(sourceImports)],
      bundle: true,
      packages: "external",
      platform: "node",
      outdir: ".tmp/database-trigger-audit",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    const catalogInputs = Object.keys(metafile.inputs).map((file) => file.replaceAll("\\", "/"))
      .filter((file) => file.startsWith("src/data/"));
    expect(catalogInputs.length).toBeGreaterThan(100);
    expect(catalogInputs.filter((file) => !triggers(file))).toEqual([]);
    expect(triggers("data/book-canon-source-registry.json")).toBe(true);
    expect(triggers("scripts/sync-literary-archive.mjs")).toBe(true);
    expect(triggers("supabase/migrations/20260902_literary_work_evidence_v2_attestations.sql")).toBe(true);
    expect(triggers("src/data/articles/publicationStats.ts")).toBe(false);
    expect(triggers("src/data/cms/homepage.ts")).toBe(false);
    expect(triggers("src/data/cms/coreSectionTitle.ts")).toBe(false);
  });

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
