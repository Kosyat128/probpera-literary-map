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
const articleHotfix = {
  filename: "20260821_articles_staff_read_rls.sql",
  sha256: "e148b1f35cc49e1ed1eeb3bd116b625bfcd1784e7c32f6ee3baacc3f345cc82b",
};
const mediaHotfix = {
  filename: "20260821_media_assets_staff_read_rls.sql",
  sha256: "1b03d20025d5bc8bc8ec6ab1bf38f1d92fb8892650c6f466d39aa528d3b2abf8",
};

function hotfixSource(filename) {
  return readFileSync(
    path.join(root, "supabase", "hotfixes", filename),
    "utf8"
  ).replace(/\r\n?/gu, "\n");
}

describe("staff read RLS hotfixes", () => {
  it("allows only authenticated staff to read editorial article rows", () => {
    const hotfix = hotfixSource(articleHotfix.filename);

    expect(hotfix).toContain('create policy "Staff read articles"');
    expect(hotfix).toContain(
      'create policy "Staff read article translations"'
    );
    expect(hotfix.match(/to authenticated/gu)).toHaveLength(2);
    expect(hotfix.match(/using \(public\.is_staff\(\)\)/gu)).toHaveLength(2);
    expect(hotfix).not.toContain("to anon");
    expect(hotfix).not.toContain("using (true)");
    expect(createHash("sha256").update(hotfix).digest("hex")).toBe(
      articleHotfix.sha256
    );
  });

  it("gives staff full read access to media metadata without exposing it to anon", () => {
    const hotfix = hotfixSource(mediaHotfix.filename);

    expect(hotfix).toContain('create policy "Staff read media metadata"');
    expect(hotfix).toContain("on public.media_assets for select");
    expect(hotfix).toContain("to authenticated");
    expect(hotfix).toContain("using (public.is_staff())");
    expect(hotfix).not.toContain("to anon");
    expect(hotfix).not.toContain("using (true)");
    expect(createHash("sha256").update(hotfix).digest("hex")).toBe(
      mediaHotfix.sha256
    );
  });

  it("pins and verifies both hotfixes in the production reconciliation plan", () => {
    const temporaryDirectory = mkdtempSync(
      path.join(os.tmpdir(), "probpera-staff-read-rls-hotfix-")
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
      expect(manifest.hotfixes).toEqual([articleHotfix, mediaHotfix]);
      for (const hotfix of manifest.hotfixes) {
        expect(plan).toContain(
          `-- BEGIN REVIEWED HOTFIX: ${hotfix.filename}`
        );
      }
      expect(plan).toContain(
        "Staff editorial read policies are missing after reconciliation"
      );
      expect(plan.indexOf("BEGIN REVIEWED HOTFIX")).toBeLessThan(
        plan.indexOf("insert into public.probpera_schema_migrations")
      );
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
