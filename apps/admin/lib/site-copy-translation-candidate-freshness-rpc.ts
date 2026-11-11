import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { PremiumTranslationDraftError } from "./premium-translation-working-draft";

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const bindingShape = {
  entityType: z.literal("site_copy"), entityId: uuid, draftId: uuid,
  draftVersion: z.number().int().positive().safe(), candidateHash: hash, sourceHash: hash,
};
const bindingSchema = z.object(bindingShape).strict();
const receiptSchema = z.object({
  version: z.literal(1), ...bindingShape, linked: z.boolean(), canPromote: z.boolean(),
  reason: z.enum(["candidate_missing", "candidate_changed", "source_changed"]).nullable(),
}).strict().refine(value => value.canPromote === (value.reason === null) &&
  (value.reason !== "source_changed" || value.linked) &&
  (value.reason !== "candidate_missing" || !value.linked));

export type SiteCopyTranslationCandidateFreshnessBinding = z.infer<typeof bindingSchema>;
export type SiteCopyTranslationCandidateFreshnessReceipt = z.infer<typeof receiptSchema>;

/** A bound metadata snapshot; the atomic CMS promotion guard remains final. */
export function parseSiteCopyTranslationCandidateFreshnessReceipt(
  value: unknown, binding: SiteCopyTranslationCandidateFreshnessBinding,
) {
  const expected = bindingSchema.safeParse(binding), receipt = receiptSchema.safeParse(value);
  if (!expected.success || !receipt.success) return null;
  const actual = receipt.data;
  // Exact legacy entity text is the existing pending/promote lookup identity.
  if (actual.entityId !== expected.data.entityId ||
    actual.draftId.toLowerCase() !== expected.data.draftId.toLowerCase() || actual.draftVersion !== expected.data.draftVersion ||
    actual.candidateHash !== expected.data.candidateHash || actual.sourceHash !== expected.data.sourceHash) return null;
  return actual;
}

export async function readSiteCopyTranslationCandidateFreshness(
  client: SupabaseClient, input: SiteCopyTranslationCandidateFreshnessBinding,
) {
  const parsed = bindingSchema.safeParse(input);
  if (!parsed.success) throw new PremiumTranslationDraftError("unconfirmed");
  const request = parsed.data;
  try {
    const response = await client.rpc("get_site_copy_translation_candidate_freshness", {
      p_entity_id: request.entityId, p_draft_id: request.draftId, p_expected_version: request.draftVersion,
      p_candidate_hash: request.candidateHash, p_source_hash: request.sourceHash,
    });
    unstable_rethrow(response?.error);
    if (response?.error) throw new PremiumTranslationDraftError("unavailable");
    const receipt = parseSiteCopyTranslationCandidateFreshnessReceipt(response?.data, request);
    if (!receipt) throw new PremiumTranslationDraftError("unconfirmed");
    return receipt;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof PremiumTranslationDraftError) throw error;
    throw new PremiumTranslationDraftError("unavailable");
  }
}
