import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import manifest from "./literary-news-correction-recovery-20261002.json" with { type: "json" };
import { CORRECTION_RECOVERY_MANIFEST_SHA256, recoverNewsCorrections, runCorrectionRecovery } from "./recover-literary-news-corrections.mjs";
import { newsSocialPayloadDigest } from "./lib/literary-news-social.mjs";

const current = new Date("2026-10-02T05:00:00Z"), expectedHead = "a".repeat(40);
const env = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "Kosyat128/probpera-literary-map", GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: expectedHead, GITHUB_RUN_ID: "42", SUPABASE_URL: "https://sjqejjmwpzfsczxdghvw.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key" };
async function fixture() {
  const rows = new Map(), history = new Map();
  for (const [index, key] of manifest.jobKeys.entries()) {
    const [, , encodedNewsId, platform, id] = key.split(":"), newsId = decodeURIComponent(encodedNewsId);
    const payload = { text: `Exact fixture message ${index}.`, entities: [], link_preview_options: { is_disabled: true } };
    const prepared = { newsId, platform, profile: "literary-news-text-v1", textRevision: "c".repeat(64),
      revision: "a".repeat(64), payload, payloadSha256: await newsSocialPayloadDigest(payload), media: null };
    const acknowledged = { key, newsId, destination: { platform, id }, status: "sent_current", remoteId: String(index + 1),
      remoteMediaKind: "text", prepared, acknowledgedRevision: prepared.revision, acknowledgedAt: "2026-10-01T12:00:00Z",
      firstAcknowledgedAt: null, operatorDecision: { actorId: "retained-operator", reason: "Retained prior decision" } };
    history.set(key, { id: index * 2 + 1, state: structuredClone(acknowledged) });
    rows.set(key, { id: index * 2 + 2, state: { ...structuredClone(acknowledged), status: "blocked",
      prepared: { ...structuredClone(prepared), revision: "b".repeat(64) }, desiredRevision: "b".repeat(64),
      lastError: "telegram_request_rejected", attemptId: "stale-attempt", runnerId: "stale-runner",
      dispatchStartedAt: null, leaseUntil: "2026-10-01T12:01:00Z", nextDueAt: "2026-10-01T12:00:00Z" } });
  }
  const original = structuredClone(rows);
  const store = { read: vi.fn(async key => structuredClone(rows.get(key))), list: vi.fn(() => { throw Error("broad_scan_forbidden"); }),
    compareAppend: vi.fn(async (key, id, state) => {
      if (rows.get(key).id !== id) return { applied: false };
      rows.set(key, { id: id + 100, state: structuredClone(state) }); return { applied: true };
    }) };
  const readAcknowledged = vi.fn(async key => structuredClone(history.get(key)));
  const options = { store, readAcknowledged, current, env, expectedHead, manifestSha256: CORRECTION_RECOVERY_MANIFEST_SHA256 };
  return { rows, history, original, store, readAcknowledged, options };
}

describe("exact reviewed 13-message correction recovery", () => {
  it("inspects only the fixed identities and emits counts without bodies, IDs or credentials", async () => {
    const f = await fixture(), result = await recoverNewsCorrections(f.options);
    expect(result).toMatchObject({ mode: "inspect", expected: 13, inspected: 13, eligible: 13, applied: 0, skipped: 0,
      externalPosts: 0, inferenceCalls: 0 });
    expect(f.store.compareAppend).not.toHaveBeenCalled(); expect(f.store.list).not.toHaveBeenCalled();
    expect(f.store.read.mock.calls.map(([key]) => key)).toEqual(manifest.jobKeys);
    expect(f.readAcknowledged.mock.calls.map(([key]) => key)).toEqual(manifest.jobKeys);
    const output = JSON.stringify(result);
    expect(output).not.toContain("Exact fixture"); expect(output).not.toContain("remoteId");
    expect(output).not.toContain(manifest.jobKeys[0]); expect(output).not.toContain(env.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("CAS requeues exactly13 corrections while retaining every remote, actor and acknowledgement field", async () => {
    const f = await fixture();
    const unrelated = "post:news:unreviewed-fourteenth:telegram:-100123";
    f.rows.set(unrelated, { id: 500, state: { status: "blocked", lastError: "telegram_request_rejected" } });
    const result = await recoverNewsCorrections({ ...f.options, apply: true });
    expect(result).toMatchObject({ mode: "apply", eligible: 13, applied: 13, conflicts: 0, skipped: 0 });
    expect(f.store.compareAppend).toHaveBeenCalledTimes(13);
    expect(f.store.list).not.toHaveBeenCalled();
    for (const key of manifest.jobKeys) {
      expect(f.rows.get(key).state).toEqual({ ...f.original.get(key).state, status: "correction_pending",
        nextDueAt: current.toISOString(), lastError: null, dispatchStartedAt: null, runnerId: null, leaseUntil: null, attemptId: null });
      expect(f.store.compareAppend.mock.calls.find(([candidate]) => candidate === key)[1]).toBe(f.original.get(key).id);
    }
    expect(f.rows.get(unrelated)).toEqual({ id: 500, state: { status: "blocked", lastError: "telegram_request_rejected" } });
    const again = await recoverNewsCorrections({ ...f.options, apply: true });
    expect(again).toMatchObject({ applied: 0, skipped: 13, reasons: { state_changed: 13 } });
    expect(f.store.compareAppend).toHaveBeenCalledTimes(13);
  });

  it.each([
    ["changed error", f => { f.rows.get(manifest.jobKeys[0]).state.lastError = "telegram_permission_denied"; }],
    ["unknown remote", f => { f.rows.get(manifest.jobKeys[0]).state.remoteId = null; }],
    ["different retained remote", f => { f.history.get(manifest.jobKeys[0]).state.remoteId = "999"; }],
    ["changed desired revision", f => { f.rows.get(manifest.jobKeys[0]).state.desiredRevision = "d".repeat(64); }],
    ["different prior text", f => { f.history.get(manifest.jobKeys[0]).state.prepared.textRevision = "d".repeat(64); }],
    ["different rendering profile", f => { f.history.get(manifest.jobKeys[0]).state.prepared.profile = "literary-news-photo-v1"; }],
    ["forged payload digest", f => { f.rows.get(manifest.jobKeys[0]).state.prepared.payload.text += " changed"; }],
    ["changed prior payload", f => { f.history.get(manifest.jobKeys[0]).state.prepared.payload.text += " changed"; }],
    ["started dispatch", f => { f.rows.get(manifest.jobKeys[0]).state.dispatchStartedAt = current.toISOString(); }],
    ["active lease", f => { f.rows.get(manifest.jobKeys[0]).state.leaseUntil = "2026-10-02T05:05:00Z"; }],
    ["withdrawal", f => { f.rows.get(manifest.jobKeys[0]).state.withdrawal = { reason: "Source correction" }; }],
  ])("skips %s while retaining the other12 reviewed identities", async (_name, mutate) => {
    const f = await fixture(); mutate(f);
    const result = await recoverNewsCorrections({ ...f.options, apply: true });
    expect(result).toMatchObject({ eligible: 12, applied: 12, skipped: 1 });
    expect(f.store.compareAppend.mock.calls.map(([key]) => key)).not.toContain(manifest.jobKeys[0]);
  });

  it("does not refresh or overwrite a concurrent acknowledgement after CAS conflict", async () => {
    const f = await fixture(), append = f.store.compareAppend.getMockImplementation();
    f.store.compareAppend.mockImplementation(async (...args) => {
      if (args[0] !== manifest.jobKeys[0]) return append(...args);
      f.rows.set(args[0], { id: 999, state: { ...f.rows.get(args[0]).state, status: "sent_current", acknowledgedUnchanged: true } });
      return { applied: false };
    });
    expect(await recoverNewsCorrections({ ...f.options, apply: true })).toMatchObject({ applied: 12, conflicts: 1 });
    expect(f.store.read.mock.calls.filter(([key]) => key === manifest.jobKeys[0])).toHaveLength(1);
    expect(f.rows.get(manifest.jobKeys[0]).state.status).toBe("sent_current");
  });

  it("stops on quota failure without attempting later mutations or provider requests", async () => {
    const f = await fixture(); f.store.compareAppend.mockRejectedValueOnce(Error("runtime_quota_exceeded"));
    await expect(recoverNewsCorrections({ ...f.options, apply: true })).rejects.toThrow("runtime_quota_exceeded");
    expect(f.store.read).toHaveBeenCalledTimes(1); expect(f.store.compareAppend).toHaveBeenCalledTimes(1);
  });

  it.each([
    { manifestSha256: undefined }, { manifestSha256: "0".repeat(64) }, { expectedHead: "b".repeat(40) },
    { env: { ...env, GITHUB_REF: "refs/heads/other" } }, { env: { ...env, GITHUB_ACTIONS: "false" } },
    { env: { ...env, GITHUB_REPOSITORY: "another/repository" } },
    { reviewedManifest: { ...manifest, jobKeys: [...manifest.jobKeys, "post:news:fourteenth:telegram:-100123"] } },
    { reviewedManifest: { ...manifest, jobKeys: [manifest.jobKeys[0], ...manifest.jobKeys.slice(0, 12)] } },
  ])("rejects an unapproved application before any reads", async overrides => {
    const f = await fixture();
    await expect(recoverNewsCorrections({ ...f.options, apply: true, ...overrides })).rejects.toThrow();
    expect(f.store.read).not.toHaveBeenCalled(); expect(f.store.compareAppend).not.toHaveBeenCalled();
  });

  it("rejects another Supabase project before using the injected client", async () => {
    const client = { from: vi.fn(), rpc: vi.fn() };
    await expect(runCorrectionRecovery({ args: [], env: { ...env, SUPABASE_URL: "https://other-project.supabase.co" }, supabase: client }))
      .rejects.toThrow("recovery_credentials_or_project_invalid");
    expect(client.from).not.toHaveBeenCalled(); expect(client.rpc).not.toHaveBeenCalled();
  });

  it("workflow is main-only, explicit, preparation-only and does not load Telegram or AI secrets", async () => {
    const text = await readFile(new URL("../.github/workflows/recover-literary-news-corrections.yml", import.meta.url), "utf8");
    const workflow = YAML.parse(text), job = workflow.jobs.recover;
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(text).toContain('"$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq \'.sha\')" == "$EXPECTED_MAIN_SHA"');
    expect(text).toContain("recover-13-corrections"); expect(text).toContain("--manifest-sha256");
    expect(text).not.toContain("TELEGRAM_BOT_TOKEN"); expect(text).not.toContain("CLOUDFLARE");
    expect(text).not.toContain("publish-literary-news"); expect(text).not.toContain("--send");
  });
});
