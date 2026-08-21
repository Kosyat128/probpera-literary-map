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
const migrationFilename = "20260822_staff_editorial_read_rls.sql";
const expectedDigest =
  "c50cda9a947cda1769c6aa36db81181dda988738e5dcf0ff7f2711d43faf03c9";
const migration = readFileSync(
  path.join(root, "supabase", "migrations", migrationFilename),
  "utf8"
);

describe("canonical staff editorial read migration", () => {
  it("creates only authenticated staff read paths and refreshes schema health", () => {
    expect(migration.match(/create policy "Staff read/gu)).toHaveLength(3);
    expect(migration.match(/to authenticated/gu)).toHaveLength(4);
    expect(migration.match(/using \(public\.is_staff\(\)\)/gu)).toHaveLength(3);
    expect(migration).toContain('create policy "Staff read articles"');
    expect(migration).toContain(
      'create policy "Staff read article translations"'
    );
    expect(migration).toContain('create policy "Staff read media metadata"');
    expect(migration).toContain(
      "'version', '20260822_staff_editorial_read_rls'"
    );
    expect(migration).toContain("'staffEditorialReadPolicies'");
    expect(migration).not.toContain("to anon");
    expect(migration).not.toContain("using (true)");
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      expectedDigest
    );
  });

  it("records the migration in the reviewed production ledger", () => {
    const temporaryDirectory = mkdtempSync(
      path.join(os.tmpdir(), "probpera-staff-read-migration-")
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
      const verification = readFileSync(verificationPath, "utf8");
      expect(manifest.migrations.at(-1)).toEqual({
        filename: migrationFilename,
        version: "20260822_staff_editorial_read_rls",
        sha256: expectedDigest,
      });
      expect(plan).toContain(
        `-- BEGIN REVIEWED MIGRATION: ${migrationFilename}`
      );
      expect(plan).toContain(
        "Staff editorial read policies are missing after reconciliation"
      );
      expect(plan.indexOf(`BEGIN REVIEWED MIGRATION: ${migrationFilename}`))
        .toBeLessThan(plan.indexOf("BEGIN REVIEWED HOTFIX"));
      expect(verification).toContain("staff_editorial_read_policies=");
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
