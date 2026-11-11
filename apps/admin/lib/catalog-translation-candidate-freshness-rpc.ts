import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { PremiumTranslationDraftError } from "./premium-translation-working-draft";

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const bindingShape = {
  entityType: z.enum(["literary_work", "country"]), entityId: z.string().min(1).max(481),
  draftId: uuid, draftVersion: z.number().int().positive().safe(), candidateHash: hash, sourceHash: hash,
};
const bindingSchema = z.object(bindingShape).strict().refine(value =>
  value.entityType !== "literary_work" || uuid.safeParse(value.entityId).success);
const receiptSchema = z.object({ version: z.literal(1), ...bindingShape,
  linked: z.boolean(), canPromote: z.boolean(),
  reason: z.enum(["candidate_missing", "candidate_changed", "source_changed"]).nullable(),
}).strict().refine(value => value.canPromote === (value.reason === null));
const inputSchema = z.object({ ...bindingShape, catalogSourceHash: hash.nullable(),
  catalogSourceFields: z.record(z.string(), z.unknown()).nullable(),
}).strict().refine(value => value.entityType === "country"
  ? value.catalogSourceHash !== null && value.catalogSourceFields !== null
  : uuid.safeParse(value.entityId).success && value.catalogSourceHash === null && value.catalogSourceFields === null);

export type CatalogTranslationCandidateFreshnessBinding = z.infer<typeof bindingSchema>;
export type CatalogTranslationCandidateFreshnessReceipt = z.infer<typeof receiptSchema>;

/** Only a bound server receipt can attest current or unlinked legacy work. */
export function parseCatalogTranslationCandidateFreshnessReceipt(value: unknown, binding: CatalogTranslationCandidateFreshnessBinding) {
  const expected = bindingSchema.safeParse(binding), receipt = receiptSchema.safeParse(value);
  if (!expected.success || !receipt.success) return null;
  const actual = receipt.data;
  if (actual.entityType !== expected.data.entityType || actual.entityId !== expected.data.entityId ||
    actual.draftId.toLowerCase() !== expected.data.draftId.toLowerCase() || actual.draftVersion !== expected.data.draftVersion ||
    actual.candidateHash !== expected.data.candidateHash || actual.sourceHash !== expected.data.sourceHash) return null;
  return actual;
}

export async function readCatalogTranslationCandidateFreshness(client: SupabaseClient,
  input: CatalogTranslationCandidateFreshnessBinding & { catalogSourceHash: string | null; catalogSourceFields: Record<string, unknown> | null }) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new PremiumTranslationDraftError("unconfirmed");
  const request = parsed.data;
  try {
    const response = await client.rpc("get_catalog_translation_candidate_freshness", {
      p_entity_type: request.entityType, p_entity_id: request.entityId, p_draft_id: request.draftId,
      p_expected_version: request.draftVersion, p_candidate_hash: request.candidateHash, p_source_hash: request.sourceHash,
      p_catalog_source_hash: request.catalogSourceHash, p_catalog_source_fields: request.catalogSourceFields,
    });
    unstable_rethrow(response?.error);
    if (response?.error) throw new PremiumTranslationDraftError("unavailable");
    const receipt = parseCatalogTranslationCandidateFreshnessReceipt(response?.data, {
      entityType: request.entityType, entityId: request.entityId, draftId: request.draftId,
      draftVersion: request.draftVersion, candidateHash: request.candidateHash, sourceHash: request.sourceHash,
    });
    if (!receipt) throw new PremiumTranslationDraftError("unconfirmed");
    return receipt;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof PremiumTranslationDraftError) throw error;
    throw new PremiumTranslationDraftError("unavailable");
  }
}
