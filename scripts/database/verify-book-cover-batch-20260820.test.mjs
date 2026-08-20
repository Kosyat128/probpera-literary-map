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
  ".github/workflows/sync-book-cover-batch-20260820.yml"
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

describe("2026-08-20 production book-cover batch verification", () => {
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

  it("keeps the manual workflow immutable, read-only until apply, and exact", () => {
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
      group: "production-book-cover-batch-20260820",
      "cancel-in-progress": false,
    });
    expect(workflow.jobs.sync.environment).toEqual({ name: "production" });
    expect(workflow.jobs.sync.if).toBe("github.ref == 'refs/heads/main'");

    expect(source).toContain("SYNC BOOK COVER BATCH 20260820");
    expect(source).toContain("^[0-9a-f]{40}$");
    expect(source).toContain("ref: ${{ inputs.expected_main_sha }}");
    expect(source).toContain("persist-credentials: false");
    expect(source).toContain("node-version: 24");
    expect(source).toContain("npm ci");
    expect(source).toContain("secrets.VITE_SUPABASE_URL");
    expect(source).toContain("secrets.SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("git ls-remote --exit-code origin refs/heads/main");

    const dryRun = "Validate the repository batch without database access";
    const preflight = "Run the read-only production schema and data preflight";
    const apply = "Reconfirm remote main and apply the idempotent batch";
    const applyCommand =
      "node scripts/sync-literary-archive.mjs --batch-2026-08-20 --apply";
    const verify =
      "Verify the exact production batch through the service role";
    expect(source.indexOf(dryRun)).toBeLessThan(source.indexOf(preflight));
    expect(source.indexOf(preflight)).toBeLessThan(source.indexOf(apply));
    expect(source.indexOf(apply)).toBeLessThan(
      source.lastIndexOf("git ls-remote --exit-code origin refs/heads/main")
    );
    expect(
      source.lastIndexOf("git ls-remote --exit-code origin refs/heads/main")
    ).toBeLessThan(source.indexOf(applyCommand));
    expect(source.indexOf(applyCommand)).toBeLessThan(source.lastIndexOf(verify));
    expect(source).toMatch(
      /node scripts\/sync-literary-archive\.mjs --batch-2026-08-20\s+--preflight/u
    );
    expect(source).toContain(applyCommand);
    expect(source).toContain(
      "node scripts/database/verify-book-cover-batch-20260820.mjs"
    );
    expect(source).not.toMatch(/echo[^\n]*(?:VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=/u);
    expect(source).not.toMatch(/^\s*(?:push|pull_request|schedule):/mu);
  });
});
