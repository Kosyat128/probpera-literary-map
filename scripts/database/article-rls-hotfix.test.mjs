import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const planner = path.join(
  root,
  "scripts/database/build-production-migration-plan.mjs"
);
const hotfixFilename = "20260821_articles_staff_read_rls.sql";
const hotfixPath = path.join(root, "supabase", "hotfixes", hotfixFilename);
const expectedDigest =
  "e148b1f35cc49e1ed1eeb3bd116b625bfcd1784e7c32f6ee3baacc3f345cc82b";

describe("article staff read RLS hotfix", () => {
  it("allows only authenticated staff to read editorial article rows", () => {
    const hotfix = readFileSync(hotfixPath, "utf8");

    expect(hotfix).toContain('create policy "Staff read articles"');
    expect(hotfix).toContain(
      'create policy "Staff read article translations"'
    );
    expect(hotfix.match(/to authenticated/gu)).toHaveLength(2);
    expect(hotfix.match(/using \(public\.is_staff\(\)\)/gu)).toHaveLength(2);
    expect(hotfix).not.toContain("to anon");
    expect(hotfix).not.toContain("using (true)");
    expect(createHash("sha256").update(hotfix).digest("hex")).toBe(
      expectedDigest
    );
  });

  it("pins and verifies the hotfix in the production reconciliation plan", () => {
    const temporaryDirectory = mkdtempSync(
      path.join(os.tmpdir(), "probpera-article-rls-hotfix-")
    );
    try {
      const planPath = path.join(temporaryDirectory, "plan.sql");
      const manifestPath = path.join(temporaryDirectory, "manifest.json");
      const verificationPath = path.join(temporaryDirectory, "verify.sql");
      execFileSync(process.execPath, [
        planner,
        "--output",
        planPath,
        "--manifest",
        manifestPath,
        "--verification",
        verificationPath,
        "--repository-sha",
        "0123456789abcdef0123456789abcdef01234567",
      ]);

      const plan = readFileSync(planPath, "utf8");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      expect(manifest.hotfixes).toEqual([
        {
          filename: hotfixFilename,
          sha256: expectedDigest,
        },
      ]);
      expect(plan).toContain(
        `-- BEGIN REVIEWED HOTFIX: ${hotfixFilename}`
      );
      expect(plan).toContain(
        "Staff article read policies are missing after reconciliation"
      );
      expect(plan.indexOf("BEGIN REVIEWED HOTFIX")).toBeLessThan(
        plan.indexOf("insert into public.probpera_schema_migrations")
      );
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
