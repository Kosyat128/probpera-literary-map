import { describe, expect, it, vi } from "vitest";
import { parseReaderDeletionPolicyFile, runReaderDeletionCommand } from "./deletionProcessorCli";
import type { ReaderDeletionServices } from "./deletionProcessor";
const id = "de6e359d-8ba2-42f0-bb3e-5c965c057328";
const policy = JSON.stringify({ version: "local-fixture-only", reviewEvidenceSha256: "b".repeat(64), privateReaderData: "delete",
  ownedAvatars: "delete", publicContributions: "block", paymentRecords: "retain-provider-records-unlinked" });
const environment = { SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-credential" };
describe("explicit operator reader deletion command", () => {
  it("defaults to no transport/mutations even with complete credentials and request arguments", async () => {
    const createServices = vi.fn();
    expect(await runReaderDeletionCommand([], environment, { createServices })).toEqual({ mode: "dry-run", status: "dry-run", codes: ["no-transport-or-mutations"], requestId: null, policyVersion: null });
    expect((await runReaderDeletionCommand(["--request-id", id, "--policy", "fixture.json"], environment,
      { readPolicyFile: async () => policy, createServices })).status).toBe("dry-run");
    expect(createServices).not.toHaveBeenCalled();
  });
  it.each([["--execute"], ["--execute", "--request-id", id], ["--execute", "--unknown"], ["--execute", "--execute"],
    ["--request-id", "invalid"], ["--timeout-seconds", "0"], ["--timeout-seconds", "301"], ["--policy", "--execute"]])("fails closed on incomplete/unknown/duplicate arguments", async args => {
    const createServices = vi.fn();
    expect((await runReaderDeletionCommand(args, environment, { createServices })).status).toBe("invalid-command");
    expect(createServices).not.toHaveBeenCalled();
  });
  it.each([
    policy.replace('"version":', '"version":"overridden","version":'),
    policy.replace('"version":', '"\\u0076ersion":"overridden","version":'),
    policy.replace('"delete"', '{"action":"delete"}'), policy + " trailing", " ".repeat(4097),
  ])("rejects ambiguous/oversized policy files", source => {
    expect(() => parseReaderDeletionPolicyFile(source)).toThrow();
  });
  it("does not reflect the policy path, malformed contents or secret in structured failures", async () => {
    const result = await runReaderDeletionCommand(["--execute", "--request-id", id, "--policy", "private-personal-path.json"], environment,
      { readPolicyFile: async () => { throw Error("private-personal-path.json SECRET"); } });
    expect(JSON.stringify(result)).not.toMatch(/personal-path|SECRET|fixture-service-credential/u);
    expect(result.status).toBe("invalid-command");
  });
  it("requires actual configuration before composing the server SDK", async () => {
    const createServices = vi.fn();
    expect((await runReaderDeletionCommand(["--execute", "--request-id", id, "--policy", "fixture.json"], {},
      { readPolicyFile: async () => policy, createServices })).status).toBe("invalid-command"); expect(createServices).not.toHaveBeenCalled();
  });
  it("bounds transport waiting with an abort deadline and leaves the durable lease resumable", async () => {
    const services = {
      claim: vi.fn(async (_lease, _hash, _seconds, signal) => new Promise((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(Error("aborted")), { once: true });
      })),
    } as unknown as ReaderDeletionServices;
    const start = Date.now();
    const result = await runReaderDeletionCommand(["--execute", "--request-id", id, "--policy", "fixture.json", "--timeout-seconds", "1"], environment,
      { readPolicyFile: async () => policy, createServices: () => services });
    expect(result).toMatchObject({ mode: "execute", status: "retry", codes: ["interrupted"], requestId: id });
    expect(Date.now() - start).toBeLessThan(4000);
  });
});
