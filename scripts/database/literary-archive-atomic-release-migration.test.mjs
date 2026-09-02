import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LITERARY_ARCHIVE_CHILD_EDIT_PRESERVATION_SCHEMA,
  encodeLiteraryArchiveReleaseItem,
  literaryArchiveReleaseBatchManifestSha256,
  literaryArchiveReleaseCommitArgs,
  literaryArchiveReleaseCreateArgs,
  literaryArchiveReleaseLegacyIdManifestSha256,
  literaryArchiveReleaseLogicalTargetManifestSha256,
  literaryArchiveReleasePostReleasePredecessorExpectation,
  literaryArchiveReleaseStageArgs,
  literaryArchiveReleaseTargetManifestSha256,
  partitionLiteraryArchiveReleaseItems,
  verifiedLiteraryArchiveManifestFromReceipts,
} from "../lib/literary-archive-atomic-release.mjs";

const root = path.resolve(process.cwd());
const read = (file) =>
  readFileSync(path.join(root, file), "utf8").replace(/\r\n?/gu, "\n");
const migration = read(
  "supabase/migrations/20260902_zz_literary_archive_atomic_release.sql"
);
const evidenceMigration = read(
  "supabase/migrations/20260902_literary_work_evidence_v2_attestations.sql"
);

const childEditPreservation = Object.freeze({
  schemaVersion: LITERARY_ARCHIVE_CHILD_EDIT_PRESERVATION_SCHEMA,
  evidenceEvents: 5,
  protectedWorks: 2,
  evidenceSha256: "9".repeat(64),
  auditHighWaterId: "41",
  outboxHighWaterId: "73",
});

function functionBody(name) {
  const pattern = new RegExp(
    `create or replace function\\s+public\\.${name}\\([\\s\\S]+?\\n\\$\\$;`,
    "iu"
  );
  const match = migration.match(pattern);
  if (!match) throw new Error(`Function ${name} not found.`);
  return match[0];
}

function functionParameterSignature(name) {
  const pattern = new RegExp(
    `create or replace function\\s+public\\.${name}\\((?<parameters>[\\s\\S]+?)\\n\\)\\nreturns`,
    "iu"
  );
  const parameters = migration.match(pattern)?.groups?.parameters;
  if (!parameters) throw new Error(`Function ${name} signature not found.`);
  return parameters.split(",\n").map((parameter) => {
    const [parameterName, parameterType] = parameter.trim().split(/\s+/u);
    return `${parameterName}:${parameterType}`;
  });
}

function item(ordinal, existing = true) {
  const legacyId = `country:writer:work-${ordinal}`;
  return {
    ordinal,
    legacyId,
    expectedLive: existing
      ? {
          exists: true,
          updatedAt: "2026-09-02T00:00:00.000Z",
          integritySha256: "a".repeat(64),
        }
      : { exists: false, updatedAt: null, integritySha256: null },
    work: { legacy_id: legacyId },
    expectedContent: { work: { legacyId } },
    authors: [],
    translations: [],
    sources: [],
    externalIds: [],
    editions: [],
    artworks: [],
    attestation: null,
  };
}

describe("atomic literary archive release migration", () => {
  it("keeps the create RPC on its exact twelve-argument contract", () => {
    expect(functionParameterSignature("create_literary_archive_release")).toEqual([
      "p_release_key:text",
      "p_source_revision:text",
      "p_expected_item_count:integer",
      "p_expected_batch_count:integer",
      "p_expected_unlocked_work_count:integer",
      "p_expected_unlocked_scope_sha256:text",
      "p_expected_child_edit_preservation:jsonb",
      "p_expected_target_manifest_sha256:text",
      "p_expected_predecessor_public_count:integer",
      "p_expected_predecessor_public_manifest_sha256:text",
      "p_enable_evidence_v2:boolean",
      "p_metadata:jsonb",
    ]);
    const sqlSignature = `public.create_literary_archive_release(
  text,
  text,
  integer,
  integer,
  integer,
  text,
  jsonb,
  text,
  integer,
  text,
  boolean,
  jsonb
)`;
    expect(migration).toContain(`revoke all on function ${sqlSignature}`);
    expect(migration).toContain(`grant execute on function ${sqlSignature}`);
  });

  it("keeps all staging private, FORCE-RLS and RPC-write-only", () => {
    for (const table of [
      "literary_archive_releases",
      "literary_archive_release_batches",
      "literary_archive_release_items",
      "literary_archive_child_edit_preservations",
      "literary_archive_child_edit_preservation_controls",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} force row level security;`
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}[\\s\\S]+?from public, anon, authenticated, service_role;`,
          "iu"
        )
      );
      expect(migration).not.toMatch(
        new RegExp(
          `grant\\s+(?:all|insert|update|delete)[\\s\\S]{0,80}public\\.${table}`,
          "iu"
        )
      );
    }
    for (const rpc of [
      "create_literary_archive_release",
      "stage_literary_archive_release_batch",
      "commit_literary_archive_release",
    ]) {
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\(`, "iu")
      );
    }
  });

  it("never mutates a live publication table before the single commit RPC", () => {
    const createBody = functionBody("create_literary_archive_release");
    const stageBody = functionBody("stage_literary_archive_release_batch");
    for (const body of [createBody, stageBody]) {
      expect(body).not.toMatch(
        /(?:insert into|update|delete from) public\.(?:literary_works|literary_work_authors|literary_work_translations|literary_work_sources|literary_work_external_ids|book_editions|literary_work_cover_artworks)/iu
      );
    }
    expect(migration).not.toMatch(/^\s*(?:begin|commit|rollback)\s*;/gimu);
  });

  it("bounds batches and signs every item, batch and complete manifest server-side", () => {
    const stageBody = functionBody("stage_literary_archive_release_batch");
    const commitBody = functionBody("commit_literary_archive_release");
    expect(stageBody).toContain("incoming_count not between 1 and 100");
    expect(stageBody).toContain("canonicalPayload");
    expect(stageBody).toContain(
      "public.literary_work_evidence_v2_sha256(canonical_payload)"
    );
    expect(stageBody).toContain(
      "Staging envelope identity does not match its payload"
    );
    expect(migration).toContain(
      "Release item legacyId must be an exact non-padded string"
    );
    expect(migration).toContain(
      "item_legacy_id is distinct from btrim(item_legacy_id)"
    );
    expect(migration).toContain(
      "item_legacy_id ~ '(^[[:space:]])|([[:space:]]$)'"
    );
    expect(stageBody).toContain("payloadSha256");
    expect(stageBody).toContain("incoming_batch_sha256");
    expect(stageBody).toContain("literary_archive_release_manifest_sha256");
    expect(commitBody).toContain("item.payload_sha256 <>");
    expect(commitBody).toContain("batch.batch_sha256 <>");
    expect(commitBody).toContain(
      "recomputed_manifest_sha256 <> p_expected_manifest_sha256"
    );
    expect(commitBody).toContain(
      "target.expected_target_manifest_sha256 is distinct from"
    );
    expect(commitBody).toContain(
      "item.payload is distinct from item.canonical_payload::jsonb"
    );
    expect(commitBody).toContain("min(item.ordinal) = 0");
    expect(commitBody).toContain("min(batch.batch_number) = 1");
  });

  it("locks every live relation and rejects CMS, existence and content races", () => {
    const commitBody = functionBody("commit_literary_archive_release");
    expect(commitBody).toContain("pg_catalog.pg_advisory_xact_lock(");
    expect(commitBody).toContain("in share row exclusive mode nowait;");
    for (const table of [
      "public.literary_works",
      "public.literary_work_authors",
      "public.literary_work_translations",
      "public.literary_work_sources",
      "public.literary_work_external_ids",
      "public.book_editions",
      "public.literary_work_cover_artworks",
      "public.literary_work_evidence_v2_attestations",
      "public.literary_work_evidence_v2_controls",
    ]) {
      expect(commitBody).toContain(table);
    }
    expect(commitBody).toContain("item.expected_live_exists <> (work.id is not null)");
    expect(commitBody).toContain("work.is_cms_locked");
    expect(commitBody).toContain(
      "public.literary_work_evidence_v2_content_sha256(work.id)"
    );
    expect(commitBody).toContain(
      "public.literary_archive_release_unlocked_scope_sha256()"
    );
    expect(commitBody).toContain("for update nowait;");
    expect(commitBody).toContain(
      "'probpera.literary_archive_atomic_release'"
    );
    expect(commitBody.indexOf("for update nowait;")).toBeLessThan(
      commitBody.indexOf("delete from public.literary_works work")
    );
    expect(migration).toContain(
      "Evidence V2 attestation advisory-lock contract cannot be patched safely"
    );
    expect(
      evidenceMigration.match(
        /  perform pg_catalog\.pg_advisory_xact_lock\(\n    pg_catalog\.hashtextextended\(p_work_id::text, 20260902\)\n  \);/gu
      )
    ).toHaveLength(1);
    const invalidationBody = functionBody(
      "invalidate_literary_work_evidence_v2"
    );
    expect(invalidationBody).toContain("if not atomic_release_mode then");
    expect(invalidationBody).toContain(
      "'probpera.literary_archive_atomic_release'"
    );
    expect(migration.match(/pg_catalog\.pg_get_functiondef\(/gu).length).toBeGreaterThanOrEqual(4);
  });

  it("fully replaces unlocked archive scope and every child set while preserving CMS rows", () => {
    const commitBody = functionBody("commit_literary_archive_release");
    expect(commitBody).toContain("delete from public.literary_works work");
    expect(commitBody).toMatch(
      /delete from public\.literary_works work[\s\S]+?where not work\.is_cms_locked[\s\S]+?not exists/iu
    );
    for (const table of [
      "literary_work_authors",
      "literary_work_translations",
      "literary_work_sources",
      "literary_work_external_ids",
      "book_editions",
      "literary_work_cover_artworks",
    ]) {
      expect(commitBody).toContain(`delete from public.${table}`);
      expect(commitBody).toContain(`insert into public.${table}`);
    }
    expect(migration).toContain("'editions', coalesce((");
    expect(migration).toContain("'artworks', coalesce((");
    expect(migration).toContain("book_editions_invalidate_evidence_v2");
    expect(migration).toContain(
      "literary_work_cover_artworks_invalidate_evidence_v2"
    );
  });

  it("locks a parent on all non-service child edits", () => {
    expect(migration).toContain(
      "create or replace function public.lock_literary_work_parent_on_child_edit()"
    );
    expect(migration).toContain("is_cms_locked = true");
    expect(migration).toContain(
      "if coalesce((select auth.role()), '') = 'service_role' then"
    );
    expect(
      migration.match(/_lock_parent_on_edit\n\s+before insert or update or delete/gu)
    ).toHaveLength(6);
    const triggerBody = functionBody(
      "lock_literary_work_parent_on_child_edit"
    );
    expect(triggerBody.indexOf(
      "if coalesce((select auth.role()), '') = 'service_role' then"
    )).toBeLessThan(triggerBody.indexOf(
      "insert into public.literary_archive_child_edit_preservations"
    ));
    expect(triggerBody.indexOf(
      "insert into public.literary_archive_child_edit_preservations"
    )).toBeLessThan(triggerBody.indexOf("update public.literary_works work"));
    expect(triggerBody).toContain("source_payload_sha256");
  });

  it("backfills all historical child relations and fails closed on missing or ambiguous evidence", () => {
    for (const [relation, action] of [
      ["literary_work_translations", "literary_work_translation.updated"],
      ["literary_work_sources", "literary_work_source.updated"],
      ["literary_work_external_ids", "literary_work_external_id.updated"],
      ["book_editions", "book_edition.updated"],
      ["literary_work_cover_artworks", "literary_work_cover_artwork.updated"],
    ]) {
      expect(migration).toContain(`'${relation}'`);
      expect(migration).toContain(`'${action}'`);
    }
    expect(migration).toContain("and audit.actor_id is not null");
    expect(migration).toContain("and outbox.actor_id is not null");
    expect(migration).toContain(
      "has no provable parent work"
    );
    expect(migration).toContain("resolves to conflicting parents");
    expect(migration).toContain(
      "Historical child-edit event has ambiguous actor provenance"
    );
    expect(migration).toContain(
      "Manual child-row metadata exists without authoritative edit evidence"
    );
    expect(migration).toContain("translation.metadata ? 'premiumTranslation'");
    expect(migration).toContain("edition.metadata ? 'importedBy'");
    expect(migration).toContain(
      "perform public.literary_archive_child_edit_preservation_receipt();\n    return;"
    );
  });

  it("binds the preservation ledger receipt through create, commit and exact postflight", () => {
    const preservationReceiptBody = functionBody(
      "literary_archive_child_edit_preservation_receipt"
    );
    const createBody = functionBody("create_literary_archive_release");
    const commitBody = functionBody("commit_literary_archive_release");
    const postflightBody = functionBody("assert_literary_archive_live_target");
    expect(createBody).toContain(
      "public.literary_archive_child_edit_preservation_receipt()"
    );
    expect(preservationReceiptBody).toContain(
      "evidence.occurred_at at time zone 'UTC'"
    );
    expect(preservationReceiptBody).toContain(
      `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`
    );
    expect(preservationReceiptBody).not.toContain("evidence.occurred_at::text");
    expect(commitBody).toContain(
      "target.expected_child_edit_preservation"
    );
    expect(commitBody).toContain(
      "public.literary_archive_child_edit_preservations"
    );
    expect(commitBody).toContain(
      "public.literary_archive_child_edit_preservation_controls"
    );
    expect(postflightBody).toContain(
      "target.commit_receipt -> 'childEditPreservation'"
    );
  });

  it("attests exact post-replacement content and enables by predecessor manifest", () => {
    const commitBody = functionBody("commit_literary_archive_release");
    expect(commitBody).toContain("public.attest_literary_work_evidence_v2(");
    expect(commitBody).toContain(
      "public.literary_work_evidence_v2_predecessor_manifest_sha256()"
    );
    expect(commitBody).toContain(
      "public.set_literary_work_evidence_v2_enforcement("
    );
    expect(commitBody).toContain("predecessor_manifest_sha256");
    expect(commitBody).toContain(
      "public.literary_archive_release_predecessor_legacy_manifest_sha256()"
    );
    expect(commitBody).toContain(
      "target.expected_predecessor_public_manifest_sha256"
    );
    expect(commitBody).toContain(
      "and invalid_attestation_count <> 0 then"
    );
    expect(commitBody).toContain(
      "public.literary_work_evidence_v2_content(work.id)"
    );
    expect(commitBody).toContain(
      "is distinct from item.payload -> 'expectedContent'"
    );
  });

  it("provides a service-only statement-snapshot full live-target postflight", () => {
    const postflightBody = functionBody(
      "assert_literary_archive_live_target"
    );
    expect(postflightBody).toContain("Service role is required");
    expect(postflightBody).toContain("target.status <> 'committed'");
    expect(postflightBody).toContain(
      "public.literary_archive_release_manifest_sha256(target.id)"
    );
    expect(postflightBody).toContain(
      "public.literary_work_evidence_v2_content(work.id)"
    );
    expect(postflightBody).toContain("item.payload -> 'expectedContent'");
    expect(postflightBody).toContain("attestation.evidence_sha256");
    expect(postflightBody).toContain(
      "actual_predecessor_public_manifest_sha256"
    );
    expect(migration).toContain(
      "grant execute on function public.assert_literary_archive_live_target("
    );
    expect(migration).toContain(
      "'public.assert_literary_archive_live_target(uuid,text)'"
    );
  });

  it("makes create, stage and commit retries explicit and fail-closed", () => {
    expect(functionBody("create_literary_archive_release")).toContain(
      "Release key is already bound to a different manifest"
    );
    expect(functionBody("stage_literary_archive_release_batch")).toContain(
      "'idempotent', true"
    );
    expect(functionBody("commit_literary_archive_release")).toContain(
      "return target.commit_receipt || jsonb_build_object('idempotent', true)"
    );
  });
});

describe("atomic literary archive release client contract", () => {
  it("partitions exact contiguous items and builds the three RPC payloads", () => {
    const items = Array.from({ length: 205 }, (_, ordinal) =>
      item(ordinal, ordinal !== 204)
    );
    const batches = partitionLiteraryArchiveReleaseItems(items);
    const expectedTargetManifestSha256 =
      literaryArchiveReleaseTargetManifestSha256(items);
    const expectedPredecessorPublicManifestSha256 =
      literaryArchiveReleaseLegacyIdManifestSha256([
        "country:writer:work-0",
        "country:writer:work-1",
      ]);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);

    expect(
      literaryArchiveReleaseCreateArgs({
        releaseKey: "books:2026-09-02:abc1234",
        sourceRevision: "abc1234",
        expectedItemCount: 205,
        expectedBatchCount: 3,
        expectedUnlockedWorkCount: 204,
        expectedUnlockedScopeSha256: "c".repeat(64),
        expectedChildEditPreservation: childEditPreservation,
        expectedTargetManifestSha256,
        expectedPredecessorPublicCount: 48,
        expectedPredecessorPublicManifestSha256,
        enableEvidenceV2: true,
      })
    ).toMatchObject({
      p_expected_item_count: 205,
      p_expected_batch_count: 3,
      p_expected_unlocked_work_count: 204,
      p_expected_child_edit_preservation: childEditPreservation,
      p_expected_target_manifest_sha256: expectedTargetManifestSha256,
      p_expected_predecessor_public_manifest_sha256:
        expectedPredecessorPublicManifestSha256,
      p_enable_evidence_v2: true,
    });
    const stageArgs = literaryArchiveReleaseStageArgs("release-id", 1, batches[0]);
    expect(stageArgs).toEqual({
      p_release_id: "release-id",
      p_batch_number: 1,
      p_items: batches[0].map(encodeLiteraryArchiveReleaseItem),
    });
    expect(JSON.parse(stageArgs.p_items[0].canonicalPayload)).toEqual(items[0]);
    expect(
      literaryArchiveReleaseCommitArgs("release-id", "f".repeat(64))
    ).toEqual({
      p_release_id: "release-id",
      p_expected_manifest_sha256: "f".repeat(64),
    });
  });

  it("accepts only complete ordered server receipts and returns server manifest", () => {
    const items = [item(0), item(1)];
    const batches = partitionLiteraryArchiveReleaseItems(items, 1);
    const targetManifestSha256 =
      literaryArchiveReleaseTargetManifestSha256(items);
    const receipts = batches.map((batch, index) => ({
      releaseId: "release-id",
      batchNumber: index + 1,
      itemCount: 1,
      batchSha256: literaryArchiveReleaseBatchManifestSha256(batch),
      items: [
        {
          ordinal: batch[0].ordinal,
          legacyId: batch[0].legacyId,
          payloadSha256: encodeLiteraryArchiveReleaseItem(batch[0]).payloadSha256,
          payload: batch[0],
        },
      ],
      stagedItems: index + 1,
      stagedBatches: index + 1,
      manifestSha256: index === batches.length - 1
        ? targetManifestSha256
        : "b".repeat(64),
    }));
    expect(
      verifiedLiteraryArchiveManifestFromReceipts({
        releaseId: "release-id",
        batches,
        receipts,
      })
    ).toBe(targetManifestSha256);
    receipts[1].items[0].payload = {
      ...receipts[1].items[0].payload,
      legacyId: "mutated",
    };
    expect(() =>
      verifiedLiteraryArchiveManifestFromReceipts({
        releaseId: "release-id",
        batches,
        receipts,
      })
    ).toThrow(/item receipt mismatch/iu);
  });

  it("changes exact target/public manifests on any staged or membership mutation", () => {
    const original = [item(0), item(1)];
    const mutated = [
      item(0),
      {
        ...item(1),
        work: { legacy_id: item(1).legacyId, title: "Mutated" },
        expectedContent: {
          work: { legacyId: item(1).legacyId, title: "Mutated" },
        },
      },
    ];
    expect(literaryArchiveReleaseTargetManifestSha256(mutated)).not.toBe(
      literaryArchiveReleaseTargetManifestSha256(original)
    );
    expect(
      literaryArchiveReleaseLegacyIdManifestSha256([original[0].legacyId])
    ).not.toBe(
      literaryArchiveReleaseLegacyIdManifestSha256(
        original.map((entry) => entry.legacyId)
      )
    );
    expect(
      literaryArchiveReleaseLogicalTargetManifestSha256(mutated)
    ).not.toBe(literaryArchiveReleaseLogicalTargetManifestSha256(original));
  });

  it("rejects padded identity and includes preserved CMS works in the post-release manifest", () => {
    const padded = item(0);
    padded.legacyId = ` ${padded.legacyId} `;
    expect(() => partitionLiteraryArchiveReleaseItems([padded])).toThrow(
      /without surrounding whitespace/iu
    );
    expect(() =>
      literaryArchiveReleaseLegacyIdManifestSha256([" valid:id "])
    ).toThrow(/without surrounding whitespace/iu);
    const tabPadded = item(0);
    tabPadded.legacyId = `\t${tabPadded.legacyId}`;
    expect(() => encodeLiteraryArchiveReleaseItem(tabPadded)).toThrow(
      /without surrounding whitespace/iu
    );

    const targetPredecessorLegacyIds = ["country:writer:target"];
    const preservedCmsLockedPredecessorLegacyIds = [
      "country:writer:cms-locked",
    ];
    const expectation =
      literaryArchiveReleasePostReleasePredecessorExpectation({
        targetPredecessorLegacyIds,
        preservedCmsLockedPredecessorLegacyIds,
      });
    expect(expectation).toEqual({
      expectedPredecessorPublicCount: 2,
      expectedPredecessorPublicManifestSha256:
        literaryArchiveReleaseLegacyIdManifestSha256([
          ...targetPredecessorLegacyIds,
          ...preservedCmsLockedPredecessorLegacyIds,
        ]),
    });
    expect(migration).toContain("'cmsLockedPredecessorLegacyIds'");
    expect(migration).toContain(
      "'cmsLockedUnattestedPredecessorLegacyIds'"
    );
    expect(migration).toContain(
      "not public.is_literary_work_evidence_v2_attested(work.id)"
    );
    expect(() =>
      literaryArchiveReleasePostReleasePredecessorExpectation({
        targetPredecessorLegacyIds,
        preservedCmsLockedPredecessorLegacyIds:
          targetPredecessorLegacyIds,
      })
    ).toThrow(/duplicates/iu);
  });
});
