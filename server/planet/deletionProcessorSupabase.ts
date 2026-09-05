import { createClient } from "@supabase/supabase-js";
import { deletionUuid, isOwnedAvatar, type ReaderDeletionServices } from "./deletionProcessor";

/** Explicit server credentials for the SAME canonical Supabase project. */
export function createSupabaseReaderDeletionServices(options: {
  canonicalProjectUrl: string;
  serviceRoleKey: string;
  fetch?: typeof fetch;
}): ReaderDeletionServices {
  const origin = new URL(options.canonicalProjectUrl);
  if (origin.origin !== options.canonicalProjectUrl || origin.protocol !== "https:" || origin.username || origin.password
    || typeof options.serviceRoleKey !== "string" || options.serviceRoleKey.length < 11 || options.serviceRoleKey.length > 8192
    || /[\s\u0000-\u001f]/u.test(options.serviceRoleKey)) throw new Error("Invalid canonical deletion service configuration");
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("Server fetch unavailable");
  function client(signal?: AbortSignal) {
    const scopedFetch: typeof fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.origin !== origin.origin || url.username || url.password) throw new Error("Deletion service origin mismatch");
      const signals = [signal, init?.signal, AbortSignal.timeout(10_000)].filter((value): value is AbortSignal => !!value);
      return fetcher(input, { ...init, signal: AbortSignal.any(signals), redirect: "error", cache: "no-store" });
    };
    return createClient(options.canonicalProjectUrl, options.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: scopedFetch },
    });
  }
  async function rpc(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const { data, error, status } = await client(signal).rpc(name, args);
    if (error || status !== 200) throw new Error("Deletion ledger unavailable");
    return data;
  }
  return {
    claim(lease, policySha256, leaseSeconds, signal) {
      return rpc("planet_claim_reader_deletion", { p_request_id: lease.requestId, p_lease_token: lease.leaseToken,
        p_policy_sha256: policySha256, p_lease_seconds: leaseSeconds }, signal);
    },
    inspect(lease, signal) {
      return rpc("planet_inspect_reader_deletion", { p_request_id: lease.requestId, p_lease_token: lease.leaseToken, p_prepare: false }, signal);
    },
    prepare(lease, signal) {
      return rpc("planet_inspect_reader_deletion", { p_request_id: lease.requestId, p_lease_token: lease.leaseToken, p_prepare: true }, signal);
    },
    finish(lease, status, evidenceSha256, blockers, signal) {
      return rpc("planet_finish_reader_deletion", { p_request_id: lease.requestId, p_lease_token: lease.leaseToken,
        p_status: status, p_evidence_sha256: evidenceSha256, p_blocker_codes: blockers }, signal);
    },
    async removeAvatars(subject, paths, signal) {
      if (!deletionUuid.test(subject) || paths.length < 1 || paths.length > 100 || new Set(paths).size !== paths.length
        || paths.some(path => !isOwnedAvatar(subject, path))) throw new Error("Invalid reader avatar cleanup scope");
      const { error } = await client(signal).storage.from("avatars").remove(paths);
      if (error) throw new Error("Reader storage cleanup unavailable");
    },
    async deleteAuthUser(subject, signal) {
      if (!deletionUuid.test(subject)) throw new Error("Invalid reader deletion subject");
      const { data, error } = await client(signal).auth.admin.deleteUser(subject, false);
      if (error || data.user?.id !== subject) throw new Error("Canonical Auth deletion unconfirmed");
    },
  };
}
