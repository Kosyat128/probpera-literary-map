import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import manifest from "./literary-news-correction-recovery-20261002.json" with { type: "json" };
import { createNewsRuntimeStore, newsSocialPayloadDigest } from "./lib/literary-news-social.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";

export const CORRECTION_RECOVERY_MANIFEST_SHA256 = "c14f0615dd24db5831b6031c42ef4edcfda5c6ad4cf47ddd47b847c2fa06d886";
const PROJECT_ORIGIN = "https://sjqejjmwpzfsczxdghvw.supabase.co";
const REPOSITORY = "Kosyat128/probpera-literary-map";
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validId = value => typeof value === "string" && /^[1-9]\d{0,14}$/.test(value) && Number.isSafeInteger(Number(value));
const fail = code => { throw Error(code); };

export async function validateCorrectionRecoveryManifest(value) {
  if (!value || Object.keys(value).sort().join(",") !== "jobKeys,schemaVersion,sourceRunId"
    || value.schemaVersion !== 1 || value.sourceRunId !== 36952852078 || !Array.isArray(value.jobKeys)
    || value.jobKeys.length !== 13 || new Set(value.jobKeys).size !== 13
    || value.jobKeys.some(key => typeof key !== "string" || key.length > 400
      || !/^post:news:[A-Za-z0-9_%.-]+:telegram:-100\d{1,13}$/.test(key))
    || await newsSocialPayloadDigest(value) !== CORRECTION_RECOVERY_MANIFEST_SHA256)
    fail("recovery_manifest_rejected");
  return value.jobKeys;
}

function authorizeApply({ apply, manifestSha256, expectedHead, env }) {
  if (!apply) return;
  if (manifestSha256 !== CORRECTION_RECOVERY_MANIFEST_SHA256) fail("recovery_manifest_guard_required");
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF !== "refs/heads/main"
    || !/^[a-f0-9]{40}$/.test(expectedHead || "") || env.GITHUB_SHA !== expectedHead
    || !/^[1-9]\d{0,14}$/.test(env.GITHUB_RUN_ID || "")) fail("recovery_main_invocation_required");
}

/** Every proof comes from the same retained remote identity; payloads never leave this process. */
export async function correctionRecoveryEligibility(key, currentRow, acknowledgedRow, current) {
  const state = currentRow?.state, prior = acknowledgedRow?.state;
  if (!Number.isSafeInteger(currentRow?.id) || currentRow.id < 1 || !state) return "missing_current_state";
  if (state.status !== "blocked" || state.lastError !== "telegram_request_rejected") return "state_changed";
  if (state.withdrawal != null || state.dispatchStartedAt != null
    || state.leaseUntil != null && (!Number.isFinite(Date.parse(state.leaseUntil)) || Date.parse(state.leaseUntil) > current.getTime()))
    return "active_or_withdrawn";
  const [, , encodedNewsId, platform, destinationId] = key.split(":");
  if (state.key !== key || state.newsId !== decodeURIComponent(encodedNewsId) || state.destination?.platform !== platform
    || state.destination?.id !== destinationId || !validId(state.remoteId) || (state.remoteMediaKind ?? "text") !== "text")
    return "identity_unverified";
  if (!Number.isSafeInteger(acknowledgedRow?.id) || acknowledgedRow.id < 1 || acknowledgedRow.id >= currentRow.id
    || prior?.status !== "sent_current" || prior.key !== key || prior.newsId !== state.newsId
    || prior.destination?.platform !== platform || prior.destination?.id !== destinationId || prior.remoteId !== state.remoteId
    || (prior.remoteMediaKind ?? "text") !== "text" || !hash(prior.acknowledgedRevision)
    || state.acknowledgedRevision !== prior.acknowledgedRevision) return "acknowledgement_unverified";
  const prepared = state.prepared, earlier = prior.prepared;
  if (prepared?.profile !== "literary-news-text-v1" || earlier?.profile !== prepared.profile
    || prepared.platform !== "telegram" || earlier.platform !== "telegram" || prepared.newsId !== state.newsId
    || earlier.newsId !== state.newsId || prepared.media != null || earlier.media != null
    || !hash(state.desiredRevision) || prepared.revision !== state.desiredRevision || earlier.revision !== prior.acknowledgedRevision
    || !hash(prepared.textRevision) || earlier.textRevision !== prepared.textRevision
    || !hash(prepared.payloadSha256) || earlier.payloadSha256 !== prepared.payloadSha256
    || !prepared.payload || !earlier.payload
    || await newsSocialPayloadDigest(prepared.payload) !== prepared.payloadSha256
    || await newsSocialPayloadDigest(earlier.payload) !== earlier.payloadSha256) return "payload_proof_changed";
  return null;
}

/** Thirteen exact reads and per-item CAS only. No journal scan, provider call, inference or dispatch. */
export async function recoverNewsCorrections({ store, readAcknowledged, reviewedManifest = manifest, apply = false,
  manifestSha256, expectedHead, env = process.env, current = new Date() }) {
  const keys = await validateCorrectionRecoveryManifest(reviewedManifest);
  authorizeApply({ apply, manifestSha256, expectedHead, env });
  if (!(current instanceof Date) || !Number.isFinite(current.getTime())) fail("recovery_clock_invalid");
  const result = { mode: apply ? "apply" : "inspect", manifestSha256: CORRECTION_RECOVERY_MANIFEST_SHA256,
    expected: 13, inspected: 0, eligible: 0, applied: 0, conflicts: 0, skipped: 0, reasons: {}, externalPosts: 0, inferenceCalls: 0 };
  for (const key of keys) {
    const row = await store.read(key), acknowledged = await readAcknowledged(key);
    result.inspected++;
    const reason = await correctionRecoveryEligibility(key, row, acknowledged, current);
    if (reason) { result.skipped++; result.reasons[reason] = (result.reasons[reason] || 0) + 1; continue; }
    result.eligible++;
    if (!apply) continue;
    const recovered = { ...row.state, status: "correction_pending", nextDueAt: current.toISOString(),
      dispatchStartedAt: null, runnerId: null, leaseUntil: null, attemptId: null, lastError: null };
    const saved = await store.compareAppend(key, row.id, recovered);
    if (saved.applied) result.applied++; else result.conflicts++; // Never refresh and blindly retry a conflict.
  }
  return result;
}

export async function runCorrectionRecovery({ args = process.argv.slice(2), env = process.env, supabase, current = new Date() } = {}) {
  let values;
  try { ({ values } = parseArgs({ args, options: { apply: { type: "boolean", default: false },
    "manifest-sha256": { type: "string" }, "expected-head": { type: "string" } }, strict: true, allowPositionals: false })); }
  catch { fail("recovery_arguments_invalid"); }
  await validateCorrectionRecoveryManifest(manifest);
  authorizeApply({ apply: values.apply, manifestSha256: values["manifest-sha256"], expectedHead: values["expected-head"], env });
  if (trustedSupabaseOrigin(env.SUPABASE_URL) !== PROJECT_ORIGIN || !env.SUPABASE_SERVICE_ROLE_KEY)
    fail("recovery_credentials_or_project_invalid");
  const client = supabase || createClient(PROJECT_ORIGIN, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const store = createNewsRuntimeStore(client);
  const readAcknowledged = async key => {
    const response = await client.from("admin_audit_log").select("id,metadata")
      .eq("entity_type", "literary_news_runtime").eq("entity_id", key).eq("metadata->>status", "sent_current")
      .not("metadata->>acknowledgedRevision", "is", null).order("id", { ascending: false }).limit(1);
    if (response.status === 402 || response.error?.code === "402") fail("runtime_quota_exceeded");
    if (response.error) fail("recovery_acknowledgement_read_failed");
    return response.data?.[0] ? { id: response.data[0].id, state: response.data[0].metadata } : { id: null, state: null };
  };
  return recoverNewsCorrections({ store, readAcknowledged, apply: values.apply,
    manifestSha256: values["manifest-sha256"], expectedHead: values["expected-head"], env, current });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let result;
  try { result = await runCorrectionRecovery(); }
  catch (error) { result = { status: "blocked", code: /^(?:recovery_|runtime_)[a-z_]+$/.test(error.message || "")
    ? error.message : "recovery_failed", externalPosts: 0, inferenceCalls: 0 }; process.exitCode = 1; }
  await mkdir(".tmp/news-correction-recovery", { recursive: true });
  await writeFile(".tmp/news-correction-recovery/result.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
