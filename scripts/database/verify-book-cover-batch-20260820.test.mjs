import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256,
  buildBookCoverBatch20260820Contract,
  redactBookCoverBatchSensitive,
  resolveBookCoverBatchProductionEnvironment,
  verifyBookCoverBatch20260820Snapshot,
} from "./verify-book-cover-batch-20260820.mjs";

const root = path.resolve(process.cwd());
const workflowPath = path.join(
  root,
  ".github/workflows/reconcile-production-database.yml"
);

function validSnapshot(contract) {
  const works = contract.workKeys.map((legacy_id, index) => ({
    id: `work-${index + 1}`,
    legacy_id,
  }));
  const workIds = new Map(works.map((work) => [work.legacy_id, work.id]));
  const artworks = contract.artworkRows.map(({ workKey, ...entry }) => ({
    ...entry,
    work_id: workIds.get(workKey),
  }));
  const supplementalIds = contract.supplementalWorkKeys.map((workKey) =>
    workIds.get(workKey)
  );
  return {
    artworkCount: artworks.length,
    artworks,
    works,
    translations: supplementalIds.flatMap((work_id) => [
      { work_id, locale: "ru" },
      { work_id, locale: "en" },
    ]),
    sources: supplementalIds.map((work_id) => ({ work_id })),
  };
}

describe("atomic archive reviewed-cover postflight", () => {
  it("pins the reviewed 43-artwork, 41-work, 17-supplement contract", () => {
    const contract = buildBookCoverBatch20260820Contract();
    expect(contract.archiveSha256).toBe(
      BOOK_COVER_BATCH_20260820_ARCHIVE_SHA256
    );
    expect(contract.workKeys).toHaveLength(41);
    expect(contract.sourceImageSha256).toHaveLength(43);
    expect(contract.artworkRows).toHaveLength(43);
    expect(contract.supplementalWorkKeys).toHaveLength(17);
    expect(verifyBookCoverBatch20260820Snapshot(contract, validSnapshot(contract))).toEqual({
      artworks: 43,
      works: 41,
      primary: 31,
      secondary: 12,
      supplementalWorks: 17,
    });
  });

  it("fails closed for altered artwork identity or counts", () => {
    const contract = buildBookCoverBatch20260820Contract();
    const snapshot = validSnapshot(contract);
    snapshot.artworks[0] = {
      ...snapshot.artworks[0],
      source_image_sha256: "f".repeat(64),
    };
    expect(() =>
      verifyBookCoverBatch20260820Snapshot(contract, snapshot)
    ).toThrow("exact 43 reviewed source images");

    const missing = validSnapshot(contract);
    missing.artworks.pop();
    expect(() =>
      verifyBookCoverBatch20260820Snapshot(contract, missing)
    ).toThrow("exactly 43 artwork rows");
  });

  it("fails closed for every changed work/artwork row mapping", () => {
    const contract = buildBookCoverBatch20260820Contract();

    const swappedWorks = validSnapshot(contract);
    const differentWorkIndex = swappedWorks.artworks.findIndex(
      (artwork) => artwork.work_id !== swappedWorks.artworks[0].work_id
    );
    [swappedWorks.artworks[0].work_id, swappedWorks.artworks[differentWorkIndex].work_id] = [
      swappedWorks.artworks[differentWorkIndex].work_id,
      swappedWorks.artworks[0].work_id,
    ];
    expect(() =>
      verifyBookCoverBatch20260820Snapshot(contract, swappedWorks)
    ).toThrow("exact work/image/primary/asset/index contract");

    const swappedPrimary = validSnapshot(contract);
    const primaryIndex = swappedPrimary.artworks.findIndex(
      (artwork) => artwork.is_primary
    );
    const secondaryIndex = swappedPrimary.artworks.findIndex(
      (artwork) => !artwork.is_primary
    );
    swappedPrimary.artworks[primaryIndex].is_primary = false;
    swappedPrimary.artworks[secondaryIndex].is_primary = true;
    expect(() =>
      verifyBookCoverBatch20260820Snapshot(contract, swappedPrimary)
    ).toThrow("exact work/image/primary/asset/index contract");

    for (const mutate of [
      (artwork) => {
        artwork.cover_url = `${artwork.cover_url}.wrong`;
      },
      (artwork) => {
        artwork.thumbnail_url = `${artwork.thumbnail_url}.wrong`;
      },
      (artwork) => {
        artwork.cover_width += 1;
      },
      (artwork) => {
        artwork.thumbnail_height += 1;
      },
      (artwork) => {
        artwork.source_index = 999;
      },
    ]) {
      const changed = validSnapshot(contract);
      mutate(changed.artworks[0]);
      expect(() =>
        verifyBookCoverBatch20260820Snapshot(contract, changed)
      ).toThrow("exact work/image/primary/asset/index contract");
    }
  });

  it("fails closed when a supplemental translation or source is missing", () => {
    const contract = buildBookCoverBatch20260820Contract();
    const translationsMissing = validSnapshot(contract);
    translationsMissing.translations.splice(0, 1);
    expect(() =>
      verifyBookCoverBatch20260820Snapshot(contract, translationsMissing)
    ).toThrow("both RU and EN");

    const sourceMissing = validSnapshot(contract);
    sourceMissing.sources.splice(0, 1);
    expect(() =>
      verifyBookCoverBatch20260820Snapshot(contract, sourceMissing)
    ).toThrow("source provenance");
  });

  it("accepts only the pinned production Supabase project without exposing secrets", () => {
    const serviceRoleKey = "service-role-secret-never-log";
    const supabaseUrl = "https://sjqejjmwpzfsczxdghvw.supabase.co/";
    expect(
      resolveBookCoverBatchProductionEnvironment({
        VITE_SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      })
    ).toEqual({
      supabaseUrl: "https://sjqejjmwpzfsczxdghvw.supabase.co",
      serviceRoleKey,
    });
    expect(() =>
      resolveBookCoverBatchProductionEnvironment({
        VITE_SUPABASE_URL: "https://example.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      })
    ).toThrow("pinned production project");
    const redacted = redactBookCoverBatchSensitive(
      `Bearer ${serviceRoleKey} at ${supabaseUrl}`,
      [serviceRoleKey, supabaseUrl]
    );
    expect(redacted).not.toContain(serviceRoleKey);
    expect(redacted).not.toContain(supabaseUrl);
    expect(redacted).toBe("Bearer [REDACTED] at [REDACTED]");
  });

  it("uses the cover contract only as postflight for one full atomic release", () => {
    const source = readFileSync(workflowPath, "utf8");
    const workflow = parse(source);
    expect(workflow.on).toEqual({
      workflow_dispatch: {
        inputs: expect.objectContaining({
          expected_main_sha: expect.objectContaining({ required: true }),
          confirmation: expect.objectContaining({ required: true }),
        }),
      },
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual({
      group: "production-database-reconciliation",
      "cancel-in-progress": false,
    });
    expect(workflow.jobs.reconcile.environment).toEqual({ name: "production" });
    expect(workflow.jobs.reconcile.if).toBe("github.ref == 'refs/heads/main'");

    expect(source).toContain("RECONCILE PRODUCTION DATABASE");
    expect(source).toContain("^[0-9a-f]{40}$");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("node-version: 24");
    expect(source).toContain("npm ci");
    expect(source).toContain("secrets.VITE_SUPABASE_URL");
    expect(source).toContain("secrets.SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("git ls-remote --exit-code origin refs/heads/main");

    const migrationVerification =
      "Verify production schema health and invariants";
    const credentialValidation =
      "Validate the pinned atomic archive service credential";
    const install = "Install the locked dependency graph for the archive release";
    const preflight = "Run the read-only full archive preflight";
    const reconfirm = "Reconfirm the exact main tip before the archive commit";
    const apply = "Publish the full literary archive in one atomic commit";
    const postflight = "Run the read-only atomic archive postflight";
    const applyCommand = "node scripts/sync-literary-archive.mjs --apply";
    for (const [before, after] of [
      [migrationVerification, credentialValidation],
      [credentialValidation, install],
      [install, preflight],
      [preflight, reconfirm],
      [reconfirm, apply],
      [apply, postflight],
    ]) {
      expect(source.indexOf(before)).toBeLessThan(source.indexOf(after));
    }
    expect(source.lastIndexOf("git ls-remote --exit-code origin refs/heads/main"))
      .toBeLessThan(source.indexOf(applyCommand));
    expect(source.match(/node scripts\/sync-literary-archive\.mjs --apply/gu))
      .toHaveLength(1);
    expect(source.match(/node scripts\/sync-literary-archive\.mjs --preflight/gu))
      .toHaveLength(1);
    expect(source.match(/node scripts\/sync-literary-archive\.mjs --postflight/gu))
      .toHaveLength(1);
    expect(source.match(/--receipt-file reconciliation\/literary-archive-release-receipt\.json/gu))
      .toHaveLength(2);
    expect(source).not.toContain("--batch-2026-08-20 --apply");
    const coverVerifier =
      "node scripts/database/verify-book-cover-batch-20260820.mjs";
    expect(source.lastIndexOf(coverVerifier)).toBeGreaterThan(
      source.indexOf(applyCommand)
    );
    expect(source.lastIndexOf(coverVerifier)).toBeGreaterThan(
      source.indexOf(postflight)
    );
    expect(source).not.toMatch(/echo[^\n]*(?:VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=/u);
    expect(source).not.toMatch(/^\s*(?:push|pull_request|schedule):/mu);
  });
});
