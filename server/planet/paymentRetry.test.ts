import { describe, expect, it, vi } from "vitest";
import { createPaymentRetryProcessor } from "./paymentRetry";
import type { VerifiedPayment } from "./api";

const token = "c3e02b27-057b-487e-b4f3-6a3b749f9cfa";
function fixture() {
  const dto = { status: "claimed", provider: "fixture-provider", eventId: "event-1", payloadSha256: "a".repeat(64),
    transactionId: "transaction-1", subject: "b7d3c04e-a59a-4bda-8db4-4b2f8c573e74", product: "base-v1",
    paymentStatus: "active", occurredAt: "2026-10-01T12:00:00.000000Z", leaseToken: token,
    leaseUntil: "2026-10-01T12:01:00.000000Z", attempts: 1 };
  const services = {
    claim: vi.fn(async (_token: string, _seconds: number, _signal?: AbortSignal): Promise<unknown> => ({ ...dto })),
    applyPayment: vi.fn(async (_provider: string, _event: VerifiedPayment, _hash: string) => undefined),
    complete: vi.fn(async (): Promise<unknown> => ({ status: "completed" })),
    reschedule: vi.fn(async (): Promise<unknown> => ({ status: "pending", nextAttemptAt: "2026-10-01T12:00:05.000000Z" })),
  };
  const processor = createPaymentRetryProcessor({ services, leaseSeconds: 60, retrySeconds: 5, crypto: { randomUUID: () => token } });
  return { dto, services, processor };
}

// Controlled server ports prove processor boundaries. Actual SQL lease, ACL and
// ledger replay are covered separately by one-connection PGlite integration.
describe("explicit bounded verified-payment retry processor", () => {
  it("reschedules apply failure without acknowledgement or raw errors, then replays the same normalized event", async () => {
    const f = fixture(); f.services.applyPayment.mockRejectedValueOnce(new Error("private-provider-token"));
    expect(await f.processor.drain()).toEqual({ status: "retry", codes: ["payment-apply-unavailable"] });
    expect(f.services.complete).not.toHaveBeenCalled();
    expect(f.services.reschedule).toHaveBeenCalledWith({ provider: f.dto.provider, eventId: f.dto.eventId, leaseToken: token }, "payment-apply-unavailable", 5, undefined);
    expect(await f.processor.drain()).toEqual({ status: "completed", codes: [] });
    expect(f.services.applyPayment).toHaveBeenCalledTimes(2);
    expect(f.services.applyPayment.mock.calls[0]).toEqual(f.services.applyPayment.mock.calls[1]);
    expect(f.services.applyPayment.mock.calls[1]).toEqual([f.dto.provider, { eventId: f.dto.eventId, transactionId: f.dto.transactionId,
      subject: f.dto.subject, product: f.dto.product, status: f.dto.paymentStatus, occurredAt: f.dto.occurredAt }, f.dto.payloadSha256]);
    expect(Object.isFrozen(f.services.applyPayment.mock.calls[1][1])).toBe(true);
  });
  it("does not call an expired or replaced completion successful and leaves SQL authority to recover the job", async () => {
    const f = fixture(); f.services.complete.mockRejectedValue(new Error("PLANET_PAYMENT_RETRY_LEASE_INVALID"));
    f.services.reschedule.mockRejectedValue(new Error("PLANET_PAYMENT_RETRY_LEASE_INVALID"));
    expect(await f.processor.drain()).toEqual({ status: "retry", codes: ["lease-or-queue-unavailable"] });
    expect(f.services.applyPayment).toHaveBeenCalledTimes(1);
    expect(f.services.reschedule).toHaveBeenCalledWith({ provider: f.dto.provider, eventId: f.dto.eventId, leaseToken: token }, "payment-completion-unavailable", 5, undefined);
  });
  it("rejects contaminated claims and stops after interrupted apply without finishing or renewing the lease", async () => {
    const f = fixture();
    for (const value of [{ ...f.dto, rawBody: "private" }, { ...f.dto, paymentStatus: ["active"] }, { ...f.dto, leaseToken: crypto.randomUUID() }]) {
      f.services.claim.mockResolvedValueOnce(value);
      expect(await f.processor.drain()).toEqual({ status: "retry", codes: ["claim-unavailable"] });
    }
    expect(f.services.applyPayment).not.toHaveBeenCalled(); expect(f.services.reschedule).not.toHaveBeenCalled();
    const abort = new AbortController(); f.services.applyPayment.mockImplementationOnce(async () => { abort.abort(); });
    expect(await f.processor.drain(abort.signal)).toEqual({ status: "retry", codes: ["interrupted"] });
    expect(f.services.complete).not.toHaveBeenCalled(); expect(f.services.reschedule).not.toHaveBeenCalled();
    f.services.claim.mockResolvedValueOnce({ status: "empty" });
    expect(await f.processor.drain()).toEqual({ status: "empty", codes: [] });
    expect(f.services.applyPayment).toHaveBeenCalledTimes(1);
  });
});
