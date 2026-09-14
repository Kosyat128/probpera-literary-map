import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildBookArchive } from "../../src/data/bookArchive";
import { bookArchiveCountries } from "../../src/data/countries";
import { draftStorageRowsFromArchive, buildLiteraryTranslationDraftStorageFixture }
  from "./fixtures/build-literary-translation-draft-storage-fixture.mjs";

const probe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 5000 });
const integrationTest = probe.status === 0 || process.env.CI ? it : it.skip;
const rows = draftStorageRowsFromArchive(buildBookArchive(bookArchiveCountries));
const fixture = buildLiteraryTranslationDraftStorageFixture(rows);
const docker = (args, input) => {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 150_000, maxBuffer: 1_000_000 });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || "Isolated draft-storage PostgreSQL failed.");
  return result.stdout;
};

describe("short literary translation draft storage", () => {
  it("covers the unchanged 89 retained short drafts in the complete current prepared source", () => {
    expect(fixture.counts.shortDrafts).toBe(89);
    expect(fixture.counts.shortDraftWorks).toBe(69);
    expect(fixture.counts.translations).toBe(rows.length);
    const bad = rows.filter(row => [...row.description].length < 140);
    expect(new Set(bad.map(row => row.editorial_status))).toEqual(new Set(["draft"]));
    expect(bad.every(row => row.reviewed_at === null)).toBe(true);
    expect(fixture.sql).not.toMatch(/-- __[A-Z_]+__/u);
  });
  integrationTest("stores all exact prepared translations and rejects invalid text, false reviews, promotion and unknown schemas", async () => {
    if (probe.status !== 0) throw new Error("Docker is required for the CI draft-storage contract.");
    const name = `probpera-draft-storage-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    try {
      docker(["run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=draft_storage",
        process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine"]);
      started = true;
      let consecutive = 0;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const ready = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres", "-d", "draft_storage"], { encoding: "utf8", timeout: 2000 });
        consecutive = ready.status === 0 ? consecutive + 1 : 0;
        if (consecutive >= 3) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (consecutive < 3) throw new Error("Isolated draft-storage PostgreSQL did not become ready.");
      const result = docker(["exec", "--interactive", name, "psql", "-U", "postgres", "-d", "draft_storage",
        "--no-psqlrc", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], fixture.sql);
      expect(result).toContain("LITERARY_TRANSLATION_DRAFT_STORAGE_OK");
      expect(result).toContain(`"preparedTranslations": ${rows.length}`);
      expect(docker(["exec", name, "psql", "-U", "postgres", "-d", "draft_storage", "-Atc",
        "select to_regclass('public.literary_work_translations') is null"]).trim()).toBe("t");
    } finally { if (started) docker(["rm", "--force", name]); }
  }, 210_000);
});
