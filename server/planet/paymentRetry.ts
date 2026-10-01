import type { VerifiedPayment } from "./api";

/** Code-only server capability. No HTTP route, scheduler or provider is activated. */
export interface PaymentRetryLease { provider: string; eventId: string; leaseToken: string }
export interface PaymentRetryServices {
  claim(leaseToken: string, leaseSeconds: number, signal?: AbortSignal): Promise<unknown>;
  applyPayment(provider: string, event: VerifiedPayment, payloadSha256: string): Promise<void>;
  complete(lease: PaymentRetryLease, signal?: AbortSignal): Promise<unknown>;
  reschedule(lease: PaymentRetryLease, failureCode: "payment-apply-unavailable" | "payment-completion-unavailable", retrySeconds: number, signal?: AbortSignal): Promise<unknown>;
}
export interface PaymentRetryResult { status: "empty" | "completed" | "retry"; codes: string[] }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const timestamp = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/u.test(value) && Number.isFinite(Date.parse(value));
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
function claimed(value: unknown, leaseToken: string): { lease: PaymentRetryLease; event: VerifiedPayment; payloadSha256: string } | null {
  if (plain(value) && exact(value, ["status"]) && value.status === "empty") return null;
  if (!plain(value) || !exact(value, ["status", "provider", "eventId", "payloadSha256", "transactionId", "subject", "product", "paymentStatus", "occurredAt", "leaseToken", "leaseUntil", "attempts"])
    || value.status !== "claimed" || typeof value.provider !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(value.provider)
    || ![value.eventId, value.transactionId].every(id => typeof id === "string" && /^[A-Za-z0-9:._/-]{1,240}$/u.test(id))
    || typeof value.subject !== "string" || !uuid.test(value.subject) || typeof value.product !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value.product)
    || typeof value.paymentStatus !== "string" || !["active", "refunded", "revoked"].includes(value.paymentStatus) || !timestamp(value.occurredAt) || !timestamp(value.leaseUntil)
    || value.leaseToken !== leaseToken || typeof value.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.payloadSha256)
    || !Number.isSafeInteger(value.attempts) || (value.attempts as number) < 1) throw new Error("Invalid payment retry claim");
  const event: VerifiedPayment = Object.freeze({ eventId: value.eventId as string, transactionId: value.transactionId as string,
    subject: value.subject, product: value.product, status: value.paymentStatus as VerifiedPayment["status"], occurredAt: value.occurredAt });
  return { lease: Object.freeze({ provider: value.provider, eventId: event.eventId, leaseToken }), event, payloadSha256: value.payloadSha256 };
}
export function createPaymentRetryProcessor(options: { services: PaymentRetryServices; leaseSeconds: number; retrySeconds: number; crypto?: Pick<Crypto, "randomUUID"> }): {
  /** One due job per explicit invocation. SQL's server clock owns lease expiry. */
  drain(signal?: AbortSignal): Promise<PaymentRetryResult>;
} {
  if (!Number.isInteger(options.leaseSeconds) || options.leaseSeconds < 30 || options.leaseSeconds > 600
    || !Number.isInteger(options.retrySeconds) || options.retrySeconds < 1 || options.retrySeconds > 86400) throw new Error("Invalid payment retry bounds");
  const crypto = options.crypto ?? globalThis.crypto;
  if (!crypto?.randomUUID) throw new Error("Server cryptography unavailable");
  const active = (signal?: AbortSignal) => { if (signal?.aborted) throw new Error("Payment retry interrupted"); };
  return {
    async drain(signal) {
      let job: ReturnType<typeof claimed> = null;
      let failureCode: "payment-apply-unavailable" | "payment-completion-unavailable" = "payment-apply-unavailable";
      try {
        active(signal);
        const token = crypto.randomUUID(); if (!uuid.test(token)) throw new Error("Invalid payment retry lease token");
        job = claimed(await options.services.claim(token, options.leaseSeconds, signal), token);
        if (!job) return { status: "empty", codes: [] };
        active(signal);
        // This is the existing idempotent ledger authority. An interrupted or
        // lost reply can still have committed; a later retry uses the same IDs/hash.
        await options.services.applyPayment(job.lease.provider, job.event, job.payloadSha256);
        failureCode = "payment-completion-unavailable"; active(signal);
        const result = await options.services.complete(job.lease, signal);
        if (!plain(result) || !exact(result, ["status"]) || result.status !== "completed") throw new Error("Invalid payment retry completion");
        return { status: "completed", codes: [] };
      } catch {
        if (signal?.aborted) return { status: "retry", codes: ["interrupted"] };
        if (!job) return { status: "retry", codes: ["claim-unavailable"] };
        try {
          const result = await options.services.reschedule(job.lease, failureCode, options.retrySeconds, signal);
          if (!plain(result) || !exact(result, ["status", "nextAttemptAt"]) || result.status !== "pending" || !timestamp(result.nextAttemptAt)) throw new Error("Invalid payment retry reschedule");
          return { status: "retry", codes: [failureCode] };
        } catch {
          // Expired/replaced tokens cannot finish or reschedule. The server-held
          // lease will expire and another explicit drain can safely retry.
          return { status: "retry", codes: ["lease-or-queue-unavailable"] };
        }
      }
    },
  };
}
