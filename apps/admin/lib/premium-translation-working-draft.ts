import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const entityType = z.enum(["literary_work", "country"]);
const entityId = z.string().min(1).max(120);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const revisionSchema = z.object({ id: uuid.nullable(), updatedAt: timestamp.nullable() }).strict()
  .refine((value) => (value.id === null) === (value.updatedAt === null));

export const premiumTranslationTimelineSchema = z.object({
  year: z.string(), title: z.string(), description: z.string(),
}).strict();

export const premiumTranslationCountryFieldsSchema = z.object({
  name: z.string(), region: z.string(), continent: z.string(), officialLanguage: z.string(),
  capital: z.string(), description: z.string(), history: z.string(), historicalNote: z.string(),
  literaryPeriods: z.array(z.string()), literaryMovements: z.array(z.string()),
  periods: z.array(z.string()), facts: z.array(z.string()), literaryPlaces: z.array(z.string()),
  timeline: z.array(premiumTranslationTimelineSchema), chronology: z.array(premiumTranslationTimelineSchema),
}).strict();

const bookSourceSchema = z.object({
  russianTitle: z.string(), verifiedEnglishTitle: z.string(), verifiedEnglishTitleSourceUrl: z.string(),
  description: z.string(), originalTitle: z.string(), firstPublished: z.number().nullable(),
  originalLanguage: z.string(), sourceLanguage: z.string(), sourceUrls: z.array(z.string()),
}).strict();
const bookSourceRevisionSchema = z.object({
  workId: uuid, workUpdatedAt: timestamp, russianId: uuid, russianUpdatedAt: timestamp,
}).strict();
const countrySourceRevisionSchema = z.object({
  overrideId: uuid.nullable(), overrideUpdatedAt: timestamp.nullable(), catalogSourceHash: hash,
}).strict().refine((value) => (value.overrideId === null) === (value.overrideUpdatedAt === null));

const bookPayloadSchema = z.object({
  description: z.string().min(140).max(900), sourceLanguage: z.literal("Russian"),
  sourceUrls: z.array(z.string().regex(/^https:\/\//u)).min(1),
  bibliographicTitle: z.object({
    value: z.string().min(1).max(300), provider: z.string().min(1),
    sourceUrl: z.string().regex(/^https:\/\//u), retrievedAt: z.string().nullable(),
  }).strict(),
}).strict();
const countryPayloadSchema = z.object({ fields: premiumTranslationCountryFieldsSchema }).strict();
const provenanceSchema = z.object({
  provider: z.enum(["cloudflare", "openai"]), translatorModel: z.string().min(1).max(300),
  reviewerModel: z.string().min(1).max(300).nullable(),
  translatorRequestId: z.string().nullable(), reviewerRequestId: z.string().nullable(), generatedAt: timestamp,
}).strict();
const draftBase = {
  id: uuid, version, entityId, targetLocale: z.literal("en"), humanReview: z.literal("pending"),
  sourceHash: hash, candidateHash: hash, targetRevision: revisionSchema,
  provenance: provenanceSchema, createdAt: timestamp, createdBy: uuid,
};
export const premiumTranslationWorkingDraftSchema = z.discriminatedUnion("entityType", [
  z.object({ ...draftBase, entityType: z.literal("literary_work"),
    sourceRevision: bookSourceRevisionSchema, sourceSnapshot: bookSourceSchema, payload: bookPayloadSchema }).strict(),
  z.object({ ...draftBase, entityType: z.literal("country"),
    sourceRevision: countrySourceRevisionSchema, sourceSnapshot: premiumTranslationCountryFieldsSchema,
    payload: countryPayloadSchema }).strict(),
]).superRefine((draft, context) => {
  if (draft.entityType === "literary_work" &&
      (!uuid.safeParse(draft.entityId).success || draft.sourceRevision.workId !== draft.entityId ||
       draft.targetRevision.id === null || draft.targetRevision.updatedAt === null)) {
    context.addIssue({ code: "custom", message: "Book draft identity is inconsistent" });
  }
  if (draft.entityType === "country" &&
      (draft.sourceRevision.overrideId !== draft.targetRevision.id ||
       draft.sourceRevision.overrideUpdatedAt !== draft.targetRevision.updatedAt)) {
    context.addIssue({ code: "custom", message: "Country draft revision is inconsistent" });
  }
});

const readSchema = z.object({
  schemaVersion: z.literal(1), entityType, entityId, draft: premiumTranslationWorkingDraftSchema.nullable(),
}).strict();
const consumedBase = {
  schemaVersion: z.literal(1), entityType, entityId, draftId: uuid, version, candidateHash: hash,
};
const promotedSchema = z.object({ ...consumedBase, state: z.literal("promoted"),
  canonicalId: uuid, canonicalUpdatedAt: timestamp, reviewedBy: uuid, reviewedAt: timestamp }).strict();
const discardedSchema = z.object({ ...consumedBase, state: z.literal("discarded") }).strict();

export type PremiumTranslationEntityType = z.infer<typeof entityType>;
export type PremiumTranslationCountryFields = z.infer<typeof premiumTranslationCountryFieldsSchema>;
export type PremiumTranslationWorkingDraft = z.infer<typeof premiumTranslationWorkingDraftSchema>;
export type PremiumTranslationDraftRead = z.infer<typeof readSchema>;
export type PremiumTranslationDraftProvenance = z.infer<typeof provenanceSchema>;
export type PremiumTranslationDraftStage = PremiumTranslationWorkingDraft extends infer Draft
  ? Draft extends PremiumTranslationWorkingDraft
    ? Omit<Draft, "id" | "version" | "targetLocale" | "humanReview" | "candidateHash" | "createdAt" | "createdBy">
    : never
  : never;
export type PremiumTranslationCandidateOutcome = {
  humanReview: "pending";
  publication: "unchanged";
  translationPersistence: "working-draft";
  workingDraftId: string;
  workingDraftVersion: number;
  workingDraftHash: string;
};

export class PremiumTranslationDraftError extends Error {
  constructor(public readonly code: "unavailable" | "conflict" | "unconfirmed") {
    super(code === "conflict" ? "Translation source or draft changed concurrently"
      : code === "unconfirmed" ? "Private translation draft result is unconfirmed"
        : "Private translation drafts are unavailable");
    this.name = "PremiumTranslationDraftError";
  }
}

type Identity = { entityType: PremiumTranslationEntityType; entityId: string };
type ExpectedCandidate = Identity & { draftId: string; version: number; candidateHash: string };

function validIdentity(input: Identity) {
  return entityType.safeParse(input.entityType).success && entityId.safeParse(input.entityId).success &&
    (input.entityType !== "literary_work" || uuid.safeParse(input.entityId).success);
}

// SQL JSONB may reorder object keys; compare every value without altering text.
export function samePremiumTranslationJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => samePremiumTranslationJson(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) =>
    key === rightKeys[index] && samePremiumTranslationJson(
      (left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}

async function rpc(supabase: SupabaseClient, name: string, args: Record<string, unknown>) {
  try {
    const response = await supabase.rpc(name, args);
    unstable_rethrow(response?.error);
    if (!response || response.error) {
      throw new PremiumTranslationDraftError(response?.error?.code === "40001" ? "conflict" : "unavailable");
    }
    return response.data as unknown;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof PremiumTranslationDraftError) throw error;
    throw new PremiumTranslationDraftError("unavailable");
  }
}

function parseRead(value: unknown, identity: Identity): PremiumTranslationDraftRead {
  const parsed = readSchema.safeParse(value);
  if (!parsed.success || parsed.data.entityType !== identity.entityType || parsed.data.entityId !== identity.entityId ||
      (parsed.data.draft && (parsed.data.draft.entityType !== identity.entityType || parsed.data.draft.entityId !== identity.entityId))) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  return parsed.data;
}

export async function readPremiumTranslationWorkingDraft(supabase: SupabaseClient, identity: Identity) {
  if (!validIdentity(identity)) throw new PremiumTranslationDraftError("unconfirmed");
  return parseRead(await rpc(supabase, "get_premium_translation_working_draft", {
    p_entity_type: identity.entityType, p_entity_id: identity.entityId,
  }), identity).draft;
}

export async function stagePremiumTranslationWorkingDraft(supabase: SupabaseClient, input: PremiumTranslationDraftStage) {
  if (!validIdentity(input)) throw new PremiumTranslationDraftError("unconfirmed");
  const staged = parseRead(await rpc(supabase, "stage_premium_translation_working_draft", {
    p_entity_type: input.entityType, p_entity_id: input.entityId,
    p_source_hash: input.sourceHash, p_source_snapshot: input.sourceSnapshot,
    p_source_revision: input.sourceRevision, p_target_revision: input.targetRevision,
    p_payload: input.payload, p_provenance: input.provenance,
    p_expected_draft_id: null, p_expected_draft_version: 0,
  }), input).draft;
  if (!staged || !samePremiumTranslationJson(staged.sourceSnapshot, input.sourceSnapshot) ||
      !samePremiumTranslationJson(staged.sourceRevision, input.sourceRevision) ||
      !samePremiumTranslationJson(staged.targetRevision, input.targetRevision) ||
      !samePremiumTranslationJson(staged.payload, input.payload) ||
      !samePremiumTranslationJson(staged.provenance, input.provenance) || staged.sourceHash !== input.sourceHash) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  return staged;
}

function matchesConsumed(receipt: z.infer<typeof discardedSchema> | z.infer<typeof promotedSchema>, input: ExpectedCandidate) {
  return receipt.entityType === input.entityType && receipt.entityId === input.entityId &&
    receipt.draftId === input.draftId && receipt.version === input.version && receipt.candidateHash === input.candidateHash;
}

function consumeArgs(input: ExpectedCandidate) {
  if (!validIdentity(input) || !uuid.safeParse(input.draftId).success ||
      !version.safeParse(input.version).success || !hash.safeParse(input.candidateHash).success) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  return { p_entity_type: input.entityType, p_entity_id: input.entityId,
    p_draft_id: input.draftId, p_expected_version: input.version, p_candidate_hash: input.candidateHash };
}

export async function promotePremiumTranslationWorkingDraft(supabase: SupabaseClient,
  input: ExpectedCandidate & { sourceHash: string; catalogSourceHash: string | null;
    catalogSourceFields: Record<string, unknown> | null; actorId: string }) {
  const args = consumeArgs(input);
  if (!hash.safeParse(input.sourceHash).success || !uuid.safeParse(input.actorId).success ||
      (input.entityType === "country"
        ? !hash.safeParse(input.catalogSourceHash).success || !input.catalogSourceFields ||
          typeof input.catalogSourceFields !== "object" || Array.isArray(input.catalogSourceFields)
        : input.catalogSourceHash !== null || input.catalogSourceFields !== null)) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  const parsed = promotedSchema.safeParse(await rpc(supabase, "promote_premium_translation_working_draft", {
    ...args, p_source_hash: input.sourceHash, p_catalog_source_hash: input.catalogSourceHash,
    p_catalog_source_fields: input.catalogSourceFields, p_confirm_human_review: true,
  }));
  if (!parsed.success || !matchesConsumed(parsed.data, input) || parsed.data.reviewedBy !== input.actorId) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  return parsed.data;
}

export async function discardPremiumTranslationWorkingDraft(supabase: SupabaseClient, input: ExpectedCandidate) {
  const parsed = discardedSchema.safeParse(await rpc(supabase, "discard_premium_translation_working_draft", consumeArgs(input)));
  if (!parsed.success || !matchesConsumed(parsed.data, input)) throw new PremiumTranslationDraftError("unconfirmed");
  return parsed.data;
}

export function premiumTranslationCandidateOutcome(draft: PremiumTranslationWorkingDraft): PremiumTranslationCandidateOutcome {
  return { humanReview: "pending", publication: "unchanged", translationPersistence: "working-draft",
    workingDraftId: draft.id, workingDraftVersion: draft.version, workingDraftHash: draft.candidateHash };
}
