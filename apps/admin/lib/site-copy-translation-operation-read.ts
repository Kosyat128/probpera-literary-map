import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireStaffRead } from "./admin-read-access";
import {
  getSiteCopyTranslationOperationArtifacts, reconcileSiteCopyTranslationOperation,
  SiteCopyTranslationOperationRpcError, type SiteCopyTranslationOperationReceipt,
} from "./site-copy-translation-operation-rpc";
import type { TranslationErrorCode } from "./translation-errors";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";

export type SiteCopyOperationPreview = { key: string; source: string; text: string }[];
export type SiteCopyOperationRead =
  | { status: "success"; data: SiteCopyTranslationOperationReceipt | null; owned: boolean;
      preview: SiteCopyOperationPreview | null; previewUnconfirmed: boolean }
  | { status: "failed"; errorCode: TranslationErrorCode };

/** Metadata is independently readable; only the original actor may request bodies. */
export async function readSiteCopyTranslationOperation(
  supabase: SupabaseClient | null,
  selection: { operationId?: string; jobId?: string; includePreview?: boolean } = {},
): Promise<SiteCopyOperationRead> {
  if (selection.operationId !== undefined && !z.string().uuid().safeParse(selection.operationId).success ||
    selection.jobId !== undefined && !z.string().uuid().safeParse(selection.jobId).success) {
    return { status: "failed", errorCode: "invalid_input" };
  }
  const staff = await requireStaffRead();
  if (!staff?.user || !supabase) return { status: "failed", errorCode: "database_unavailable" };
  try {
    let receipt = await reconcileSiteCopyTranslationOperation(supabase, selection.operationId ?? null);
    if (selection.operationId !== undefined && (!receipt || receipt.operationId.toLowerCase() !== selection.operationId.toLowerCase()) ||
      selection.jobId !== undefined && (!receipt || receipt.jobId.toLowerCase() !== selection.jobId.toLowerCase())) {
      return { status: "failed", errorCode: "translation_retry_unconfirmed" };
    }
    const owned = receipt?.actorId.toLowerCase() === staff.user.id.toLowerCase();
    let preview: SiteCopyOperationPreview | null = null, previewUnconfirmed = false;
    if (selection.includePreview && receipt && owned && receipt.providerCalls > 0 && receipt.pendingCallId === null) {
      try {
        const artifact = await getSiteCopyTranslationOperationArtifacts(supabase, receipt);
        receipt = artifact.receipt;
        const { retainedSiteCopyTranslationCandidate } = await import("./auto-translate-site-copy-private");
        const candidate = await retainedSiteCopyTranslationCandidate(artifact);
        const parsed = z.object({ items: z.array(z.object({ key: z.string(), text: z.string() }).strict()) }).strict()
          .safeParse(candidate?.payload);
        const retainedMatches = (artifact.receipt.phase !== "finished" ||
          artifact.receipt.result?.candidateHash != null && artifact.candidate !== null) &&
          (artifact.candidate === null ? artifact.receipt.result?.candidateHash == null
            : samePremiumTranslationJson(artifact.candidate, candidate));
        if (retainedMatches && parsed.success && parsed.data.items.length === artifact.sourceSnapshot.items.length &&
          parsed.data.items.every((item, index) => item.key === artifact.sourceSnapshot.items[index]?.key)) {
          preview = parsed.data.items.map((item, index) => ({ ...item, source: artifact.sourceSnapshot.items[index].text }));
        } else previewUnconfirmed = true;
      } catch (error) { unstable_rethrow(error); previewUnconfirmed = true; }
    }
    return { status: "success", data: receipt, owned, preview, previewUnconfirmed };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "failed", errorCode: error instanceof SiteCopyTranslationOperationRpcError
      ? error.errorCode : "translation_retry_unconfirmed" };
  }
}
