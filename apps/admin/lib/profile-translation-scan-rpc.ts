// Strict metadata adapter for the bounded country/writer scan protocol.
// Existing paid receipts remain kind-specific and grant no scan dispatch rights.
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { catalogTranslationConfigurationSchema, parseCatalogTranslationOperationReceipt,
  type CatalogTranslationConfiguration, type CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";
import { writerTranslationConfigurationSchema, parseWriterTranslationOperationReceipt,
  type WriterTranslationConfiguration, type WriterTranslationOperationReceipt } from "./writer-translation-operation-rpc";
import { parseWriterBiographyCandidateIdentity, writerBiographyCandidateIdentity, samePremiumTranslationJson } from "./premium-translation-working-draft";
import type { TranslationErrorCode } from "./translation-errors";

export const PROFILE_SCAN_MAX_MEMBERS = 10_000;
export const PROFILE_SCAN_MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
export const PROFILE_SCAN_WINDOW_SIZE = 500;
export const PROFILE_SCAN_MAX_MARKER_BYTES = 64 * 1024;
export type ProfileTranslationScanKind = "writer" | "country";
const uuid = z.string().uuid(), hash = z.string().regex(/^[a-f0-9]{64}$/u);
const jobVersion = z.string().regex(/^[1-9][0-9]{0,18}$/u).refine(value => BigInt(value) <= 9_223_372_036_854_775_807n);
const countryId = z.string().min(1).max(120).refine(value => value === value.trim() && !/\p{Cc}/u.test(value));
const writerId = z.string().min(1).max(360);
const countryManifestMember = z.object({ countryId, catalogSourceHash: hash }).strict();
const writerManifestMember = z.object({ countryId, writerId, catalogSourceHash: hash }).strict().refine(value => {
  try { return parseWriterBiographyCandidateIdentity(writerBiographyCandidateIdentity(value.countryId, value.writerId)) !== null; }
  catch { return false; }
});
export type CountryProfileScanManifestMember = z.infer<typeof countryManifestMember>;
export type WriterProfileScanManifestMember = z.infer<typeof writerManifestMember>;
export type ProfileTranslationScanManifest = readonly CountryProfileScanManifestMember[] | readonly WriterProfileScanManifestMember[];
export type ProfileTranslationScanConfiguration = WriterTranslationConfiguration | CatalogTranslationConfiguration;

const itemStatus = z.enum(["reviewing", "succeeded", "conflict", "stale", "skipped", "not-configured", "dead_letter", "cancelled"]);
const itemBase = { itemId: uuid, position: z.number().int().min(0).max(499), entityId: z.string().min(1).max(481), catalogSourceHash: hash, status: itemStatus };
const countryMember = z.object({ ...itemBase, countryId }).strict();
const writerMember = z.object({ ...itemBase, countryId, writerId }).strict();
const child = z.object({ binding: z.enum(["attached", "observed-blocked"]), initialProviderCalls: z.number().int().min(0).max(4), receipt: z.unknown() }).strict().nullable();
const receiptBase = {
  version: z.literal(1), scanId: uuid, jobId: uuid, jobVersion, actorId: uuid, provider: z.enum(["cloudflare", "openai"]),
  status: z.enum(["reviewing", "completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured", "cancelling", "cancelled"]),
  configurationHash: hash, fullManifestHash: hash, membershipHash: hash,
  totalMembership: z.number().int().min(0).max(PROFILE_SCAN_MAX_MEMBERS),
  windowCount: z.number().int().min(1).max(PROFILE_SCAN_MAX_MEMBERS / PROFILE_SCAN_WINDOW_SIZE),
  windowIndex: z.number().int().min(0).max(PROFILE_SCAN_MAX_MEMBERS / PROFILE_SCAN_WINDOW_SIZE - 1),
  predecessorJobId: uuid.nullable(), successorJobId: uuid.nullable(),
  totalItems: z.number().int().min(0).max(500), nextPosition: z.number().int().min(0).max(500),
  lastWindow: z.boolean(), exhausted: z.boolean(), child,
  replayed: z.boolean(), transition: z.enum(["created", "read", "attached", "advanced", "zero-call-held", "held", "successor", "exhausted"]),
  blockReason: z.enum(["child_pending", "child_owned_by_another_actor", "child_attached_to_another_scan", "scan_stopped", "window_complete"]).nullable(),
};
const receiptSchema = z.discriminatedUnion("kind", [
  z.object({ ...receiptBase, kind: z.literal("country"), members: z.array(countryMember).max(500) }).strict(),
  z.object({ ...receiptBase, kind: z.literal("writer"), members: z.array(writerMember).max(500) }).strict(),
]);
type RawReceipt = z.infer<typeof receiptSchema>;
export type CountryProfileTranslationScanMember = z.infer<typeof countryMember>;
export type WriterProfileTranslationScanMember = z.infer<typeof writerMember>;
export type ProfileTranslationScanMember = CountryProfileTranslationScanMember | WriterProfileTranslationScanMember;
export type CountryProfileOperationReceipt = CatalogTranslationOperationReceipt & { entityType: "country";
  sourceRevision: Extract<CatalogTranslationOperationReceipt["sourceRevision"], { catalogSourceHash: string }> };
export type ProfileTranslationScanPaidReceipt = WriterTranslationOperationReceipt | CountryProfileOperationReceipt;
type ScanChild<T> = null | { binding: "attached" | "observed-blocked"; initialProviderCalls: number; receipt: T };
export type CountryProfileTranslationScanReceipt = Omit<Extract<RawReceipt, { kind: "country" }>, "child"> & { child: ScanChild<CountryProfileOperationReceipt> };
export type WriterProfileTranslationScanReceipt = Omit<Extract<RawReceipt, { kind: "writer" }>, "child"> & { child: ScanChild<WriterTranslationOperationReceipt> };
export type ProfileTranslationScanReceipt = CountryProfileTranslationScanReceipt | WriterProfileTranslationScanReceipt;
export type ProfileTranslationScanObservation = {
  version: 1; type: "free"; state: "manual" | "current" | "review-pending" | "stale" | "skipped" | "failed";
  reason: null | "source_missing" | "ineligible" | "existing_candidate" | "database_read_failed" | "catalog_changed"; sourceHash: string | null;
} | { version: 1; type: "child-terminal" };
const observationSchema = z.discriminatedUnion("type", [
  z.object({ version: z.literal(1), type: z.literal("free"), state: z.enum(["manual", "current", "review-pending", "stale", "skipped", "failed"]),
    reason: z.enum(["source_missing", "ineligible", "existing_candidate", "database_read_failed", "catalog_changed"]).nullable(), sourceHash: hash.nullable() }).strict()
    .refine(value => value.reason !== "catalog_changed" || value.state === "stale"),
  z.object({ version: z.literal(1), type: z.literal("child-terminal") }).strict(),
]);
const sameUuid = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const sameNullableUuid = (left: string | null, right: string | null) => left === null ? right === null : right !== null && sameUuid(left, right);
export const profileTranslationScanOrdinal = (receipt: ProfileTranslationScanReceipt) => receipt.windowIndex * PROFILE_SCAN_WINDOW_SIZE + receipt.nextPosition;

function memberIdentity(kind: ProfileTranslationScanKind, member: { countryId: string; writerId?: string }) {
  if (kind === "country") return member.countryId;
  if (member.writerId === undefined) throw new Error("Writer tuple missing");
  return writerBiographyCandidateIdentity(member.countryId, member.writerId);
}
function paidReceipt(kind: ProfileTranslationScanKind, member: ProfileTranslationScanMember, value: unknown): ProfileTranslationScanPaidReceipt | null {
  if (kind === "writer") {
    if (!("writerId" in member)) return null;
    return parseWriterTranslationOperationReceipt(value, { countryId: member.countryId, writerId: member.writerId });
  }
  const parsed = parseCatalogTranslationOperationReceipt(value, { entityType: "country", entityId: member.countryId });
  return parsed && parsed.entityType === "country" && "catalogSourceHash" in parsed.sourceRevision ? parsed as CountryProfileOperationReceipt : null;
}
function childCurrentCursor(receipt: ProfileTranslationScanPaidReceipt, parent: ProfileTranslationScanReceipt | RawReceipt) {
  const next = receipt.phase === "finished" && !(receipt.providerCalls === 0 && receipt.result?.state === "skipped");
  return { [parent.kind === "writer" ? "writerCursor" : "countryCursor"]: parent.windowIndex * 500 + parent.nextPosition + (next ? 1 : 0) };
}

/** Membership order is assigned once; no key sort/live ordinal selects a row. */
export function parseProfileTranslationScanReceipt(value: unknown): ProfileTranslationScanReceipt | null {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success) return null;
  const r = parsed.data, expectedWindows = Math.max(1, Math.ceil(r.totalMembership / 500));
  const expectedItems = Math.min(500, Math.max(0, r.totalMembership - r.windowIndex * 500));
  if (r.windowCount !== expectedWindows || r.windowIndex >= r.windowCount || r.totalItems !== expectedItems || r.totalItems !== r.members.length ||
    r.nextPosition > r.totalItems || r.lastWindow !== (r.windowIndex === r.windowCount - 1) ||
    (r.windowIndex === 0) !== (r.predecessorJobId === null) || (r.windowIndex === 0) !== sameUuid(r.scanId, r.jobId) ||
    (r.windowIndex === 1 && (r.predecessorJobId === null || !sameUuid(r.predecessorJobId, r.scanId))) ||
    (r.successorJobId === null) !== r.lastWindow ||
    (r.predecessorJobId !== null && sameUuid(r.predecessorJobId, r.jobId)) ||
    (r.successorJobId !== null && (sameUuid(r.successorJobId, r.jobId) || sameUuid(r.successorJobId, r.scanId))) ||
    (r.predecessorJobId !== null && r.successorJobId !== null && sameUuid(r.predecessorJobId, r.successorJobId)) ||
    (r.exhausted && (!r.lastWindow || r.nextPosition !== r.totalItems || r.child !== null || r.successorJobId !== null)) ||
    new Set(r.members.map(member => member.itemId.toLowerCase())).size !== r.totalItems) return null;
  const identities = new Set<string>();
  for (let index = 0; index < r.members.length; index++) {
    const member = r.members[index];
    let identity: string;
    try { identity = memberIdentity(r.kind, member); } catch { return null; }
    if (member.position !== index || member.entityId !== identity || identities.has(identity) ||
      (index < r.nextPosition ? member.status === "reviewing" : member.status !== "reviewing")) return null;
    identities.add(identity);
  }
  let selectedChild: ScanChild<ProfileTranslationScanPaidReceipt> = null;
  if (r.child !== null) {
    const member = r.members[r.nextPosition];
    if (!member) return null;
    const receipt = paidReceipt(r.kind, member, r.child.receipt);
    if (!receipt || receipt.canExecute || receipt.canDispatch || receipt.providerCalls < r.child.initialProviderCalls ||
      (r.child.binding === "attached" && (r.child.initialProviderCalls !== 0 || !sameUuid(receipt.actorId, r.actorId) || receipt.provider !== r.provider ||
        receipt.configurationHash !== r.configurationHash || receipt.sourceRevision.catalogSourceHash !== member.catalogSourceHash ||
        !samePremiumTranslationJson(receipt.resumeCursor, childCurrentCursor(receipt, r))))) return null;
    selectedChild = { ...r.child, receipt };
  }
  return { ...r, child: selectedChild } as ProfileTranslationScanReceipt;
}

export class ProfileTranslationScanRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly databaseCode: string | null = null) {
    super(errorCode); this.name = "ProfileTranslationScanRpcError";
  }
}
function fault(error?: { code?: unknown } | null) {
  const code = typeof error?.code === "string" && error.code.trim() ? error.code : null;
  return new ProfileTranslationScanRpcError(code === "PGRST202" || code === "42883" ? "translation_migration_required"
    : code === "40001" || code === "P0002" ? "translation_resume_stale" : code === "42501" ? "translation_retry_blocked"
      : code === "22023" ? "invalid_input" : "translation_scan_unconfirmed", code);
}
function invalid(): never { throw new ProfileTranslationScanRpcError("invalid_input"); }
function configurationForKind(kind: ProfileTranslationScanKind, value: ProfileTranslationScanConfiguration) {
  if (kind === "writer") { const result = writerTranslationConfigurationSchema.safeParse(value); return result.success ? result.data : invalid(); }
  const result = catalogTranslationConfigurationSchema.safeParse(value);
  return result.success && result.data.schemaName === "probpera_country_profile_translation" && result.data.maxOutputTokens === 12_000 ? result.data : invalid();
}
function manifestForKind(kind: ProfileTranslationScanKind, value: ProfileTranslationScanManifest) {
  const schema = kind === "writer" ? z.array(writerManifestMember).max(PROFILE_SCAN_MAX_MEMBERS) : z.array(countryManifestMember).max(PROFILE_SCAN_MAX_MEMBERS);
  const parsed = schema.safeParse(value);
  if (!parsed.success || new TextEncoder().encode(JSON.stringify(parsed.data)).length > PROFILE_SCAN_MAX_MANIFEST_BYTES) return invalid();
  const identities = parsed.data.map(member => memberIdentity(kind, member));
  if (new Set(identities).size !== parsed.data.length) return invalid();
  return parsed.data;
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  try {
    const response = await client.rpc(name, args);
    unstable_rethrow(response?.error);
    if (response?.error) throw fault(response.error);
    const receipt = parseProfileTranslationScanReceipt(response?.data);
    if (!receipt) throw fault();
    return receipt;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ProfileTranslationScanRpcError) throw error;
    throw fault();
  }
}
function bound(receipt: ProfileTranslationScanReceipt, parent: ProfileTranslationScanReceipt) {
  if (receipt.kind !== parent.kind || !sameUuid(receipt.scanId, parent.scanId) || !sameUuid(receipt.jobId, parent.jobId) ||
    !sameUuid(receipt.actorId, parent.actorId) || receipt.provider !== parent.provider || receipt.configurationHash !== parent.configurationHash ||
    receipt.fullManifestHash !== parent.fullManifestHash || receipt.membershipHash !== parent.membershipHash || receipt.totalMembership !== parent.totalMembership ||
    receipt.windowCount !== parent.windowCount || receipt.windowIndex !== parent.windowIndex || receipt.totalItems !== parent.totalItems ||
    !sameNullableUuid(receipt.predecessorJobId, parent.predecessorJobId) || !sameNullableUuid(receipt.successorJobId, parent.successorJobId) ||
    BigInt(receipt.jobVersion) < BigInt(parent.jobVersion) || receipt.members.some((member, index) => {
      const old = parent.members[index];
      return !sameUuid(member.itemId, old.itemId) || member.position !== old.position || member.entityId !== old.entityId || member.countryId !== old.countryId ||
        ("writerId" in member ? member.writerId : null) !== ("writerId" in old ? old.writerId : null) || member.catalogSourceHash !== old.catalogSourceHash;
    })) throw fault();
  return receipt;
}
export async function beginProfileTranslationScan(client: SupabaseClient, scanId: string, kind: ProfileTranslationScanKind,
  configuration: ProfileTranslationScanConfiguration, manifest: ProfileTranslationScanManifest) {
  if (!uuid.safeParse(scanId).success || kind !== "writer" && kind !== "country") return invalid();
  const config = configurationForKind(kind, configuration), members = manifestForKind(kind, manifest);
  const receipt = await rpc(client, "begin_profile_translation_scan", { p_scan_id: scanId, p_kind: kind, p_configuration: config, p_manifest: members });
  if (receipt.kind !== kind || !sameUuid(receipt.scanId, scanId) || !sameUuid(receipt.jobId, scanId) || receipt.windowIndex !== 0 ||
    receipt.provider !== config.provider || receipt.totalMembership !== members.length || receipt.totalItems !== Math.min(500, members.length) ||
    receipt.members.some((member, index) => member.entityId !== memberIdentity(kind, members[index]) || member.catalogSourceHash !== members[index].catalogSourceHash)) throw fault();
  return receipt;
}
export async function getProfileTranslationScan(client: SupabaseClient, jobId: string, kind: ProfileTranslationScanKind) {
  if (!uuid.safeParse(jobId).success || kind !== "writer" && kind !== "country") return invalid();
  const receipt = await rpc(client, "get_profile_translation_scan", { p_job_id: jobId });
  if (receipt.kind !== kind || !sameUuid(receipt.jobId, jobId)) throw fault();
  return receipt;
}
export async function attachProfileTranslationScanOperation(client: SupabaseClient, parent: ProfileTranslationScanReceipt,
  childReceipt: ProfileTranslationScanPaidReceipt, transitionId: string) {
  const member = parent.members[parent.nextPosition];
  if (!member || !uuid.safeParse(transitionId).success) return invalid();
  const selected = paidReceipt(parent.kind, member, childReceipt);
  if (!selected || !sameUuid(selected.actorId, parent.actorId) || selected.provider !== parent.provider || selected.configurationHash !== parent.configurationHash ||
    selected.sourceRevision.catalogSourceHash !== member.catalogSourceHash || selected.phase !== "running" || selected.providerCalls !== 0 || selected.pendingCallId !== null ||
    !samePremiumTranslationJson(selected.resumeCursor, childCurrentCursor(selected, parent))) throw fault();
  const receipt = bound(await rpc(client, "attach_profile_translation_scan_operation", {
    p_window_job_id: parent.jobId, p_expected_version: parent.jobVersion, p_item_id: member.itemId,
    p_operation_job_id: selected.jobId, p_operation_item_id: selected.itemId, p_operation_id: selected.operationId,
    p_intent_hash: selected.intentHash, p_transition_id: transitionId,
  }), parent);
  const attached = receipt.child?.receipt;
  if (receipt.nextPosition !== parent.nextPosition || receipt.child?.binding !== "attached" || !attached || receipt.exhausted || receipt.status !== "reviewing" ||
    receipt.transition !== "attached" || receipt.blockReason === "scan_stopped" || !sameUuid(attached.jobId, selected.jobId) || !sameUuid(attached.itemId, selected.itemId) ||
    !sameUuid(attached.operationId, selected.operationId) || attached.intentHash !== selected.intentHash || attached.sourceHash !== selected.sourceHash ||
    attached.configurationHash !== selected.configurationHash || !samePremiumTranslationJson(attached.configuration, selected.configuration) ||
    !samePremiumTranslationJson(attached.sourceRevision, selected.sourceRevision) || !samePremiumTranslationJson(attached.targetRevision, selected.targetRevision) ||
    ("rawSeedHash" in attached ? attached.rawSeedHash : null) !== ("rawSeedHash" in selected ? selected.rawSeedHash : null) ||
    attached.phase !== "running" || attached.providerCalls !== 0 || attached.pendingCallId !== null) throw fault();
  // The eager successor pointer may already exist on this unfinished window.
  return receipt;
}
export async function checkpointProfileTranslationScanItem(client: SupabaseClient, parent: ProfileTranslationScanReceipt,
  transitionId: string, observation: ProfileTranslationScanObservation, operationId: string | null = null) {
  const member = parent.members[parent.nextPosition];
  if (!member || !uuid.safeParse(transitionId).success || !observationSchema.safeParse(observation).success ||
    (observation.type === "free" ? operationId !== null : !uuid.safeParse(operationId).success || sameUuid(transitionId, operationId!))) return invalid();
  const receipt = bound(await rpc(client, "checkpoint_profile_translation_scan_item", {
    p_window_job_id: parent.jobId, p_expected_version: parent.jobVersion, p_item_id: member.itemId,
    p_transition_id: transitionId, p_observation: observation, p_operation_id: operationId,
  }), parent);
  const advanced = receipt.transition === "advanced" && receipt.nextPosition === parent.nextPosition + 1 && receipt.child === null && receipt.members[parent.nextPosition].status !== "reviewing";
  const zeroHeld = receipt.transition === "zero-call-held" && receipt.nextPosition === parent.nextPosition && receipt.child === null;
  const held = receipt.transition === "held" && receipt.nextPosition === parent.nextPosition && receipt.blockReason !== null;
  if (!advanced && !zeroHeld && !held) throw fault();
  return receipt;
}
export async function continueProfileTranslationScan(client: SupabaseClient, parent: ProfileTranslationScanReceipt, configuration: ProfileTranslationScanConfiguration) {
  const config = configurationForKind(parent.kind, configuration);
  const receipt = await rpc(client, "continue_profile_translation_scan", {
    p_window_job_id: parent.jobId, p_expected_version: parent.jobVersion, p_configuration: config,
  });
  if (sameUuid(receipt.jobId, parent.jobId)) {
    bound(receipt, parent);
    if (receipt.nextPosition !== parent.nextPosition) throw fault();
    return receipt;
  }
  if (parent.nextPosition !== parent.totalItems || parent.child !== null || parent.status === "cancelled" || parent.status === "cancelling" || parent.exhausted ||
    parent.successorJobId === null || !sameUuid(receipt.jobId, parent.successorJobId) || receipt.kind !== parent.kind || !sameUuid(receipt.scanId, parent.scanId) ||
    !sameUuid(receipt.actorId, parent.actorId) || receipt.provider !== parent.provider || receipt.configurationHash !== parent.configurationHash ||
    receipt.fullManifestHash !== parent.fullManifestHash || receipt.totalMembership !== parent.totalMembership || receipt.windowCount !== parent.windowCount ||
    receipt.predecessorJobId === null || !sameUuid(receipt.predecessorJobId, parent.jobId) || receipt.windowIndex !== parent.windowIndex + 1 || receipt.transition !== "successor") throw fault();
  return receipt;
}
