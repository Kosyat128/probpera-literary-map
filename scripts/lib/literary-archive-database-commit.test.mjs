import { describe, expect, it, vi } from "vitest";
import { createNativeArchiveCommitClient, parseNativeArchiveCommitReceipt } from "./literary-archive-database-commit.mjs";

const args = { p_release_id: "00000000-0000-4000-8000-000000000001", p_expected_manifest_sha256: "a".repeat(64) };
const receipt = { releaseId: args.p_release_id, manifestSha256: args.p_expected_manifest_sha256, status: "committed", items: 9762, idempotent: false };
const envelope = { transport: "native-postgres", elapsedMs: 9123, receipt };
const env = { SUPABASE_DB_URL: "postgres://fixture-secret@db.invalid/postgres", VITE_SUPABASE_URL: "https://fixture.supabase.co" };

describe("bounded native archive commit transport", () => {
  it("leaves all staging and read RPCs with their existing client", async () => {
    const result = { data: { status: "staging" }, error: null };
    const supabase = { rpc: vi.fn().mockResolvedValue(result) };
    const execute = vi.fn();
    const client = createNativeArchiveCommitClient(supabase, { env, execute });
    expect(await client.rpc("stage_literary_archive_release_batch", { batch: 1 })).toBe(result);
    expect(supabase.rpc).toHaveBeenCalledWith("stage_literary_archive_release_batch", { batch: 1 });
    expect(execute).not.toHaveBeenCalled();
  });

  it("runs one fixed command with two arguments and returns the original receipt for the full caller gate", async () => {
    const execute = vi.fn().mockResolvedValue({ stdout: JSON.stringify(envelope) + "\n" });
    const rpc = vi.fn();
    const logger = vi.fn();
    const client = createNativeArchiveCommitClient({ rpc }, { env, execute, logger });
    expect(await client.rpc("commit_literary_archive_release", args)).toEqual({ data: receipt, error: null });
    const [binary, commandArgs, options] = execute.mock.calls[0];
    expect(binary).toBe("bash");
    expect(commandArgs.slice(1)).toEqual(["commit-archive", args.p_release_id, args.p_expected_manifest_sha256]);
    expect(commandArgs.join(" ")).not.toContain("fixture-secret");
    expect(options.env.SUPABASE_URL).toBe(env.VITE_SUPABASE_URL);
    expect(options.timeout).toBeGreaterThan(320_000);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining("9123 ms"));
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { ...args, p_release_id: "'; select 1; --" },
    { ...args, p_expected_manifest_sha256: "a".repeat(63) },
    { ...args, arbitrary_sql: "select 1" },
    { ...args, p_release_id: [args.p_release_id] },
  ])("rejects noncanonical or additional command inputs before execution", async (input) => {
    const execute = vi.fn();
    const client = createNativeArchiveCommitClient({ rpc: vi.fn() }, { env, execute });
    expect((await client.rpc("commit_literary_archive_release", input)).error).toBeInstanceOf(Error);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    { ...envelope, receipt: { ...receipt, releaseId: "00000000-0000-4000-8000-000000000002" } },
    { ...envelope, receipt: { ...receipt, manifestSha256: "b".repeat(64) } },
    { ...envelope, receipt: { ...receipt, status: "staging" } },
    { ...envelope, elapsedMs: -1 },
    { ...envelope, extra: true },
  ])("refuses a receipt for another request or incomplete transaction", (value) => {
    expect(() => parseNativeArchiveCommitReceipt(JSON.stringify(value), args)).toThrow();
  });

  it("rejects malformed or excessive output and accepts a matching idempotent receipt", () => {
    expect(() => parseNativeArchiveCommitReceipt("SET\n" + JSON.stringify(envelope), args)).toThrow();
    expect(() => parseNativeArchiveCommitReceipt(" ".repeat(128 * 1024 + 1), args)).toThrow();
    expect(parseNativeArchiveCommitReceipt(JSON.stringify({ ...envelope, receipt: { ...receipt, idempotent: true } }), args).receipt.idempotent).toBe(true);
  });

  it("fails closed without a REST fallback or credential-bearing error details", async () => {
    const error = Object.assign(new Error("fixture-secret"), { stderr: "psql: ERROR:  57014\nfixture-secret", code: 3 });
    const execute = vi.fn().mockRejectedValue(error);
    const rpc = vi.fn();
    const result = await createNativeArchiveCommitClient({ rpc }, { env, execute }).rpc("commit_literary_archive_release", args);
    expect(result.data).toBeNull();
    expect(result.error.message).toContain("57014");
    expect(result.error.message).not.toContain("fixture-secret");
    expect(result.error.cause).toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires explicit database credentials before creating the native client", () => {
    expect(() => createNativeArchiveCommitClient({ rpc() {} }, { env: {} })).toThrow("SUPABASE_DB_URL");
  });
});
