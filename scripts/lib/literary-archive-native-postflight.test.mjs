import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNativeArchiveReadSql, createNativeArchiveReadClient, executeNativeArchiveRead,
  parseNativeArchiveReadOutput, validateNativeArchiveWorkflowReceipt } from "./literary-archive-native-postflight.mjs";
import { postflightEnvelope, postflightIdentity, postflightPrecondition, postflightReceipt }
  from "../database/fixtures/literary-archive-native-postflight.mjs";

const env = { SUPABASE_DB_URL: "postgresql://fixture-secret@db.invalid/postgres", VITE_SUPABASE_URL: "https://fixture.invalid" };
const options = { env, identity: postflightIdentity, temporaryRoot: tmpdir() };
const parse = value => parseNativeArchiveReadOutput(JSON.stringify(value), "postflight", postflightReceipt, postflightIdentity);
afterEach(() => vi.unstubAllGlobals());

describe("native read-only archive verification", () => {
  it("accepts the exact existing seven-field assertion and rejects drift in every field", () => {
    expect(parse(postflightEnvelope)).toEqual(postflightEnvelope);
    const changes = { releaseId: "10000000-0000-4000-8000-000000000002", committedManifestSha256: "9".repeat(64),
      unlockedWorks: 2, childEditPreservation: { ...postflightReceipt.childEditPreservation, auditHighWaterId: "867" },
      liveTargetManifestSha256: "invalid", predecessorPublic: 68, predecessorPublicManifestSha256: "9".repeat(64) };
    for (const [field, value] of Object.entries(changes)) {
      expect(() => parse({ ...postflightEnvelope, result: { ...postflightEnvelope.result, [field]: value } }), field).toThrow();
    }
    expect(() => parse({ ...postflightEnvelope, result: { ...postflightEnvelope.result, extra: true } })).toThrow();
  });

  it("rejects mutable or user contexts and loss of current public Evidence V2 protection", () => {
    for (const [field, value] of Object.entries({ readOnly: false, isolation: "read committed", role: "postgres",
      authRole: "authenticated", uid: "10000000-0000-4000-8000-000000000001", statementTimeoutMs: 0, lockTimeoutMs: 0 })) {
      expect(() => parse({ ...postflightEnvelope, context: { ...postflightEnvelope.context, [field]: value } }), field).toThrow();
    }
    for (const [field, value] of Object.entries({ enforcementEnabled: false, invalidAttestationCount: 1,
      predecessorPublicCount: 68, controlsRlsForced: false, attestationsRlsForced: false, rpcOnlyEvidenceWrites: false,
      canonRegistryVersion: "stale", validatorVersion: "stale", policyCount: 6, invalidationTriggerCount: 6 })) {
      expect(() => parse({ ...postflightEnvelope, health: { ...postflightEnvelope.health, [field]: value } }), field).toThrow();
    }
  });

  it("accepts only fixed read operations, exact receipt fields and bounded JSON output", () => {
    expect(validateNativeArchiveWorkflowReceipt(postflightReceipt)).toBe(postflightReceipt);
    for (const operation of ["commit", "apply", "select 1", ""]) expect(() => buildNativeArchiveReadSql(operation, {})).toThrow();
    expect(() => buildNativeArchiveReadSql("precondition", { sql: "select 1" })).toThrow();
    expect(() => validateNativeArchiveWorkflowReceipt({ ...postflightReceipt, extra: true })).toThrow();
    expect(() => validateNativeArchiveWorkflowReceipt({ ...postflightReceipt, releaseId: "'; select 1 --" })).toThrow();
    for (const stdout of ["SET\n{}", " ".repeat(128 * 1024 + 1), "null"]) {
      expect(() => parseNativeArchiveReadOutput(stdout, "postflight", postflightReceipt, postflightIdentity)).toThrow();
    }
    const sql = buildNativeArchiveReadSql("postflight", postflightReceipt, postflightIdentity);
    expect(sql).toContain("set transaction isolation level repeatable read read only;");
    expect(sql).toContain("public.assert_literary_archive_live_target(");
    expect(sql).not.toContain("public.commit_literary_archive_release(");
  });

  it("executes one fixed native read, keeps credentials out of arguments and removes temporary files", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    let input;
    const execute = vi.fn(async (_binary, args, settings) => {
      expect(args[1]).toBe("verify-production"); input = args[2];
      expect(args.join(" ")).not.toContain("fixture-secret");
      expect(settings.timeout).toBe(330000);
      expect(settings.env.SUPABASE_URL).toBe(env.VITE_SUPABASE_URL);
      expect(await readFile(input, "utf8")).toContain("set transaction isolation level repeatable read read only;");
      await writeFile(args[3], JSON.stringify(postflightEnvelope));
    });
    expect(await executeNativeArchiveRead("postflight", postflightReceipt, { ...options, execute })).toEqual(postflightEnvelope);
    expect(execute).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
    await expect(readFile(input)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("routes only the precondition RPC natively and preserves prototype-based RPC delegation", async () => {
    class Client { calls = []; rpc(name, args) { this.calls.push({ name, args }); return { data: "rest", error: null }; } }
    const source = new Client();
    const execute = vi.fn(async (_binary, args) => writeFile(args[3], JSON.stringify({ ...postflightEnvelope,
      operation: "precondition", result: postflightPrecondition, health: null })));
    const client = createNativeArchiveReadClient(source, { ...options, execute });
    expect(await client.rpc("get_literary_archive_release_precondition", {})).toEqual({ data: postflightPrecondition, error: null });
    expect(source.calls).toEqual([]); expect(execute).toHaveBeenCalledTimes(1);
    expect(await client.rpc("stage_literary_archive_release_batch", { batch: 1 })).toEqual({ data: "rest", error: null });
    expect(source.calls).toEqual([{ name: "stage_literary_archive_release_batch", args: { batch: 1 } }]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("fails once without REST fallback or credential-bearing native diagnostics", async () => {
    const rpc = vi.fn(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const execute = vi.fn().mockRejectedValue(Object.assign(new Error("fixture-secret"), { stderr: "fixture-secret row values" }));
    const result = await createNativeArchiveReadClient({ rpc }, { ...options, execute }).rpc("get_literary_archive_release_precondition", {});
    expect(result.data).toBeNull(); expect(result.error.message).not.toContain("fixture-secret");
    expect(result.error.cause).toBeUndefined(); expect(execute).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    await expect(executeNativeArchiveRead("precondition", {}, { ...options, env: {}, execute })).rejects.toThrow("SUPABASE_DB_URL");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("surfaces only the native SQLSTATE when timeout diagnostics contain credentials or row values", async () => {
    const rpc = vi.fn();
    const execute = vi.fn().mockRejectedValue(Object.assign(new Error("fixture-secret"), {
      stderr: "psql:/tmp/read.sql:42: ERROR: 57014\nconnection fixture-secret; private row values\n",
    }));
    const result = await createNativeArchiveReadClient({ rpc }, { ...options, execute })
      .rpc("get_literary_archive_release_precondition", {});
    expect(result.data).toBeNull();
    expect(result.error.sqlState).toBe("57014");
    expect(result.error.message).toContain("SQLSTATE 57014");
    expect(result.error.message).not.toMatch(/fixture-secret|private row|psql:|read\.sql/u);
    expect(result.error.cause).toBeUndefined();
    expect(result.error.stderr).toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});
