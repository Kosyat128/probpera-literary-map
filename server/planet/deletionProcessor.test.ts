import { describe, expect, it, vi } from "vitest";
import { createReaderDeletionProcessor, validateReaderDeletionPolicy, type ReaderDeletionServices, type ReaderDeletionPolicy } from "./deletionProcessor";
import { createSupabaseReaderDeletionServices } from "./deletionProcessorSupabase";

const subject = "13e2f102-3f70-45dd-b57c-9e4e9c692d85";
const requestId = "de6e359d-8ba2-42f0-bb3e-5c965c057328";
const policy: ReaderDeletionPolicy = { version: "test-only-unreviewed", reviewEvidenceSha256: "a".repeat(64),
  privateReaderData: "delete", ownedAvatars: "delete", publicContributions: "block", paymentRecords: "retain-provider-records-unlinked" };
const state = (override: Record<string, unknown> = {}) => ({ phase: "fenced", subject, blockers: [], objects: [], objectCount: 0, ...override });
function fixture() {
  const services: ReaderDeletionServices = {
    claim: vi.fn(async () => ({ status: "claimed" })), inspect: vi.fn(async () => state()),
    prepare: vi.fn(async () => state({ phase: "auth-ready" })),
    finish: vi.fn(async (lease, status) => ({ requestId: lease.requestId, status })),
    removeAvatars: vi.fn(async () => {}), deleteAuthUser: vi.fn(async () => {}),
  };
  return { services, processor: createReaderDeletionProcessor({ services, policy, leaseSeconds: 60, maxStorageBatches: 2 }) };
}
describe("strict reader deletion state machine", () => {
  it.each([
    { ...policy, approved: true }, { ...policy, reviewEvidenceSha256: "approved" }, { ...policy, privateReaderData: "retain" },
    { ...policy, publicContributions: "delete" }, { ...policy, paymentRecords: "anonymize" }, { ...policy, version: "\nsecret" },
  ])("rejects unsupported policy semantics and fabricated approval flags", value => {
    expect(() => validateReaderDeletionPolicy(value)).toThrow("Invalid reader deletion policy");
  });
  it.each([[0, 2], [601, 2], [60, 0], [60, 11], [60.5, 2]])("requires bounded explicit processing limits %s/%s", (leaseSeconds, maxStorageBatches) => {
    expect(() => createReaderDeletionProcessor({ services: fixture().services, policy, leaseSeconds, maxStorageBatches })).toThrow();
  });
  it("keeps policy digest stable after caller mutation and never sends the approval document", async () => {
    const { services } = fixture();
    const input = { ...policy };
    const processor = createReaderDeletionProcessor({ services, policy: input, leaseSeconds: 60, maxStorageBatches: 1 });
    input.version = "changed";
    await processor.process(requestId); await processor.process(requestId);
    const calls = vi.mocked(services.claim).mock.calls;
    expect(calls[0][1]).toMatch(/^[0-9a-f]{64}$/u); expect(calls[1][1]).toBe(calls[0][1]);
    expect(calls[0][0].leaseToken).not.toBe(calls[1][0].leaseToken);
    expect(JSON.stringify(calls)).not.toContain("reviewEvidenceSha256");
  });
  it.each([
    state({ subject: null }), state({ phase: "auth-deleted" }), state({ phase: "auth-deleted", subject: null, objectCount: 1 }),
    state({ objects: [`${subject}/../other/avatar.webp`], objectCount: 1 }),
    state({ objects: ["00000000-0000-4000-8000-000000000001/avatar.webp"], objectCount: 1 }),
    state({ objects: [`${subject}/avatar.webp`], objectCount: 0 }), state({ blockers: ["error\nsecret"] }), state({ extra: true }),
  ])("denies malformed, contradictory or out-of-scope ledger inspection", async value => {
    const { services, processor } = fixture(); vi.mocked(services.inspect).mockResolvedValue(value);
    expect((await processor.process(requestId)).status).toBe("retry"); expect(services.removeAvatars).not.toHaveBeenCalled();
    expect(services.deleteAuthUser).not.toHaveBeenCalled(); expect(services.finish).not.toHaveBeenCalled();
  });
  it("does not trust a subject switch while preparing Auth deletion", async () => {
    const { services, processor } = fixture(); vi.mocked(services.prepare).mockResolvedValue(state({ phase: "auth-ready", subject: requestId }));
    expect((await processor.process(requestId)).status).toBe("retry"); expect(services.deleteAuthUser).not.toHaveBeenCalled();
  });
  it("does not expose upstream errors or complete when Auth says success but SQL disagrees", async () => {
    const { services, processor } = fixture(); vi.mocked(services.deleteAuthUser).mockRejectedValue(new Error("SECRET service key and personal email"));
    expect(await processor.process(requestId)).toEqual({ status: "retry", codes: ["auth-delete-unconfirmed"] }); expect(services.finish).not.toHaveBeenCalled();
  });
  it("does not resume side effects after cancellation while a storage read is pending", async () => {
    const { services, processor } = fixture(), controller = new AbortController();
    vi.mocked(services.inspect).mockImplementation(async () => { controller.abort(); return state({ objects: [`${subject}/avatar.webp`], objectCount: 1 }); });
    expect(await processor.process(requestId, controller.signal)).toEqual({ status: "retry", codes: ["interrupted"] });
    expect(services.removeAvatars).not.toHaveBeenCalled(); expect(services.deleteAuthUser).not.toHaveBeenCalled();
  });
  it("does not record completion when cancelled after committed Auth delete; later lease can reconcile", async () => {
    const { services, processor } = fixture(), controller = new AbortController();
    vi.mocked(services.deleteAuthUser).mockImplementation(async () => { controller.abort(); });
    expect(await processor.process(requestId, controller.signal)).toEqual({ status: "retry", codes: ["interrupted"] }); expect(services.finish).not.toHaveBeenCalled();
  });
  it("requires a durable exact completion response", async () => {
    const { services, processor } = fixture(); vi.mocked(services.inspect).mockResolvedValue(state({ phase: "auth-deleted", subject: null }));
    vi.mocked(services.finish).mockResolvedValue({ requestId: subject, status: "completed" });
    expect((await processor.process(requestId)).status).toBe("retry"); expect(services.deleteAuthUser).not.toHaveBeenCalled();
  });
  it("requires explicit service origin/key and rejects Storage traversal before any network", async () => {
    const fetcher = vi.fn();
    for (const canonicalProjectUrl of ["http://canonical.test", "https://canonical.test/path", "https://user:pass@canonical.test"]) {
      expect(() => createSupabaseReaderDeletionServices({ canonicalProjectUrl, serviceRoleKey: "fixture-server-key", fetch: fetcher })).toThrow();
    }
    const services = createSupabaseReaderDeletionServices({ canonicalProjectUrl: "https://canonical.test", serviceRoleKey: "fixture-server-key", fetch: fetcher });
    await expect(services.removeAvatars(subject, [`${subject}/../avatar.webp`])).rejects.toThrow();
    await expect(services.deleteAuthUser("../admin")).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
});
