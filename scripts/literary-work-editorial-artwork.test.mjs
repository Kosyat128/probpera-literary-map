import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260820_literary_work_cover_artworks.sql",
    import.meta.url
  ),
  "utf8"
);
const syncSource = await readFile(
  new URL("./sync-literary-archive.mjs", import.meta.url),
  "utf8"
);
const migrationPlanner = await readFile(
  new URL("./database/build-production-migration-plan.mjs", import.meta.url),
  "utf8"
);

describe("work-level editorial artwork persistence", () => {
  it("stores user artwork outside edition and ISBN semantics", () => {
    expect(migration).toMatch(
      /create table if not exists public\.literary_work_cover_artworks/iu
    );
    expect(migration).toMatch(
      /unique \(work_id, source_archive_sha256, source_image_sha256\)/iu
    );
    expect(migration).toMatch(
      /literary_work_cover_artworks_one_primary_idx[\s\S]*where is_primary/iu
    );
    expect(migration).toMatch(
      /guard_literary_work_cover_artwork_provenance\(\)[\s\S]*new\.source_archive_sha256 is distinct from old\.source_archive_sha256[\s\S]*new\.provenance is distinct from old\.provenance[\s\S]*create a new artwork row instead/iu
    );
    expect(migration).toMatch(
      /rights_status = 'editorial-original'/iu
    );
    expect(migration).not.toMatch(/\bisbn(?:_1[03])?\s+(?:text|varchar)/iu);
  });

  it("fails closed instead of replacing a different primary artwork", () => {
    expect(syncSource).toMatch(
      /existing\.cover_url !== incoming\.coverUrl[\s\S]*source_archive_sha256[\s\S]*source_image_sha256/iu
    );
    expect(syncSource).toMatch(
      /синхронизация не перезаписывает её/iu
    );
    expect(syncSource).toMatch(
      /onConflict: "work_id,source_archive_sha256,source_image_sha256"/u
    );
    expect(syncSource).toMatch(/lockedLegacyIds\.has\(entry\.workKey\)/u);
  });

  it("preflights every required relation and schema RPC before the first write", () => {
    for (const relation of [
      "literary_works",
      "literary_work_translations",
      "literary_work_sources",
      "literary_work_external_ids",
      "book_editions",
      "literary_work_cover_artworks",
    ]) {
      expect(syncSource).toContain(`"${relation}"`);
    }
    expect(syncSource).toContain('"get_editorial_schema_health"');
    expect(syncSource.indexOf("await preflightDatabaseContract(supabase)")).toBeLessThan(
      syncSource.indexOf(".upsert(batch")
    );
    expect(syncSource).toContain("batchArtworkWorkKeys.size !== 41");
    expect(syncSource).toContain("source.batch20260820CoverEntries.length !== 43");
    expect(syncSource.indexOf("Artwork data preflight passed")).toBeLessThan(
      syncSource.indexOf(".upsert(batch")
    );
    expect(syncSource).toContain('process.argv.includes("--batch-2026-08-20")');
    expect(syncSource).toContain('process.argv.includes("--preflight")');
  });

  it("preserves archive and image provenance and emits a publication event", () => {
    expect(migration).toMatch(/provenance->>'archiveSha256' = source_archive_sha256/u);
    expect(migration).toMatch(/provenance->>'imageSha256' = source_image_sha256/u);
    expect(migration).toMatch(/capture_public_build_outbox\(\)/u);
    expect(syncSource).toMatch(/source_relative_path: sourceRelativePath/u);
    expect(syncSource).toMatch(/cover_source_url: `https:\/\/probpera\.ru\/\$\{entry\.coverUrl\}`/u);
  });

  it("is checksum-pinned in the ordered reconciliation plan with current health", () => {
    expect(migrationPlanner).toContain(
      '20260820_literary_work_cover_artworks.sql", "e39ba6da664bcb2c3b4c5c78fa1e6ff6f46d420453d5575e113b92635e1f5c58"'
    );
    expect(migrationPlanner).toContain("Expected 21 publication triggers");
    expect(migrationPlanner).toContain("20260820_literary_work_cover_artworks");
    expect(migration).toContain("'workCoverArtworks'");
    expect(migration).toContain("select count(*) = 21");
  });
});
