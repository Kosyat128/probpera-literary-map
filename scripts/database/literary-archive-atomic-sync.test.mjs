import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LITERARY_ARCHIVE_CHILD_EDIT_PRESERVATION_SCHEMA,
  LITERARY_ARCHIVE_RELEASE_CONTRACT,
  encodeLiteraryArchiveReleaseItem,
  isLiteraryArchiveReleasePreEvidencePublishable,
  literaryArchiveReleaseBatchManifestSha256,
  literaryArchiveReleaseLogicalTargetManifestSha256,
  literaryArchiveReleasePostReleasePredecessorExpectation,
  literaryArchiveReleaseTargetManifestSha256,
  literaryArchiveReleaseUnlockedScopeSha256,
  publishLiteraryArchiveAtomicRelease,
  validateLiteraryArchiveReleasePrecondition,
} from "../lib/literary-archive-atomic-release.mjs";

const root = path.resolve(process.cwd());
const read = (file) =>
  readFileSync(path.join(root, file), "utf8").replace(/\r\n?/gu, "\n");
const syncSource = read("scripts/sync-literary-archive.mjs");
const helperSource = read("scripts/lib/literary-archive-atomic-release.mjs");

function item(ordinal) {
  const legacyId = `country:writer:work-${ordinal}`;
  return {
    ordinal,
    legacyId,
    expectedLive: {
      exists: true,
      updatedAt: "2026-09-02T00:00:00.000Z",
      integritySha256: "a".repeat(64),
    },
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

const childEditPreservation = Object.freeze({
  schemaVersion: LITERARY_ARCHIVE_CHILD_EDIT_PRESERVATION_SCHEMA,
  evidenceEvents: 5,
  protectedWorks: 2,
  evidenceSha256: "9".repeat(64),
  auditHighWaterId: "41",
  outboxHighWaterId: "73",
});

const precondition = Object.freeze({
  childEditPreservation,
  unlockedWorks: 2,
  unlockedScopeSha256: "b".repeat(64),
  predecessorPublic: 2,
  predecessorLegacyManifestSha256: "c".repeat(64),
  cmsLockedPredecessorLegacyIds: ["country:writer:cms-locked"],
  cmsLockedUnattestedPredecessorLegacyIds: [],
});

function mockAtomicClient(items, options = {}) {
  const calls = [];
  const state = {
    committed: false,
    staged: new Map(),
  };
  const targetManifestSha256 =
    literaryArchiveReleaseTargetManifestSha256(items);
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ name, args: structuredClone(args) });
        if (name === "get_literary_archive_release_precondition") {
          return {
            data: structuredClone(
              options.driftPrecondition
                ? { ...precondition, unlockedWorks: 3 }
                : options.driftPreservation
                  ? {
                      ...precondition,
                      childEditPreservation: {
                        ...childEditPreservation,
                        evidenceSha256: "8".repeat(64),
                      },
                    }
                : precondition
            ),
            error: null,
          };
        }
        if (name === "create_literary_archive_release") {
          return {
            data: {
              releaseId: "00000000-0000-4000-8000-000000000001",
              releaseKey: args.p_release_key,
              sourceRevision: args.p_source_revision,
              contractVersion: LITERARY_ARCHIVE_RELEASE_CONTRACT,
              status: state.committed ? "committed" : "staging",
              expectedItems: args.p_expected_item_count,
              expectedBatches: args.p_expected_batch_count,
              expectedChildEditPreservation:
                args.p_expected_child_edit_preservation,
              expectedTargetManifestSha256:
                args.p_expected_target_manifest_sha256,
            },
            error: null,
          };
        }
        if (name === "stage_literary_archive_release_batch") {
          const payloads = args.p_items.map((envelope) =>
            JSON.parse(envelope.canonicalPayload)
          );
          state.staged.set(args.p_batch_number, payloads);
          const stagedItems = [...state.staged.values()].flat().length;
          const receiptItems = payloads.map((payload, index) => ({
            ordinal: payload.ordinal,
            legacyId: payload.legacyId,
            payloadSha256: args.p_items[index].payloadSha256,
            payload:
              options.mutateEcho && args.p_batch_number === 1 && index === 0
                ? { ...payload, legacyId: "mutated" }
                : payload,
          }));
          return {
            data: {
              releaseId: args.p_release_id,
              batchNumber: args.p_batch_number,
              itemCount: payloads.length,
              batchSha256:
                literaryArchiveReleaseBatchManifestSha256(payloads),
              items: receiptItems,
              stagedItems,
              stagedBatches: state.staged.size,
              manifestSha256:
                stagedItems === items.length
                  ? targetManifestSha256
                  : "d".repeat(64),
              idempotent: state.committed,
            },
            error: null,
          };
        }
        if (name === "commit_literary_archive_release") {
          const idempotent = state.committed;
          state.committed = true;
          if (options.loseFirstCommitResponse && !idempotent) {
            return {
              data: null,
              error: { message: "simulated lost commit response" },
            };
          }
          return {
            data: {
              releaseId: args.p_release_id,
              releaseKey: "books:release-contract",
              sourceRevision: "source-revision",
              contractVersion: LITERARY_ARCHIVE_RELEASE_CONTRACT,
              status: "committed",
              manifestSha256: args.p_expected_manifest_sha256,
              items: items.length,
              batches: Math.ceil(items.length / 100),
              childEditPreservation,
              idempotent,
            },
            error: null,
          };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
    },
  };
}

function publishArgs(client, items) {
  return {
    supabase: client,
    items,
    expectedPrecondition: precondition,
    releaseKey: "books:release-contract",
    sourceRevision: "source-revision",
    expectedPredecessorPublicCount: 2,
    expectedPredecessorPublicManifestSha256: "e".repeat(64),
    enableEvidenceV2: false,
  };
}

describe("atomic literary archive sync integration", () => {
  it("has no direct live mutation path and commits only after exact receipt verification", () => {
    expect(syncSource).not.toMatch(/\.(?:upsert|insert|delete)\(/u);
    expect(syncSource).not.toMatch(
      /\.from\([^)]*\)[\s\S]{0,240}?\.update\(/u
    );
    expect(syncSource).not.toContain("sync_literary_work_authorship_batch");
    expect(syncSource).not.toContain("sync_literary_work_evidence_v2_batch");
    expect(syncSource).toContain("publishLiteraryArchiveAtomicRelease({");
    for (const stagedField of [
      "authors: authorRowsForWork.map(withoutWorkId)",
      "translations: translationRowsForWork.map(withoutWorkId)",
      "sources: sourceRowsForWork.map(withoutWorkId)",
      "externalIds: externalIdRowsForWork.map(withoutWorkId)",
      "editions: editionRowsForWork.map(withoutWorkId)",
      "artworks: artworkRowsForWork.map(withoutWorkId)",
      "expectedContent,",
      "attestation: evidenceCandidate",
    ]) {
      expect(syncSource).toContain(stagedField);
    }
    expect(helperSource.indexOf('"create_literary_archive_release"')).toBeLessThan(
      helperSource.indexOf('"stage_literary_archive_release_batch"')
    );
    expect(helperSource.indexOf("verifiedLiteraryArchiveManifestFromReceipts({")).toBeLessThan(
      helperSource.indexOf('"commit_literary_archive_release"')
    );
  });

  it("keeps local dry-run credential-free and exits preflight before staging", () => {
    const localExit = syncSource.indexOf(
      "if (!applyChanges && !preflightOnly && !postflightOnly)"
    );
    const credentialRead = syncSource.indexOf("const supabaseUrl =");
    const preflightExit = syncSource.indexOf("if (preflightOnly)");
    const publish = syncSource.indexOf(
      "publishLiteraryArchiveAtomicRelease({"
    );
    expect(localExit).toBeGreaterThan(-1);
    expect(localExit).toBeLessThan(credentialRead);
    expect(preflightExit).toBeGreaterThan(credentialRead);
    expect(preflightExit).toBeLessThan(publish);
    expect(syncSource.slice(preflightExit, publish)).toContain(
      "process.exit(0)"
    );
  });

  it("binds a read-only full postflight to the durable release receipt", () => {
    const postflight = syncSource.indexOf("if (postflightOnly)");
    const publish = syncSource.indexOf(
      "publishLiteraryArchiveAtomicRelease({"
    );
    expect(postflight).toBeGreaterThan(-1);
    expect(postflight).toBeLessThan(publish);
    const postflightSource = syncSource.slice(postflight, publish);
    expect(postflightSource).toContain("readAtomicWorkflowReceipt()");
    expect(postflightSource).toContain("assertAtomicLiveTarget(supabase");
    expect(postflightSource).toContain(
      "workflowReceipt.logicalTargetManifestSha256"
    );
    expect(syncSource).toContain(
      '"assert_literary_archive_live_target"'
    );
    expect(syncSource).toContain(
      "literaryArchiveReleaseLogicalTargetManifestSha256(releaseItems)"
    );
    expect(syncSource).toContain('{ encoding: "utf8", flag: "wx" }');

    const original = [item(0), item(1)];
    const reordered = [item(1), item(0)];
    expect(
      literaryArchiveReleaseLogicalTargetManifestSha256(reordered)
    ).toBe(literaryArchiveReleaseLogicalTargetManifestSha256(original));
    const mutated = [
      item(0),
      {
        ...item(1),
        expectedContent: {
          work: { legacyId: item(1).legacyId, title: "Changed" },
        },
      },
    ];
    expect(
      literaryArchiveReleaseLogicalTargetManifestSha256(mutated)
    ).not.toBe(literaryArchiveReleaseLogicalTargetManifestSha256(original));
  });

  it("stages bounded batches in order and binds create, echo, manifest and commit", async () => {
    const items = Array.from({ length: 205 }, (_, ordinal) => item(ordinal));
    const { client, calls } = mockAtomicClient(items);
    const result = await publishLiteraryArchiveAtomicRelease(
      publishArgs(client, items)
    );
    expect(result.targetManifestSha256).toBe(
      literaryArchiveReleaseTargetManifestSha256(items)
    );
    expect(calls.map((call) => call.name)).toEqual([
      "get_literary_archive_release_precondition",
      "create_literary_archive_release",
      "stage_literary_archive_release_batch",
      "stage_literary_archive_release_batch",
      "stage_literary_archive_release_batch",
      "commit_literary_archive_release",
    ]);
    const stageCalls = calls.filter(
      (call) => call.name === "stage_literary_archive_release_batch"
    );
    expect(stageCalls.map((call) => call.args.p_batch_number)).toEqual([1, 2, 3]);
    expect(stageCalls.map((call) => call.args.p_items.length)).toEqual([
      100,
      100,
      5,
    ]);
    expect(stageCalls[0].args.p_items[0]).toEqual(
      encodeLiteraryArchiveReleaseItem(items[0])
    );
  });

  it("is retry-safe and accepts durable idempotent create, stage and commit receipts", async () => {
    const items = [item(0), item(1)];
    const { client } = mockAtomicClient(items);
    const first = await publishLiteraryArchiveAtomicRelease(
      publishArgs(client, items)
    );
    const retry = await publishLiteraryArchiveAtomicRelease(
      publishArgs(client, items)
    );
    expect(first.commitReceipt.idempotent).toBe(false);
    expect(retry.createReceipt.status).toBe("committed");
    expect(retry.stageReceipts.every((receipt) => receipt.idempotent)).toBe(true);
    expect(retry.commitReceipt.idempotent).toBe(true);
    expect(retry.targetManifestSha256).toBe(first.targetManifestSha256);
  });

  it("retries an ambiguous commit response against the same durable release", async () => {
    const items = [item(0), item(1)];
    const { client, calls } = mockAtomicClient(items, {
      loseFirstCommitResponse: true,
    });
    const result = await publishLiteraryArchiveAtomicRelease({
      ...publishArgs(client, items),
      rpcRetryDelayMs: 0,
    });
    expect(
      calls.filter((call) => call.name === "commit_literary_archive_release")
    ).toHaveLength(2);
    expect(result.commitReceipt.idempotent).toBe(true);
  });

  it("fails before create on precondition drift and before commit on echo mutation", async () => {
    const items = [item(0), item(1)];
    const drift = mockAtomicClient(items, { driftPrecondition: true });
    await expect(
      publishLiteraryArchiveAtomicRelease(publishArgs(drift.client, items))
    ).rejects.toThrow(/precondition drifted/iu);
    expect(drift.calls.map((call) => call.name)).toEqual([
      "get_literary_archive_release_precondition",
    ]);

    const echo = mockAtomicClient(items, { mutateEcho: true });
    await expect(
      publishLiteraryArchiveAtomicRelease(publishArgs(echo.client, items))
    ).rejects.toThrow(/item receipt mismatch/iu);
    expect(echo.calls.some((call) => call.name === "commit_literary_archive_release")).toBe(false);
  });

  it("strictly validates the precondition and preserves locked predecessor membership", () => {
    expect(validateLiteraryArchiveReleasePrecondition(precondition)).toEqual(
      precondition
    );
    expect(() =>
      validateLiteraryArchiveReleasePrecondition({
        ...precondition,
        unknown: true,
      })
    ).toThrow(/unknown schema/iu);
    expect(
      literaryArchiveReleasePostReleasePredecessorExpectation({
        targetPredecessorLegacyIds: ["country:writer:target"],
        preservedCmsLockedPredecessorLegacyIds:
          precondition.cmsLockedPredecessorLegacyIds,
      }).expectedPredecessorPublicCount
    ).toBe(2);
    expect(syncSource).toContain(
      "precondition.cmsLockedPredecessorLegacyIds"
    );
    expect(syncSource).toContain(
      "preconditionBefore.cmsLockedUnattestedPredecessorLegacyIds"
    );
    expect(syncSource).toContain(
      "CMS-locked predecessor-public works without a valid current attestation"
    );
    expect(
      syncSource.indexOf(
        "preconditionBefore.cmsLockedUnattestedPredecessorLegacyIds"
      )
    ).toBeLessThan(syncSource.indexOf("fetchAllLiveWorks(supabase)"));
    expect(
      syncSource.indexOf(
        "preconditionBefore.cmsLockedUnattestedPredecessorLegacyIds"
      )
    ).toBeLessThan(
      syncSource.indexOf("publishLiteraryArchiveAtomicRelease({")
    );
    expect(syncSource).toContain("!lockedLegacyIds.has(work.legacy_id)");
    expect(syncSource).toContain(
      "localUnlockedScopeSha256 !== preconditionBefore.unlockedScopeSha256"
    );
    expect(syncSource).toContain("precondition.childEditPreservation");
    expect(() =>
      validateLiteraryArchiveReleasePrecondition({
        ...precondition,
        childEditPreservation: undefined,
      })
    ).toThrow(/child-edit preservation receipt is invalid/iu);
    expect(() =>
      validateLiteraryArchiveReleasePrecondition({
        ...precondition,
        cmsLockedUnattestedPredecessorLegacyIds: ["country:writer:unknown"],
      })
    ).toThrow(/not in the locked set/iu);
  });

  it("fails before private staging when the preservation receipt drifts", async () => {
    const items = [item(0), item(1)];
    const drift = mockAtomicClient(items, { driftPreservation: true });
    await expect(
      publishLiteraryArchiveAtomicRelease(publishArgs(drift.client, items))
    ).rejects.toThrow(/precondition drifted/iu);
    expect(drift.calls.map((call) => call.name)).toEqual([
      "get_literary_archive_release_precondition",
    ]);
  });

  it("reproduces the exact PostgreSQL unlocked-scope receipt across time zones", () => {
    const integritySha256 = "f".repeat(64);
    const utc = literaryArchiveReleaseUnlockedScopeSha256([
      {
        legacyId: "country:writer:one",
        updatedAt: "2026-09-02T03:04:05.1234Z",
        integritySha256,
      },
    ]);
    const offset = literaryArchiveReleaseUnlockedScopeSha256([
      {
        legacyId: "country:writer:one",
        updatedAt: "2026-09-02T06:04:05.123400+03:00",
        integritySha256,
      },
    ]);
    expect(offset).toBe(utc);
    expect(() =>
      literaryArchiveReleaseUnlockedScopeSha256([
        {
          legacyId: " padded ",
          updatedAt: "2026-09-02T03:04:05Z",
          integritySha256,
        },
      ])
    ).toThrow(/without surrounding whitespace/iu);
  });

  it("mirrors the exact predecessor publication gate for staged RU/EN rows", () => {
    const ruDescription = `${"Русское описание произведения ".repeat(5).trim()}. ${"Второе проверенное предложение ".repeat(4).trim()}.`;
    const enDescription = `${"English description of the literary work ".repeat(4).trim()}. ${"A second verified sentence ".repeat(4).trim()}.`;
    const sourceUrl = "https://authority.example/work";
    const staged = {
      ...item(0),
      work: {
        legacy_id: item(0).legacyId,
        editorial_status: "verified",
      },
      sources: [
        {
          provider: "authority",
          source_url: sourceUrl,
          field_names: ["title", "description"],
          license_name: null,
          usage: "reference-only",
          retrieved_at: "2026-09-02",
        },
      ],
      translations: [
        {
          locale: "ru",
          title: "Русское название",
          description: ruDescription,
          source_language: "ru",
          translation_method: "editorial-original",
          editorial_status: "verified",
          source_urls: [sourceUrl],
          reviewed_at: "2026-09-02",
        },
        {
          locale: "en",
          title: "English title",
          description: enDescription,
          source_language: "en",
          translation_method: "human-translation",
          editorial_status: "verified",
          source_urls: [sourceUrl],
          reviewed_at: "2026-09-02",
        },
      ],
    };
    expect(isLiteraryArchiveReleasePreEvidencePublishable(staged)).toBe(true);
    staged.translations[1].description += " Кириллица.";
    expect(isLiteraryArchiveReleasePreEvidencePublishable(staged)).toBe(false);
  });
});
