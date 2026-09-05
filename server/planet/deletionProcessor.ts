/** Server-only, explicitly invoked reader deletion. No scheduler or production policy defaults. */
export interface ReaderDeletionPolicy {
  version: string;
  reviewEvidenceSha256: string;
  privateReaderData: "delete";
  ownedAvatars: "delete";
  publicContributions: "block";
  paymentRecords: "retain-provider-records-unlinked";
}
export interface DeletionLease { requestId: string; leaseToken: string }
export interface DeletionInspection {
  phase: "fenced" | "auth-ready" | "auth-deleted";
  subject: string | null;
  blockers: string[];
  objects: string[];
  objectCount: number;
}
export type DeletionClaim = { status: "completed" | "busy" | "not-found" | "policy-conflict" }
  | { status: "claimed" };
export interface ReaderDeletionServices {
  claim(lease: DeletionLease, policySha256: string, leaseSeconds: number, signal?: AbortSignal): Promise<unknown>;
  inspect(lease: DeletionLease, signal?: AbortSignal): Promise<unknown>;
  prepare(lease: DeletionLease, signal?: AbortSignal): Promise<unknown>;
  finish(lease: DeletionLease, status: "blocked" | "completed", evidenceSha256: string, blockers: string[], signal?: AbortSignal): Promise<unknown>;
  removeAvatars(subject: string, paths: string[], signal?: AbortSignal): Promise<void>;
  deleteAuthUser(subject: string, signal?: AbortSignal): Promise<void>;
}
export type ReaderDeletionResult = { status: "completed" | "busy" | "not-found" | "retry" | "blocked"; codes: string[] };
export const deletionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const hashPattern = /^[0-9a-f]{64}$/u;
function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(",") === keys.sort().join(",");
}
export function validateReaderDeletionPolicy(value: unknown): ReaderDeletionPolicy {
  if (!plain(value) || !exact(value, ["version", "reviewEvidenceSha256", "privateReaderData", "ownedAvatars", "publicContributions", "paymentRecords"])
    || typeof value.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value.version)
    || typeof value.reviewEvidenceSha256 !== "string" || !hashPattern.test(value.reviewEvidenceSha256)
    || value.privateReaderData !== "delete" || value.ownedAvatars !== "delete" || value.publicContributions !== "block"
    || value.paymentRecords !== "retain-provider-records-unlinked") throw new Error("Invalid reader deletion policy");
  // A supplied evidence reference is configuration, not an assertion by this code
  // that a reviewer approved it. Provider identifiers remain correlatable by provider.
  return { version: value.version, reviewEvidenceSha256: value.reviewEvidenceSha256, privateReaderData: "delete",
    ownedAvatars: "delete", publicContributions: "block", paymentRecords: "retain-provider-records-unlinked" };
}
export function isOwnedAvatar(subject: string, path: string): boolean {
  return deletionUuid.test(subject) && ["jpg", "png", "webp"].some(extension => path === `${subject}/avatar.${extension}`);
}
function inspection(value: unknown): DeletionInspection {
  if (!plain(value) || !exact(value, ["phase", "subject", "blockers", "objects", "objectCount"])
    || !["fenced", "auth-ready", "auth-deleted"].includes(String(value.phase))
    || !(value.subject === null || typeof value.subject === "string" && deletionUuid.test(value.subject))
    || !Array.isArray(value.blockers) || value.blockers.length > 16 || value.blockers.some(code => typeof code !== "string" || !/^[a-z][a-z0-9._-]{0,63}$/u.test(code))
    || !Array.isArray(value.objects) || value.objects.length > 100 || new Set(value.objects).size !== value.objects.length
    || value.objects.some(path => typeof path !== "string" || value.subject === null || !isOwnedAvatar(value.subject as string, path))
    || !Number.isSafeInteger(value.objectCount) || (value.objectCount as number) < value.objects.length
    || (value.phase === "auth-deleted") !== (value.subject === null)
    || value.phase === "auth-deleted" && ((value.objectCount as number) !== 0 || value.blockers.length !== 0)) throw new Error("Invalid deletion inspection");
  return value as unknown as DeletionInspection;
}
export function createReaderDeletionProcessor(options: {
  services: ReaderDeletionServices; policy: ReaderDeletionPolicy | null; leaseSeconds: number; maxStorageBatches: number;
  crypto?: Crypto;
}): { process(requestId: string, signal?: AbortSignal): Promise<ReaderDeletionResult> } {
  if (!Number.isInteger(options.leaseSeconds) || options.leaseSeconds < 30 || options.leaseSeconds > 600
    || !Number.isInteger(options.maxStorageBatches) || options.maxStorageBatches < 1 || options.maxStorageBatches > 10) throw new Error("Invalid deletion processing bounds");
  const policy = options.policy === null ? null : validateReaderDeletionPolicy(options.policy);
  const crypto = options.crypto ?? globalThis.crypto;
  if (!crypto?.subtle || !crypto.randomUUID) throw new Error("Server cryptography unavailable");
  const services = options.services;
  async function sha(value: unknown): Promise<string> {
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)))), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  const policyHash = policy ? sha(policy) : null;
  return {
    async process(requestId, signal) {
      if (!deletionUuid.test(requestId)) throw new Error("Invalid deletion request identifier");
      if (!policyHash) return { status: "blocked", codes: ["reviewed-policy-required"] };
      const lease: DeletionLease = { requestId, leaseToken: crypto.randomUUID() };
      let removed = 0;
      const active = () => { if (signal?.aborted) throw new Error("Deletion processing interrupted"); };
      async function finish(status: "blocked" | "completed", codes: string[]): Promise<ReaderDeletionResult> {
        active();
        const evidence = await sha({ version: 1, requestId, policySha256: await policyHash, status, codes, removedObjects: removed });
        const result = await services.finish(lease, status, evidence, codes, signal);
        if (!plain(result) || !exact(result, ["requestId", "status"]) || result.requestId !== requestId || result.status !== status) throw new Error("Invalid deletion completion response");
        return { status, codes };
      }
      try {
        active();
        const claim = await services.claim(lease, await policyHash, options.leaseSeconds, signal);
        if (!plain(claim) || !exact(claim, ["status"]) || !["claimed", "completed", "busy", "not-found", "policy-conflict"].includes(String(claim.status))) throw new Error("Invalid deletion claim");
        if (claim.status === "policy-conflict") return { status: "blocked", codes: ["policy-conflict"] };
        if (claim.status !== "claimed") return { status: claim.status as "completed" | "busy" | "not-found", codes: [] };
        for (let batch = 0; ; batch++) {
          active();
          const state = inspection(await services.inspect(lease, signal));
          if (state.phase === "auth-deleted") return await finish("completed", []);
          if (state.blockers.length) return await finish("blocked", state.blockers);
          if (state.objectCount > 0) {
            if (batch >= options.maxStorageBatches || state.objects.length === 0) return { status: "retry", codes: ["storage-batch-budget"] };
            active();
            await services.removeAvatars(state.subject!, state.objects, signal);
            removed += state.objects.length;
            // Requery the first remaining page. HTTP success is not proof of absence.
            continue;
          }
          active();
          const prepared = inspection(await services.prepare(lease, signal));
          if (prepared.blockers.length) return await finish("blocked", prepared.blockers);
          if (prepared.phase === "auth-deleted") return await finish("completed", []);
          if (prepared.phase !== "auth-ready" || prepared.subject !== state.subject || prepared.objectCount !== 0) throw new Error("Auth deletion not prepared");
          active();
          // The database guard rechecks the fence inside Auth's deletion transaction.
          // A lost HTTP response may follow a committed delete; always reconcile SQL.
          try { await services.deleteAuthUser(prepared.subject!, signal); } catch { /* durable phase decides, never HTTP alone */ }
          active();
          const reconciled = inspection(await services.inspect(lease, signal));
          if (reconciled.phase === "auth-deleted") return await finish("completed", []);
          if (reconciled.blockers.length) return await finish("blocked", reconciled.blockers);
          return { status: "retry", codes: ["auth-delete-unconfirmed"] };
        }
      } catch {
        // Leases expire; a later explicit invocation safely resumes durable work.
        // No upstream error, credential, user identifier or storage path is returned.
        return { status: "retry", codes: [signal?.aborted ? "interrupted" : "processing-unavailable"] };
      }
    },
  };
}
