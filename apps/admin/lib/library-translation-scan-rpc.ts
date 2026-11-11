import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { parseCatalogTranslationOperationReceipt, type CatalogTranslationConfiguration,
  type CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";
import type { TranslationErrorCode } from "./translation-errors";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";

const uuid = z.string().uuid(), hash = z.string().regex(/^[a-f0-9]{64}$/u);
const jobVersion = z.string().regex(/^[1-9][0-9]{0,18}$/u).refine(value => BigInt(value) <= 9223372036854775807n);
const member = z.object({ itemId: uuid, position: z.number().int().min(0).max(499), workId: uuid,
  status: z.enum(["reviewing", "succeeded", "conflict", "stale", "skipped", "not-configured", "dead_letter", "cancelled"]),
}).strict();
const receiptSchema = z.object({
  version: z.literal(1), scanId: uuid, jobId: uuid, jobVersion, actorId: uuid, kind: z.literal("literary_work"),
  provider: z.enum(["cloudflare", "openai"]),
  status: z.enum(["reviewing", "completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured", "cancelling", "cancelled"]),
  configurationHash: hash, windowIndex: z.number().int().nonnegative().safe(), predecessorJobId: uuid.nullable(), successorJobId: uuid.nullable(),
  upperId: uuid.nullable(), afterId: uuid.nullable(), lastId: uuid.nullable(), membershipHash: hash,
  totalItems: z.number().int().min(0).max(500), nextPosition: z.number().int().min(0).max(500),
  lastWindow: z.boolean(), exhausted: z.boolean(), members: z.array(member).max(500),
  child: z.object({ binding: z.enum(["attached", "observed-blocked"]), initialProviderCalls: z.number().int().min(0).max(4), receipt: z.unknown() }).strict().nullable(),
  replayed: z.boolean(), transition: z.enum(["created", "read", "attached", "advanced", "zero-call-held", "held", "successor", "exhausted"]),
  blockReason: z.enum(["child_pending", "child_owned_by_another_actor", "child_attached_to_another_scan", "scan_stopped", "window_complete"]).nullable(),
}).strict();
export type LibraryTranslationScanMember = z.infer<typeof member>;
export type LibraryTranslationScanReceipt = Omit<z.infer<typeof receiptSchema>, "child"> & {
  child: null | { binding: "attached" | "observed-blocked"; initialProviderCalls: number; receipt: CatalogTranslationOperationReceipt };
};
export type LibraryTranslationScanObservation = {
  version: 1; type: "free"; state: "manual" | "current" | "review-pending" | "stale" | "skipped" | "failed";
  reason: null | "source_missing" | "ineligible" | "existing_candidate" | "database_read_failed"; sourceHash: string | null;
} | { version: 1; type: "child-terminal" };
const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Fixed membership and explicit end; a numeric ordinal never selects live rows. */
export function parseLibraryTranslationScanReceipt(value: unknown): LibraryTranslationScanReceipt | null {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (r.totalItems !== r.members.length || r.nextPosition > r.totalItems ||
    r.windowIndex * 500 + r.totalItems > 999_999_999 ||
    (r.windowIndex === 0) !== (r.predecessorJobId === null) ||
    (r.windowIndex === 0) !== sameUuid(r.scanId, r.jobId) ||
    (r.predecessorJobId !== null && sameUuid(r.predecessorJobId, r.jobId)) ||
    (r.successorJobId !== null && sameUuid(r.successorJobId, r.jobId)) ||
    (r.exhausted && (!r.lastWindow || r.nextPosition !== r.totalItems || r.child !== null || r.successorJobId !== null)) ||
    (r.upperId === null && (r.totalItems !== 0 || r.afterId !== null || r.lastId !== null)) ||
    (r.afterId !== null && (r.upperId === null || r.afterId.toLowerCase() > r.upperId.toLowerCase())) ||
    new Set(r.members.map(value => value.itemId.toLowerCase())).size !== r.totalItems) return null;
  let previous = r.afterId?.toLowerCase() ?? null;
  for (let index = 0; index < r.members.length; index++) {
    const value = r.members[index], key = value.workId.toLowerCase();
    if (value.position !== index || r.upperId === null || key > r.upperId.toLowerCase() ||
      (previous !== null && key <= previous) ||
      (index < r.nextPosition ? value.status === "reviewing" : value.status !== "reviewing")) return null;
    previous = key;
  }
  if (r.members.length > 0 && (r.lastId === null || previous !== r.lastId.toLowerCase())) return null;
  let child: LibraryTranslationScanReceipt["child"] = null;
  if (r.child !== null) {
    const current = r.members[r.nextPosition];
    if (!current) return null;
    const receipt = parseCatalogTranslationOperationReceipt(r.child.receipt, { entityType: "literary_work", entityId: current.workId });
    if (!receipt || receipt.canExecute || receipt.canDispatch || receipt.providerCalls < r.child.initialProviderCalls ||
      (r.child.binding === "attached" && (r.child.initialProviderCalls !== 0 || !sameUuid(receipt.actorId, r.actorId) ||
        receipt.provider !== r.provider || receipt.configurationHash !== r.configurationHash ||
        !samePremiumTranslationJson(receipt.resumeCursor, { libraryCursor: r.windowIndex * 500 + r.nextPosition +
          (receipt.phase === "finished" && !(receipt.providerCalls === 0 && receipt.result?.state === "skipped") ? 1 : 0) })))) return null;
    child = { ...r.child, receipt };
  }
  return { ...r, child };
}

export class LibraryTranslationScanRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly databaseCode: string | null = null) {
    super(errorCode); this.name = "LibraryTranslationScanRpcError";
  }
}
function fault(error?: { code?: unknown } | null) {
  const code = typeof error?.code === "string" && error.code.trim() ? error.code : null;
  return new LibraryTranslationScanRpcError(code === "PGRST202" || code === "42883" ? "translation_migration_required"
    : code === "40001" || code === "P0002" ? "translation_resume_stale"
      : code === "42501" ? "translation_retry_blocked" : code === "22023" ? "invalid_input" : "translation_scan_unconfirmed", code);
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  try {
    const response = await client.rpc(name, args);
    unstable_rethrow(response?.error);
    if (response?.error) throw fault(response.error);
    const receipt = parseLibraryTranslationScanReceipt(response?.data);
    if (!receipt) throw fault();
    return receipt;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof LibraryTranslationScanRpcError) throw error;
    throw fault();
  }
}
function bound(receipt: LibraryTranslationScanReceipt, parent: LibraryTranslationScanReceipt) {
  if (!sameUuid(receipt.scanId, parent.scanId) || !sameUuid(receipt.jobId, parent.jobId) ||
    !sameUuid(receipt.actorId, parent.actorId) || receipt.provider !== parent.provider || receipt.configurationHash !== parent.configurationHash ||
    receipt.windowIndex !== parent.windowIndex || receipt.predecessorJobId !== parent.predecessorJobId ||
    receipt.upperId !== parent.upperId || receipt.afterId !== parent.afterId || receipt.lastId !== parent.lastId ||
    receipt.membershipHash !== parent.membershipHash || receipt.totalItems !== parent.totalItems ||
    receipt.members.some((value, index) => !sameUuid(value.itemId, parent.members[index].itemId) || !sameUuid(value.workId, parent.members[index].workId))) throw fault();
  return receipt;
}
export async function beginLibraryTranslationScan(client: SupabaseClient, scanId: string, configuration: CatalogTranslationConfiguration) {
  const receipt = await rpc(client, "begin_library_translation_scan", { p_scan_id: scanId, p_configuration: configuration });
  if (!sameUuid(receipt.scanId, scanId) || receipt.provider !== configuration.provider) throw fault();
  return receipt;
}
export async function getLibraryTranslationScan(client: SupabaseClient, jobId: string) {
  const receipt = await rpc(client, "get_library_translation_scan", { p_job_id: jobId });
  if (!sameUuid(receipt.jobId, jobId)) throw fault();
  return receipt;
}
export async function attachLibraryTranslationScanOperation(client: SupabaseClient, parent: LibraryTranslationScanReceipt,
  child: CatalogTranslationOperationReceipt, transitionId: string) {
  const current = parent.members[parent.nextPosition];
  if (!current) throw fault();
  const receipt = bound(await rpc(client, "attach_library_translation_scan_operation", {
    p_window_job_id: parent.jobId, p_expected_version: parent.jobVersion, p_item_id: current.itemId,
    p_operation_job_id: child.jobId, p_operation_item_id: child.itemId, p_operation_id: child.operationId,
    p_intent_hash: child.intentHash, p_transition_id: transitionId,
  }), parent);
  const attached = receipt.child?.receipt;
  if (receipt.nextPosition !== parent.nextPosition || receipt.child?.binding !== "attached" || !attached ||
    receipt.exhausted || receipt.successorJobId !== null || receipt.status !== "reviewing" ||
    receipt.transition !== "attached" || receipt.blockReason === "scan_stopped" ||
    !parseCatalogTranslationOperationReceipt(attached, child, child) || attached.rawSeedHash !== child.rawSeedHash ||
    attached.configurationHash !== child.configurationHash || !samePremiumTranslationJson(attached.configuration, child.configuration) ||
    !samePremiumTranslationJson(attached.sourceRevision, child.sourceRevision) || !samePremiumTranslationJson(attached.targetRevision, child.targetRevision) ||
    attached.phase !== "running" || attached.providerCalls !== 0 || attached.pendingCallId !== null) throw fault();
  return receipt;
}
export async function checkpointLibraryTranslationScanItem(client: SupabaseClient, parent: LibraryTranslationScanReceipt,
  transitionId: string, observation: LibraryTranslationScanObservation, operationId: string | null = null) {
  const current = parent.members[parent.nextPosition];
  if (!current) throw fault();
  const receipt = bound(await rpc(client, "checkpoint_library_translation_scan_item", {
    p_window_job_id: parent.jobId, p_expected_version: parent.jobVersion, p_item_id: current.itemId,
    p_transition_id: transitionId, p_observation: observation, p_operation_id: operationId,
  }), parent);
  const advanced = receipt.transition === "advanced" && receipt.nextPosition === parent.nextPosition + 1 &&
    receipt.child === null && receipt.members[parent.nextPosition]?.status !== "reviewing";
  const zeroHeld = receipt.transition === "zero-call-held" && receipt.nextPosition === parent.nextPosition && receipt.child === null;
  const held = receipt.transition === "held" && receipt.nextPosition === parent.nextPosition && receipt.blockReason !== null;
  if (!advanced && !zeroHeld && !held) throw fault();
  return receipt;
}
export async function continueLibraryTranslationScan(client: SupabaseClient, parent: LibraryTranslationScanReceipt,
  configuration: CatalogTranslationConfiguration) {
  const receipt = await rpc(client, "continue_library_translation_scan", {
    p_window_job_id: parent.jobId, p_expected_version: parent.jobVersion, p_configuration: configuration,
  });
  if (sameUuid(receipt.jobId, parent.jobId)) return bound(receipt, parent);
  if (!sameUuid(receipt.scanId, parent.scanId) || !sameUuid(receipt.actorId, parent.actorId) ||
    receipt.provider !== parent.provider || receipt.configurationHash !== parent.configurationHash ||
    receipt.predecessorJobId === null || !sameUuid(receipt.predecessorJobId, parent.jobId) || receipt.windowIndex !== parent.windowIndex + 1 ||
    receipt.upperId !== parent.upperId || receipt.afterId !== parent.lastId) throw fault();
  return receipt;
}
